#!/usr/bin/env python3
"""
API Server for Fact Checker Pro Chrome Extension
Bridges the extension with existing Python agents
"""

import os
import sys
import json
import base64
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime
import traceback

# Import your existing agents
try:
    from Agnet import fact_checker_agent, save_result
    from WebAgent import fact_checker_agent as web_fact_checker
    from ImageAgent import process_image
    from PageAnalyzer import PageAnalyzer
    from GoogleSearchAgent import search_web
except ImportError as e:
    print(f"Warning: Could not import some agents: {e}")
    print("Make sure all agent files are in the same directory")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, origins=["chrome-extension://*", "http://localhost:*"])

# Initialize agents
try:
    page_analyzer = PageAnalyzer()
except Exception as e:
    logger.warning(f"Could not initialize PageAnalyzer: {e}")
    page_analyzer = None

class FactCheckerAPI:
    def __init__(self):
        self.request_count = 0
        self.start_time = datetime.now()
        
    def log_request(self, request_type, data_preview=""):
        self.request_count += 1
        logger.info(f"Request #{self.request_count}: {request_type} - {data_preview}")

    def format_response(self, success=True, data=None, error=None):
        """Standardize API response format"""
        response = {
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "request_id": self.request_count
        }
        
        if success and data is not None:
            response["data"] = data
        elif not success and error:
            response["error"] = error
            
        return response

    def process_text_claim(self, text):
        """Process text claim using the main fact checker agent"""
        try:
            self.log_request("TEXT_CLAIM", text[:50] + "...")
            
            # Use your existing Agnet.py fact checker
            result = fact_checker_agent(text)
            
            # Standardize the response format
            standardized = self.standardize_result(result, "text")
            
            return self.format_response(success=True, data=standardized)
            
        except Exception as e:
            logger.error(f"Error processing text claim: {e}")
            return self.format_response(success=False, error=str(e))

    def process_url_analysis(self, url):
        """Process URL analysis using PageAnalyzer"""
        try:
            self.log_request("URL_ANALYSIS", url)
            
            if page_analyzer:
                # Use PageAnalyzer for comprehensive analysis
                result = page_analyzer.analyze_page(url)
            else:
                # Fallback to basic fact checker
                result = fact_checker_agent(url)
            
            standardized = self.standardize_result(result, "url")
            
            return self.format_response(success=True, data=standardized)
            
        except Exception as e:
            logger.error(f"Error analyzing URL: {e}")
            return self.format_response(success=False, error=str(e))

    def process_image_analysis(self, image_data, filename="", mime_type=""):
        """Process image analysis using ImageAgent"""
        try:
            self.log_request("IMAGE_ANALYSIS", f"Image: {filename}")
            
            # Handle base64 image data
            if image_data.startswith('data:'):
                # Extract base64 data from data URL
                header, data = image_data.split(',', 1)
                if not mime_type:
                    mime_type = header.split(':')[1].split(';')[0]
            else:
                data = image_data
            
            # Create temporary file for image processing
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
                try:
                    # Decode base64 and save to temp file
                    image_bytes = base64.b64decode(data)
                    tmp_file.write(image_bytes)
                    tmp_file.flush()
                    
                    # Process with ImageAgent
                    result = process_image(tmp_file.name)
                    
                finally:
                    # Clean up temp file
                    os.unlink(tmp_file.name)
            
            standardized = self.standardize_result(result, "image")
            
            return self.format_response(success=True, data=standardized)
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            return self.format_response(success=False, error=str(e))

    def process_page_analysis(self, url):
        """Process current page analysis"""
        try:
            self.log_request("PAGE_ANALYSIS", url)
            
            if page_analyzer:
                result = page_analyzer.analyze_page(url)
            else:
                # Fallback to URL fact checking
                result = fact_checker_agent(url)
            
            standardized = self.standardize_result(result, "page")
            
            return self.format_response(success=True, data=standardized)
            
        except Exception as e:
            logger.error(f"Error analyzing page: {e}")
            return self.format_response(success=False, error=str(e))

    def search_web_sources(self, query, num_results=5):
        """Search web for additional sources"""
        try:
            self.log_request("WEB_SEARCH", query)
            
            results = search_web(query, num_results)
            
            return self.format_response(success=True, data=results)
            
        except Exception as e:
            logger.error(f"Error searching web: {e}")
            return self.format_response(success=False, error=str(e))

    def standardize_result(self, result, source_type):
        """Standardize different agent results into a common format"""
        if isinstance(result, dict) and "error" in result:
            raise Exception(result["error"])
        
        standardized = {
            "source_type": source_type,
            "timestamp": datetime.now().isoformat()
        }
        
        # Handle different result formats from your agents
        if isinstance(result, dict):
            # Copy common fields
            for field in ["claim", "is_correct", "confidence_score", "category", 
                         "sources", "explanation", "is_misleading", "overall_credibility_score",
                         "fact_check_summary", "analyzed_title", "analyzed_url", "query"]:
                if field in result:
                    standardized[field] = result[field]
            
            # Handle PageAnalyzer specific fields
            if "risk_level" in result:
                standardized["risk_level"] = result["risk_level"]
            if "issues_found" in result:
                standardized["issues_found"] = result["issues_found"]
            if "recommendation" in result:
                standardized["recommendation"] = result["recommendation"]
            
            # Handle ImageAgent specific fields
            if "image_description" in result:
                standardized["image_description"] = result["image_description"]
            
            # Ensure we have required fields with defaults
            if "is_correct" not in standardized and "is_misleading" in standardized:
                standardized["is_correct"] = not standardized["is_misleading"]
            
            if "confidence_score" not in standardized and "overall_credibility_score" in standardized:
                standardized["confidence_score"] = standardized["overall_credibility_score"]
            
            if "explanation" not in standardized and "fact_check_summary" in standardized:
                standardized["explanation"] = standardized["fact_check_summary"]
            
            if "sources" not in standardized:
                standardized["sources"] = []
                
        else:
            # Handle non-dict results
            standardized["explanation"] = str(result)
            standardized["is_correct"] = None
            standardized["confidence_score"] = 0
            standardized["sources"] = []
        
        return standardized

