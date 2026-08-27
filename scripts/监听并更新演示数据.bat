@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 监听 Excel 保存并自动更新演示数据（关闭本窗口即停止）
echo 在线演示请直接 push Excel 到 GitHub，无需本地监听。
echo 本地预览可重复运行：scripts\更新演示数据.bat
pause
exit /b 0
pause
