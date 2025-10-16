import os
import json
import base64
import requests
import sys
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "data")
RESULTS_FILE = os.path.join(RESULTS_DIR, "results.json")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyClUxdw4BkTeqT8IX7m0xqmiis3KGYQzSk")
DEFAULT_IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-pro")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY not set.")

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

def query_gemini_with_image(image_data: str, mime_type: str, model: str = DEFAULT_IMAGE_MODEL):
    """Query Gemini with an image and text prompt for fact-checking"""
    url = f"{BASE_URL}/{model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    
    payload = {
        "contents": [{
            "parts": [
                {
                    "text": """Analyze this image and extract any claims, statements, or information that can be fact-checked. Then evaluate whether the information shown is true or false. 

Return your analysis in JSON format with these exact keys:
{
"claim": "The main claim or statement extracted from the image",
"is_correct": true or false,
"confidence_score": 0-100,
"category": "Science/Health/Politics/History/etc.",
"sources": ["List of URLs or references supporting your conclusion"],
"explanation": "Detailed explanation of why this claim is true or false with evidence",
"image_description": "Brief description of what's shown in the image"
}"""
                },
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image_data
                    }
                }
            ]
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        # Make sure to handle cases where the response might not be what you expect
        candidates = response.json().get('candidates', [])
        if candidates and 'content' in candidates[0] and 'parts' in candidates[0]['content']:
            return candidates[0]['content']['parts'][0]['text']
        else:
            return json.dumps({"error": "Invalid response structure from Gemini API", "response": response.json()})
    except (requests.exceptions.RequestException, KeyError, IndexError, json.JSONDecodeError) as e:
        return json.dumps({"error": f"Failed to fetch or parse API response: {e}"})

def extract_json_from_text(text: str):
    """Extract JSON from Gemini response text"""
    import re
    cleaned = re.sub(r"```(json)?", "", text, flags=re.IGNORECASE).strip()
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {"error": "Failed to parse cleaned JSON", "raw_response": text}
    else:
        return {"error": "No JSON found in response", "raw_response": text}

def save_result(result: dict):
    """Save result to JSON file"""
    os.makedirs(RESULTS_DIR, exist_ok=True)

    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
    else:
        data = []
    data.append(result)
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def process_image(image_data: str, mime_type: str):
    """Process an image and return fact-check result"""
    raw_text = query_gemini_with_image(image_data, mime_type)
    result = extract_json_from_text(raw_text)
    result["source_type"] = "image"
    save_result(result)
    return result

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            sys.exit(1)
            
        with open(image_path, "rb") as image_file:
            img_data = base64.b64encode(image_file.read()).decode('utf-8')
        
        file_extension = os.path.splitext(image_path)[1].lower()
        img_mime_type = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', 
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }.get(file_extension, 'image/jpeg')

        result = process_image(img_data, img_mime_type)
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python ImageAgent.py <image_path>")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        if not os.path.exists(image_path):
            print(json.dumps({"error": f"Image file not found: {image_path}"}))
            sys.exit(1)
            
        with open(image_path, "rb") as image_file:
            img_data = base64.b64encode(image_file.read()).decode('utf-8')
        
        file_extension = os.path.splitext(image_path)[1].lower()
        img_mime_type = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', 
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }.get(file_extension, 'image/jpeg')

        result = process_image(img_data, img_mime_type)
        print(json.dumps(result, indent=2))
    else:
        print("Usage: python ImageAgent.py <image_path>")
        sys.exit(1)