# Initialize API handler
api_handler = FactCheckerAPI()

# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    uptime = datetime.now() - api_handler.start_time
    return jsonify({
        "status": "healthy",
        "uptime_seconds": uptime.total_seconds(),
        "requests_processed": api_handler.request_count,
        "agents_available": {
            "fact_checker": "fact_checker_agent" in globals(),
            "page_analyzer": page_analyzer is not None,
            "image_processor": "process_image" in globals(),
            "web_search": "search_web" in globals()
        }
    })

@app.route('/api/fact-check', methods=['POST'])
def fact_check():
    """Main fact-checking endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'type' not in data or 'data' not in data:
            return jsonify(api_handler.format_response(
                success=False, 
                error="Missing required fields: 'type' and 'data'"
            )), 400
        
        check_type = data['type']
        check_data = data['data']
        
        # Route to appropriate handler based on type
        if check_type == 'text':
            if 'text' in check_data:
                result = api_handler.process_text_claim(check_data['text'])
            else:
                return jsonify(api_handler.format_response(
                    success=False, error="Missing 'text' field in data"
                )), 400
                
        elif check_type == 'url':
            if 'url' in check_data:
                result = api_handler.process_url_analysis(check_data['url'])
            else:
                return jsonify(api_handler.format_response(
                    success=False, error="Missing 'url' field in data"
                )), 400
                
        elif check_type == 'image':
            if 'image' in check_data:
                result = api_handler.process_image_analysis(
                    check_data['image'],
                    check_data.get('filename', ''),
                    check_data.get('type', '')
                )
            else:
                return jsonify(api_handler.format_response(
                    success=False, error="Missing 'image' field in data"
                )), 400
                
        elif check_type == 'page':
            if 'url' in check_data:
                result = api_handler.process_page_analysis(check_data['url'])
            else:
                return jsonify(api_handler.format_response(
                    success=False, error="Missing 'url' field in data"
                )), 400
                
        else:
            return jsonify(api_handler.format_response(
                success=False, 
                error=f"Unknown fact-check type: {check_type}"
            )), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Unexpected error in fact_check: {e}")
        logger.error(traceback.format_exc())
        return jsonify(api_handler.format_response(
            success=False, 
            error=f"Internal server error: {str(e)}"
        )), 500

@app.route('/api/search', methods=['POST'])
def web_search():
    """Web search endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify(api_handler.format_response(
                success=False, error="Missing 'query' field"
            )), 400
        
        query = data['query']
        num_results = data.get('num_results', 5)
        
        result = api_handler.search_web_sources(query, num_results)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in web_search: {e}")
        return jsonify(api_handler.format_response(
            success=False, error=str(e)
        )), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get API usage statistics"""
    uptime = datetime.now() - api_handler.start_time
    return jsonify({
        "uptime_seconds": uptime.total_seconds(),
        "requests_processed": api_handler.request_count,
        "start_time": api_handler.start_time.isoformat(),
        "current_time": datetime.now().isoformat()
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify(api_handler.format_response(
        success=False, error="Endpoint not found"
    )), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify(api_handler.format_response(
        success=False, error="Internal server error"
    )), 500

def main():
    """Main function to run the API server"""
    print("🚀 Starting Fact Checker Pro API Server...")
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Check if agent files exist
    agent_files = ['Agnet.py', 'WebAgent.py', 'ImageAgent.py', 'PageAnalyzer.py', 'GoogleSearchAgent.py']
    missing_files = []
    
    for file in agent_files:
        if not os.path.exists(file):
            missing_files.append(file)
    
    if missing_files:
        print(f"⚠️  Warning: Missing agent files: {missing_files}")
        print("Some functionality may be limited.")
    else:
        print("✅ All agent files found!")
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '127.0.0.1')
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"🌐 Server will run on http://{host}:{port}")
    print(f"🔧 Debug mode: {debug}")
    print("\n📋 Available endpoints:")
    print("  GET  /api/health     - Health check")
    print("  POST /api/fact-check - Main fact-checking")
    print("  POST /api/search     - Web search")
    print("  GET  /api/stats      - Usage statistics")
    print("\n🎯 Ready to receive requests from Chrome extension!")
    print("💡 Press Ctrl+C to stop the server")
    
    try:
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
