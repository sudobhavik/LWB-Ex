@echo off
REM ============================================================
REM GUPTCHARA: 1-Click Windows Demo Launcher
REM Starts local benchmark server & opens Chrome/Edge with extension
REM ============================================================

setlocal enabledelayedexpansion
title GUPTCHARA Privacy Agent Demo Launcher

echo ============================================================
echo      GUPTCHARA: Privacy-Preserving Agentic Web Assistant    
echo                  Windows 1-Click Launcher                  
echo ============================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Error: Node.js was not found in your PATH.
    echo     Please download and install Node.js (LTS version) from:
    echo     https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Move to project root directory
cd /d "%~dp0\.."

REM Ensure extension/config.json exists or prompt
if not exist "extension\config.json" (
    echo [*] Note: extension\config.json not found.
    echo     Running on-device WASM YOLO without pre-configured cloud key.
    echo     (You can configure your OpenAI API key anytime inside the extension settings).
    echo.
)

echo [*] Starting GUPTCHARA demo on Windows...
echo [*] Press Ctrl+C in this window when you want to stop the demo.
echo.

REM Run the cross-platform Node.js launcher
node scripts\launch_demo.js chrome

if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] The browser or server exited with code %ERRORLEVEL%.
    pause
)
