@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 正在合并 文件/ 下全部 Excel 并更新演示数据…
python "%~dp0gen_real_demo_data.py"
if errorlevel 1 (
  echo.
  echo 生成失败。请确认已安装 Python 与 openpyxl：pip install -r requirements.txt
  pause
  exit /b 1
)
echo.
echo 在线演示请执行：git add 文件/ 与演示数据后 git push
pause
