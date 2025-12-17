// extension/content_script.js - Advanced real-time transcription UI with SE terminology analysis

console.log('SE Insight Content Script Loading...');

const CAPTION_BAR_ID = 'se-insight-caption-bar';
const TOOLTIP_ID = 'se-insight-tooltip';
const SETTINGS_PANEL_ID = 'se-insight-settings';

let captionBar = null;
let tooltipElement = null;
let settingsPanel = null;
let fadeTimeout = null;
let currentStatus = 'stopped';
let transcriptionHistory = [];
let currentConfidence = 0;
let isMinimized = false;

// UI Configuration
const UI_CONFIG = {
    maxHistoryItems: 50,
    autoHideDelay: 8000,
    confidenceThreshold: 0.7,
    animationDuration: 300,
    tooltipDelay: 500,
    maxCaptionLength: 200
};

// Create advanced caption bar with enhanced features
function createCaptionBar() {
    if (captionBar) return captionBar;

    captionBar = document.createElement('div');
    captionBar.id = CAPTION_BAR_ID;
    captionBar.setAttribute('role', 'region');
    captionBar.setAttribute('aria-label', 'SE Insight Live Transcription');
    captionBar.setAttribute('aria-live', 'polite');
    
    // Advanced styling with accessibility and responsiveness
    captionBar.style.cssText = `
        position: fixed;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        max-width: min(80vw, 800px);
        min-width: 320px;
        background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95));
        color: white;
        padding: 16px 24px;
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        text-align: left;
        z-index: 2147483647;
        box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        visibility: hidden;
        opacity: 0;
        transition: all ${UI_CONFIG.animationDuration}ms cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: auto;
        word-wrap: break-word;
        hyphens: auto;
        user-select: text;
        cursor: default;
    `;

    // Create header with status and controls
    const header = document.createElement('div');
    header.id = 'se-insight-header';
    header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Status indicator with text
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'se-insight-status';
    statusIndicator.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #666;
        transition: background-color 0.3s ease;
        flex-shrink: 0;
    `;

    const statusText = document.createElement('span');
    statusText.id = 'se-insight-status-text';
    statusText.style.cssText = `
        font-size: 12px;
        opacity: 0.8;
        font-weight: 500;
    `;
    statusText.textContent = 'Stopped';

    statusContainer.appendChild(statusIndicator);
    statusContainer.appendChild(statusText);

    // Controls container
    const controls = document.createElement('div');
    controls.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    // Confidence indicator
    const confidenceIndicator = document.createElement('div');
    confidenceIndicator.id = 'se-insight-confidence';
    confidenceIndicator.style.cssText = `
        font-size: 11px;
        opacity: 0.6;
        display: none;
    `;

    // Minimize/maximize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.id = 'se-insight-minimize';
    minimizeBtn.setAttribute('aria-label', 'Minimize caption');
    minimizeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        opacity: 0.6;
        transition: opacity 0.2s ease;
        font-size: 14px;
    `;
    minimizeBtn.innerHTML = '−';
    minimizeBtn.addEventListener('click', toggleMinimize);
    minimizeBtn.addEventListener('mouseenter', () => minimizeBtn.style.opacity = '1');
    minimizeBtn.addEventListener('mouseleave', () => minimizeBtn.style.opacity = '0.6');

    controls.appendChild(confidenceIndicator);
    controls.appendChild(minimizeBtn);

    header.appendChild(statusContainer);
    header.appendChild(controls);
    captionBar.appendChild(header);
    
    // Main content area
    const contentArea = document.createElement('div');
    contentArea.id = 'se-insight-content';
    contentArea.style.cssText = `
        margin: 0;
        padding: 0;
        min-height: 20px;
        transition: all ${UI_CONFIG.animationDuration}ms ease;
    `;
    
    captionBar.appendChild(contentArea);

    // History toggle button (initially hidden)
    const historyBtn = document.createElement('button');
    historyBtn.id = 'se-insight-history';
    historyBtn.setAttribute('aria-label', 'Show transcription history');
    historyBtn.style.cssText = `
        position: absolute;
        top: -12px;
        left: 16px;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 10px;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
    `;
    historyBtn.textContent = 'History';
    historyBtn.addEventListener('click', toggleHistory);
    captionBar.appendChild(historyBtn);
    
    // Insert into DOM with collision detection
    insertCaptionBarSafely();
    
    console.log('Advanced caption bar created successfully');
    return captionBar;
}

