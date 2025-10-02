#!/bin/bash

# Fact Checker Pro - Server Startup Script (macOS/Linux)
# This script starts the API server for the Chrome extension

echo "🚀 Starting Fact Checker Pro API Server..."
echo "================================================"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed or not in PATH"
    echo "💡 Please install Python 3.8+ and try again"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "api_server.py" ]; then
    echo "❌ api_server.py not found in current directory"
    echo "💡 Please run this script from the Extension_project directory"
    exit 1
fi

# Check if virtual environment exists, create if not
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if all agent files exist
echo "🔍 Checking agent files..."
missing_files=()

for file in "Agnet.py" "WebAgent.py" "ImageAgent.py" "PageAnalyzer.py" "GoogleSearchAgent.py"; do
    if [ ! -f "$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -ne 0 ]; then
    echo "⚠️  Warning: Missing agent files:"
    printf '   - %s\n' "${missing_files[@]}"
    echo "Some functionality may be limited."
fi

# Start the server
echo ""
echo "🌟 Starting API server..."
echo "📍 Server will be available at: http://localhost:5000"
echo "🔑 Press Ctrl+C to stop the server"
echo ""

# Export environment variables if needed
export FLASK_ENV=development
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start the Flask server
python3 api_server.py
