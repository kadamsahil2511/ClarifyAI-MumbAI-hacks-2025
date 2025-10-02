// Background Script for Fact Checker Pro Extension

console.log('Fact Checker Pro background script loading...');

// Global variables
let isInitialized = false;

// Initialize the extension
function initializeExtension() {
    if (isInitialized) {
        console.log('Extension already initialized');
        return;
    }

    console.log('Initializing Fact Checker Pro extension...');
    
    try {
        setupEventListeners();
        isInitialized = true;
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    // Event listeners are set up at the bottom of the file
}

// Handle keyboard commands
async function handleCommand(command) {
    console.log('Command received:', command);

    switch (command) {
        case 'open_fact_checker':
            await openFactChecker();
            break;
        default:
            console.log('Unknown command:', command);
    }
}

// Open the fact checker popup
async function openFactChecker() {
    try {
        // Get the current active tab
        const [activeTab] = await chrome.tabs.query({ 
            active: true, 
            currentWindow: true 
        });

        if (!activeTab) {
            console.error('No active tab found');
            return;
        }

        // Open the extension popup
        await chrome.action.openPopup();

    } catch (error) {
        console.error('Error opening fact checker:', error);
        
        // Fallback: try to open as a new tab if popup fails
        try {
            await chrome.tabs.create({
                url: chrome.runtime.getURL('popup.html'),
                active: true
            });
        } catch (tabError) {
            console.error('Failed to open as tab:', tabError);
        }
    }
}

// Handle messages from popup and content scripts
async function handleMessage(request, sender, sendResponse) {
    console.log('Message received:', request);

    try {
        switch (request.action) {
            case 'openFactChecker':
                await openFactChecker();
                sendResponse({ success: true });
                break;

            case 'ping':
                sendResponse({ success: true, pong: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle installation
function handleInstallation(details) {
    console.log('Extension installed/updated:', details.reason);

    if (details.reason === 'install') {
        // First time installation
        showWelcomeNotification();
        setDefaultSettings();
    }
    
    console.log('Installation completed successfully');
}

// Show welcome notification
async function showWelcomeNotification() {
    try {
        await chrome.notifications.create('welcome', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Fact Checker Pro Installed!',
            message: 'Press Cmd/Ctrl + Shift + F to start fact-checking.'
        });

        // Clear notification after 5 seconds
        setTimeout(() => {
            chrome.notifications.clear('welcome');
        }, 5000);
    } catch (error) {
        console.error('Failed to show welcome notification:', error);
    }
}

// Set default settings
async function setDefaultSettings() {
    const defaultSettings = {
        autoAnalyze: false,
        showConfidenceScore: true,
        saveHistory: true,
        apiEndpoint: 'http://localhost:5000/api',
        theme: 'light'
    };

    try {
        await chrome.storage.sync.set({ settings: defaultSettings });
        console.log('Default settings saved');
    } catch (error) {
        console.error('Failed to save default settings:', error);
    }
}

// Event Listeners (set up at module level to avoid conflicts)

// Handle keyboard shortcuts
if (chrome.commands && chrome.commands.onCommand) {
    chrome.commands.onCommand.addListener(handleCommand);
    console.log('Keyboard command listener set up');
}

// Handle extension installation/startup
if (chrome.runtime && chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener(handleInstallation);
    console.log('Installation listener set up');
}

// Handle messages from content scripts and popup
if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sender, sendResponse);
        return true; // Keep message channel open for async responses
    });
    console.log('Message listener set up');
}

// Handle extension startup
if (chrome.runtime && chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        console.log('Extension started');
    });
    console.log('Startup listener set up');
}

// Initialize immediately
initializeExtension();

console.log('Fact Checker Pro background script loaded successfully');