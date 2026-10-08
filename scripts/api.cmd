@echo off
python "%~dp0api.py" %*
exit /b %errorlevel%
