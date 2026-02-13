@echo off
REM Quick switch to ZAI
echo Switching to ZAI...
powershell -ExecutionPolicy Bypass -File "%~dp0switch-ai-provider.ps1" zai
