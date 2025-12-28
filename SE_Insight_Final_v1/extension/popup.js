/**
 * SE Insight Railway Popup Controller
 * Manages user interface and Railway backend configuration
 * Following SE Insight architecture patterns
 */

class RailwayPopupController {
    constructor() {
        this.isCapturing = false;
        this.backendHealthy = false;
        this.googleApiAvailable = false;
        this.config = new SEInsightConfig();
        this.railwayUrl = 'http://localhost:8006'; // Will be updated by config
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadConfiguration();
        this.checkStatus();
        
        console.log('🎛️ SE Insight Railway Popup Controller initialized');
    }
    
    initializeElements() {
        // Status indicators
        this.backendStatus = document.getElementById('backend-status');
        this.backendText = document.getElementById('backend-text');
        this.googleStatus = document.getElementById('google-status');
        this.googleText = document.getElementById('google-text');
        this.captureStatus = document.getElementById('capture-status');
        this.captureText = document.getElementById('capture-text');
        this.websocketStatus = document.getElementById('websocket-status');
        this.websocketText = document.getElementById('websocket-text');
        
        // Audio level monitoring
        this.audioPulse = document.getElementById('audio-pulse');
        this.audioLevelBar = document.getElementById('audio-level-bar');
        this.audioLevelText = document.getElementById('audio-level-text');
        
        // Controls
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.testBtn = document.getElementById('test-btn');
        this.railwayUrlInput = document.getElementById('railway-url');
    }
    
    setupEventListeners() {
        // Button event listeners
        this.startBtn.addEventListener('click', () => this.startCapture());
        this.stopBtn.addEventListener('click', () => this.stopCapture());
        this.testBtn.addEventListener('click', () => this.testConnection());
        
        // Railway URL configuration
        this.railwayUrlInput.addEventListener('change', () => this.saveRailwayUrl());
        this.railwayUrlInput.addEventListener('blur', () => this.saveRailwayUrl());
        
        // Periodic status updates
        setInterval(() => this.updateStatus(), 3000);
        
        // Audio level monitoring
        setInterval(() => this.updateAudioLevel(), 100);
    }
    
    async loadConfiguration() {
        try {
            // Use config system to get the appropriate URL
            this.railwayUrl = await this.config.getBackendUrl();
            this.railwayUrlInput.value = this.railwayUrl;
            
            const connectionInfo = this.config.getConnectionInfo();
            console.log('🚂 Railway configuration loaded:', connectionInfo);
            
            // Update UI to show production vs development
            if (this.config.isProduction) {
                this.railwayUrlInput.style.borderColor = 'rgba(76, 175, 80, 0.6)';
                console.log('✅ Using Railway production URL');
            } else {
                this.railwayUrlInput.style.borderColor = 'rgba(255, 152, 0, 0.6)';
                console.log('⚠️ Using local development URL');
            }
            
        } catch (error) {
            console.error('❌ Failed to load configuration:', error);
        }
    }
    
    async saveRailwayUrl() {
        const newUrl = this.railwayUrlInput.value.trim();
        if (newUrl && newUrl !== this.railwayUrl) {
            // Use config system to save URL
            await this.config.saveUrl(newUrl);
            this.railwayUrl = newUrl;
            
            // Update UI styling based on URL type
            if (this.config.isProduction) {
                this.railwayUrlInput.style.borderColor = 'rgba(76, 175, 80, 0.6)';
            } else {
                this.railwayUrlInput.style.borderColor = 'rgba(255, 152, 0, 0.6)';
            }
            
            // Update background script
            await chrome.runtime.sendMessage({
                type: 'SET_RAILWAY_URL',
                url: this.railwayUrl
            });
            
            // Recheck status with new URL
            this.checkStatus();
        }
    }
    
    async checkStatus() {
        // Check Railway backend health
        await this.checkBackendHealth();
        
        // Check capture status
        await this.checkCaptureStatus();
        
        this.updateUI();
    }
    
