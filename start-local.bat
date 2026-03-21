@echo off
title AI Trading Bot — Local Mode
color 0A
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║           AI Trading Bot — Local Mode                   ║
echo  ║   Runs everything on YOUR PC — no VPS needed!           ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  This launcher will start:
echo    [1] Web App      →  http://localhost:3000
echo    [2] MT5 Bridge   →  http://localhost:8765
echo.

:: ── Check Node.js ────────────────────────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Download and install from: https://nodejs.org/
    echo  Choose the LTS version ^(recommended^)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  ✓ Node.js %NODE_VER% found

:: ── Check Python ─────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Python is not installed.
    echo.
    echo  Download from: https://www.python.org/downloads/
    echo  During install, check "Add Python to PATH"
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version') do set PY_VER=%%v
echo  ✓ %PY_VER% found

:: ── Install Node dependencies if needed ───────────────────────────────────────
if not exist "node_modules" (
    echo.
    echo  [1/3] Installing Node.js packages ^(first run only^)...
    npm install --quiet
    if %errorlevel% neq 0 (
        echo  ERROR: npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo  ✓ Node packages installed
) else (
    echo  ✓ Node packages already installed
)

:: ── Install Python dependencies ───────────────────────────────────────────────
echo.
echo  [2/3] Installing Python packages...
pip install MetaTrader5 flask flask-cors --quiet
echo  ✓ Python packages ready

:: ── Start MT5 Bridge ─────────────────────────────────────────────────────────
echo.
echo  [3/3] Starting services...
echo.

if exist "mt5-bridge\bridge.py" (
    start "MT5 Bridge — port 8765" cmd /k "title MT5 Bridge ^& echo. ^& echo  ╔══════════════════════════════════════════╗ ^& echo  ║  MT5 Bridge running at localhost:8765   ║ ^& echo  ║  Keep this window open while trading    ║ ^& echo  ╚══════════════════════════════════════════╝ ^& echo. ^& python mt5-bridge\bridge.py --host localhost --port 8765"
    echo  ✓ MT5 Bridge starting at http://localhost:8765
) else (
    echo  ! MT5 Bridge not found ^(mt5-bridge\bridge.py^) — skipping
)

:: ── Short pause for bridge to initialize ─────────────────────────────────────
timeout /t 2 >nul

:: ── Start Web App ─────────────────────────────────────────────────────────────
start "AI Trading Bot — port 3000" cmd /k "title AI Trading Bot ^& echo. ^& echo  ╔══════════════════════════════════════════╗ ^& echo  ║  Web App running at http://localhost:3000║ ^& echo  ║  Open browser: http://localhost:3000    ║ ^& echo  ╚══════════════════════════════════════════╝ ^& echo. ^& npm run dev"
echo  ✓ Web App starting at http://localhost:3000

:: ── Wait for app to boot, then open browser ──────────────────────────────────
echo.
echo  Waiting for app to start...
timeout /t 6 >nul
start "" "http://localhost:3000"

echo.
echo  ══════════════════════════════════════════════════════════
echo   ✓ All done! Browser opening at http://localhost:3000
echo.
echo   SETTINGS to use after opening the app:
echo     • MT5 Bridge URL: http://localhost:8765
echo     • Enable MT5 Bridge toggle: ON
echo     • Click "Test Connection"
echo.
echo   Close the two opened windows to stop all services.
echo  ══════════════════════════════════════════════════════════
echo.
pause
