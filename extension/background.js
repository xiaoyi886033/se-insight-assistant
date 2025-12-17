// extension/background.js - Robust service worker with keep-alive and proper async handling

console.log('SE Insight Background Service Worker Starting...');

// Service worker keep-alive mechanism
let keepAliveInterval;
let offscreenDocumentPromise = null;

// Keep service worker alive
function startKeepAlive() {
    if (keepAliveInterval) return;
    
    keepAliveInterval = setInterval(() => {
        console.log('Service worker keep-alive ping');
        // Perform a lightweight operation to keep worker alive
        chrome.storage.local.get(['keepAlive'], () => {
            if (chrome.runtime.lastError) {
                console.warn('Keep-alive storage access failed:', chrome.runtime.lastError);
            }
        });
    }, 25000); // Every 25 seconds (before 30s timeout)
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Enhanced offscreen document management
async function createOffscreenDocument(path) {
    // Return existing promise if creation is in progress
    if (offscreenDocumentPromise) {
        return offscreenDocumentPromise;
    }
    
    offscreenDocumentPromise = (async () => {
        try {
            // Check if offscreen document already exists
            const contexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT'],
                documentUrls: [chrome.runtime.getURL(path)],
            });

            if (contexts.length > 0) {
                console.log('Offscreen document already exists');
                return true;
            }

            // Create new offscreen document
            await chrome.offscreen.createDocument({
                url: path,
                reasons: ['WEB_RTC'], // Only WEB_RTC is needed for audio capture
                justification: 'Capture and process tab audio for real-time transcription and SE terminology analysis.'
            });
            
            console.log('Offscreen document created successfully');
            
            // Wait a moment for the document to fully initialize
            await new Promise(resolve => setTimeout(resolve, 100));
            
            return true;
            
        } catch (error) {
            console.error('Failed to create offscreen document:', error.name, error.message);
            
            // Reset promise on failure
            offscreenDocumentPromise = null;
            
            return false;
        }
    })();
    
    return offscreenDocumentPromise;
}

// Enhanced message forwarding to offscreen document
async function forwardToOffscreen(message, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // Ensure offscreen document exists
            const offscreenReady = await createOffscreenDocument('offscreen.html');
            if (!offscreenReady) {
                throw new Error('Offscreen document not available');
            }
            
            // Send message to offscreen document
            await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            console.log('Message forwarded to offscreen successfully');
            return true;
            
        } catch (error) {
            console.warn(`Offscreen message attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt < retries - 1) {
                // Reset offscreen promise and wait before retry
                offscreenDocumentPromise = null;
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    
    console.error('Failed to forward message to offscreen after all retries');
    return false;
}

// Main message handler with proper async support
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type, 'from:', sender.tab ? 'content script' : 'popup');
    
    // Handle async operations properly
    (async () => {
        try {
            switch (message.type) {
                case 'STREAM_ID_RECEIVED':
                    await handleStreamIdReceived(message, sendResponse);
                    break;
                    
                case 'STOP_CAPTURE':
                    await handleStopCapture(message, sendResponse);
                    break;
                    
                case 'OFFSCREEN_READY':
                    // Offscreen document is ready
                    console.log('Offscreen document ready');
                    sendResponse({ status: 'acknowledged' });
                    break;
                    
                default:
                    console.warn('Unknown message type:', message.type);
                    sendResponse({ status: 'error', error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ status: 'error', error: error.message });
        }
    })();
    
    // Return true to indicate async response
    return true;
});

// Handle stream ID received from popup
async function handleStreamIdReceived(message, sendResponse) {
    try {
        console.log('Processing stream ID:', message.streamId);
        
        // Start keep-alive mechanism
        startKeepAlive();
        
        // Forward to offscreen document
        const success = await forwardToOffscreen({
            type: 'START_CAPTURING',
            streamId: message.streamId,
            tabId: message.tabId,
            timestamp: message.timestamp
        });
        
        if (success) {
            // Store capture state
            await chrome.storage.local.set({
                captureActive: true,
                tabId: message.tabId,
                streamId: message.streamId,
                startTime: Date.now()
            });
            
            sendResponse({ status: 'started' });
        } else {
            sendResponse({ status: 'failed', error: 'Failed to start offscreen capture' });
        }
        
    } catch (error) {
        console.error('Error in handleStreamIdReceived:', error);
        sendResponse({ status: 'failed', error: error.message });
    }
}

// Handle stop capture request
async function handleStopCapture(message, sendResponse) {
    try {
        console.log('Stopping capture...');
        
        // Forward stop message to offscreen
        await forwardToOffscreen({
            type: 'STOP_CAPTURING',
            timestamp: message.timestamp
        });
        
        // Clear capture state
        await chrome.storage.local.remove(['captureActive', 'tabId', 'streamId', 'startTime']);
        
        // Stop keep-alive when not capturing
        stopKeepAlive();
        
        sendResponse({ status: 'stopped' });
        
    } catch (error) {
        console.error('Error in handleStopCapture:', error);
        sendResponse({ status: 'failed', error: error.message });
    }
}

// Handle service worker startup
chrome.runtime.onStartup.addListener(() => {
    console.log('SE Insight service worker started');
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('SE Insight installed/updated:', details.reason);
    
    // Clear any stale state
    chrome.storage.local.clear(() => {
        console.log('Extension state cleared');
    });
});

// Handle tab updates to manage capture state
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        try {
            const result = await chrome.storage.local.get(['captureActive', 'tabId']);
            if (result.captureActive && result.tabId === tabId) {
                console.log('Captured tab updated, checking if capture should continue');
                // Could implement logic to handle tab navigation
            }
        } catch (error) {
            console.warn('Error checking tab update:', error);
        }
    }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
        const result = await chrome.storage.local.get(['captureActive', 'tabId']);
        if (result.captureActive && result.tabId === tabId) {
            console.log('Captured tab closed, stopping capture');
            await handleStopCapture({ timestamp: Date.now() }, () => {});
        }
    } catch (error) {
        console.warn('Error handling tab removal:', error);
    }
});

console.log('SE Insight Background Service Worker Ready');