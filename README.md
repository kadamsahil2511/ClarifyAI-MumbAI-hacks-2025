# Fact Checker Pro - Chrome Extension

A powerful AI-powered Chrome extension that instantly verifies claims, analyzes URLs, fact-checks images, and evaluates web pages for accuracy and misinformation.

## 🚀 Features

- **🔍 Text Fact-Checking**: Analyze any text claim for truthfulness
- **🌐 URL Analysis**: Comprehensive analysis of web pages and articles
- **📸 Image Verification**: Fact-check claims within images using AI vision
- **📄 Page Analysis**: Real-time analysis of the current webpage
- **⌨️ Keyboard Shortcuts**: Quick access with `Cmd/Ctrl + /`
- **🎯 Context Menu Integration**: Right-click to fact-check selected content
- **📊 Confidence Scoring**: Get reliability scores for all analyses
- **🔗 Source Citations**: View supporting sources and references
- **💾 History Tracking**: Keep track of your fact-checking history

## 📋 Prerequisites

- **Python 3.8+** installed on your system
- **Chrome Browser** (version 88+)
- **Internet connection** for AI processing and web searches

## 🛠️ Installation & Setup

### Step 1: Install Python Dependencies

```bash
# Navigate to the project directory
cd /Users/armaanmulani/Desktop/Extension_project

# Install required Python packages
pip install -r requirements.txt
```

### Step 2: Start the API Server

```bash
# Start the Flask API server
python3 api_server.py
```

The server will start on `http://localhost:5000` and display:
```
🚀 Starting Fact Checker Pro API Server...
✅ All agent files found!
🌐 Server will run on http://127.0.0.1:5000
🎯 Ready to receive requests from Chrome extension!
```

### Step 3: Install Chrome Extension

1. **Open Chrome** and navigate to `chrome://extensions/`

2. **Enable Developer Mode** (toggle in top-right corner)

3. **Load Unpacked Extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from this project
   - The extension should appear in your extensions list

4. **Pin the Extension** (optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Fact Checker Pro" for easy access

## 🎯 Usage

### Keyboard Shortcut
- **macOS**: `Cmd + Shift + F`
- **Windows/Linux**: `Ctrl + Shift + F`

Press the shortcut anywhere in Chrome to open the fact-checker popup.

### Extension Popup
Click the extension icon in the toolbar to open the interface with four tabs:

#### 📝 Text Tab
- Enter any claim or statement
- Get instant fact-checking with confidence scores
- View supporting sources and explanations

#### 🔗 URL Tab
- Paste any URL for comprehensive analysis
- Evaluate credibility and potential misinformation
- Get detailed page assessment reports

#### 📷 Image Tab
- Upload images containing text claims
- AI vision extracts and fact-checks textual content
- Supports JPG, PNG, GIF, and WebP formats

#### 📄 Current Page Tab
- Analyze the webpage you're currently viewing
- Get real-time credibility assessment
- Identify potential misinformation or bias

### Context Menu (Right-Click)
- **Selected Text**: Right-click selected text → "Fact-check selected text"
- **Links**: Right-click any link → "Fact-check this link"
- **Images**: Right-click images → "Fact-check this image"
- **Page**: Right-click anywhere → "Fact-check this page"

## 🔧 Configuration

### API Keys
Your existing agents already include API keys. If you need to update them:

1. **Gemini API Key**: Update in `Agnet.py`, `ImageAgent.py`, `WebAgent.py`
2. **Environment Variables**: Create `.env` file with:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### Server Settings
Modify `api_server.py` for custom configuration:
```python
# Change port (default: 5000)
port = int(os.environ.get('PORT', 5000))

# Change host (default: 127.0.0.1)
host = os.environ.get('HOST', '127.0.0.1')

# Enable debug mode
debug = os.environ.get('DEBUG', 'False').lower() == 'true'
```

## 📁 Project Structure

```
Extension_project/
├── chrome-extension/           # Chrome extension files
│   ├── manifest.json          # Extension configuration
│   ├── popup.html            # Main interface
│   ├── popup.js              # Frontend logic
│   ├── popup.css             # Styling
│   ├── background.js         # Background script
│   ├── content.js            # Content script
│   ├── content.css           # Content styles
│   └── icons/                # Extension icons
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
├── api_server.py             # Flask API server
├── requirements.txt          # Python dependencies
├── create_icons.py          # Icon generation script
├── Agnet.py                 # Main fact-checking agent
├── WebAgent.py              # Web search agent
├── ImageAgent.py            # Image analysis agent
├── PageAnalyzer.py          # Page analysis agent
├── GoogleSearchAgent.py     # Search functionality
├── research.py              # Research utilities
└── README.md               # This file
```

## 🔍 API Endpoints

The Flask server provides these endpoints:

- `GET /api/health` - Health check and status
- `POST /api/fact-check` - Main fact-checking endpoint
- `POST /api/search` - Web search functionality
- `GET /api/stats` - Usage statistics

### Example API Usage

```javascript
// Fact-check text
fetch('http://localhost:5000/api/fact-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'text',
    data: { text: 'The Earth is flat' }
  })
})
```

## 🐛 Troubleshooting

### Extension Not Loading
- Ensure Developer Mode is enabled in Chrome
- Check that all files are in the `chrome-extension` folder
- Look for errors in `chrome://extensions/` (click "Errors" if present)

### API Server Issues
- Verify Python dependencies are installed: `pip list`
- Check if port 5000 is available: `lsof -i :5000`
- Review server logs for error messages

### Keyboard Shortcut Not Working
- Check if another extension uses the same shortcut
- Go to `chrome://extensions/shortcuts` to modify shortcuts
- Ensure the extension has necessary permissions

### Fact-Checking Not Working
- Verify API server is running on `http://localhost:5000`
- Check internet connection for AI API calls
- Review browser console for JavaScript errors (F12 → Console)

## 🔒 Privacy & Security

- **Local Processing**: The extension communicates only with your local API server
- **No Data Collection**: No personal data is stored or transmitted to third parties
- **API Keys**: Your AI API keys remain on your local machine
- **HTTPS Support**: Extension works on both HTTP and HTTPS sites

## 🚀 Advanced Usage

### Custom Agents
You can modify the existing Python agents to customize fact-checking behavior:

- **Agnet.py**: Main fact-checking logic
- **PageAnalyzer.py**: Web page analysis
- **ImageAgent.py**: Image processing
- **WebAgent.py**: Web search integration

### Extension Customization
Modify the extension interface by editing:

- **popup.html**: Change UI structure
- **popup.css**: Customize styling and themes
- **popup.js**: Add new functionality

### Deployment
For production deployment:

1. **Server**: Deploy `api_server.py` to a cloud service
2. **Extension**: Update API endpoint in `popup.js`
3. **Distribution**: Package extension for Chrome Web Store

## 📊 Performance

- **Response Time**: Typically 2-5 seconds for text analysis
- **Accuracy**: Depends on AI model and source quality
- **Resource Usage**: Minimal impact on browser performance
- **Offline Mode**: Extension UI works offline, but fact-checking requires internet

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is for educational and personal use. Please ensure compliance with:
- Chrome Extension policies
- AI API terms of service
- Web scraping best practices

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server and browser console logs
3. Ensure all dependencies are properly installed
4. Verify API keys are valid and have sufficient quota

## 🎉 Acknowledgments

- Built with Google's Gemini AI for fact-checking
- Uses Flask for the API server
- Chrome Extension APIs for browser integration
- Beautiful UI inspired by modern design principles

---

**Happy Fact-Checking! 🕵️‍♂️✅**
