/**
 * SE Insight Content Script - Railway Edition
 * Implements glassmorphism-styled caption bar with SE terminology display
 * Following SE Insight UI standards and architecture patterns
 */

class SEInsightCaptionBar {
    constructor() {
        this.captionContainer = null;
        this.explanationTooltip = null;
        this.isActive = false;
        this.currentTranscription = '';
        this.seTerms = [];
        this.seDefinitions = {};
        
        this.setupMessageListener();
        this.createCaptionUI();
        this.createExplanationTooltip();
        console.log('📺 SE Insight Caption Bar initialized with term explanations');
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Content script received message:', message);
            
            switch (message.type) {
                case 'PING':
                    sendResponse({ status: 'active', version: '1.0' });
                    break;
                    
                case 'TRANSCRIPTION_UPDATE':
                    this.handleTranscriptionUpdate(message.data);
                    break;
                    
                case 'SHOW_CAPTIONS':
                    this.showCaptions();
                    break;
                    
                case 'HIDE_CAPTIONS':
                    this.hideCaptions();
                    break;
            }
        });
    }
    
    createCaptionUI() {
        // Create main caption container with glassmorphism styling
        this.captionContainer = document.createElement('div');
        this.captionContainer.id = 'se-insight-captions';
        this.captionContainer.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            max-width: 80%;
            min-width: 300px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.5;
            color: white;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            display: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        // Create transcription display area
        this.transcriptionArea = document.createElement('div');
        this.transcriptionArea.className = 'transcription-text';
        this.transcriptionArea.style.cssText = `
            margin-bottom: 12px;
            font-weight: 500;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        `;
        
        // Create SE terms display area
        this.seTermsArea = document.createElement('div');
        this.seTermsArea.className = 'se-terms';
        this.seTermsArea.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin-top: 12px;
        `;
        
        // Create SE Insight branding with connection status
        this.brandingArea = document.createElement('div');
        this.brandingArea.className = 'se-insight-branding';
        this.brandingArea.innerHTML = '🎓 SE Insight';
        this.brandingArea.style.cssText = `
            font-size: 12px;
            opacity: 0.7;
            margin-top: 8px;
            font-weight: 600;
        `;
        
        // Create connection status indicator
        this.connectionStatus = document.createElement('div');
        this.connectionStatus.className = 'connection-status';
        this.connectionStatus.innerHTML = '🔴 Backend Disconnected';
        this.connectionStatus.style.cssText = `
            font-size: 11px;
            margin-top: 4px;
            padding: 4px 8px;
            border-radius: 8px;
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid rgba(244, 67, 54, 0.4);
            color: #f44336;
            text-align: center;
        `;
        
        // Assemble the UI
        this.captionContainer.appendChild(this.transcriptionArea);
        this.captionContainer.appendChild(this.seTermsArea);
        this.captionContainer.appendChild(this.brandingArea);
        this.captionContainer.appendChild(this.connectionStatus);
        
        // Add to page
        document.body.appendChild(this.captionContainer);
        
        console.log('📺 SE Insight glassmorphism caption UI created with connection status');
    }
    
    createExplanationTooltip() {
        // Create floating explanation tooltip
        this.explanationTooltip = document.createElement('div');
        this.explanationTooltip.id = 'se-insight-explanation';
        this.explanationTooltip.style.cssText = `
            position: fixed;
            z-index: 10001;
            max-width: 400px;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            display: none;
            pointer-events: none;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
            transform: translateY(10px);
        `;
        
        document.body.appendChild(this.explanationTooltip);
        console.log('💡 SE Insight explanation tooltip created');
    }
    
    handleTranscriptionUpdate(data) {
        console.log('📝 Transcription update:', data);
        
        if (!data) return;
        
        // Update transcription text
        if (data.text) {
            this.currentTranscription = data.text;
            this.updateTranscriptionDisplay(data);
        }
        
        // Update SE terms and definitions if provided
        if (data.se_terms && data.se_terms.length > 0) {
            this.seTerms = data.se_terms;
            this.seDefinitions = data.se_definitions || {};
            this.updateSETermsDisplay();
        }
        
        // Handle Gemini analysis with Chinese explanations (PO3)
        if (data.gemini_analysis && data.gemini_analysis.keywords.length > 0) {
            this.displayGeminiExplanations(data.gemini_analysis);
        }
        
        // Update connection status based on data source
        this.updateConnectionStatus(true);
        
        // Show captions if not already visible
        if (!this.isActive && this.currentTranscription) {
            this.showCaptions();
        }
        
        // Auto-hide after period of inactivity
        this.scheduleAutoHide();
    }
    
    updateConnectionStatus(isConnected) {
        /**
         * Update connection status indicator in glassmorphism UI
         */
        if (!this.connectionStatus) return;
        
        if (isConnected) {
            this.connectionStatus.innerHTML = '🟢 Backend Connected';
            this.connectionStatus.style.cssText = `
                font-size: 11px;
                margin-top: 4px;
                padding: 4px 8px;
                border-radius: 8px;
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid rgba(76, 175, 80, 0.4);
                color: #4caf50;
                text-align: center;
            `;
        } else {
            this.connectionStatus.innerHTML = '🔴 Connection Blocked';
            this.connectionStatus.style.cssText = `
                font-size: 11px;
                margin-top: 4px;
                padding: 4px 8px;
                border-radius: 8px;
                background: rgba(244, 67, 54, 0.2);
                border: 1px solid rgba(244, 67, 54, 0.4);
                color: #f44336;
                text-align: center;
            `;
        }
    }
    
    updateTranscriptionDisplay(data) {
        if (!this.transcriptionArea) return;
        
        // Style based on is_final status (SE Insight standard)
        const isFinal = data.is_final;
        const confidence = data.confidence || 0;
        
        this.transcriptionArea.textContent = this.currentTranscription;
        
        // Apply styling based on transcription status
        if (isFinal) {
            // Final transcription - solid white
            this.transcriptionArea.style.cssText += `
                color: white;
                font-weight: 600;
                opacity: 1;
            `;
        } else {
            // Interim transcription - semi-transparent
            this.transcriptionArea.style.cssText += `
                color: #ffeb3b;
                font-weight: 400;
                opacity: 0.8;
                font-style: italic;
            `;
        }
        
        // Add confidence indicator
        if (confidence > 0) {
            const confidenceBar = this.createConfidenceIndicator(confidence);
            this.transcriptionArea.appendChild(confidenceBar);
        }
    }
    
    createConfidenceIndicator(confidence) {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            width: 100%;
            height: 2px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 1px;
            margin-top: 8px;
            overflow: hidden;
        `;
        
        const fill = document.createElement('div');
        fill.style.cssText = `
            width: ${confidence * 100}%;
            height: 100%;
            background: linear-gradient(90deg, #4caf50, #8bc34a);
            border-radius: 1px;
            transition: width 0.3s ease;
        `;
        
        indicator.appendChild(fill);
        return indicator;
    }
    
    updateSETermsDisplay() {
        if (!this.seTermsArea || !this.seTerms.length) return;
        
        // Clear existing terms
        this.seTermsArea.innerHTML = '';
        
        // Add SE term badges with hover explanations (PO3)
        this.seTerms.forEach(term => {
            const badge = document.createElement('span');
            badge.textContent = term;
            badge.className = 'se-term-badge';
            badge.dataset.term = term;
            badge.style.cssText = `
                background: rgba(76, 175, 80, 0.2);
                border: 1px solid rgba(76, 175, 80, 0.4);
                color: #4caf50;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 12px;
                font-weight: 600;
                backdrop-filter: blur(10px);
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                display: inline-block;
                margin: 2px;
            `;
            
            // Add hover effects and explanation display
            badge.addEventListener('mouseenter', (e) => {
                badge.style.background = 'rgba(76, 175, 80, 0.3)';
                badge.style.transform = 'scale(1.05)';
                badge.style.borderColor = 'rgba(76, 175, 80, 0.6)';
                
                // Show explanation tooltip if definition available
                if (this.seDefinitions[term]) {
                    this.showExplanationTooltip(e, term, this.seDefinitions[term]);
                }
            });
            
            badge.addEventListener('mouseleave', () => {
                badge.style.background = 'rgba(76, 175, 80, 0.2)';
                badge.style.transform = 'scale(1)';
                badge.style.borderColor = 'rgba(76, 175, 80, 0.4)';
                
                // Hide explanation tooltip
                this.hideExplanationTooltip();
            });
            
            // Add click handler for detailed explanation
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.seDefinitions[term]) {
                    this.showDetailedExplanation(term, this.seDefinitions[term]);
                }
            });
            
            this.seTermsArea.appendChild(badge);
        });
    }
    
    showExplanationTooltip(event, term, definition) {
        if (!this.explanationTooltip || !definition) return;
        
        // Create tooltip content
        const content = `
            <div style="margin-bottom: 8px;">
                <strong style="color: #4caf50; font-size: 14px;">${term}</strong>
                <span style="background: rgba(76, 175, 80, 0.2); color: #4caf50; padding: 2px 6px; border-radius: 8px; font-size: 10px; margin-left: 8px;">${definition.category}</span>
            </div>
            <div style="margin-bottom: 8px; line-height: 1.4;">
                ${definition.definition}
            </div>
            ${definition.examples && definition.examples.length > 0 ? `
                <div style="margin-bottom: 6px;">
                    <strong style="color: #ffeb3b; font-size: 12px;">Examples:</strong>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
                        ${definition.examples.join(', ')}
                    </div>
                </div>
            ` : ''}
            ${definition.related_terms && definition.related_terms.length > 0 ? `
                <div>
                    <strong style="color: #ff9800; font-size: 12px;">Related:</strong>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
                        ${definition.related_terms.join(', ')}
                    </div>
                </div>
            ` : ''}
            <div style="margin-top: 8px; font-size: 10px; opacity: 0.7; text-align: center;">
                Click for detailed explanation
            </div>
        `;
        
        this.explanationTooltip.innerHTML = content;
        
        // Position tooltip near the mouse cursor
        const rect = event.target.getBoundingClientRect();
        const tooltipRect = this.explanationTooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - 200; // Center horizontally
        let top = rect.top - tooltipRect.height - 10; // Above the badge
        
        // Adjust if tooltip would go off-screen
        if (left < 10) left = 10;
        if (left + 400 > window.innerWidth) left = window.innerWidth - 410;
        if (top < 10) top = rect.bottom + 10; // Show below if no space above
        
        this.explanationTooltip.style.left = `${left}px`;
        this.explanationTooltip.style.top = `${top}px`;
        this.explanationTooltip.style.display = 'block';
        
        // Animate in
        setTimeout(() => {
            this.explanationTooltip.style.opacity = '1';
            this.explanationTooltip.style.transform = 'translateY(0)';
        }, 10);
    }
    
    hideExplanationTooltip() {
        if (!this.explanationTooltip) return;
        
        this.explanationTooltip.style.opacity = '0';
        this.explanationTooltip.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            this.explanationTooltip.style.display = 'none';
        }, 200);
    }
    
    showDetailedExplanation(term, definition) {
        // Create detailed explanation modal
        const modal = document.createElement('div');
        modal.id = 'se-insight-detailed-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 10002;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 24px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            position: relative;
            animation: slideUp 0.3s ease;
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="margin: 0; color: #4caf50; font-size: 24px;">${term}</h2>
                <button id="close-modal" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px;">×</button>
            </div>
            
            <div style="background: rgba(76, 175, 80, 0.2); color: #4caf50; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; display: inline-block; margin-bottom: 16px;">
                ${definition.category}
            </div>
            
            <div style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                ${definition.definition}
            </div>
            
            ${definition.examples && definition.examples.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #ffeb3b; font-size: 16px; margin-bottom: 8px;">💡 Examples</h3>
                    <ul style="margin: 0; padding-left: 20px;">
                        ${definition.examples.map(example => `<li style="margin-bottom: 4px;">${example}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${definition.related_terms && definition.related_terms.length > 0 ? `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #ff9800; font-size: 16px; margin-bottom: 8px;">🔗 Related Terms</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${definition.related_terms.map(relatedTerm => `
                            <span style="background: rgba(255, 152, 0, 0.2); color: #ff9800; padding: 4px 8px; border-radius: 8px; font-size: 12px;">${relatedTerm}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
                <div style="font-size: 12px; opacity: 0.7;">🎓 SE Insight Knowledge Base</div>
            </div>
        `;
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close modal handlers
        const closeModal = () => {
            modal.style.animation = 'fadeIn 0.3s ease reverse';
            setTimeout(() => {
                document.body.removeChild(modal);
                document.head.removeChild(style);
            }, 300);
        };
        
        modalContent.querySelector('#close-modal').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        console.log(`💡 Showing detailed explanation for SE term: ${term}`);
    }
    
    displayGeminiExplanations(geminiAnalysis) {
        /**
         * Display Gemini AI Chinese explanations for SE terms (PO3)
         * Creates floating notification with Chinese explanations from Gemini API
         */
        console.log('🤖 Displaying Gemini Chinese explanations:', geminiAnalysis);
        
        if (!geminiAnalysis.keywords || geminiAnalysis.keywords.length === 0) {
            return;
        }
        
        // Create Gemini explanation container
        const geminiContainer = document.createElement('div');
        geminiContainer.id = 'se-insight-gemini-explanations';
        geminiContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10003;
            max-width: 400px;
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(20px);
            border: 2px solid #4caf50;
            border-radius: 16px;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif, 'Microsoft YaHei', '微软雅黑';
            color: white;
            box-shadow: 0 8px 32px rgba(76, 175, 80, 0.4);
            animation: slideInRight 0.5s ease;
            cursor: pointer;
        `;
        
        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(76, 175, 80, 0.3);
        `;
        
        const title = document.createElement('div');
        title.innerHTML = '🤖 AI 术语解释';
        title.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            color: #4caf50;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Create explanations list
        const explanationsList = document.createElement('div');
        explanationsList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        geminiAnalysis.keywords.forEach(keyword => {
            const explanationItem = document.createElement('div');
            explanationItem.style.cssText = `
                background: rgba(76, 175, 80, 0.1);
                border-radius: 12px;
                padding: 12px;
                border-left: 3px solid #4caf50;
            `;
            
            const termName = document.createElement('div');
            termName.textContent = keyword.term;
            termName.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                color: #4caf50;
                margin-bottom: 6px;
            `;
            
            const chineseExplanation = document.createElement('div');
            chineseExplanation.textContent = keyword.explanation;
            chineseExplanation.style.cssText = `
                font-size: 13px;
                line-height: 1.4;
                color: white;
                opacity: 0.9;
            `;
            
            explanationItem.appendChild(termName);
            explanationItem.appendChild(chineseExplanation);
            explanationsList.appendChild(explanationItem);
        });
        
        // Create footer
        const footer = document.createElement('div');
        footer.innerHTML = '点击任意位置关闭 • Powered by Gemini AI';
        footer.style.cssText = `
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid rgba(76, 175, 80, 0.3);
            font-size: 11px;
            opacity: 0.7;
            text-align: center;
        `;
        
        // Assemble container
        geminiContainer.appendChild(header);
        geminiContainer.appendChild(explanationsList);
        geminiContainer.appendChild(footer);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Add to page
        document.body.appendChild(geminiContainer);
        
        // Auto-hide after 8 seconds
        const autoHideTimeout = setTimeout(() => {
            this.hideGeminiExplanations(geminiContainer, style);
        }, 8000);
        
        // Close handlers
        const closeExplanations = () => {
            clearTimeout(autoHideTimeout);
            this.hideGeminiExplanations(geminiContainer, style);
        };
        
        closeBtn.addEventListener('click', closeExplanations);
        geminiContainer.addEventListener('click', closeExplanations);
        
        // Prevent event bubbling on explanations
        explanationsList.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        console.log(`🤖 Displayed ${geminiAnalysis.keywords.length} Chinese explanations from Gemini AI`);
    }
    
    hideGeminiExplanations(container, styleElement) {
        /**
         * Hide Gemini explanations with animation
         */
        if (container && container.parentNode) {
            container.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (container.parentNode) {
                    document.body.removeChild(container);
                }
                if (styleElement && styleElement.parentNode) {
                    document.head.removeChild(styleElement);
                }
            }, 300);
        }
    }
    
    showCaptions() {
        if (this.captionContainer) {
            this.captionContainer.style.display = 'block';
            // Trigger animation
            setTimeout(() => {
                this.captionContainer.style.opacity = '1';
                this.captionContainer.style.transform = 'translateX(-50%) translateY(0)';
            }, 10);
            
            this.isActive = true;
            console.log('📺 SE Insight captions shown');
        }
    }
    
    hideCaptions() {
        if (this.captionContainer) {
            this.captionContainer.style.opacity = '0';
            this.captionContainer.style.transform = 'translateX(-50%) translateY(20px)';
            
            setTimeout(() => {
                this.captionContainer.style.display = 'none';
            }, 300);
            
            this.isActive = false;
            this.currentTranscription = '';
            this.seTerms = [];
            this.seDefinitions = {};
            
            // Hide explanation tooltip
            this.hideExplanationTooltip();
            
            // Reset connection status
            this.updateConnectionStatus(false);
            
            console.log('📺 SE Insight captions hidden');
        }
    }
    
    scheduleAutoHide() {
        // Clear existing timeout
        if (this.autoHideTimeout) {
            clearTimeout(this.autoHideTimeout);
        }
        
        // Hide after 5 seconds of inactivity
        this.autoHideTimeout = setTimeout(() => {
            this.hideCaptions();
        }, 5000);
    }
}

// Initialize SE Insight Caption Bar
const seInsightCaptionBar = new SEInsightCaptionBar();