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
            dot.style.background = 'var(--success-color)';
            text.textContent = 'Ready';
        } else {
            dot.style.background = 'var(--error-color)';
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
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const apiResponse = await response.json();
            
            if (!apiResponse.success) {
                throw new Error(apiResponse.error || 'API returned an unsuccessful response.');
            }

            const result = apiResponse.data;
            this.displayResult(result);

            // Save to storage for history
            this.saveToHistory(type, data, result);

        } catch (error) {
            console.error('Fact check error:', error);
            this.showError(`Fact check failed: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    showLoading() {
        const resultsSection = document.getElementById('resultsSection');
        const loader = document.getElementById('loadingIndicator');
        const resultCard = document.getElementById('resultCard');

        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        if (loader) {
            loader.style.display = 'flex';
        }

        if (resultCard) {
            resultCard.classList.remove('show');
        }

        document.querySelectorAll('.check-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    hideLoading() {
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.style.display = 'none';
        }

        document.querySelectorAll('.check-btn').forEach(btn => {
            btn.disabled = false;
        });
    }

    hideResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultCard = document.getElementById('resultCard');

        if (resultsSection) {
            resultsSection.style.display = 'none';
        }

        if (resultCard) {
            resultCard.classList.remove('show');
        }
    }

    displayResult(result) {
        const statusText = document.getElementById('statusText');
        const statusIcon = document.getElementById('statusIcon');
        const scoreValue = document.getElementById('scoreValue');
        const resultCard = document.getElementById('resultCard');
        const resultClaim = document.getElementById('resultClaim');
        const resultExplanation = document.getElementById('resultExplanation');
        const issuesContainer = document.getElementById('resultIssues');
        const issuesList = document.getElementById('issuesList');
        const recommendation = document.getElementById('resultRecommendation');
        const sourcesList = document.getElementById('sourcesList');
        const resultsSection = document.getElementById('resultsSection');
        const loader = document.getElementById('loadingIndicator');

        if (resultsSection) {
            resultsSection.style.display = 'block';
        }

        if (loader) {
            loader.style.display = 'none';
        }

        if (resultCard) {
            resultCard.classList.add('show');
        }

        const { verdictClass, verdictLabel } = this.getVerdictDetails(result);

        if (statusText) {
            statusText.textContent = verdictLabel;
        }

        if (statusIcon) {
            statusIcon.className = `status-icon ${verdictClass}`;
        }

        const confidence = this.getConfidenceScore(result);
        if (scoreValue) {
            scoreValue.textContent = `${confidence}%`;
        }

        if (resultClaim) {
            resultClaim.textContent = this.getDisplayClaim(result);
        }

        if (resultExplanation) {
            resultExplanation.textContent = this.getExplanation(result);
        }

        this.renderIssues(result, issuesContainer, issuesList);
        this.renderRecommendation(result, recommendation);
        this.renderSources(result.sources || [], sourcesList);

        this.currentResult = result;
    }

    getVerdictDetails(result) {
        if (result.is_correct === true) {
            return { verdictClass: 'true', verdictLabel: 'True' };
        }

        if (result.is_correct === false || result.is_misleading === true) {
            const label = result.is_misleading ? 'Misleading' : 'False';
            return { verdictClass: 'false', verdictLabel: label };
        }

        return { verdictClass: 'unknown', verdictLabel: 'Review' };
    }

    getConfidenceScore(result) {
        const scores = [
            result.confidence_score,
            result.overall_credibility_score,
            result.confidence,
        ].filter(score => typeof score === 'number');

        if (scores.length === 0) {
            return 0;
        }

        const score = Math.max(...scores);
        return Math.round(score);
    }

    getDisplayClaim(result) {
        return result.claim || result.query || result.analyzed_title || 'Fact Check Analysis';
    }

    getExplanation(result) {
        return result.explanation || result.fact_check_summary || 'No detailed explanation provided.';
    }

    escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    renderIssues(result, container, listElement) {
        const issues = result.issues_found || [];
        if (!container || !listElement) {
            return;
        }

        if (!issues.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        listElement.innerHTML = issues.map(issue => {
            const typeRaw = issue.type ? issue.type.replace(/_/g, ' ') : 'Issue';
            const severityRaw = issue.severity ? String(issue.severity).toUpperCase() : 'UNKNOWN';
            const descriptionRaw = issue.description || 'No description provided.';
            const evidenceRaw = issue.evidence ? String(issue.evidence) : '';

            const type = this.escapeHtml(typeRaw);
            const severity = this.escapeHtml(severityRaw);
            const description = this.escapeHtml(descriptionRaw).replace(/\n/g, '<br />');
            const evidence = evidenceRaw ? `<p>${this.escapeHtml(evidenceRaw).replace(/\n/g, '<br />')}</p>` : '';
            return `
                <div class="issue-item">
                    <strong>${type} • ${severity}</strong>
                    <p>${description}</p>
                    ${evidence}
                </div>
            `;
        }).join('');
    }

    renderRecommendation(result, element) {
        if (!element) {
            return;
        }

        if (!result.recommendation) {
            element.textContent = '';
            element.style.display = 'none';
            return;
        }

        element.style.display = 'block';
        element.textContent = `Recommendation: ${result.recommendation}`;
    }

    renderSources(sources, listElement) {
        if (!listElement) {
            return;
        }

        if (!sources.length) {
            listElement.innerHTML = '<li>No sources provided</li>';
            return;
        }

        listElement.innerHTML = sources.map(source => {
            if (typeof source === 'string' && this.isValidUrl(source)) {
                try {
                    const urlObj = new URL(source);
                    const safeHref = urlObj.toString();
                    const label = this.escapeHtml(this.formatUrl(safeHref));
                    return `<li><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a></li>`;
                } catch (error) {
                    // Fall through to render as text if URL parsing fails
                }
            }
            const fallback = this.escapeHtml(source);
            return `<li>${fallback}</li>`;
        }).join('');
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
