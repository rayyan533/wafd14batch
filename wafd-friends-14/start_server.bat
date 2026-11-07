@echo off
title WAFD FRIENDS 14 BATCH - Class Management Server
echo ========================================================
echo   WAFD FRIENDS 14 BATCH - Class Management Website
echo ========================================================
echo.
echo Starting server on http://localhost:3000 ...
echo Admin Credentials: admin / wafd14@admin
echo.
cd /d "%~dp0"
agy-node server.js
pause