// Safely insert caption bar avoiding collisions with page elements
function insertCaptionBarSafely() {
    document.body.appendChild(captionBar);
    
    // Check for collisions with fixed elements
    setTimeout(() => {
        const rect = captionBar.getBoundingClientRect();
        const elementsBelow = document.elementsFromPoint(rect.left + rect.width/2, rect.bottom + 10);
        
        let hasCollision = false;
        for (const element of elementsBelow) {
            if (element !== captionBar && element !== document.body && element !== document.documentElement) {
                const style = window.getComputedStyle(element);
                if (style.position === 'fixed' || style.position === 'sticky') {
                    hasCollision = true;
                    break;
                }
            }
        }
        
        if (hasCollision) {
            console.log('Collision detected, adjusting caption position');
            captionBar.style.bottom = '80px';
        }
    }, 100);
}

// Toggle minimize/maximize state
function toggleMinimize() {
    isMinimized = !isMinimized;
    const contentArea = document.getElementById('se-insight-content');
    const minimizeBtn = document.getElementById('se-insight-minimize');
    
    if (isMinimized) {
        contentArea.style.display = 'none';
        minimizeBtn.innerHTML = '+';
        minimizeBtn.setAttribute('aria-label', 'Maximize caption');
        captionBar.style.padding = '8px 16px';
    } else {
        contentArea.style.display = 'block';
        minimizeBtn.innerHTML = '−';
        minimizeBtn.setAttribute('aria-label', 'Minimize caption');
        captionBar.style.padding = '16px 24px';
    }
}

// Toggle transcription history display
function toggleHistory() {
    // Implementation for history panel would go here
    console.log('History toggle clicked - showing last', transcriptionHistory.length, 'items');
}

