@echo off
chcp 65001 >nul
title Supabase Integration 24h Continuous Rank Checker v1.0
echo.
echo ========================================
echo  Supabase Integration 24h Continuous Rank Checker v1.0
echo ========================================
echo.
echo Continuously processing work list from Supabase DB.
echo.
echo Processing steps:
echo    1. Query work list from keywords table (id ascending)
echo    2. Separate platforms by slot_type (coupang, naver, 11st)
echo    3. Perform rank checking for each platform
echo    4. Extract product ID from URL and search rank
echo    5. Save results to slot_status table
echo    6. Delete processed keywords
echo    7. Wait 10 seconds and re-query if list is empty
echo.
echo Supported platforms:
echo    - Coupang: Fully implemented
echo    - Naver: Stub implementation (future expansion)
echo    - 11st: Stub implementation (future expansion)
echo.
echo Warnings:
echo    - Supabase connection info must be set in .env file
echo    - Press Ctrl+C to safely exit
echo    - Stable network connection required for 24h operation
echo.
echo Press any key to start...
pause >nul
echo.
echo Starting 24-hour continuous rank checking...
echo.

cd /d "%~dp0"

REM Check environment variables
if not exist ".env" (
    echo ERROR: .env file not found!
    echo.
    echo Create .env file with following content:
    echo.
    echo SUPABASE_URL=your_supabase_url_here
    echo SUPABASE_ANON_KEY=your_supabase_anon_key_here
    echo TARGET_PRODUCT_ID=8617045901
    echo NODE_ENV=production
    echo.
    pause
    exit /b 1
)

REM Check Node.js installation
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not installed!
    echo.
    echo Install Node.js and try again.
    echo    https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check dependencies
if not exist "node_modules" (
    echo Installing dependency packages...
    npm install
    if errorlevel 1 (
        echo ERROR: Package installation failed!
        pause
        exit /b 1
    )
)

REM Execute main script
echo Starting 24-hour continuous rank checker...
echo.
node continuous-rank-checker.js

echo.
echo Rank checking completed!
echo.
echo Press any key to check results...
pause >nul

