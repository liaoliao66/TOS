@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting local preview...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_preview.ps1"
if errorlevel 1 (
  echo.
  echo Preview failed.
  echo Manual:
  echo   1^) mklink /J C:\TOS-local "%~dp0"
  echo   2^) cd /d C:\TOS-local
  echo   3^) python -m http.server 8765 --bind 127.0.0.1
  echo   4^) open http://127.0.0.1:8765/prototype/index.html
  pause
  exit /b 1
)
exit /b 0
