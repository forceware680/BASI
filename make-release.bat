@echo off
REM make-release.bat — Wrapper CMD untuk menjalankan make-release.ps1
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0make-release.ps1" %*
