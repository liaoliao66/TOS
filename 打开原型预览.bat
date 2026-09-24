@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PORT=8765
set URL=http://127.0.0.1:%PORT%/prototype/index.html

REM 若 8765 已被占用，直接打开；否则启动本地静态服务
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri '%URL%' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "TOS-Preview" /min cmd /c "python -m http.server %PORT%"
  timeout /t 2 /nobreak >nul
)

start "" "%URL%"
exit /b 0
