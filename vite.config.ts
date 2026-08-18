import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SIM-BA Koreksi BMD — Vite 前端配置 (Tauri v2).
//  Alias 用 relative imports (tidak perlu __dirname / module type).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
