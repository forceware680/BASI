// pgsql_daemon.rs — Deteksi cerdas & otomatisasi Portable PostgreSQL untuk komputer baru.
//
// 1. Jika PostgreSQL sudah aktif di port 5432 (standalone), gunakan yang sudah ada (non-destruktif).
// 2. Jika belum aktif, jalankan biner PostgreSQL portabel dari resource aplikasi.
// 3. Matikan daemon portabel secara aman saat aplikasi keluar.

use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Periksa apakah port lokal tertentu sedang terbuka / aktif.
pub fn is_port_open(port: u16) -> bool {
    let addr: SocketAddr = format!("127.0.0.1:{port}").parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

/// Cari lokasi folder binari PostgreSQL portabel (resource bundle atau lokal).
fn find_pgsql_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 1. Cek di resource directory Tauri (saat aplikasi diinstall)
    if let Ok(res_dir) = app.path().resource_dir() {
        let p = res_dir.join("resources").join("pgsql");
        if p.join("bin").join("postgres.exe").exists() {
            return Some(p);
        }
        let p2 = res_dir.join("pgsql");
        if p2.join("bin").join("postgres.exe").exists() {
            return Some(p2);
        }
    }

    // 2. Cek di direktori kerja saat development
    let dev_p = PathBuf::from("resources").join("pgsql");
    if dev_p.join("bin").join("postgres.exe").exists() {
        return Some(dev_p);
    }

    let dev_tauri_p = PathBuf::from("src-tauri").join("resources").join("pgsql");
    if dev_tauri_p.join("bin").join("postgres.exe").exists() {
        return Some(dev_tauri_p);
    }

    // 3. Fallback sistem
    let sys_p = PathBuf::from(r"C:\Program Files\PostgreSQL\18");
    if sys_p.join("bin").join("postgres.exe").exists() {
        return Some(sys_p);
    }

    None
}

/// Inisialisasi dan jalankan daemon PostgreSQL portabel jika port 5432 belum aktif.
/// Mengembalikan path data directory jika portable daemon berhasil dijalankan.
pub fn ensure_pgsql_running(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    // 1. Cek apakah layanan PostgreSQL sudah aktif di port 5432
    if is_port_open(5432) {
        println!("[PGSQL] Layanan PostgreSQL lokal terdeteksi aktif di port 5432. Menggunakan PostgreSQL yang sudah ada.");
        return Ok(None);
    }

    println!("[PGSQL] Port 5432 belum aktif. Mencari biner PostgreSQL portabel...");

    let pgsql_dir = match find_pgsql_dir(app) {
        Some(d) => d,
        None => {
            println!("[PGSQL WARN] Biner PostgreSQL portabel tidak ditemukan. Akan mencoba koneksi langsung.");
            return Ok(None);
        }
    };

    let bin_dir = pgsql_dir.join("bin");
    let share_dir = pgsql_dir.join("share");
    let initdb_exe = bin_dir.join("initdb.exe");
    let pg_ctl_exe = bin_dir.join("pg_ctl.exe");

    // Tentukan lokasi data cluster di AppData pengguna
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal mendapatkan app data dir: {e}"))?;
    let data_dir = app_data_dir.join("pgsql_data");

    if let Err(e) = std::fs::create_dir_all(&data_dir) {
        return Err(format!("Gagal membuat direktori data database: {e}"));
    }

    // 2. Inisialisasi cluster database jika belum pernah diinisialisasi
    if !data_dir.join("PG_VERSION").exists() {
        println!("[PGSQL] Menginisialisasi cluster data PostgreSQL baru di {:?}...", data_dir);

        let mut cmd = Command::new(&initdb_exe);
        cmd.arg("-D")
            .arg(&data_dir)
            .arg("-U")
            .arg("postgres")
            .arg("-A")
            .arg("trust")
            .arg("-E")
            .arg("UTF8")
            .arg("--locale=C")
            .arg("--no-instructions");

        if share_dir.exists() {
            cmd.arg("-L").arg(&share_dir);
        }

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let status = cmd.status().map_err(|e| format!("Gagal menjalankan initdb.exe: {e}"))?;
        if !status.success() {
            return Err(format!("initdb gagal dengan exit status: {:?}", status.code()));
        }
        println!("[PGSQL] Inisialisasi cluster selesai.");
    }

    // 3. Jalankan daemon PostgreSQL dengan pg_ctl
    println!("[PGSQL] Menjalankan server PostgreSQL portabel di port 5432...");
    let log_file = data_dir.join("server.log");

    let mut start_cmd = Command::new(&pg_ctl_exe);
    start_cmd
        .arg("-D")
        .arg(&data_dir)
        .arg("-l")
        .arg(&log_file)
        .arg("-o")
        .arg("-p 5432")
        .arg("start");

    #[cfg(windows)]
    start_cmd.creation_flags(CREATE_NO_WINDOW);

    let start_status = start_cmd
        .status()
        .map_err(|e| format!("Gagal menjalankan pg_ctl.exe start: {e}"))?;

    if !start_status.success() {
        return Err(format!("pg_ctl start gagal dengan exit code: {:?}", start_status.code()));
    }

    // 4. Tunggu hingga port 5432 siap menerima koneksi (maksimal 7 detik)
    let start_time = Instant::now();
    while !is_port_open(5432) {
        if start_time.elapsed() > Duration::from_secs(7) {
            return Err("Batas waktu terlampaui saat menunggu PostgreSQL portabel menyala.".to_string());
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    println!("[PGSQL] Server PostgreSQL portabel berhasil dijalankan dan siap melayani koneksi.");
    Ok(Some(data_dir))
}

/// Hentikan daemon PostgreSQL portabel saat aplikasi ditutup.
pub fn stop_portable_pgsql(app: &tauri::AppHandle, data_dir: &Path) {
    if let Some(pgsql_dir) = find_pgsql_dir(app) {
        let pg_ctl_exe = pgsql_dir.join("bin").join("pg_ctl.exe");
        if pg_ctl_exe.exists() {
            println!("[PGSQL] Menghentikan server PostgreSQL portabel secara aman...");
            let mut stop_cmd = Command::new(&pg_ctl_exe);
            stop_cmd.arg("-D").arg(data_dir).arg("-m").arg("fast").arg("stop");

            #[cfg(windows)]
            stop_cmd.creation_flags(CREATE_NO_WINDOW);

            let _ = stop_cmd.status();
            println!("[PGSQL] Server PostgreSQL portabel dihentikan.");
        }
    }
}
