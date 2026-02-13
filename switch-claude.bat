@echo off
REM Quick switch to Claude Subscription
echo Switching to Claude Subscription...
powershell -ExecutionPolicy Bypass -File "%~dp0switch-ai-provider.ps1" claude
