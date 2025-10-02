import time
from urllib.parse import quote_plus
import webbrowser
from duckduckgo_search import DDGS
import requests
import json

GEMINI_API_KEY = "AIzaSyBowNftE-G8V_grQ9hZXiCwfsDa6B47FLs"
NUM_RESULTS = 5

def call_gemini(prompt, model="gemini-2.0-flash", max_output_tokens=512, temperature=0.2):
    try:
        import google.genai as genai
        client = genai.Client()
        response = client.models.generate_content(model=model, contents=prompt)
        if hasattr(response, 'text'):
            return response.text
        elif isinstance(response, dict) and 'candidates' in response:
            return response['candidates'][0].get('content', '')
        elif hasattr(response, 'candidates'):
            return response.candidates[0].content
        else:
            return str(response)
    except Exception as e:
        print("genai SDK not available, fallback to HTTP:", e)
    try:
        if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("YOUR_"):
            raise RuntimeError("GEMINI_API_KEY missing")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generate"
        headers = {"Content-Type": "application/json"}
        payload = {
            "prompt": {"text": prompt},
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        }
        params = {"key": GEMINI_API_KEY}
        resp = requests.post(url, params=params, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if 'candidates' in data and len(data['candidates']) > 0:
            return data['candidates'][0].get('content', '')
        return json.dumps(data)
    except Exception as e:
        print("HTTP fallback to Gemini failed:", e)
        return ""

def open_default_browser(query):
    url = f"https://www.google.com/search?q={quote_plus(query)}"
    webbrowser.open(url, new=2)
    time.sleep(2)

def fetch_search_results(query, max_results=NUM_RESULTS):
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=max_results):
            results.append({
                "title": r.get('title', r.get('body', 'No title')),
                "link": r.get('href', 'No link')
            })
    return results

def summarize_and_fact_check(results):
    summary = ""
    for i, r in enumerate(results, start=1):
        prompt = f"""
You are Nexus, an AI assistant. Fact-check this information:
Title: {r['title']}
Link: {r['link']}

Is this true or misleading? Explain in 1-2 lines.
"""
        verdict = call_gemini(prompt, max_output_tokens=100, temperature=0.2)
        summary += f"{i}. {r['title']} ({r['link']}) → {verdict.strip()}\n"
    return summary

def research_query(query):
    open_default_browser(query)
    results = fetch_search_results(query)
    if not results:
        return "No search results found."
    summary = summarize_and_fact_check(results)
    return f"Here’s what I found for '{query}':\n{summary}"

if __name__ == "__main__":
    user_query = input("Enter your research query: ")
    print(f"🔍 Researching: {user_query}")
    final = research_query(user_query)
    print("\n--- Nexus Summary ---\n")
    print(final)
