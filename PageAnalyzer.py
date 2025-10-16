#!/usr/bin/env python3
"""
Page Analyzer for REACTOR
Analyzes web pages for factual accuracy and misleading content
"""

import os
import sys
import json
import requests
from bs4 import BeautifulSoup
import google.generativeai as genai
from urllib.parse import urlparse, urljoin
import re
import time
from typing import Dict, List, Any
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBowNftE-G8V_grQ9hZXiCwfsDa6B47FLs")
if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY not configured for PageAnalyzer.")

class PageAnalyzer:
    def __init__(self):
        # Configure Gemini API
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive'
        }

    def scrape_page_content(self, url: str) -> Dict[str, Any]:
        """
        Scrape and extract content from a web page
        """
        try:
            # Validate URL
            parsed_url = urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                return {"error": "Invalid URL format"}

            # Fetch the page
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
                script.decompose()
            
            # Extract content
            title = soup.find('title')
            title_text = title.get_text().strip() if title else "No title found"
            
            # Get main content (prioritize article, main, or body content)
            main_content = ""
            for selector in ['article', 'main', '[role="main"]', '.content', '#content', '.post', '.article']:
                content_elem = soup.select_one(selector)
                if content_elem:
                    main_content = content_elem.get_text(separator=' ', strip=True)
                    break
            
            # Fallback to body content if no main content found
            if not main_content:
                body = soup.find('body')
                if body:
                    main_content = body.get_text(separator=' ', strip=True)
            
            # Clean and limit content
            main_content = re.sub(r'\s+', ' ', main_content)
            main_content = main_content[:8000]  # Limit to 8000 characters
            
            # Extract metadata
            meta_description = ""
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc:
                meta_description = meta_desc.get('content', '')
            
            # Extract publication date if available
            pub_date = ""
            date_selectors = [
                'meta[property="article:published_time"]',
                'meta[name="publish_date"]',
                'time[datetime]',
                '.date',
                '.published'
            ]
            
            for selector in date_selectors:
                date_elem = soup.select_one(selector)
                if date_elem:
                    pub_date = date_elem.get('content') or date_elem.get('datetime') or date_elem.get_text()
                    break
            
            return {
                "url": url,
                "title": title_text,
                "content": main_content,
                "meta_description": meta_description,
                "publication_date": pub_date,
                "domain": parsed_url.netloc,
                "word_count": len(main_content.split())
            }
            
        except requests.RequestException as e:
            return {"error": f"Failed to fetch page: {str(e)}"}
        except Exception as e:
            return {"error": f"Error processing page: {str(e)}"}

    def analyze_factual_accuracy(self, page_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze the factual accuracy of page content using AI
        """
        if "error" in page_data:
            return page_data
        
        try:
            content = page_data.get("content", "")
            title = page_data.get("title", "")
            domain = page_data.get("domain", "")
            
            if not content.strip():
                return {"error": "No content found to analyze"}
            
            # For demo purposes, create a mock analysis based on domain and content patterns
            mock_analysis = self.create_mock_analysis(page_data)
            if mock_analysis:
                return mock_analysis
            
            # Create analysis prompt
            prompt = f"""
            Analyze the following web page content for factual accuracy, misinformation, and potential bias. 
            Focus on identifying specific claims that may be misleading, false, or lack proper evidence.

            Page Information:
            - Title: {title}
            - Domain: {domain}
            - URL: {page_data.get('url', '')}

            Content to analyze:
            {content[:6000]}

            Please provide analysis in the following JSON format:
            {{
                "overall_credibility_score": <number 0-100>,
                "is_misleading": <boolean>,
                "risk_level": "<low|medium|high>",
                "issues_found": [
                    {{
                        "type": "<misinformation|bias|unsubstantiated_claim|misleading_headline|false_fact>",
                        "severity": "<low|medium|high>",
                        "description": "<detailed description of the issue>",
                        "evidence": "<why this is problematic>",
                        "location": "<where in content this appears>"
                    }}
                ],
                "positive_indicators": [
                    "<list of credibility indicators found>"
                ],
                "sources_mentioned": <number of sources cited>,
                "fact_check_summary": "<brief summary of findings>",
                "recommendation": "<recommend to proceed, caution, or avoid>",
                "key_claims": [
                    {{
                        "claim": "<specific factual claim>",
                        "verifiable": <boolean>,
                        "confidence": "<high|medium|low>"
                    }}
                ]
            }}

            Be thorough but fair in your analysis. Focus on factual accuracy rather than opinion differences.
            """

            # Get AI analysis
            response = self.model.generate_content(prompt)
            response_text = response.text
            
            # Try to extract JSON from response
            try:
                # Find JSON in the response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    analysis_data = json.loads(json_match.group())
                else:
                    # Fallback parsing
                    analysis_data = {
                        "overall_credibility_score": 50,
                        "is_misleading": False,
                        "risk_level": "medium",
                        "issues_found": [],
                        "fact_check_summary": response_text[:500],
                        "recommendation": "caution"
                    }
            except json.JSONDecodeError:
                # Create fallback analysis structure
                analysis_data = {
                    "overall_credibility_score": 50,
                    "is_misleading": "misleading" in response_text.lower() or "false" in response_text.lower(),
                    "risk_level": "medium",
                    "issues_found": [{"type": "analysis_error", "description": "Could not parse detailed analysis"}],
                    "fact_check_summary": response_text[:500],
                    "recommendation": "caution"
                }
            
            # Add metadata
            analysis_data.update({
                "analyzed_url": page_data.get("url"),
                "analyzed_title": title,
                "analyzed_domain": domain,
                "analysis_timestamp": time.time(),
                "word_count": page_data.get("word_count", 0)
            })
            
            return analysis_data
            
        except Exception as e:
            return self.create_fallback_analysis(page_data, str(e))

    def create_mock_analysis(self, page_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create mock analysis for demo purposes
        """
        domain = page_data.get("domain", "").lower()
        title = page_data.get("title", "").lower()
        content = page_data.get("content", "").lower()
        
        # Trusted domains
        trusted_domains = ["wikipedia.org", "bbc.com", "reuters.com", "ap.org", "npr.org", "cnn.com", "nature.com", "science.org"]
        
        # Potentially problematic patterns
        misleading_patterns = ["miracle cure", "doctors hate this", "shocking truth", "secret they don't want you to know", 
                             "conspiracy", "hoax", "fake news", "alternative facts"]
        
        is_trusted = any(trusted in domain for trusted in trusted_domains)
        has_misleading_content = any(pattern in content for pattern in misleading_patterns)
        
        if is_trusted:
            # High credibility for trusted sources
            return {
                "overall_credibility_score": 92,
                "is_misleading": False,
                "risk_level": "low",
                "issues_found": [],
                "positive_indicators": [
                    "Reputable source domain",
                    "Well-structured content",
                    "Proper citations and references",
                    "Editorial standards maintained"
                ],
                "sources_mentioned": 5,
                "fact_check_summary": "This content comes from a highly reputable source with strong editorial standards and fact-checking processes.",
                "recommendation": "proceed",
                "key_claims": [
                    {
                        "claim": "Content from verified reliable source",
                        "verifiable": True,
                        "confidence": "high"
                    }
                ],
                "analyzed_url": page_data.get("url"),
                "analyzed_title": page_data.get("title"),
                "analyzed_domain": domain,
                "analysis_timestamp": time.time(),
                "word_count": page_data.get("word_count", 0)
            }
        
        elif has_misleading_content:
            # Low credibility for content with misleading patterns
            return {
                "overall_credibility_score": 25,
                "is_misleading": True,
                "risk_level": "high",
                "issues_found": [
                    {
                        "type": "misleading_headline",
                        "severity": "high",
                        "description": "Content contains sensationalized language typical of misinformation",
                        "evidence": "Uses phrases like 'shocking truth' or 'secret they don't want you to know'",
                        "location": "Throughout the article"
                    },
                    {
                        "type": "unsubstantiated_claim",
                        "severity": "medium",
                        "description": "Makes claims without proper evidence or citations",
                        "evidence": "Lacks credible sources and peer-reviewed references",
                        "location": "Main content body"
                    }
                ],
                "positive_indicators": [],
                "sources_mentioned": 0,
                "fact_check_summary": "This content exhibits multiple red flags typical of misinformation including sensationalized language and unsubstantiated claims.",
                "recommendation": "avoid",
                "key_claims": [
                    {
                        "claim": "Various health/conspiracy claims",
                        "verifiable": False,
                        "confidence": "low"
                    }
                ],
                "analyzed_url": page_data.get("url"),
                "analyzed_title": page_data.get("title"),
                "analyzed_domain": domain,
                "analysis_timestamp": time.time(),
                "word_count": page_data.get("word_count", 0)
            }
        
        # Return None to use AI analysis for other cases
        return None

    def create_fallback_analysis(self, page_data: Dict[str, Any], error: str) -> Dict[str, Any]:
        """
        Create fallback analysis when AI fails
        """
        return {
            "error": f"Failed to analyze content: {error}",
            "overall_credibility_score": 50,
            "is_misleading": False,
            "risk_level": "unknown",
            "fact_check_summary": f"Analysis failed: {error}",
            "analyzed_url": page_data.get("url"),
            "analyzed_title": page_data.get("title"),
            "analyzed_domain": page_data.get("domain"),
            "analysis_timestamp": time.time(),
            "word_count": page_data.get("word_count", 0)
        }

    def analyze_page(self, url: str) -> Dict[str, Any]:
        """
        Complete page analysis pipeline
        """
        # Step 1: Scrape page content
        page_data = self.scrape_page_content(url)
        
        if "error" in page_data:
            return page_data
        
        # Step 2: Analyze factual accuracy
        analysis = self.analyze_factual_accuracy(page_data)
        
        return analysis

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python PageAnalyzer.py <url>"}))
        sys.exit(1)
    
    url = sys.argv[1]
    analyzer = PageAnalyzer()
    result = analyzer.analyze_page(url)
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()