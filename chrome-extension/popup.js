// Popup JavaScript for Fact Checker Pro Extension

class FactCheckerPopup {
    constructor() {
        this.apiBaseUrl = 'http://localhost:5001/api';
        this.currentTab = 'text';
        this.isLoading = false;
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // Minimum 1 second between requests
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCurrentPageInfo();
        this.checkApiConnection();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Check buttons
        document.getElementById('checkTextBtn').addEventListener('click', () => this.checkText());
        document.getElementById('checkUrlBtn').addEventListener('click', () => this.checkUrl());
        document.getElementById('checkImageBtn').addEventListener('click', () => this.checkImage());
        document.getElementById('checkPageBtn').addEventListener('click', () => this.checkCurrentPage());

        // File input handling
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageUpload(e));

        // Result actions
        document.getElementById('copyResultBtn').addEventListener('click', () => this.copyResult());
        document.getElementById('shareResultBtn').addEventListener('click', () => this.shareResult());

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());

        // Enter key handling for text inputs
        document.getElementById('textInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) this.checkText();
        });

        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkUrl();
        });
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Tab`);
        });

        this.currentTab = tabName;
        this.hideResults();
    }

    async loadCurrentPageInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                document.getElementById('currentPageUrl').textContent = tab.url;
                document.getElementById('currentPageTitle').textContent = tab.title || 'Untitled';
            }
        } catch (error) {
            console.error('Error loading page info:', error);
            document.getElementById('currentPageUrl').textContent = 'Unable to access page';
            document.getElementById('currentPageTitle').textContent = 'Permission required';
        }
    }

    async checkApiConnection() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const isConnected = response.ok;
            
            this.updateConnectionStatus(isConnected);
        } catch (error) {
            console.error('API connection failed:', error);
            this.updateConnectionStatus(false);
        }
    }

    async analyzeExplanationWithAI(explanation, claim) {
        try {
            // Create a simple, direct prompt for AI analysis
            const analysisPrompt = `Is this claim TRUE or FALSE based on the explanation?

CLAIM: "${claim}"

EXPLANATION: "${explanation}"

