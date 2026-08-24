#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
set-version.py — Script otomatis patch versi di 4 file aplikasi SIMBASI BMD.
Penggunaan:
    python set-version.py 1.2.0
    atau jalankan tanpa argumen untuk mode interaktif: python set-version.py
"""

import sys
import re
import os

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    if len(sys.argv) > 1 and sys.argv[1].strip():
        new_version = sys.argv[1].strip()
    else:
        print("============================================================")
        print("  SIMBASI BMD - Pembaruan Versi Build Aplikasi (Python)")
        print("============================================================")
        try:
            new_version = input("Masukkan nomor versi baru (contoh: 1.2.0 atau v1.2.0): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nDibatalkan.")
            return

    clean_version = new_version.lstrip("vV").strip()
    if not re.match(r"^\d+\.\d+\.\d+", clean_version):
        print(f"[ERROR] Format versi '{clean_version}' tidak valid! Gunakan format semver seperti '1.2.0'.")
        sys.exit(1)

    print(f"\nMemperbarui versi menjadi v{clean_version}...")

    # 1. Update package.json
    pkg_path = os.path.join(root_dir, "package.json")
    if os.path.exists(pkg_path):
        with open(pkg_path, "r", encoding="utf-8") as f:
            content = f.read()
        updated = re.sub(r'("version"\s*:\s*)"[^"]+"', rf'\1"{clean_version}"', content)
        with open(pkg_path, "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"  [OK] package.json               -> version: \"{clean_version}\"")

    # 2. Update src-tauri/tauri.conf.json
    tauri_path = os.path.join(root_dir, "src-tauri", "tauri.conf.json")
    if os.path.exists(tauri_path):
        with open(tauri_path, "r", encoding="utf-8") as f:
            content = f.read()
        updated = re.sub(r'("version"\s*:\s*)"[^"]+"', rf'\1"{clean_version}"', content)
        with open(tauri_path, "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"  [OK] src-tauri/tauri.conf.json  -> version: \"{clean_version}\"")

    # 3. Update src-tauri/Cargo.toml
    cargo_path = os.path.join(root_dir, "src-tauri", "Cargo.toml")
    if os.path.exists(cargo_path):
        with open(cargo_path, "r", encoding="utf-8") as f:
            content = f.read()
        updated = re.sub(r'(?m)^version\s*=\s*"[^"]+"', rf'version = "{clean_version}"', content)
        with open(cargo_path, "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"  [OK] src-tauri/Cargo.toml       -> version = \"{clean_version}\"")

    # 4. Update src/components/LoginScreen.tsx
    login_path = os.path.join(root_dir, "src", "components", "LoginScreen.tsx")
    if os.path.exists(login_path):
        with open(login_path, "r", encoding="utf-8") as f:
            content = f.read()
        updated = re.sub(r'v\d+\.\d+\.\d+[^<]*', f'v{clean_version}', content)
        with open(login_path, "w", encoding="utf-8") as f:
            f.write(updated)
        print(f"  [OK] src/components/LoginScreen.tsx -> v{clean_version}")

    print("\n============================================================")
    print(f"  SUKSES! Seluruh 4 file berhasil di-patch ke versi v{clean_version}")
    print("  Jalankan 'npm run tauri build' untuk mengompilasi installer baru.")
    print("============================================================\n")

if __name__ == "__main__":
    main()