    async checkBackendHealth() {
        try {
            console.log('🔍 Checking Railway backend health:', this.railwayUrl);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.railwayUrl}/health`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.backendHealthy = true;
                this.googleApiAvailable = data.google_api_available && data.client_initialized;
                
                this.updateStatusIndicator(
                    this.backendStatus, 
                    this.backendText, 
                    'online', 
                    'Connected'
                );
                
                this.updateStatusIndicator(
                    this.googleStatus,
                    this.googleText,
                    this.googleApiAvailable ? 'online' : 'warning',
                    this.googleApiAvailable ? 'Ready' : 'Not Configured'
                );
                
                console.log('✅ Railway backend healthy:', data);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
            
        } catch (error) {
            this.backendHealthy = false;
            this.googleApiAvailable = false;
            
            this.updateStatusIndicator(
                this.backendStatus, 
                this.backendText, 
                'offline', 
                'Disconnected'
            );
            
            this.updateStatusIndicator(
                this.googleStatus,
                this.googleText,
                'offline',
                'Unavailable'
            );
            
            console.log('❌ Railway backend unhealthy:', error.message);
        }
    }
    
    async checkCaptureStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
            this.isCapturing = response.isCapturing;
            
            if (this.isCapturing) {
                this.updateStatusIndicator(
                    this.captureStatus, 
                    this.captureText, 
                    'online', 
                    'Recording'
                );
                
                // Update WebSocket status
                if (response.websocketConnected) {
                    this.updateStatusIndicator(
                        this.websocketStatus,
                        this.websocketText,
                        'online',
                        'Connected'
                    );
                } else {
                    this.updateStatusIndicator(
                        this.websocketStatus,
                        this.websocketText,
                        'warning',
                        'Connecting...'
                    );
                }
            } else {
                this.updateStatusIndicator(
                    this.captureStatus, 
                    this.captureText, 
                    'offline', 
                    'Stopped'
                );
                
                this.updateStatusIndicator(
                    this.websocketStatus,
                    this.websocketText,
                    'offline',
                    'Disconnected'
                );
            }
            
        } catch (error) {
            console.log('❌ Failed to check capture status:', error);
        }
    }
    
    async updateAudioLevel() {
        try {
            if (!this.isCapturing) {
                // Reset audio level when not capturing
                this.audioLevelBar.style.width = '0%';
                this.audioLevelText.textContent = 'No Audio Signal';
                this.audioPulse.classList.remove('active');
                return;
            }
            
            const response = await chrome.runtime.sendMessage({ type: 'GET_AUDIO_LEVEL' });
            
            if (response && response.audioLevel !== undefined) {
                const level = Math.min(100, Math.max(0, response.audioLevel * 100));
                
                // Update audio level bar
                this.audioLevelBar.style.width = `${level}%`;
                
                // Update audio level text
                if (level > 50) {
                    this.audioLevelText.textContent = 'Strong Signal';
                } else if (level > 20) {
                    this.audioLevelText.textContent = 'Moderate Signal';
                } else if (level > 5) {
                    this.audioLevelText.textContent = 'Weak Signal';
                } else {
                    this.audioLevelText.textContent = 'Very Low Signal';
                }
                
                // Update pulse indicator
                if (level > 5) {
                    this.audioPulse.classList.add('active');
                } else {
                    this.audioPulse.classList.remove('active');
                }
            }
            
        } catch (error) {
            // Silently handle errors for audio level monitoring
            this.audioLevelBar.style.width = '0%';
            this.audioLevelText.textContent = 'Audio Monitor Unavailable';
            this.audioPulse.classList.remove('active');
        }
    }
    
    updateStatusIndicator(indicator, textElement, status, text) {
        // Update indicator color and animation
        indicator.className = `status-indicator status-${status}`;
        
        // Update text
        textElement.textContent = text;
    }
    
    async startCapture() {
        if (!this.backendHealthy) {
            this.showError('Railway backend is not available. Please check your configuration and try again.');
            return;
        }
        
        if (!this.googleApiAvailable) {
            this.showWarning('Google Speech API is not configured. Transcription may not work properly.');
        }
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('No active tab found');
            }
            
            // Show loading state
            this.startBtn.innerHTML = '<span class="loading"></span><span>Starting...</span>';
            this.startBtn.disabled = true;
            
            // Send start command to background
            const response = await chrome.runtime.sendMessage({
                type: 'START_CAPTURE',
                tabId: tab.id
            });
            
            if (response.success) {
                this.isCapturing = true;
                this.updateUI();
                console.log('✅ SE Insight capture started successfully');
                
                // Notify content script to show captions
                chrome.tabs.sendMessage(tab.id, { type: 'SHOW_CAPTIONS' });
                
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error('❌ Failed to start SE Insight capture:', error);
            this.showError(`Failed to start capture: ${error.message}`);
        } finally {
            // Restore button state
            this.startBtn.innerHTML = '<span>🎬</span><span>Start SE Transcription</span>';
            this.updateUI();
        }
    }
    
    async stopCapture() {
        try {
            // Show loading state
            this.stopBtn.innerHTML = '<span class="loading"></span><span>Stopping...</span>';
            this.stopBtn.disabled = true;
            
            // Send stop command to background
            const response = await chrome.runtime.sendMessage({
                type: 'STOP_CAPTURE'
            });
            
            if (response.success) {
                this.isCapturing = false;
                this.updateUI();
                console.log('✅ SE Insight capture stopped successfully');
                
                // Notify content script to hide captions
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { type: 'HIDE_CAPTIONS' });
                }
                
            } else {
                throw new Error(response.error);
            }
            
        } catch (error) {
            console.error('❌ Failed to stop SE Insight capture:', error);
            this.showError(`Failed to stop capture: ${error.message}`);
        } finally {
            // Restore button state
            this.stopBtn.innerHTML = '<span>🛑</span><span>Stop Transcription</span>';
            this.updateUI();
        }
    }
    
    async testConnection() {
        this.testBtn.innerHTML = '<span class="loading"></span><span>Testing...</span>';
        this.testBtn.disabled = true;
        
        try {
            await this.checkBackendHealth();
            
            if (this.backendHealthy) {
                if (this.googleApiAvailable) {
                    this.showSuccess('✅ Connection test successful! Railway backend and Google Speech API are ready.');
                } else {
                    this.showWarning('⚠️ Railway backend is connected, but Google Speech API needs configuration.');
                }
            } else {
                this.showError('❌ Connection test failed! Please check your Railway URL and backend status.');
            }
            
        } catch (error) {
            this.showError(`❌ Connection test failed: ${error.message}`);
        } finally {
            this.testBtn.innerHTML = '<span>🔍</span><span>Test Railway Connection</span>';
            this.testBtn.disabled = false;
        }
    }
    
    updateStatus() {
        this.checkStatus();
    }
    
    updateUI() {
        // Update button states
        this.startBtn.disabled = this.isCapturing || !this.backendHealthy;
        this.stopBtn.disabled = !this.isCapturing;
        
        // Update capture status display
        if (this.isCapturing) {
            this.updateStatusIndicator(
                this.captureStatus, 
                this.captureText, 
                'online', 
                'Recording'
            );
        } else {
            this.updateStatusIndicator(
                this.captureStatus, 
                this.captureText, 
                'offline', 
                'Stopped'
            );
        }
    }
    
    showSuccess(message) {
        // Simple alert for now - could be enhanced with custom notifications
        alert(message);
    }
    
    showWarning(message) {
        alert(message);
    }
    
    showError(message) {
        alert(message);
    }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new RailwayPopupController();
});