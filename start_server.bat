@echo off
REM Fact Checker Pro - Server Startup Script (Windows)
REM This script starts the API server for the Chrome extension

echo 🚀 Starting Fact Checker Pro API Server...
echo ================================================

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    echo 💡 Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "api_server.py" (
    echo ❌ api_server.py not found in current directory
    echo 💡 Please run this script from the Extension_project directory
    pause
    exit /b 1
)

REM Check if virtual environment exists, create if not
if not exist "venv" (
    echo 📦 Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/upgrade dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Check if all agent files exist
echo 🔍 Checking agent files...
set missing_files=

for %%f in (Agnet.py WebAgent.py ImageAgent.py PageAnalyzer.py GoogleSearchAgent.py) do (
    if not exist "%%f" (
        echo ⚠️  Warning: Missing %%f
        set missing_files=1
    )
)

if defined missing_files (
    echo Some functionality may be limited.
)

REM Start the server
echo.
echo 🌟 Starting API server...
echo 📍 Server will be available at: http://localhost:5000
echo 🔑 Press Ctrl+C to stop the server
echo.

REM Set environment variables if needed
set FLASK_ENV=development
set PYTHONPATH=%PYTHONPATH%;%CD%

REM Start the Flask server
python api_server.py

pause
