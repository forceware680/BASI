// server.js — File API Microservice untuk SIMBASI BMD
// Menangani upload, streaming/viewer, dan penghapusan berkas scan bukti fisik.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
const API_KEY = process.env.API_KEY || ''; // Jika kosong, authentication dinonaktifkan (public)

// Pastikan direktori root upload ada
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[STORAGE] Direktori upload dibuat: ${UPLOAD_DIR}`);
}

// Middleware dasar
app.use(helmet({
  crossOriginResourcePolicy: false, // Memungkinkan akses gambar/PDF dari frontend Tauri
  crossOriginEmbedderPolicy: false,
  frameguard: false, // Memungkinkan embedding PDF/Image di iframe WebView
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware Autentikasi API Key (Opsional melalui ENV)
function authenticateApiKey(req, res, next) {
  if (!API_KEY) {
    return next(); // Tidak ada API_KEY yang diset, lewati autentikasi
  }

  const clientKey = req.headers['x-api-key'] || req.query.api_key;
  if (!clientKey || clientKey !== API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Header x-api-key atau parameter api_key tidak valid atau tidak disediakan.',
    });
  }
  next();
}

// Sanitasi nama file agar aman dari path traversal
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Konfigurasi Multer untuk penyimpanan disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const koreksiId = req.body.koreksi_id || req.query.koreksi_id || 'general';
    const sanitizedId = sanitizeFileName(koreksiId);
    const targetDir = path.join(UPLOAD_DIR, sanitizedId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const keepName =
      req.body.keep_name === 'true' ||
      req.query.keep_name === 'true' ||
      req.headers['x-keep-name'] === 'true';
    const cleanName = sanitizeFileName(file.originalname);
    if (keepName) {
      cb(null, cleanName);
    } else {
      const timestamp = Date.now();
      cb(null, `${timestamp}_${cleanName}`);
    }
  },
});

// Filter tipe file yang diizinkan (PDF & Gambar)
const fileFilter = (req, file, cb) => {
  const allowedMime = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',
  ];

  if (allowedMime.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpg|jpeg|png|webp|tif|tiff)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe berkas tidak didukung. Hanya PDF, JPG, PNG, WEBP, atau TIFF yang diperbolehkan.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Maksimal 50MB per berkas
  },
});

// ==========================================
// ROUTES & ENDPOINTS
// ==========================================

// 1. Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'simbasi-file-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    upload_dir: UPLOAD_DIR,
    auth_required: Boolean(API_KEY),
  });
});

// 2. Upload Berkas Bukti
app.post('/api/bukti/upload', authenticateApiKey, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada berkas yang diunggah.' });
    }

    const koreksiId = sanitizeFileName(req.body.koreksi_id || 'general');
    const filename = req.file.filename;
    const relPath = `bukti/${koreksiId}/${filename}`;
    
    // Protokol & Host untuk URL stream
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/api/bukti/${koreksiId}/${filename}`;

    console.log(`[UPLOAD] Berkas tersimpan: ${relPath} (${req.file.size} bytes)`);

    res.json({
      success: true,
      file_path: relPath,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      stored_filename: filename,
      koreksi_id: koreksiId,
      url: fileUrl,
      uploaded_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[UPLOAD ERROR]', err);
    res.status(500).json({ error: 'Gagal memproses berkas.', details: err.message });
  }
});

// 3. Streaming / Viewer Berkas Bukti (PDF / Gambar)
app.get('/api/bukti/:koreksi_id/:filename', (req, res) => {
  const koreksiId = sanitizeFileName(req.params.koreksi_id);
  const filename = sanitizeFileName(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, koreksiId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Berkas bukti tidak ditemukan.' });
  }

  // Tentukan content type
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// 4. Download Berkas Bukti sebagai Attachment
app.get('/api/bukti/download/:koreksi_id/:filename', (req, res) => {
  const koreksiId = sanitizeFileName(req.params.koreksi_id);
  const filename = sanitizeFileName(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, koreksiId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Berkas bukti tidak ditemukan.' });
  }

  res.download(filePath, filename);
});

// 5. Baca Berkas sebagai Base64 & Data URL (Memudahkan Viewer Frontend)
app.get('/api/bukti/base64/:koreksi_id/:filename', authenticateApiKey, (req, res) => {
  const koreksiId = sanitizeFileName(req.params.koreksi_id);
  const filename = sanitizeFileName(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, koreksiId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Berkas bukti tidak ditemukan.' });
  }

  try {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    res.json({
      mime_type: mimeType,
      data_url: dataUrl,
      base64: base64Data,
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal membaca berkas.', details: err.message });
  }
});

// 6. Hapus Berkas Bukti Fisik
app.delete('/api/bukti/:koreksi_id/:filename', authenticateApiKey, (req, res) => {
  const koreksiId = sanitizeFileName(req.params.koreksi_id);
  const filename = sanitizeFileName(req.params.filename);
  const folderPath = path.join(UPLOAD_DIR, koreksiId);
  const filePath = path.join(folderPath, filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`[DELETE] Berkas dihapus: ${filePath}`);

      // Hapus folder koreksi_id jika sudah kosong
      const remainingFiles = fs.readdirSync(folderPath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(folderPath);
      }

      return res.json({ success: true, message: 'Berkas berhasil dihapus.' });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal menghapus berkas.', details: err.message });
    }
  }

  res.status(404).json({ error: 'Berkas tidak ditemukan.' });
});

// Error handling global
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`  SIMBASI File API Service`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Upload Directory: ${UPLOAD_DIR}`);
  console.log(`  Auth Enabled: ${Boolean(API_KEY)}`);
  console.log('====================================================');
});
