// Content Script for Fact Checker Pro Extension

class FactCheckerContent {
    constructor() {
        this.isInjected = false;
        this.selectedText = '';
        this.contextElement = null;
        this.overlay = null;
        
        this.init();
    }

    init() {
        // Prevent multiple injections
        if (window.factCheckerContentLoaded) {
            return;
        }
        window.factCheckerContentLoaded = true;

        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.injectStyles();
        
        console.log('Fact Checker Pro content script loaded');
    }

    setupEventListeners() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open
        });

        // Track text selection
        document.addEventListener('mouseup', () => {
            this.handleTextSelection();
        });

        document.addEventListener('keyup', () => {
            this.handleTextSelection();
        });

        // Handle clicks on fact-checkable elements
        document.addEventListener('click', (e) => {
            this.handleElementClick(e);
        }, true);

        // Handle hover for quick preview (optional feature)
        document.addEventListener('mouseover', (e) => {
            this.handleElementHover(e);
        });

        document.addEventListener('mouseout', (e) => {
            this.handleElementHoverOut(e);
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + F for quick fact check of selected text
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                this.quickFactCheckSelection();
            }

            // Escape to close any overlays
            if (e.key === 'Escape') {
                this.closeOverlays();
            }
        });
    }

    injectStyles() {
        if (document.getElementById('fact-checker-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'fact-checker-styles';
        style.textContent = `
            .fact-checker-highlight {
                background-color: rgba(79, 70, 229, 0.2) !important;
                border-radius: 3px !important;
                cursor: pointer !important;
                transition: background-color 0.2s ease !important;
            }

            .fact-checker-highlight:hover {
                background-color: rgba(79, 70, 229, 0.3) !important;
            }

            .fact-checker-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 2147483647 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                animation: factCheckerFadeIn 0.3s ease-out !important;
            }

            @keyframes factCheckerFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .fact-checker-modal {
                background: white !important;
                border-radius: 12px !important;
                padding: 24px !important;
                max-width: 500px !important;
                width: 90% !important;
                max-height: 80vh !important;
                overflow-y: auto !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
                animation: factCheckerSlideUp 0.3s ease-out !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }

            @keyframes factCheckerSlideUp {
                from { 
                    opacity: 0;
                    transform: translateY(20px);
                }
                to { 
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .fact-checker-modal h3 {
                margin: 0 0 16px 0 !important;
                color: #1f2937 !important;
                font-size: 18px !important;
                font-weight: 600 !important;
            }

            .fact-checker-modal .status {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                margin-bottom: 16px !important;
                padding: 12px !important;
                border-radius: 8px !important;
                font-weight: 500 !important;
            }

            .fact-checker-modal .status.true {
                background: #f0fdf4 !important;
                color: #166534 !important;
                border: 1px solid #bbf7d0 !important;
            }

            .fact-checker-modal .status.false {
                background: #fef2f2 !important;
                color: #dc2626 !important;
                border: 1px solid #fecaca !important;
            }

            .fact-checker-modal .status.unknown {
                background: #fffbeb !important;
                color: #d97706 !important;
                border: 1px solid #fed7aa !important;
            }

            .fact-checker-modal .explanation {
                color: #4b5563 !important;
                line-height: 1.6 !important;
                margin-bottom: 16px !important;
            }

            .fact-checker-modal .sources {
                margin-bottom: 16px !important;
            }

            .fact-checker-modal .sources h4 {
                margin: 0 0 8px 0 !important;
                color: #374151 !important;
                font-size: 14px !important;
                font-weight: 600 !important;
            }

            .fact-checker-modal .sources ul {
                margin: 0 !important;
                padding-left: 16px !important;
                list-style: none !important;
            }

            .fact-checker-modal .sources li {
                margin-bottom: 4px !important;
                font-size: 13px !important;
                color: #6b7280 !important;
                position: relative !important;
            }

            .fact-checker-modal .sources li::before {
                content: '•' !important;
                color: #4f46e5 !important;
                position: absolute !important;
                left: -12px !important;
            }

            .fact-checker-modal .actions {
                display: flex !important;
                gap: 8px !important;
                justify-content: flex-end !important;
            }

            .fact-checker-modal button {
                padding: 8px 16px !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
                background: white !important;
                color: #374151 !important;
                cursor: pointer !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                transition: all 0.2s ease !important;
            }

            .fact-checker-modal button:hover {
                background: #f3f4f6 !important;
                border-color: #9ca3af !important;
            }

            .fact-checker-modal button.primary {
                background: #4f46e5 !important;
                color: white !important;
                border-color: #4f46e5 !important;
            }

            .fact-checker-modal button.primary:hover {
                background: #4338ca !important;
                border-color: #4338ca !important;
            }

            .fact-checker-tooltip {
                position: absolute !important;
                background: #1f2937 !important;
                color: white !important;
                padding: 8px 12px !important;
                border-radius: 6px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                z-index: 2147483646 !important;
                pointer-events: none !important;
                opacity: 0 !important;
                transition: opacity 0.2s ease !important;
                max-width: 200px !important;
                word-wrap: break-word !important;
            }

            .fact-checker-tooltip.show {
                opacity: 1 !important;
            }

            .fact-checker-tooltip::after {
                content: '' !important;
                position: absolute !important;
                top: 100% !important;
                left: 50% !important;
                margin-left: -5px !important;
                border-width: 5px !important;
                border-style: solid !important;
                border-color: #1f2937 transparent transparent transparent !important;
            }

            .fact-checker-loading {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 12px !important;
                padding: 20px !important;
                color: #6b7280 !important;
            }

            .fact-checker-spinner {
                width: 20px !important;
                height: 20px !important;
                border: 2px solid #e5e7eb !important;
                border-top: 2px solid #4f46e5 !important;
                border-radius: 50% !important;
                animation: factCheckerSpin 1s linear infinite !important;
            }

            @keyframes factCheckerSpin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;

        document.head.appendChild(style);
    }

    handleMessage(request, sender, sendResponse) {
        console.log('Content script received message:', request);

        switch (request.action) {
            case 'factCheckText':
                this.factCheckText(request.text);
                sendResponse({ success: true });
                break;

            case 'factCheckUrl':
                this.factCheckUrl(request.url);
                sendResponse({ success: true });
                break;

            case 'factCheckImage':
                this.factCheckImage(request.imageUrl);
                sendResponse({ success: true });
                break;

            case 'factCheckPage':
                this.factCheckCurrentPage();
                sendResponse({ success: true });
                break;

            case 'highlightClaims':
                this.highlightFactCheckableClaims();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }

    handleTextSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 10) {
            this.selectedText = text;
            this.showSelectionTooltip(selection);
        } else {
            this.hideSelectionTooltip();
        }
    }

    showSelectionTooltip(selection) {
        // Remove existing tooltip
        this.hideSelectionTooltip();

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const tooltip = document.createElement('div');
        tooltip.className = 'fact-checker-tooltip';
        tooltip.id = 'fact-checker-selection-tooltip';
        tooltip.textContent = 'Click to fact-check this text';
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 40}px`;
        tooltip.style.transform = 'translateX(-50%)';

        document.body.appendChild(tooltip);

        // Show tooltip after a brief delay
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 100);

        // Add click handler
        tooltip.addEventListener('click', () => {
            this.factCheckText(this.selectedText);
            this.hideSelectionTooltip();
        });

        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.hideSelectionTooltip();
        }, 3000);
    }

    hideSelectionTooltip() {
        const tooltip = document.getElementById('fact-checker-selection-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    handleElementClick(e) {
        // Check if clicking on a highlighted claim
        if (e.target.classList.contains('fact-checker-highlight')) {
            e.preventDefault();
            e.stopPropagation();
            
            const text = e.target.textContent.trim();
            if (text) {
                this.factCheckText(text);
            }
        }
    }

    handleElementHover(e) {
        // Show preview for highlighted elements
        if (e.target.classList.contains('fact-checker-highlight')) {
            this.showElementTooltip(e.target, 'Click to fact-check this claim');
        }
    }

    handleElementHoverOut(e) {
        if (e.target.classList.contains('fact-checker-highlight')) {
            this.hideElementTooltip();
        }
    }

    showElementTooltip(element, text) {
        this.hideElementTooltip();

        const rect = element.getBoundingClientRect();
        const tooltip = document.createElement('div');
        tooltip.className = 'fact-checker-tooltip';
        tooltip.id = 'fact-checker-element-tooltip';
        tooltip.textContent = text;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 40}px`;
        tooltip.style.transform = 'translateX(-50%)';

        document.body.appendChild(tooltip);

        setTimeout(() => {
            tooltip.classList.add('show');
        }, 100);
    }

    hideElementTooltip() {
        const tooltip = document.getElementById('fact-checker-element-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    quickFactCheckSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 5) {
            this.factCheckText(text);
        } else {
            this.showNotification('Please select some text to fact-check', 'warning');
        }
    }

    async factCheckText(text) {
        if (!text || text.trim().length === 0) {
            return;
        }

        console.log('Fact-checking text:', text);
        
        this.showLoadingModal('Fact-checking selected text...');

        try {
            // Send to background script for processing
            const response = await chrome.runtime.sendMessage({
                action: 'factCheck',
                data: {
                    type: 'text',
                    content: text.trim()
                }
            });

            if (response.success) {
                this.showResultModal(text, response.result);
            } else {
                this.showErrorModal('Failed to fact-check text: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error fact-checking text:', error);
            this.showErrorModal('Failed to fact-check text. Please try again.');
        }
    }

    async factCheckUrl(url) {
        console.log('Fact-checking URL:', url);
        
        this.showLoadingModal('Analyzing URL...');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'factCheck',
                data: {
                    type: 'url',
                    content: url
                }
            });

            if (response.success) {
                this.showResultModal(`URL: ${url}`, response.result);
            } else {
                this.showErrorModal('Failed to analyze URL: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error fact-checking URL:', error);
            this.showErrorModal('Failed to analyze URL. Please try again.');
        }
    }

    async factCheckImage(imageUrl) {
        console.log('Fact-checking image:', imageUrl);
        
        this.showLoadingModal('Analyzing image...');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'factCheck',
                data: {
                    type: 'image',
                    content: imageUrl
                }
            });

            if (response.success) {
                this.showResultModal(`Image: ${imageUrl}`, response.result);
            } else {
                this.showErrorModal('Failed to analyze image: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error fact-checking image:', error);
            this.showErrorModal('Failed to analyze image. Please try again.');
        }
    }

    async factCheckCurrentPage() {
        console.log('Fact-checking current page');
        
        this.showLoadingModal('Analyzing current page...');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'factCheck',
                data: {
                    type: 'page',
                    content: window.location.href
                }
            });

            if (response.success) {
                this.showResultModal(`Page: ${document.title}`, response.result);
            } else {
                this.showErrorModal('Failed to analyze page: ' + (response.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error fact-checking page:', error);
            this.showErrorModal('Failed to analyze page. Please try again.');
        }
    }

    highlightFactCheckableClaims() {
        // Simple implementation to highlight potential claims
        const textNodes = this.getTextNodes(document.body);
        const claimPatterns = [
            /\b\d+%\b/g, // Percentages
            /\b\d+\s*(million|billion|thousand)\b/gi, // Large numbers
            /\b(studies show|research indicates|scientists say|experts claim)\b/gi, // Authority claims
            /\b(always|never|all|none|every|no one)\b/gi // Absolute statements
        ];

        textNodes.forEach(node => {
            let text = node.textContent;
            let hasMatch = false;

            claimPatterns.forEach(pattern => {
                if (pattern.test(text)) {
                    hasMatch = true;
                }
            });

            if (hasMatch && text.trim().length > 20) {
                this.highlightTextNode(node);
            }
        });
    }

    getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip script, style, and other non-content elements
                    const parent = node.parentElement;
                    if (parent && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    highlightTextNode(textNode) {
        const parent = textNode.parentElement;
        if (parent && !parent.classList.contains('fact-checker-highlight')) {
            const span = document.createElement('span');
            span.className = 'fact-checker-highlight';
            span.textContent = textNode.textContent;
            
            parent.replaceChild(span, textNode);
        }
    }

    showLoadingModal(message) {
        this.closeOverlays();

        const overlay = document.createElement('div');
        overlay.className = 'fact-checker-overlay';
        overlay.id = 'fact-checker-loading-overlay';

        const modal = document.createElement('div');
        modal.className = 'fact-checker-modal';

        modal.innerHTML = `
            <div class="fact-checker-loading">
                <div class="fact-checker-spinner"></div>
                <span>${message}</span>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeOverlays();
            }
        });

        this.overlay = overlay;
    }

    showResultModal(claim, result) {
        this.closeOverlays();

        const overlay = document.createElement('div');
        overlay.className = 'fact-checker-overlay';
        overlay.id = 'fact-checker-result-overlay';

        const modal = document.createElement('div');
        modal.className = 'fact-checker-modal';

        // Determine status
        let status = 'unknown';
        let statusText = 'Unknown';
        
        if (result.is_correct === true) {
            status = 'true';
            statusText = 'True';
        } else if (result.is_correct === false) {
            status = 'false';
            statusText = 'False';
        } else if (result.is_misleading === true) {
            status = 'false';
            statusText = 'Misleading';
        }

        const sources = result.sources || [];
        const sourcesHtml = sources.length > 0 
            ? `<div class="sources">
                <h4>Sources:</h4>
                <ul>
                    ${sources.map(source => `<li>${source}</li>`).join('')}
                </ul>
               </div>`
            : '';

        modal.innerHTML = `
            <h3>Fact Check Result</h3>
            <div class="status ${status}">
                <strong>${statusText}</strong>
                ${result.confidence_score ? `(${result.confidence_score}% confidence)` : ''}
            </div>
            <div class="claim"><strong>Claim:</strong> ${claim}</div>
            <div class="explanation">${result.explanation || 'No explanation provided.'}</div>
            ${sourcesHtml}
            <div class="actions">
                <button onclick="this.closest('.fact-checker-overlay').remove()">Close</button>
                <button class="primary" onclick="navigator.clipboard.writeText('${claim}\\n${statusText}: ${result.explanation}')">Copy Result</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeOverlays();
            }
        });

        this.overlay = overlay;
    }

    showErrorModal(message) {
        this.closeOverlays();

        const overlay = document.createElement('div');
        overlay.className = 'fact-checker-overlay';
        overlay.id = 'fact-checker-error-overlay';

        const modal = document.createElement('div');
        modal.className = 'fact-checker-modal';

        modal.innerHTML = `
            <h3>Error</h3>
            <div class="status false">
                <strong>Error occurred</strong>
            </div>
            <div class="explanation">${message}</div>
            <div class="actions">
                <button class="primary" onclick="this.closest('.fact-checker-overlay').remove()">Close</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.closeOverlays();
            }
        });

        this.overlay = overlay;
    }

    closeOverlays() {
        const overlays = document.querySelectorAll('.fact-checker-overlay');
        overlays.forEach(overlay => overlay.remove());
        this.overlay = null;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: ${type === 'error' ? '#fef2f2' : type === 'warning' ? '#fffbeb' : '#f0f9ff'} !important;
            color: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#1e40af'} !important;
            border: 1px solid ${type === 'error' ? '#fecaca' : type === 'warning' ? '#fed7aa' : '#bfdbfe'} !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            z-index: 2147483647 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
            animation: factCheckerSlideIn 0.3s ease-out !important;
        `;

        notification.textContent = message;
        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// Initialize content script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new FactCheckerContent();
    });
} else {
    new FactCheckerContent();
}
