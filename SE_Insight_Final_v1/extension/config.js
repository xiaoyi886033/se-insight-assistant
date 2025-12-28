/**
 * SE Insight Railway Configuration
 * Manages backend URL configuration with Railway production priority
 * Properly handles HTTPS base URLs and WSS WebSocket conversion
 */

class SEInsightConfig {
    constructor() {
        this.defaultUrls = {
            // Production Railway URL - Base HTTPS URL for health checks
            production: 'https://web-production-e5d54.up.railway.app',
            // Local development fallback
            development: 'http://localhost:8006'
        };
        
        this.currentUrl = null;
        this.isProduction = false;
    }
    
    /**
     * Get the appropriate backend URL with Railway priority
     * @returns {Promise<string>} The backend base URL (HTTPS/HTTP)
     */
    async getBackendUrl() {
        // Try to get saved URL from storage first
        try {
            const result = await chrome.storage.sync.get(['railwayUrl', 'useProduction']);
            
            if (result.railwayUrl) {
                this.currentUrl = result.railwayUrl;
                this.isProduction = this.isRailwayUrl(result.railwayUrl);
                return this.currentUrl;
            }
        } catch (error) {
            console.log('Failed to load saved URL, using defaults');
        }
        
        // Auto-detect production vs development
        if (await this.isRailwayAvailable()) {
            this.currentUrl = this.defaultUrls.production;
            this.isProduction = true;
        } else {
            this.currentUrl = this.defaultUrls.development;
            this.isProduction = false;
        }
        
        return this.currentUrl;
    }
    
    /**
     * Get WebSocket URL from base HTTP/HTTPS URL
     * @param {string} baseUrl - Base HTTP/HTTPS URL
     * @returns {string} WebSocket URL with /ws/audio path
     */
    getWebSocketUrl(baseUrl) {
        if (!baseUrl) return null;
        
        // Convert HTTPS to WSS, HTTP to WS, and append WebSocket path
        if (baseUrl.startsWith('https://')) {
            return baseUrl.replace('https://', 'wss://') + '/ws/audio';
        } else if (baseUrl.startsWith('http://')) {
            return baseUrl.replace('http://', 'ws://') + '/ws/audio';
        }
        
        return null;
    }
    
    /**
     * Get health check URL from base URL
     * @param {string} baseUrl - Base HTTP/HTTPS URL
     * @returns {string} Health check URL
     */
    getHealthUrl(baseUrl) {
        if (!baseUrl) return null;
        return `${baseUrl}/health`;
    }
    
    /**
     * Check if URL is a Railway deployment
     * @param {string} url - URL to check
     * @returns {boolean} True if Railway URL
     */
    isRailwayUrl(url) {
        return url && (
            url.includes('.railway.app') || 
            url.includes('.up.railway.app')
        );
    }
    
    /**
     * Test if Railway backend is available using HTTPS health check
     * @returns {Promise<boolean>} True if Railway is available
     */
    async isRailwayAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const healthUrl = this.getHealthUrl(this.defaultUrls.production);
            console.log(`🔍 Testing Railway health check: ${healthUrl}`);
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Railway health check successful:', data);
                return data.status === 'healthy';
            } else {
                console.log(`❌ Railway health check failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log(`❌ Railway health check error: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Save URL configuration
     * @param {string} url - Base URL to save (HTTPS/HTTP)
     */
    async saveUrl(url) {
        try {
            await chrome.storage.sync.set({ 
                railwayUrl: url,
                useProduction: this.isRailwayUrl(url)
            });
            
            this.currentUrl = url;
            this.isProduction = this.isRailwayUrl(url);
            
            console.log(`✅ Saved backend URL: ${url} (Production: ${this.isProduction})`);
        } catch (error) {
            console.error('❌ Failed to save URL:', error);
        }
    }
    
    /**
     * Update production URL (for when Railway deployment URL is known)
     * @param {string} railwayUrl - The actual Railway deployment base URL
     */
    updateProductionUrl(railwayUrl) {
        this.defaultUrls.production = railwayUrl;
        console.log(`🚂 Updated Railway production URL: ${railwayUrl}`);
    }
    
    /**
     * Get connection info for debugging
     * @returns {Object} Connection information
     */
    getConnectionInfo() {
        return {
            currentUrl: this.currentUrl,
            isProduction: this.isProduction,
            websocketUrl: this.getWebSocketUrl(this.currentUrl),
            healthUrl: this.getHealthUrl(this.currentUrl),
            railwayUrl: this.defaultUrls.production,
            developmentUrl: this.defaultUrls.development
        };
    }
    
    /**
     * Test connection to current backend
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        try {
            const baseUrl = await this.getBackendUrl();
            const healthUrl = this.getHealthUrl(baseUrl);
            
            console.log(`🔍 Testing connection to: ${healthUrl}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(healthUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Connection test successful:', data);
                
                return {
                    success: true,
                    status: data.status,
                    features: data.features,
                    url: baseUrl,
                    websocketUrl: this.getWebSocketUrl(baseUrl)
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error('❌ Connection test failed:', error);
            return {
                success: false,
                error: error.message,
                url: this.currentUrl
            };
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SEInsightConfig;
} else {
    // Browser environment
    window.SEInsightConfig = SEInsightConfig;
}