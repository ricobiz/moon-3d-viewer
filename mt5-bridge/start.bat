@echo off
echo AI Trading Bot - MT5 Bridge
echo ============================
echo.

REM Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

REM Start bridge
echo.
echo Starting MT5 Bridge on http://localhost:8765
echo Press Ctrl+C to stop
echo.
python bridge.py --host localhost --port 8765

pause
