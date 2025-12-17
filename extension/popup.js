// extension/popup.js - Robust audio capture with proper tab capture and retry logic

let isCapturing = false;
let retryCount = 0;
const MAX_RETRIES = 3;

// Exponential backoff retry mechanism
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt) {
    return Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
}

// Robust message sending with retry logic
async function sendMessageWithRetry(message, maxRetries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Message timeout'));
                }, 5000); // 5 second timeout

                chrome.runtime.sendMessage(message, (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            return response;
        } catch (error) {
            console.warn(`Message attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt < maxRetries) {
                const backoffDelay = calculateBackoffDelay(attempt);
                console.log(`Retrying in ${backoffDelay}ms...`);
                await delay(backoffDelay);
            } else {
                throw error;
            }
        }
    }
}

// Enhanced tab capture stream ID acquisition with validation
async function getTabCaptureStreamId(tabId) {
    return new Promise((resolve, reject) => {
        // Validate tab ID
        if (!tabId || tabId < 0) {
            reject(new Error('Invalid tab ID'));
            return;
        }
        
        console.log('Requesting stream ID for tab:', tabId);
        
        chrome.tabCapture.getMediaStreamId({
            targetTabId: tabId
        }, (streamId) => {
            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;
                console.error('Tab capture error:', error);
                
                // Provide more specific error messages
                if (error.includes('permission')) {
                    reject(new Error('Tab audio capture permission denied'));
                } else if (error.includes('not found')) {
                    reject(new Error('Tab not found or not accessible'));
                } else if (error.includes('not supported')) {
                    reject(new Error('Tab audio capture not supported on this page'));
                } else {
                    reject(new Error(`Tab capture failed: ${error}`));
                }
            } else if (!streamId) {
                reject(new Error('No stream ID returned - tab may not have audio'));
            } else {
                console.log('Stream ID obtained successfully:', streamId);
                resolve(streamId);
            }
        });
    });
}

// Validate tab for audio capture capability
async function validateTabForCapture(tab) {
    const issues = [];
    
    // Check if tab URL is capturable
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('moz-extension://') ||
        tab.url === 'about:blank') {
        issues.push('Cannot capture audio from browser internal pages');
    }
    
    // Check if tab is audible (has audio)
    if (!tab.audible && tab.mutedInfo && !tab.mutedInfo.muted) {
        issues.push('Tab does not appear to have audio content');
    }
    
    // Check tab status
    if (tab.status !== 'complete') {
        issues.push('Tab is still loading - please wait for page to finish loading');
    }
    
    return {
        isValid: issues.length === 0,
        issues: issues,
        warnings: tab.audible ? [] : ['Tab audio not detected - capture may still work']
    };
}

// Enhanced main capture initiation function
async function startCapture() {
    const button = document.getElementById('toggleButton');
    
    try {
        button.textContent = 'Checking tab...';
        
        // Get active tab
        const tabs = await new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(tabs);
                }
            });
        });
        
        if (!tabs || tabs.length === 0) {
            throw new Error('No active tab found');
        }
        
        const activeTab = tabs[0];
        console.log('Active tab:', {
            id: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
            audible: activeTab.audible,
            status: activeTab.status
        });
        
        // Validate tab for capture
        const validation = await validateTabForCapture(activeTab);
        if (!validation.isValid) {
            throw new Error(validation.issues[0]);
        }
        
        // Show warnings if any
        if (validation.warnings.length > 0) {
            console.warn('Tab validation warnings:', validation.warnings);
        }
        
        button.textContent = 'Requesting permissions...';
        
        // Get real stream ID with enhanced error handling
        const streamId = await getTabCaptureStreamId(activeTab.id);
        console.log('Stream ID obtained successfully:', streamId);
        
        button.textContent = 'Initializing audio...';
        
        // Send message to background with retry logic
        const response = await sendMessageWithRetry({
            type: 'STREAM_ID_RECEIVED',
            tabId: activeTab.id,
            streamId: streamId,
            timestamp: Date.now(),
            tabInfo: {
                url: activeTab.url,
                title: activeTab.title,
                audible: activeTab.audible
            }
        });
        
        if (response && response.status === 'started') {
            button.textContent = 'Stop Transcription';
            isCapturing = true;
            retryCount = 0;
            
            // Store enhanced capture state
            await chrome.storage.local.set({
                isCapturing: true,
                tabId: activeTab.id,
                streamId: streamId,
                startTime: Date.now(),
                tabInfo: {
                    url: activeTab.url,
                    title: activeTab.title
                }
            });
            
            console.log('Enhanced transcription started successfully');
            
            // Auto-close popup after successful start
            setTimeout(() => {
                window.close();
            }, 1000);
            
        } else {
            throw new Error(response?.error || 'Unknown error from background script');
        }
        
    } catch (error) {
        console.error('Failed to start capture:', error);
        button.textContent = 'Start Transcription';
        
        // Provide detailed user-friendly error messages
        let errorMsg = 'Failed to start transcription';
        
        if (error.message.includes('permission')) {
            errorMsg = 'Permission denied - please allow tab audio capture';
        } else if (error.message.includes('not found')) {
            errorMsg = 'Tab not accessible - try refreshing the page';
        } else if (error.message.includes('not supported')) {
            errorMsg = 'Audio capture not supported on this page';
        } else if (error.message.includes('internal pages')) {
            errorMsg = 'Cannot capture from browser pages';
        } else if (error.message.includes('audio content')) {
            errorMsg = 'No audio detected - try a page with audio/video';
        } else if (error.message.includes('loading')) {
            errorMsg = 'Page still loading - please wait';
        } else if (error.message.includes('stream')) {
            errorMsg = 'Audio stream error - try refreshing the tab';
        } else if (error.message.includes('timeout')) {
            errorMsg = 'Connection timeout - check your connection';
        } else {
            errorMsg = `Error: ${error.message}`;
        }
        
        // Show error in button with appropriate duration
        button.textContent = errorMsg;
        const errorDuration = errorMsg.length > 30 ? 4000 : 3000;
        
        setTimeout(() => {
            button.textContent = 'Start Transcription';
        }, errorDuration);
        
        // Log detailed error for debugging
        console.error('Detailed capture error:', {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }
}

// Stop capture function
async function stopCapture() {
    const button = document.getElementById('toggleButton');
    
    try {
        button.textContent = 'Stopping...';
        
        const response = await sendMessageWithRetry({
            type: 'STOP_CAPTURE',
            timestamp: Date.now()
        });
        
        if (response && response.status === 'stopped') {
            button.textContent = 'Start Transcription';
            isCapturing = false;
            
            // Clear capture state
            await chrome.storage.local.remove(['isCapturing', 'tabId', 'streamId']);
            
            console.log('Transcription stopped successfully');
        } else {
            throw new Error(response?.error || 'Failed to stop capture');
        }
        
    } catch (error) {
        console.error('Failed to stop capture:', error);
        button.textContent = 'Start Transcription';
        isCapturing = false;
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    const button = document.getElementById('toggleButton');
    
    // Check if already capturing
    try {
        const result = await chrome.storage.local.get(['isCapturing']);
        if (result.isCapturing) {
            button.textContent = 'Stop Transcription';
            isCapturing = true;
        }
    } catch (error) {
        console.warn('Failed to check capture state:', error);
    }
    
    // Add click handler
    button.addEventListener('click', () => {
        if (isCapturing) {
            stopCapture();
        } else {
            startCapture();
        }
    });
});