// Update status indicator and text based on current status
function updateStatusIndicator(status) {
    const indicator = document.getElementById('se-insight-status');
    const statusText = document.getElementById('se-insight-status-text');
    if (!indicator || !statusText) return;
    
    const statusConfig = {
        'stopped': { color: '#666', text: 'Stopped', pulse: false },
        'connecting': { color: '#ffa500', text: 'Connecting...', pulse: true },
        'connected': { color: '#4CAF50', text: 'Connected', pulse: false },
        'transcribing': { color: '#2196F3', text: 'Transcribing', pulse: true },
        'reconnecting': { color: '#ff9800', text: 'Reconnecting...', pulse: true },
        'error': { color: '#f44336', text: 'Error', pulse: false },
        'mock': { color: '#9c27b0', text: 'Demo Mode', pulse: false },
        'failed': { color: '#f44336', text: 'Failed', pulse: false }
    };
    
    const config = statusConfig[status] || statusConfig['stopped'];
    
    indicator.style.backgroundColor = config.color;
    statusText.textContent = config.text;
    
    // Add pulsing animation for active states
    if (config.pulse) {
        indicator.style.animation = 'se-insight-pulse 2s infinite';
    } else {
        indicator.style.animation = 'none';
    }
    
    currentStatus = status;
    
    // Add pulse animation CSS if not already added
    if (!document.getElementById('se-insight-styles')) {
        const styles = document.createElement('style');
        styles.id = 'se-insight-styles';
        styles.textContent = `
            @keyframes se-insight-pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
            }
            
            .se-insight-fade-in {
                animation: se-insight-fade-in 0.3s ease-out;
            }
            
            @keyframes se-insight-fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .se-insight-highlight {
                animation: se-insight-highlight 0.5s ease-out;
            }
            
            @keyframes se-insight-highlight {
                0% { background-color: rgba(76, 175, 80, 0.3); }
                100% { background-color: transparent; }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Enhanced text processing with SE terminology highlighting
function processTranscriptionText(text, keywords = [], explanations = {}) {
    if (!text) return '';
    
    let processedText = text;
    
    // Highlight SE terminology
    keywords.forEach(keyword => {
        const regex = new RegExp(`\\b(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
        const explanation = explanations[keyword];
        
        if (explanation) {
            processedText = processedText.replace(regex, 
                `<span class="se-term" title="${explanation}" style="
                    background: linear-gradient(120deg, #4CAF50, #45a049);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 500;
                    cursor: help;
                    text-decoration: underline;
                    text-decoration-style: dotted;
                ">$1</span>`
            );
        } else {
            processedText = processedText.replace(regex, 
                `<span class="se-term-basic" style="
                    background: rgba(76, 175, 80, 0.3);
                    padding: 1px 4px;
                    border-radius: 3px;
                    font-weight: 500;
                ">$1</span>`
            );
        }
    });
    
    return processedText;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create and show tooltip for SE terms
function showTermTooltip(element) {
    const term = element.getAttribute('data-term');
    const explanation = element.getAttribute('data-explanation');
    
    if (!explanation) return;
    
    // Remove existing tooltip
    hideTooltip();
    
    tooltipElement = document.createElement('div');
    tooltipElement.id = TOOLTIP_ID;
    tooltipElement.style.cssText = `
        position: fixed;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.4;
        max-width: 300px;
        z-index: 2147483648;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
    `;
    
    // Create tooltip content
    const title = document.createElement('div');
    title.style.cssText = `
        font-weight: 600;
        color: #4CAF50;
        margin-bottom: 6px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    `;
    title.textContent = term;
    
    const description = document.createElement('div');
    description.textContent = explanation;
    
    tooltipElement.appendChild(title);
    tooltipElement.appendChild(description);
    
    document.body.appendChild(tooltipElement);
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 8;
    
    // Adjust if tooltip goes off screen
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
        top = rect.bottom + 8;
    }
    
    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${top}px`;
    
    // Show tooltip
    setTimeout(() => {
        if (tooltipElement) {
            tooltipElement.style.opacity = '1';
        }
    }, 50);
    
    // Auto-hide after delay
    setTimeout(hideTooltip, 5000);
}

// Hide tooltip
function hideTooltip() {
    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }
}

// Make tooltip functions globally available
window.showTermTooltip = showTermTooltip;

// Show caption with smooth animation
function showCaption() {
    if (!captionBar) return;
    
    captionBar.style.visibility = 'visible';
    captionBar.style.opacity = '1';
    captionBar.style.transform = 'translateX(-50%) translateY(0)';
    
    // Clear any existing fade timeout
    if (fadeTimeout) {
        clearTimeout(fadeTimeout);
        fadeTimeout = null;
    }
}

// Hide caption with smooth animation
function hideCaption() {
    if (!captionBar) return;
    
    captionBar.style.opacity = '0';
    captionBar.style.transform = 'translateX(-50%) translateY(10px)';
    
    setTimeout(() => {
        if (captionBar) {
            captionBar.style.visibility = 'hidden';
        }
    }, 300);
}

// Enhanced caption update with advanced features
function updateCaption(text, keywords = [], explanations = {}, status = 'transcribing', confidence = 0) {
    if (!captionBar) {
        createCaptionBar();
    }
    
    const contentArea = document.getElementById('se-insight-content');
    const confidenceIndicator = document.getElementById('se-insight-confidence');
    const historyBtn = document.getElementById('se-insight-history');
    
    if (!contentArea) return;
    
    // Update status and confidence
    updateStatusIndicator(status);
    currentConfidence = confidence;
    
    // Update confidence indicator
    if (confidenceIndicator && confidence > 0) {
        confidenceIndicator.textContent = `${Math.round(confidence * 100)}%`;
        confidenceIndicator.style.display = confidence < UI_CONFIG.confidenceThreshold ? 'block' : 'none';
    }
    
    // Handle empty text
    if (!text || text.trim() === '') {
        if (status === 'stopped') {
            hideCaption();
            if (historyBtn) historyBtn.style.opacity = '0';
        }
        return;
    }
    
    // Truncate very long text
    let displayText = text;
    if (text.length > UI_CONFIG.maxCaptionLength) {
        displayText = text.substring(0, UI_CONFIG.maxCaptionLength) + '...';
    }
    
    // Add to transcription history
    if (status === 'transcribing' && text.trim() !== '') {
        addToHistory({
            text: text,
            keywords: keywords,
            explanations: explanations,
            confidence: confidence,
            timestamp: Date.now()
        });
        
        // Show history button if we have history
        if (historyBtn && transcriptionHistory.length > 0) {
            historyBtn.style.opacity = '0.6';
            historyBtn.style.pointerEvents = 'auto';
            historyBtn.textContent = `History (${transcriptionHistory.length})`;
        }
    }
    
    // Process and display text with enhanced features
    const processedText = processTranscriptionText(displayText, keywords, explanations, confidence);
    
    // Add fade-in animation for new content
    if (contentArea.innerHTML !== processedText) {
        contentArea.classList.add('se-insight-fade-in');
        contentArea.innerHTML = processedText;
        
        // Remove animation class after animation completes
        setTimeout(() => {
            contentArea.classList.remove('se-insight-fade-in');
        }, UI_CONFIG.animationDuration);
    }
    
    showCaption();
    
    // Auto-hide logic with different delays based on content
    if (status !== 'error' && status !== 'connecting' && status !== 'reconnecting') {
        if (fadeTimeout) clearTimeout(fadeTimeout);
        
        // Longer delay for content with SE terms
        const hasSeTerms = keywords && keywords.length > 0;
        const delay = hasSeTerms ? UI_CONFIG.autoHideDelay * 1.5 : UI_CONFIG.autoHideDelay;
        
        fadeTimeout = setTimeout(() => {
            if (currentStatus === 'stopped') {
                hideCaption();
            }
        }, delay);
    }
}

// Add transcription to history
function addToHistory(item) {
    transcriptionHistory.unshift(item);
    
    // Limit history size
    if (transcriptionHistory.length > UI_CONFIG.maxHistoryItems) {
        transcriptionHistory = transcriptionHistory.slice(0, UI_CONFIG.maxHistoryItems);
    }
}

// Enhanced show caption with collision detection
function showCaptionEnhanced() {
    if (!captionBar) return;
    
    // Check for page element collisions
    const rect = captionBar.getBoundingClientRect();
    const elementsAtPosition = document.elementsFromPoint(
        rect.left + rect.width / 2, 
        rect.bottom + 10
    );
    
    let hasCollision = false;
    for (const element of elementsAtPosition) {
        if (element !== captionBar && element !== document.body && element !== document.documentElement) {
            const style = window.getComputedStyle(element);
            if (style.position === 'fixed' || style.position === 'sticky') {
                hasCollision = true;
                break;
            }
        }
    }
    
    // Adjust position if collision detected
    if (hasCollision) {
        captionBar.style.bottom = '80px';
    } else {
        captionBar.style.bottom = '50px';
    }
    
    showCaption();
}

// Handle window resize to maintain positioning
function handleResize() {
    if (captionBar && captionBar.style.visibility === 'visible') {
        // Recalculate positioning if needed
        const rect = captionBar.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        if (rect.right > viewportWidth - 20) {
            captionBar.style.maxWidth = `${viewportWidth - 40}px`;
        }
    }
}

// Enhanced message handler with advanced features
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.type, message.status || '');
    
    try {
        switch (message.type) {
            case 'UPDATE_CAPTION':
                updateCaption(
                    message.text || '',
                    message.keywords || [],
                    message.explanations || {},
                    message.status || 'transcribing',
                    message.confidence || 0
                );
                sendResponse({ 
                    status: 'updated',
                    historyCount: transcriptionHistory.length,
                    isMinimized: isMinimized
                });
                break;
                
            case 'HIDE_CAPTION':
                hideCaption();
                hideTooltip();
                sendResponse({ status: 'hidden' });
                break;
                
            case 'SHOW_CAPTION':
                showCaptionEnhanced();
                sendResponse({ status: 'shown' });
                break;
                
            case 'TOGGLE_MINIMIZE':
                toggleMinimize();
                sendResponse({ status: 'toggled', isMinimized: isMinimized });
                break;
                
            case 'CLEAR_HISTORY':
                transcriptionHistory = [];
                const historyBtn = document.getElementById('se-insight-history');
                if (historyBtn) {
                    historyBtn.style.opacity = '0';
                    historyBtn.style.pointerEvents = 'none';
                }
                sendResponse({ status: 'cleared' });
                break;
                
            case 'GET_HISTORY':
                sendResponse({ 
                    status: 'success', 
                    history: transcriptionHistory.slice(0, 10) // Return last 10 items
                });
                break;
                
            case 'UPDATE_SETTINGS':
                // Update UI configuration
                if (message.settings) {
                    Object.assign(UI_CONFIG, message.settings);
                    console.log('UI settings updated:', UI_CONFIG);
                }
                sendResponse({ status: 'updated', config: UI_CONFIG });
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
                sendResponse({ status: 'error', error: 'Unknown message type' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ status: 'error', error: error.message });
    }
    
    return true; // Async response
});

// Enhanced initialization with performance monitoring
function initialize() {
    const startTime = performance.now();
    
    try {
        // Create caption bar
        createCaptionBar();
        
        // Add enhanced event listeners
        setupEventListeners();
        
        // Setup performance monitoring
        setupPerformanceMonitoring();
        
        // Setup accessibility features
        setupAccessibility();
        
        const initTime = performance.now() - startTime;
        console.log(`SE Insight Content Script Initialized in ${initTime.toFixed(2)}ms`);
        
        // Notify background script that content script is ready
        chrome.runtime.sendMessage({
            type: 'CONTENT_SCRIPT_READY',
            url: window.location.href,
            timestamp: Date.now(),
            initTime: initTime
        }).catch(error => {
            console.warn('Failed to notify background script:', error);
        });
        
    } catch (error) {
        console.error('Failed to initialize SE Insight:', error);
    }
}

// Setup enhanced event listeners
function setupEventListeners() {
    // Responsive resize handling
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 150);
    });
    
    // Enhanced scroll handling with throttling
    let scrollTimeout;
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        
        scrollTimeout = setTimeout(() => {
            const currentScrollY = window.scrollY;
            const scrollDelta = Math.abs(currentScrollY - lastScrollY);
            
            if (captionBar && captionBar.style.visibility === 'visible') {
                // Maintain fixed positioning
                captionBar.style.position = 'fixed';
                
                // Adjust opacity based on scroll speed for better UX
                if (scrollDelta > 100) {
                    captionBar.style.opacity = '0.8';
                    setTimeout(() => {
                        if (captionBar) captionBar.style.opacity = '1';
                    }, 1000);
                }
            }
            
            lastScrollY = currentScrollY;
        }, 100);
    }, { passive: true });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, pause animations
            if (captionBar) {
                captionBar.style.animationPlayState = 'paused';
            }
        } else {
            // Page is visible, resume animations
            if (captionBar) {
                captionBar.style.animationPlayState = 'running';
            }
        }
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + Shift + S to toggle caption visibility
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
            event.preventDefault();
            if (captionBar && captionBar.style.visibility === 'visible') {
                hideCaption();
            } else {
                showCaptionEnhanced();
            }
        }
        
        // Escape to hide tooltip
        if (event.key === 'Escape') {
            hideTooltip();
        }
    });
}

// Setup performance monitoring
function setupPerformanceMonitoring() {
    // Monitor DOM mutations for performance impact
    const observer = new MutationObserver((mutations) => {
        const mutationCount = mutations.length;
        if (mutationCount > 50) {
            console.warn(`High DOM mutation count detected: ${mutationCount}`);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
    });
    
    // Cleanup observer when page unloads
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });
}

// Setup accessibility features
function setupAccessibility() {
    // Add ARIA live region for screen readers
    if (!document.getElementById('se-insight-aria-live')) {
        const ariaLive = document.createElement('div');
        ariaLive.id = 'se-insight-aria-live';
        ariaLive.setAttribute('aria-live', 'polite');
        ariaLive.setAttribute('aria-atomic', 'true');
        ariaLive.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(ariaLive);
    }
    
    // Update ARIA live region when caption updates
    const originalUpdateCaption = updateCaption;
    updateCaption = function(text, keywords, explanations, status, confidence) {
        originalUpdateCaption.call(this, text, keywords, explanations, status, confidence);
        
        // Update ARIA live region for screen readers
        const ariaLive = document.getElementById('se-insight-aria-live');
        if (ariaLive && text && status === 'transcribing') {
            ariaLive.textContent = `SE Insight transcription: ${text}`;
        }
    };
}

// Initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

console.log('SE Insight Content Script Loaded');