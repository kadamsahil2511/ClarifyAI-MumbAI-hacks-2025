import os
import json
import re
import requests
import sys
import base64
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = "AIzaSyBowNftE-G8V_grQ9hZXiCwfsDa6B47FLs"
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY not set.")

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
RESULTS_FILE = "data/results.json"

def query_gemini_with_image(image_data: str, mime_type: str, model: str = "gemini-2.0-flash"):
    """Query Gemini with image data for fact-checking"""
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
        return response.json()['candidates'][0]['content']['parts'][0]['text']
    except (requests.exceptions.RequestException, KeyError, IndexError, json.JSONDecodeError) as e:
        return f"Failed to fetch or parse API response: {e}"

def query_gemini(prompt: str, model: str = "gemini-2.0-flash"):
    url = f"{BASE_URL}/{model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
    }
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        return response.json()['candidates'][0]['content']['parts'][0]['text']
    except (requests.exceptions.RequestException, KeyError, IndexError, json.JSONDecodeError) as e:
        return f"Failed to fetch or parse API response: {e}"

def extract_json_from_text(text: str):
    cleaned = re.sub(r"```(json)?", "", text, flags=re.IGNORECASE).strip()
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {"error": "Failed to parse cleaned JSON", "raw_response": text}
    else:
        return {"error": "No JSON found in response", "raw_response": text}

def detect_intent(input_text: str):
    if input_text.startswith("data:image/"):
        return "image"
    elif input_text.startswith("http://") or input_text.startswith("https://"):
        return "url"
    elif len(input_text.split()) > 5:
        return "claim"
    else:
        return "promo"

def fact_checker_agent(input_text: str):
    intent = detect_intent(input_text)
    
    if intent == "image":
        # Extract image data and MIME type from data URL
        try:
            header, data = input_text.split(',', 1)
            mime_type = header.split(':')[1].split(';')[0]
            raw_text = query_gemini_with_image(data, mime_type)
            result = extract_json_from_text(raw_text)
            result["source_type"] = "image"
            return result
        except Exception as e:
            return {"error": f"Failed to process image: {e}", "raw_response": input_text}
    
    elif intent == "url":
        prompt = f"""
You are an expert fact-checking AI. Analyze this URL and return JSON ONLY:
{{
"url": "{input_text}",
"is_correct": true or false,
"summary": "Brief summary of content",
"sources": ["{input_text}"],
"explanation": "Explain why the claim is true or false using evidence from the page"
}}
"""
    elif intent == "claim":
        prompt = f"""
You are an expert fact-checking AI. Analyze the claim: "{input_text}".
Return JSON ONLY with keys:
{{
"claim": "{input_text}",
"is_correct": true or false,
"confidence_score": 0-100,
"category": "Science/History/Health/etc.",
"sources": ["List of URLs or documents supporting your conclusion"],
"explanation": "Explain why this claim is true or false with proof from sources"
}}
"""
    else:  # promo/keyword
        prompt = f"""
You are an expert AI agent. The user gave a keyword/promo: "{input_text}".
Browse the web, find 10-15 reliable sources, and summarize your findings.
Return JSON ONLY with:
{{
"query": "{input_text}",
"conclusion": "Brief summary/conclusion",
"confidence_score": 0-100,
"sources": ["List of URLs found"],
"explanation": "Provide reasoning and proof based on sources"
}}
"""
    raw_text = query_gemini(prompt)
    return extract_json_from_text(raw_text)

def save_result(result: dict):
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

def process_single_input(input_text: str):
    """Process a single input and return result"""
    result = fact_checker_agent(input_text)
    save_result(result)
    return result

def run_cli():
    print("\n=== Gemini-Powered Fact Checker with Intent Detection (v3) ===")
    print("Type 'exit' to quit.\n")
    while True:
        user_input = input("> Enter a claim, URL, or promo: ").strip()
        if user_input.lower() in ["exit", "quit"]:
            print("Exiting...")
            break
        if not user_input:
            print("Please enter a valid input.")
            continue
        result = fact_checker_agent(user_input)
        save_result(result)
        print("Done")

if __name__ == "__main__":
    # Check if we're being called with a command line argument or file
    if len(sys.argv) > 1:
        if len(sys.argv) >= 3 and sys.argv[1] == "--file":
            # Read image data from file
            file_path = sys.argv[2]
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    input_text = f.read().strip()
                result = process_single_input(input_text)
                print(json.dumps(result, indent=2))
            except Exception as e:
                print(json.dumps({"error": f"Failed to read file: {e}"}, indent=2))
        else:
            # Direct text input
            input_text = " ".join(sys.argv[1:])
            result = process_single_input(input_text)
            print(json.dumps(result, indent=2))
    else:
        run_cli()