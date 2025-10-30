@echo off
chcp 65001 >nul
title Coupang Rank Checker v1.0
echo.
echo ========================================
echo    Coupang Rank Checker v1.0 - Final
echo ========================================
echo.
echo Starting rank checking for 3 products...
echo.
echo Products to search:
echo    1. Mobile Trolley (Product ID: 8473798698)
echo    2. Bicycle Lock (Product ID: 7446595001)
echo    3. Bicycle Light (Product ID: 8188782600)
echo.
echo Press any key to start...
pause >nul
echo.
echo Starting rank checking...
echo.

cd /d "%~dp0"
node optimized_fast_checker_gui.js

echo.
echo Rank checking completed!
echo.
echo Press any key to check results...
pause >nul