Answer with just one word: TRUE or FALSE`;

            const response = await fetch(`${this.apiBaseUrl}/fact-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    type: 'text', 
                    data: { text: analysisPrompt }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiResponse = await response.json();
            const result = apiResponse.success ? apiResponse.data : apiResponse;
            const aiExplanation = (result.explanation || '').toLowerCase();
            
            console.log('AI Response for analysis:', aiExplanation.substring(0, 200));
            
            // Look for clear TRUE/FALSE indicators in the response
            if (aiExplanation.includes('false') || aiExplanation.includes('wrong') || 
                aiExplanation.includes('incorrect') || aiExplanation.includes('refut')) {
                return { verdict: 'false', reasoning: 'AI analysis indicates false' };
            } else if (aiExplanation.includes('true') || aiExplanation.includes('correct') || 
                      aiExplanation.includes('support') || aiExplanation.includes('confirm')) {
                return { verdict: 'true', reasoning: 'AI analysis indicates true' };
            } else {
                // If unclear, analyze the original explanation directly
                if (explanation.toLowerCase().includes('myth') || 
                    explanation.toLowerCase().includes('debunked') ||
                    explanation.toLowerCase().includes('retracted') ||
                    explanation.toLowerCase().includes('fraudulent')) {
                    return { verdict: 'false', reasoning: 'Direct analysis indicates false' };
                } else {
                    return { verdict: 'unknown', reasoning: 'Cannot determine from analysis' };
                }
            }
        } catch (error) {
            console.error('AI explanation analysis failed:', error);
            throw error;
        }
    }

    updateConnectionStatus(isConnected) {
        const indicator = document.getElementById('statusIndicator');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('span');

        if (isConnected) {
            dot.style.background = '#10b981';
            text.textContent = 'Ready';
        } else {
            dot.style.background = '#ef4444';
            text.textContent = 'API Offline';
        }
    }

    async checkText() {
        const input = document.getElementById('textInput').value.trim();
        
        if (!input) {
            this.showError('Please enter a claim to fact-check');
            return;
        }

        await this.performFactCheck('text', { text: input });
    }

    async checkUrl() {
        const input = document.getElementById('urlInput').value.trim();
        
        if (!input) {
            this.showError('Please enter a URL to analyze');
            return;
        }

        if (!this.isValidUrl(input)) {
            this.showError('Please enter a valid URL');
            return;
        }

        await this.performFactCheck('url', { url: input });
    }

    async checkImage() {
        const fileInput = document.getElementById('imageInput');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('Please select an image to analyze');
            return;
        }

        // Convert image to base64
        const base64 = await this.fileToBase64(file);
        await this.performFactCheck('image', { 
            image: base64,
            filename: file.name,
            type: file.type
        });
    }

    async checkCurrentPage() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url) {
                this.showError('Unable to access current page');
                return;
            }

            await this.performFactCheck('page', { url: tab.url });
        } catch (error) {
            console.error('Error checking current page:', error);
            this.showError('Unable to analyze current page');
        }
    }

    async performFactCheck(type, data) {
        // Prevent rapid successive requests
        const now = Date.now();
        if (this.isLoading || (now - this.lastRequestTime) < this.minRequestInterval) {
            console.log('Request throttled - too soon after last request');
            return;
        }

        this.isLoading = true;
        this.lastRequestTime = now;
        this.showLoading();

        try {
            const response = await fetch(`${this.apiBaseUrl}/fact-check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type, data })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiResponse = await response.json();
            
            // Extract the actual fact-check data from the API response
            const result = apiResponse.success ? apiResponse.data : apiResponse;
            await this.displayResult(result);

            // Save to storage for history
            this.saveToHistory(type, data, result);

        } catch (error) {
            console.error('Fact check error:', error);
            this.showError('Failed to perform fact check. Please check your connection and try again.');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    showLoading() {
        const resultsSection = document.getElementById('resultsSection');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const resultCard = document.getElementById('resultCard');

        resultsSection.classList.add('show');
        loadingIndicator.style.display = 'flex';
        resultCard.classList.remove('show');

        // Disable all check buttons
        document.querySelectorAll('.check-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        loadingIndicator.style.display = 'none';

        // Re-enable check buttons
        document.querySelectorAll('.check-btn').forEach(btn => {
            btn.disabled = false;
        });
    }

    hideResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultCard = document.getElementById('resultCard');
        
        resultsSection.classList.remove('show');
        resultCard.classList.remove('show');
    }

    async displayResult(result) {
        const resultCard = document.getElementById('resultCard');
        const statusIcon = document.getElementById('statusIcon');
        const statusText = document.getElementById('statusText');
        const scoreValue = document.getElementById('scoreValue');
        const resultClaim = document.getElementById('resultClaim');
        const resultExplanation = document.getElementById('resultExplanation');
        const sourcesList = document.getElementById('sourcesList');

        // Determine status based on available data
        let status = 'unknown';
        let statusLabel = 'Analysis Complete';
        
        // Check for explicit correctness indicators first
        if (result.is_correct === true) {
            status = 'true';
            statusLabel = 'True';
        } else if (result.is_correct === false) {
            status = 'false';
            statusLabel = 'False';
        } else if (result.is_misleading === true) {
            status = 'false';
            statusLabel = 'Misleading';
        } else if (result.is_misleading === false) {
            status = 'true';
            statusLabel = 'Reliable';
        } else if (result.explanation) {
            // Use AI to analyze the explanation and determine the verdict
            try {
                const aiAnalysis = await this.analyzeExplanationWithAI(result.explanation, result.claim || result.query);
                console.log('AI Analysis Result:', aiAnalysis);
                
                if (aiAnalysis.verdict === 'false') {
                    status = 'false';
                    statusLabel = 'False';
                } else if (aiAnalysis.verdict === 'true') {
                    status = 'true';
                    statusLabel = 'True';
                } else {
                    status = 'unknown';
                    statusLabel = 'Cannot Determine';
                }
            } catch (error) {
                console.error('AI analysis failed, using simple text analysis:', error);
                
                // Fallback to simple text analysis
                const explanation = result.explanation.toLowerCase();
                
                // Look for strong debunking language
                if (explanation.includes('false') || explanation.includes('wrong') || 
                    explanation.includes('myth') || explanation.includes('debunked') ||
                    explanation.includes('refuted') || explanation.includes('retracted') ||
                    explanation.includes('no evidence') || explanation.includes('fraudulent')) {
                    status = 'false';
                    statusLabel = 'False';
                } 
                // Look for strong supporting language
                else if (explanation.includes('true') || explanation.includes('correct') ||
                         explanation.includes('confirmed') || explanation.includes('proven') ||
                         explanation.includes('evidence shows') || explanation.includes('established')) {
                    status = 'true';
                    statusLabel = 'True';
                }
                // Use confidence score as final fallback
                else if (result.confidence_score >= 85) {
                    status = 'true';
                    statusLabel = 'True';
                } else if (result.confidence_score <= 25) {
                    status = 'false';
                    statusLabel = 'False';
                } else {
                    status = 'unknown';
                    statusLabel = 'Cannot Determine';
                }
            }
        }

        // Update status display
        statusIcon.className = `status-icon ${status}`;
        statusText.textContent = statusLabel;
        statusText.parentElement.className = `result-status ${status}`;

        // Update confidence score
        const confidence = result.confidence_score || result.overall_credibility_score || 0;
        scoreValue.textContent = `${confidence}%`;

        // Update claim
        const claim = result.claim || result.query || result.analyzed_title || 'Fact Check Analysis';
        resultClaim.textContent = claim;

        // Update explanation
        const explanation = result.explanation || result.fact_check_summary || result.summary || 'Analysis completed successfully.';
        resultExplanation.textContent = explanation;

        // Update sources
        sourcesList.innerHTML = '';
        const sources = result.sources || [];
        
        if (sources.length > 0) {
            sources.forEach(source => {
                const li = document.createElement('li');
                if (this.isValidUrl(source)) {
                    const a = document.createElement('a');
                    a.href = source;
                    a.textContent = this.formatUrl(source);
                    a.target = '_blank';
                    li.appendChild(a);
                } else {
                    li.textContent = source;
                }
                sourcesList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No sources provided';
            sourcesList.appendChild(li);
        }

        // Show result card
        resultCard.classList.add('show');
        
        // Store current result for actions
        this.currentResult = result;
    }

    showError(message) {
        // Create or update error display
        let errorDiv = document.querySelector('.error-message');
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = `
                background: #fef2f2;
                border: 1px solid #fecaca;
                color: #dc2626;
                padding: 12px 16px;
                border-radius: 8px;
                margin: 16px 20px;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            
            document.querySelector('.input-section').appendChild(errorDiv);
        }

        errorDiv.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${message}
        `;

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        const preview = document.getElementById('imagePreview');
        const checkBtn = document.getElementById('checkImageBtn');

        if (file) {
            // Show preview
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            
            preview.innerHTML = '';
            preview.appendChild(img);
            
            // Enable check button
            checkBtn.disabled = false;
            
            // Update file display
            const display = document.getElementById('fileInputDisplay');
            display.querySelector('span').textContent = file.name;
        } else {
            preview.innerHTML = '';
            checkBtn.disabled = true;
        }
    }

    async copyResult() {
        if (!this.currentResult) return;

        const text = this.formatResultForCopy(this.currentResult);
        
        try {
            await navigator.clipboard.writeText(text);
            this.showSuccessMessage('Result copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showError('Failed to copy result');
        }
    }

    async shareResult() {
        if (!this.currentResult) return;

        const text = this.formatResultForCopy(this.currentResult);
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Fact Check Result',
                    text: text
                });
            } catch (error) {
                console.error('Share failed:', error);
            }
        } else {
            // Fallback to copy
            await this.copyResult();
        }
    }

    formatResultForCopy(result) {
        const status = result.is_correct === true ? 'TRUE' : 
                     result.is_correct === false ? 'FALSE' : 'UNKNOWN';
        const claim = result.claim || result.analyzed_title || 'Analysis';
        const explanation = result.explanation || result.fact_check_summary || '';
        const confidence = result.confidence_score || result.overall_credibility_score || 0;

        return `FACT CHECK RESULT
Status: ${status}
Confidence: ${confidence}%
Claim: ${claim}
Explanation: ${explanation}

Generated by Fact Checker Pro`;
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 16px 20px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        successDiv.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${message}
        `;
        
        document.querySelector('.input-section').appendChild(successDiv);

        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }

    openSettings() {
        // Open options page
        chrome.runtime.openOptionsPage();
    }

    async saveToHistory(type, data, result) {
        try {
            const history = await this.getStorageData('factCheckHistory') || [];
            
            const entry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                type,
                data,
                result
            };

            history.unshift(entry);
            
            // Keep only last 50 entries
            if (history.length > 50) {
                history.splice(50);
            }

            await this.setStorageData('factCheckHistory', history);
        } catch (error) {
            console.error('Failed to save to history:', error);
        }
    }

    async getStorageData(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    async setStorageData(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
        } catch (_) {
            return url;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FactCheckerPopup();
});

// Handle messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openFactChecker') {
        // Popup is already open, just focus on it
        window.focus();
    }
});

// Handle keyboard shortcuts within popup
document.addEventListener('keydown', (e) => {
    // Escape to close
    if (e.key === 'Escape') {
        window.close();
    }
    
    // Tab navigation
    if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        // Handle reverse tab navigation if needed
    }
});

// Auto-focus first input when popup opens
window.addEventListener('load', () => {
    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.focus();
    }
});
