@echo off
title AI Trading Bot — Cloudflare Tunnel
color 0B
chcp 65001 >nul 2>&1

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║     AI Trading Bot — Cloudflare Tunnel Mode             ║
echo  ║  Use the cloud app + your LOCAL MT5, for FREE!          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo  This lets the cloud-deployed app ^(Railway^) connect to
echo  MetaTrader 5 running on THIS computer — completely free.
echo.

:: ── Check Python ─────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Python not found. Download from: https://www.python.org/
    pause & exit /b 1
)

:: ── Install Python dependencies ───────────────────────────────────────────────
echo  Installing Python packages...
pip install MetaTrader5 flask flask-cors --quiet 2>nul
echo  ✓ Python packages ready
echo.

:: ── Check / Install cloudflared ──────────────────────────────────────────────
cloudflared --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  Cloudflare Tunnel ^(cloudflared^) not found. Installing...
    echo.
    echo  Option A — Install via winget ^(Windows 10/11^):
    echo    winget install Cloudflare.cloudflared
    echo.
    echo  Option B — Download manually:
    echo    https://github.com/cloudflare/cloudflared/releases/latest
    echo    Download cloudflared-windows-amd64.exe, rename to cloudflared.exe
    echo    Place in C:\Windows or add its folder to PATH
    echo.
    echo  After installing cloudflared, run this script again.
    echo.

    :: Try winget silently
    winget install Cloudflare.cloudflared --silent >nul 2>&1
    if %errorlevel% equ 0 (
        echo  ✓ cloudflared installed via winget
    ) else (
        echo  Could not auto-install. Please install manually ^(see above^).
        pause & exit /b 1
    )
)

for /f "tokens=*" %%v in ('cloudflared --version 2^>^&1') do (
    set CF_VER=%%v
    goto :cf_done
)
:cf_done
echo  ✓ %CF_VER%

:: ── Start MT5 Bridge ─────────────────────────────────────────────────────────
echo.
echo  Starting MT5 Bridge on http://localhost:8765...
if exist "mt5-bridge\bridge.py" (
    start "MT5 Bridge" cmd /k "python mt5-bridge\bridge.py --host localhost --port 8765"
) else if exist "bridge.py" (
    start "MT5 Bridge" cmd /k "python bridge.py --host localhost --port 8765"
) else (
    echo  ERROR: bridge.py not found. Run this from the project root folder.
    pause & exit /b 1
)

timeout /t 2 >nul

:: ── Start Cloudflare Tunnel ──────────────────────────────────────────────────
echo.
echo  ════════════════════════════════════════════════════════
echo   Starting Cloudflare Tunnel...
echo   A public URL like https://xxxx.trycloudflare.com
echo   will appear below. COPY that URL!
echo  ════════════════════════════════════════════════════════
echo.
echo  Instructions after you see the URL:
echo    1. Copy the https://xxxx.trycloudflare.com URL
echo    2. Open your cloud app (Railway) → Settings
echo    3. Paste it as "MT5 Bridge URL"
echo    4. Enable MT5 Bridge and click "Test Connection"
echo.
echo  Press Ctrl+C in this window to stop the tunnel.
echo  ════════════════════════════════════════════════════════
echo.

cloudflared tunnel --url http://localhost:8765

echo.
echo  Tunnel stopped. MT5 Bridge window may still be open — close it manually.
pause
