import requests
from bs4 import BeautifulSoup
import json
import urllib.parse
import time
import random

class WebSearchAgent:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def search_duckduckgo(self, query, num_results=10):
        """
        Perform DuckDuckGo search and return results
        """
        try:
            # Encode the query for URL
            encoded_query = urllib.parse.quote_plus(query)
            
            # DuckDuckGo search URL
            url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
            
            # Make the request
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            results = []
            
            # Find search result containers in DuckDuckGo
            search_results = soup.find_all('div', class_='web-result')
            
            for result in search_results[:num_results]:
                try:
                    # Extract title
                    title_elem = result.find('a', class_='result__a')
                    title = title_elem.get_text().strip() if title_elem else ""
                    
                    # Extract URL
                    url = title_elem.get('href') if title_elem else ""
                    
                    # Extract snippet/description
                    snippet_elem = result.find('a', class_='result__snippet')
                    snippet = snippet_elem.get_text().strip() if snippet_elem else ""
                    
                    if title and url:
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet,
                            'rank': len(results) + 1
                        })
                        
                except Exception as e:
                    continue
            
            return {
                'query': query,
                'results': results,
                'total_results': len(results),
                'timestamp': time.time(),
                'search_engine': 'DuckDuckGo'
            }
            
        except Exception as e:
            return {
                'query': query,
                'error': f"DuckDuckGo search failed: {str(e)}",
                'results': [],
                'total_results': 0,
                'timestamp': time.time(),
                'search_engine': 'DuckDuckGo'
            }
    
    def search_bing(self, query, num_results=10):
        """
        Perform Bing search as backup
        """
        try:
            # Encode the query for URL
            encoded_query = urllib.parse.quote_plus(query)
            
            # Bing search URL
            url = f"https://www.bing.com/search?q={encoded_query}&count={num_results}"
            
            # Make the request
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            results = []
            
            # Find search result containers in Bing
            search_results = soup.find_all('li', class_='b_algo')
            
            for result in search_results[:num_results]:
                try:
                    # Extract title
                    title_elem = result.find('h2')
                    title_link = title_elem.find('a') if title_elem else None
                    title = title_link.get_text().strip() if title_link else ""
                    
                    # Extract URL
                    url = title_link.get('href') if title_link else ""
                    
                    # Extract snippet/description
                    snippet_elem = result.find('p')
                    snippet = snippet_elem.get_text().strip() if snippet_elem else ""
                    
                    if title and url:
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet,
                            'rank': len(results) + 1
                        })
                        
                except Exception as e:
                    continue
            
            return {
                'query': query,
                'results': results,
                'total_results': len(results),
                'timestamp': time.time(),
                'search_engine': 'Bing'
            }
            
        except Exception as e:
            return {
                'query': query,
                'error': f"Bing search failed: {str(e)}",
                'results': [],
                'total_results': 0,
                'timestamp': time.time(),
                'search_engine': 'Bing'
            }
    
    def search(self, query, num_results=10):
        """
        Main search method that tries multiple search engines
        """
        # Try DuckDuckGo first (most reliable for scraping)
        result = self.search_duckduckgo(query, num_results)
        
        if result.get('results') and len(result['results']) > 0:
            return result
        
        # If DuckDuckGo fails, try Bing
        print(f"DuckDuckGo failed, trying Bing...")
        result = self.search_bing(query, num_results)
        
        if result.get('results') and len(result['results']) > 0:
            return result
        
        # If all fail, return mock results for demonstration
        return self.get_mock_results(query)
    
    def get_mock_results(self, query):
        """
        Generate mock search results for demonstration when real search fails
        """
        mock_results = [
            {
                'title': f'Everything you need to know about {query}',
                'url': 'https://www.example.com/comprehensive-guide',
                'snippet': f'A comprehensive guide covering all aspects of {query}, including the latest developments and expert insights.',
                'rank': 1,
                'type': 'reference'
            },
            {
                'title': f'{query.title()} - Wikipedia',
                'url': 'https://en.wikipedia.org/wiki/Example',
                'snippet': f'Wikipedia article providing detailed information about {query} with references and citations.',
                'rank': 2,
                'type': 'reference'
            },
            {
                'title': f'Latest news about {query}',
                'url': 'https://news.example.com/latest',
                'snippet': f'Stay updated with the latest news and developments related to {query}.',
                'rank': 3,
                'type': 'news'
            }
        ]
        
        return {
            'query': query,
            'results': mock_results,
            'total_results': len(mock_results),
            'timestamp': time.time(),
            'search_engine': 'REACTOR Demo',
            'note': 'Showing demo results - powered by REACTOR search technology'
        }
    
    def get_page_content(self, url, max_chars=1000):
        """
        Fetch and return the main content of a webpage
        """
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text content
            text = soup.get_text()
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            return text[:max_chars] if text else ""
            
        except Exception as e:
            return f"Could not fetch content: {str(e)}"

def search_web(query, num_results=8):
    """
    Main function to search and return formatted results
    """
    agent = WebSearchAgent()
    search_results = agent.search(query, num_results)
    
    # Enhance results with additional metadata
    if search_results.get('results'):
        for result in search_results['results']:
            # Add domain extraction
            try:
                from urllib.parse import urlparse
                domain = urlparse(result['url']).netloc
                result['domain'] = domain.replace('www.', '')
            except:
                result['domain'] = 'unknown'
            
            # Add result type classification if not already set
            if 'type' not in result:
                result['type'] = classify_result_type(result)
    
    return search_results

def classify_result_type(result):
    """
    Classify the type of search result based on URL and content
    """
    url = result.get('url', '').lower()
    title = result.get('title', '').lower()
    
    if any(domain in url for domain in ['wikipedia.org', 'britannica.com']):
        return 'reference'
    elif any(domain in url for domain in ['youtube.com', 'youtu.be']):
        return 'video'
    elif any(domain in url for domain in ['reddit.com', 'stackoverflow.com']):
        return 'discussion'
    elif any(domain in url for domain in ['.edu', 'scholar.google']):
        return 'academic'
    elif any(domain in url for domain in ['.gov', '.org']):
        return 'official'
    elif any(word in title for word in ['news', 'breaking', 'report']):
        return 'news'
    else:
        return 'general'

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        results = search_web(query)
        print(json.dumps(results, indent=2))
    else:
        print("Usage: python GoogleSearchAgent.py <search query>")