@echo off
chcp 65001 >nul
title Coupang Rank Checker - API Integration
echo.
echo ========================================
echo  Coupang Rank Checker - API Integration
echo ========================================
echo.
echo Getting keywords from API and checking ranks...
echo.
echo Automatically fetching registered keywords from website
echo.
echo Press any key to start rank checking...
pause >nul
echo.
echo Starting rank checking program...
echo.

cd /d "%~dp0"
node optimized_fast_checker_gui.js

echo.
echo Rank checking completed!
echo.
echo Press any key to check results...
pause >nul
