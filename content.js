// Content script for Exploratory Testing Assistant
class ContentScriptHandler {
    constructor() {
        this.isInjected = false;
        this.overlay = null;
        this.screenshotMode = false;
        this.currentStepClickPath = [];
        this.isTrackingClicks = false;
        this.setupMessageListener();
        this.injectStyles();
        console.log('Exploratory Testing Assistant content script loaded');
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'prepareScreenshot':
                    this.prepareForScreenshot();
                    sendResponse({ success: true });
                    break;

                case 'highlightElement':
                    this.highlightElement(message.selector);
                    sendResponse({ success: true });
                    break;

                case 'removeHighlight':
                    this.removeHighlight();
                    sendResponse({ success: true });
                    break;

                case 'showOverlay':
                    this.showOverlay(message.content);
                    sendResponse({ success: true });
                    break;

                case 'hideOverlay':
                    this.hideOverlay();
                    sendResponse({ success: true });
                    break;

                case 'injectAnnotationTool':
                    this.injectAnnotationTool();
                    sendResponse({ success: true });
                    break;

                case 'startClickTracking':
                    this.startClickTracking();
                    sendResponse({ success: true });
                    break;

                case 'stopClickTracking':
                    const clickPath = this.stopClickTracking();
                    sendResponse({ success: true, clickPath: clickPath });
                    break;

                case 'getClickPath':
                    sendResponse({ success: true, clickPath: this.currentStepClickPath });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Content script message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    injectStyles() {
        if (document.getElementById('exploratoryTestingStyles')) return;

        const styles = document.createElement('style');
        styles.id = 'exploratoryTestingStyles';
        styles.textContent = `
            .testing-assistant-highlight {
                outline: 3px solid #6366f1 !important;
                outline-offset: 2px !important;
                background-color: rgba(99, 102, 241, 0.1) !important;
                position: relative !important;
                z-index: 9998 !important;
            }

            .testing-assistant-highlight::before {
                content: '🔍 Testing Focus';
                position: absolute !important;
                top: -30px !important;
                left: 0 !important;
                background: #6366f1 !important;
                color: white !important;
                padding: 4px 8px !important;
                font-size: 12px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                border-radius: 4px !important;
                z-index: 9999 !important;
                white-space: nowrap !important;
            }

            .testing-assistant-overlay {
                position: fixed !important;
                top: 20px !important;
                right: 20px !important;
                background: white !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 8px !important;
                padding: 16px !important;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2) !important;
                z-index: 10000 !important;
                max-width: 300px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 14px !important;
                line-height: 1.5 !important;
                color: #1e293b !important;
            }

            .testing-assistant-overlay-header {
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
                margin-bottom: 12px !important;
                font-weight: 600 !important;
                color: #6366f1 !important;
            }

            .testing-assistant-overlay-close {
                background: none !important;
                border: none !important;
                font-size: 18px !important;
                cursor: pointer !important;
                color: #64748b !important;
                margin-left: auto !important;
                padding: 0 !important;
                width: 24px !important;
                height: 24px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 4px !important;
            }

            .testing-assistant-overlay-close:hover {
                background: #f1f5f9 !important;
                color: #1e293b !important;
            }

            .testing-assistant-annotation-tool {
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                background: white !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 12px !important;
                padding: 20px !important;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25) !important;
                z-index: 10001 !important;
                min-width: 400px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }

            .testing-assistant-annotation-backdrop {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background: rgba(0, 0, 0, 0.5) !important;
                z-index: 10000 !important;
            }

            .testing-assistant-screenshot-mode {
                cursor: crosshair !important;
            }

            .testing-assistant-screenshot-instruction {
                position: fixed !important;
                top: 20px !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: #6366f1 !important;
                color: white !important;
                padding: 12px 20px !important;
                border-radius: 8px !important;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                font-size: 14px !important;
                z-index: 10002 !important;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4) !important;
            }

            @keyframes testing-assistant-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .testing-assistant-pulse {
                animation: testing-assistant-pulse 1s ease-in-out infinite !important;
            }

            .testing-assistant-fade-in {
                animation: testing-assistant-fade-in 0.3s ease-out !important;
            }

            @keyframes testing-assistant-fade-in {
                from { 
                    opacity: 0 !important; 
                    transform: translateY(-10px) !important; 
                }
                to { 
                    opacity: 1 !important; 
                    transform: translateY(0) !important; 
                }
            }
        `;

        document.head.appendChild(styles);
    }

    prepareForScreenshot() {
        // Add visual feedback that screenshot is being taken
        this.showScreenshotInstructions();
        
        // Remove any existing highlights that might interfere
        this.removeHighlight();
        
        // Scroll to top to ensure consistent screenshot framing
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Hide the overlay temporarily
        this.hideOverlay();
        
        // Add a brief delay to ensure page is ready
        setTimeout(() => {
            this.hideScreenshotInstructions();
        }, 1500);
    }

    showScreenshotInstructions() {
        const existing = document.querySelector('.testing-assistant-screenshot-instruction');
        if (existing) existing.remove();

        const instruction = document.createElement('div');
        instruction.className = 'testing-assistant-screenshot-instruction testing-assistant-fade-in';
        instruction.textContent = '📸 Taking screenshot...';
        document.body.appendChild(instruction);
    }

    hideScreenshotInstructions() {
        const instruction = document.querySelector('.testing-assistant-screenshot-instruction');
        if (instruction) {
            instruction.remove();
        }
    }

    highlightElement(selector) {
        try {
            this.removeHighlight();
            
            const element = document.querySelector(selector);
            if (element) {
                element.classList.add('testing-assistant-highlight');
                element.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'center'
                });
            }
        } catch (error) {
            console.error('Element highlighting error:', error);
        }
    }

    removeHighlight() {
        const highlightedElements = document.querySelectorAll('.testing-assistant-highlight');
        highlightedElements.forEach(element => {
            element.classList.remove('testing-assistant-highlight');
        });
    }

    showOverlay(content) {
        this.hideOverlay();

        const overlay = document.createElement('div');
        overlay.className = 'testing-assistant-overlay testing-assistant-fade-in';
        overlay.innerHTML = `
            <div class="testing-assistant-overlay-header">
                <span>🔍</span>
                <span>Testing Assistant</span>
                <button class="testing-assistant-overlay-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="testing-assistant-overlay-content">
                ${content}
            </div>
        `;

        document.body.appendChild(overlay);
        this.overlay = overlay;

        // Auto-hide after 5 seconds unless it's an error
        if (!content.includes('error') && !content.includes('Error')) {
            setTimeout(() => {
                this.hideOverlay();
            }, 5000);
        }
    }

    hideOverlay() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Also remove any existing overlays
        const existingOverlays = document.querySelectorAll('.testing-assistant-overlay');
        existingOverlays.forEach(overlay => overlay.remove());
    }

    injectAnnotationTool() {
        if (document.querySelector('.testing-assistant-annotation-tool')) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'testing-assistant-annotation-backdrop';
        backdrop.onclick = () => this.closeAnnotationTool();

        const tool = document.createElement('div');
        tool.className = 'testing-assistant-annotation-tool testing-assistant-fade-in';
        tool.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; font-weight: 600; color: #6366f1;">
                <span style="font-size: 20px;">📝</span>
                <span>Add Test Annotation</span>
                <button onclick="testingContentScript.closeAnnotationTool()" 
                        style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 4px;">×</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Test Step Description:</label>
                <textarea id="annotationText" placeholder="Describe what you're testing on this page..." 
                         style="width: 100%; height: 80px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"></textarea>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">Expected Result:</label>
                <textarea id="expectedResult" placeholder="What should happen?" 
                         style="width: 100%; height: 60px; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="testingContentScript.closeAnnotationTool()" 
                        style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button>
                <button onclick="testingContentScript.saveAnnotation()" 
                        style="padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Save Step</button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(tool);

        // Focus the text area
        setTimeout(() => {
            document.getElementById('annotationText').focus();
        }, 100);
    }

    closeAnnotationTool() {
        const backdrop = document.querySelector('.testing-assistant-annotation-backdrop');
        const tool = document.querySelector('.testing-assistant-annotation-tool');
        
        if (backdrop) backdrop.remove();
        if (tool) tool.remove();
    }

    saveAnnotation() {
        const description = document.getElementById('annotationText').value.trim();
        const expectedResult = document.getElementById('expectedResult').value.trim();
        
        if (!description) {
            this.showOverlay(`
                <div style="color: #dc2626; font-weight: 500;">❌ Validation Error</div>
                <div style="margin-top: 8px; font-size: 13px; color: #64748b;">
                    Please enter a test step description.
                </div>
            `);
            return;
        }

        const annotation = {
            description: description,
            expectedResult: expectedResult,
            url: window.location.href,
            timestamp: new Date().toISOString(),
            pageTitle: document.title
        };

        // Send to background script
        chrome.runtime.sendMessage({
            action: 'saveTestStep',
            data: annotation
        }, (response) => {
            if (response && response.success) {
                this.showOverlay(`
                    <div style="color: #059669; font-weight: 500;">✅ Test step saved!</div>
                    <div style="margin-top: 8px; font-size: 13px; color: #64748b;">
                        "${description.substring(0, 50)}${description.length > 50 ? '...' : ''}"
                    </div>
                `);
            } else {
                this.showOverlay(`
                    <div style="color: #dc2626; font-weight: 500;">❌ Failed to save step</div>
                    <div style="margin-top: 8px; font-size: 13px; color: #64748b;">
                        Please try again or check the extension popup.
                    </div>
                `);
            }
        });

        this.closeAnnotationTool();
    }

    // Utility methods for element interaction
    getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c).slice(0, 2);
            return `.${classes.join('.')}`;
        }
        
        const tagName = element.tagName.toLowerCase();
        const parent = element.parentElement;
        
        if (parent) {
            const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
            if (siblings.length > 1) {
                const index = siblings.indexOf(element) + 1;
                return `${tagName}:nth-of-type(${index})`;
            }
        }
        
        return tagName;
    }

    // Monitor page interactions for automatic step detection
    setupInteractionMonitoring() {
        const events = ['click', 'submit', 'change', 'input'];
        
        events.forEach(eventType => {
            document.addEventListener(eventType, (event) => {
                this.handleInteraction(event);
            }, true);
        });
    }

    startClickTracking() {
        this.isTrackingClicks = true;
        this.currentStepClickPath = [];
        console.log('Started click tracking for current step');
    }

    stopClickTracking() {
        this.isTrackingClicks = false;
        const clickPath = [...this.currentStepClickPath];
        this.currentStepClickPath = [];
        console.log('Stopped click tracking, captured path:', clickPath);
        return clickPath;
    }

    recordClick(element) {
        if (!this.isTrackingClicks) return;

        const clickInfo = {
            timestamp: new Date().toISOString(),
            elementType: element.tagName.toLowerCase(),
            elementText: this.getElementText(element),
            selector: this.getElementSelector(element),
            url: window.location.href,
            pageTitle: document.title
        };

        this.currentStepClickPath.push(clickInfo);
        console.log('Recorded click:', clickInfo);
    }

    getElementText(element) {
        // Get meaningful text from the element
        if (element.textContent && element.textContent.trim()) {
            return element.textContent.trim().substring(0, 50);
        } else if (element.value) {
            return `[Input: ${element.value.substring(0, 20)}]`;
        } else if (element.placeholder) {
            return `[Placeholder: ${element.placeholder.substring(0, 20)}]`;
        } else if (element.alt) {
            return `[Alt: ${element.alt.substring(0, 20)}]`;
        } else if (element.title) {
            return `[Title: ${element.title.substring(0, 20)}]`;
        }
        return `[${element.tagName.toLowerCase()}]`;
    }

    handleInteraction(event) {
        // Record click if tracking is enabled
        if (event.type === 'click' && this.isTrackingClicks) {
            this.recordClick(event.target);
        }

        // This could be used to automatically suggest test steps based on user interactions
        const element = event.target;
        const selector = this.getElementSelector(element);
        const interaction = {
            type: event.type,
            element: selector,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        // Store interaction for potential step suggestions
        this.storeInteraction(interaction);
    }

    storeInteraction(interaction) {
        // Store recent interactions in session storage for step suggestions
        const interactions = JSON.parse(sessionStorage.getItem('testingAssistantInteractions') || '[]');
        interactions.push(interaction);
        
        // Keep only last 20 interactions
        if (interactions.length > 20) {
            interactions.splice(0, interactions.length - 20);
        }
        
        sessionStorage.setItem('testingAssistantInteractions', JSON.stringify(interactions));
    }
}

// Initialize content script
const testingContentScript = new ContentScriptHandler();

// Make globally accessible for HTML event handlers
window.testingContentScript = testingContentScript;

// Setup interaction monitoring
testingContentScript.setupInteractionMonitoring();