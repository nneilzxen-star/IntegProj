@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the one-click launcher.
  echo Install the LTS version from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

node server.js
if errorlevel 1 pause
