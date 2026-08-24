@echo off
REM set-version.bat — Wrapper CMD untuk menjalankan set-version.ps1
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0set-version.ps1" %*
