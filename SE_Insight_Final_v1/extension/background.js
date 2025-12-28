/**
 * SE Insight Railway Background Script (Service Worker)
 * Handles message routing, offscreen document management, and Railway backend communication
 * Following SE Insight architecture patterns
 */

class SEInsightBackgroundService {
    constructor() {
        this.offscreenDocumentId = null;
        this.isCapturing = false;
        this.railwayUrl = 'http://localhost:8006';
        
        this.setupMessageHandlers();
        this.setupOffscreenDocument();
        console.log('🎛️ SE Insight Railway Background Service initialized');
    }
    
    setupMessageHandlers() {
        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Background received message:', message);
            
            switch (message.type) {
                case 'START_CAPTURE':
                    this.startCapture(message.tabId)
                        .then(result => sendResponse(result))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // Keep message channel open for async response
                    
                case 'STOP_CAPTURE':
                    this.stopCapture()
                        .then(result => sendResponse(result))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
                    
                case 'GET_STATUS':
                    sendResponse({
                        isCapturing: this.isCapturing,
                        railwayUrl: this.railwayUrl,
                        offscreenActive: !!this.offscreenDocumentId
                    });
                    break;
                    
                case 'GET_AUDIO_LEVEL':
                    // Forward to offscreen document for audio level
                    if (this.offscreenDocumentId) {
                        chrome.runtime.sendMessage({
                            type: 'GET_AUDIO_LEVEL'
                        }).then(response => {
                            sendResponse(response || { audioLevel: 0, isRecording: false });
                        }).catch(() => {
                            sendResponse({ audioLevel: 0, isRecording: false });
                        });
                        return true; // Keep message channel open
                    } else {
                        sendResponse({ audioLevel: 0, isRecording: false });
                    }
                    break;
                    
                case 'SET_RAILWAY_URL':
                    this.railwayUrl = message.url;
                    console.log('🚂 Railway URL updated:', this.railwayUrl);
                    sendResponse({ success: true });
                    break;
                    
                case 'TRANSCRIPTION_RESULT':
                    // Forward transcription results to content script
                    this.forwardToContentScript(message.data);
                    break;
            }
        });
    }
    
    async setupOffscreenDocument() {
        try {
            // Check if offscreen document already exists
            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT']
            });
            
            if (existingContexts.length === 0) {
                // Create offscreen document for audio processing
                await chrome.offscreen.createDocument({
                    url: 'offscreen.html',
                    reasons: ['USER_MEDIA'],
                    justification: 'SE Insight audio capture and processing for real-time transcription'
                });
                
                this.offscreenDocumentId = 'se-insight-offscreen';
                console.log('📄 SE Insight offscreen document created');
            } else {
                this.offscreenDocumentId = 'se-insight-offscreen';
                console.log('📄 SE Insight offscreen document already exists');
            }
        } catch (error) {
            console.error('❌ Failed to setup offscreen document:', error);
        }
    }
    
    async startCapture(tabId) {
        try {
            console.log('🎬 Starting SE Insight capture for tab:', tabId);
            
            // Ensure offscreen document is ready
            await this.setupOffscreenDocument();
            
            if (!this.offscreenDocumentId) {
                throw new Error('Offscreen document not available');
            }
            
            // Send start command to offscreen document
            const response = await chrome.runtime.sendMessage({
                type: 'START_AUDIO_CAPTURE',
                tabId: tabId,
                railwayUrl: this.railwayUrl
            });
            
            if (response && response.success) {
                this.isCapturing = true;
                console.log('✅ SE Insight capture started successfully');
                return { success: true };
            } else {
                throw new Error(response?.error || 'Failed to start audio capture');
            }
            
        } catch (error) {
            console.error('❌ Failed to start SE Insight capture:', error);
            return { success: false, error: error.message };
        }
    }
    
    async stopCapture() {
        try {
            console.log('🛑 Stopping SE Insight capture');
            
            if (this.offscreenDocumentId) {
                // Send stop command to offscreen document
                await chrome.runtime.sendMessage({
                    type: 'STOP_AUDIO_CAPTURE'
                });
            }
            
            this.isCapturing = false;
            console.log('✅ SE Insight capture stopped successfully');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Failed to stop SE Insight capture:', error);
            return { success: false, error: error.message };
        }
    }
    
    async forwardToContentScript(transcriptionData) {
        try {
            // Get active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab) {
                // Send transcription data to content script
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'TRANSCRIPTION_UPDATE',
                    data: transcriptionData
                });
                
                console.log('📤 Transcription forwarded to content script');
            }
        } catch (error) {
            console.log('📤 Content script not available (tab may not support injection)');
        }
    }
}

// Initialize SE Insight Background Service
const seInsightBackground = new SEInsightBackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🎓 SE Insight Railway Extension installed/updated');
    
    if (details.reason === 'install') {
        // Set default configuration
        chrome.storage.sync.set({
            railwayUrl: 'http://localhost:8006',
            autoStart: false,
            showNotifications: true
        });
        
        console.log('⚙️ Default SE Insight configuration set');
    }
});

// Handle tab updates (for content script injection)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Only inject on supported pages (http/https)
        if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
            console.log('📄 Tab updated, content script available:', tab.url);
        }
    }
});