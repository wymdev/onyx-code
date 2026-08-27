@echo off
REM Onyx Code Launcher
cd /d "%~dp0"
start /min cmd /c "npm run electron:dev"
exit
