// Side Panel JavaScript for Exploratory Testing Assistant
class SidePanelTestingAssistant {
    constructor() {
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.syncCheckInterval = null;
        this.testSteps = [];
        this.screenshots = [];
        
        this.initializeUI();
        this.loadSavedData();
        
        // Listen for storage changes to sync between popup and sidepanel
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                this.handleStorageChange(changes);
            }
        });
        
        // Force refresh data when sidepanel becomes visible
        this.setupVisibilityHandlers();
    }

    setupVisibilityHandlers() {
        // Constants for timing
        const VISIBILITY_REFRESH_DELAY = 100; // ms delay before refreshing data
        const SYNC_CHECK_INTERVAL = 2000; // ms between sync checks
        
        // Force refresh data when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible - refresh data to ensure sync
                setTimeout(() => {
                    this.loadSavedData();
                }, VISIBILITY_REFRESH_DELAY);
            }
        });
        
        // Also refresh data when window gains focus
        window.addEventListener('focus', () => {
            setTimeout(() => {
                this.loadSavedData();
            }, VISIBILITY_REFRESH_DELAY);
        });
        
        // Periodic sync check (only when visible)
        this.syncCheckInterval = setInterval(() => {
            if (!document.hidden) {
                this.syncCheck();
            }
        }, SYNC_CHECK_INTERVAL);
        
        // Cleanup interval when page is about to unload
        window.addEventListener('beforeunload', () => {
            if (this.syncCheckInterval) {
                clearInterval(this.syncCheckInterval);
                this.syncCheckInterval = null;
            }
        });
    }

    async syncCheck() {
        try {
            const result = await chrome.storage.local.get('testingAssistantData');
            const data = result.testingAssistantData;
            
            if (data) {
                // Check if our data is stale by comparing multiple factors
                const serverSteps = data.testSteps || [];
                const serverSession = data.currentSession;
                
                // Check for differences in step count, session status, or step modifications
                const stepCountDiff = serverSteps.length !== this.testSteps.length;
                const sessionStatusDiff = (serverSession && serverSession.status) !== (this.currentSession ? this.currentSession.status : null);
                
                // Check for step modifications by comparing last modification times
                let stepModificationDiff = false;
                if (serverSteps.length === this.testSteps.length && serverSteps.length > 0) {
                    // Compare step statuses and timestamps to detect modifications
                    for (let i = 0; i < serverSteps.length; i++) {
                        if (serverSteps[i].status !== this.testSteps[i].status ||
                            serverSteps[i].id !== this.testSteps[i].id) {
                            stepModificationDiff = true;
                            break;
                        }
                    }
                }
                
                if (stepCountDiff || sessionStatusDiff || stepModificationDiff) {
                    // Data is out of sync, refresh
                    console.log('Sidepanel data out of sync, refreshing...', {
                        stepCountDiff,
                        sessionStatusDiff,
                        stepModificationDiff
                    });
                    
                    this.currentSession = serverSession;
                    this.testSteps = serverSteps;
                    this.screenshots = data.screenshots || [];
                    
                    this.updateStepsList();
                    this.updateSessionInfo();
                    
                    // Update session UI state
                    if (this.currentSession && this.currentSession.status === 'active') {
                        this.sessionStartTime = new Date(this.currentSession.startTime).getTime();
                        document.getElementById('startSession').disabled = true;
                        document.getElementById('endSession').disabled = false;
                        document.getElementById('testInfo').style.display = 'block';
                        document.getElementById('actionButtons').style.display = 'block';
                        this.updateStatus('Testing in progress', 'warning');
                        if (!this.sessionTimer) {
                            this.startSessionTimer();
                        }
                    } else {
                        document.getElementById('startSession').disabled = false;
                        document.getElementById('endSession').disabled = true;
                        this.updateStatus('Ready', 'ready');
                        if (this.sessionTimer) {
                            clearInterval(this.sessionTimer);
                            this.sessionTimer = null;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Sync check failed:', error);
        }
    }

    initializeUI() {
        // Session controls
        document.getElementById('startSession').addEventListener('click', () => this.startSession());
        document.getElementById('endSession').addEventListener('click', () => this.endSession());

        // Action buttons
        document.getElementById('addStep').addEventListener('click', () => this.showStepInput());
        document.getElementById('openMainExtension').addEventListener('click', () => this.openMainExtension());

        // Step input
        document.getElementById('saveStep').addEventListener('click', () => this.saveStep());
        document.getElementById('cancelStep').addEventListener('click', () => this.hideStepInput());

        // Add event delegation for step action buttons
        document.getElementById('stepsList').addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-pass') || e.target.closest('.btn-pass')) {
                const stepIndex = parseInt(e.target.dataset.stepIndex || e.target.closest('.btn-pass').dataset.stepIndex);
                this.markStep(stepIndex, 'pass');
            } else if (e.target.classList.contains('btn-fail') || e.target.closest('.btn-fail')) {
                const stepIndex = parseInt(e.target.dataset.stepIndex || e.target.closest('.btn-fail').dataset.stepIndex);
                this.markStep(stepIndex, 'fail');
            }
        });
    }

    async startSession() {
        this.currentSession = {
            id: Date.now(),
            startTime: new Date(),
            status: 'active'
        };
        this.sessionStartTime = Date.now();
        this.testSteps = [];
        this.screenshots = [];

        // Update UI
        document.getElementById('startSession').disabled = true;
        document.getElementById('endSession').disabled = false;
        document.getElementById('testInfo').style.display = 'block';
        document.getElementById('actionButtons').style.display = 'block';
        
        this.updateStatus('Testing in progress', 'warning');
        this.startSessionTimer();
        this.updateSessionInfo();
        
        // Inject content script for screenshot capability
        await this.injectContentScript();
        
        this.saveData();
    }

    endSession() {
        if (this.currentSession) {
            this.currentSession.endTime = new Date();
            this.currentSession.status = 'completed';
        }

        clearInterval(this.sessionTimer);
        
        // Update UI
        document.getElementById('startSession').disabled = false;
        document.getElementById('endSession').disabled = true;
        document.getElementById('actionButtons').style.display = 'none';
        document.getElementById('stepInput').style.display = 'none';
        
        this.updateStatus('Session completed', 'success');
        this.saveData();
    }

    startSessionTimer() {
        this.sessionTimer = setInterval(() => {
            this.updateSessionInfo();
        }, 1000);
    }

    updateSessionInfo() {
        // Always show current counts even when session isn't active
        document.getElementById('stepCount').textContent = this.testSteps.length;
        document.getElementById('screenshotCount').textContent = this.screenshots.length;
        
        // Only update timer if there's an active session
        if (!this.sessionStartTime || !this.currentSession || this.currentSession.status !== 'active') {
            document.getElementById('sessionTime').textContent = '00:00:00';
            return;
        }

        const elapsed = Date.now() - this.sessionStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        document.getElementById('sessionTime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateStatus(text, type = 'ready') {
        const statusText = document.getElementById('statusText');
        const statusDot = document.querySelector('.status-dot');
        
        statusText.textContent = text;
        
        // Update status dot color
        statusDot.style.background = {
            'ready': '#10b981',
            'warning': '#f59e0b',
            'success': '#10b981',
            'error': '#ef4444'
        }[type] || '#10b981';
    }

    async openMainExtension() {
        try {
            // Try to open the main extension popup
            if (chrome && chrome.action && chrome.action.openPopup) {
                await chrome.action.openPopup();
            } else {
                // Fallback: show instructions
                this.showNotification('Please click the extension icon in Chrome toolbar to access screenshot functionality.', 'info');
            }
        } catch (error) {
            // Fallback: show instructions
            this.showNotification('Please click the extension icon in Chrome toolbar to access screenshot functionality.', 'info');
        }
    }

    showStepInput() {
        document.getElementById('stepInput').style.display = 'block';
        document.getElementById('stepDescription').focus();
    }

    hideStepInput() {
        document.getElementById('stepInput').style.display = 'none';
        document.getElementById('stepDescription').value = '';
    }

    saveStep() {
        const description = document.getElementById('stepDescription').value.trim();
        if (!description) return;

        const step = {
            id: Date.now(),
            timestamp: new Date(),
            description: description,
            status: 'in-progress',
            screenshots: []
        };

        this.testSteps.push(step);
        this.updateStepsList();
        this.updateSessionInfo();
        this.hideStepInput();
        this.saveData();
    }

    markCurrentStep(status) {
        if (this.testSteps.length === 0) {
            this.showNotification('No steps to mark', 'warning');
            return;
        }

        // Find the first pending or in-progress step, or use the last step
        let targetStep = this.testSteps.find(step => step.status === 'pending' || step.status === 'in-progress');
        if (!targetStep) {
            targetStep = this.testSteps[this.testSteps.length - 1];
        }

        targetStep.status = status;
        this.updateStepsList();
        this.saveData();
        
        const stepIndex = this.testSteps.indexOf(targetStep) + 1;
        this.showNotification(`Step ${stepIndex} marked as ${status}`, 'success');
    }

    markStep(index, status) {
        if (index >= 0 && index < this.testSteps.length) {
            const currentStatus = this.testSteps[index].status;
            this.testSteps[index].status = status;
            this.updateStepsList();
            this.saveData();
            
            // Provide clear feedback about the status change
            if (currentStatus === status) {
                this.showNotification(`Step ${index + 1} is already marked as ${status}`, 'info');
            } else {
                this.showNotification(`Step ${index + 1} changed from ${currentStatus} to ${status}`, 'success');
            }
        }
    }

    updateStepsList() {
        const stepsList = document.getElementById('stepsList');
        stepsList.innerHTML = '';

        if (this.testSteps.length === 0) {
            stepsList.innerHTML = '<div class="no-steps">No test steps yet. Start a session and add some steps!</div>';
            return;
        }

        this.testSteps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = `step-item ${step.status} fade-in`;
            
            const stepNumber = index + 1;
            const scriptIndicator = step.fromScript ? '📋 ' : '';
            const screenshotIndicator = (step.screenshots && step.screenshots.length > 0) ? ` 📸${step.screenshots.length}` : '';
            
            stepElement.innerHTML = `
                <div class="step-header">
                    <span class="step-number">${scriptIndicator}Step ${stepNumber}${screenshotIndicator}</span>
                    <span class="step-status ${step.status}">${step.status}</span>
                </div>
                <div class="step-description">${step.description}</div>
                <div class="step-timestamp">${this.formatTimestamp(step.timestamp)}</div>
                <div class="step-actions">
                    <button class="btn btn-mini btn-pass" data-step-index="${index}" title="Mark this step as Pass">✅ Pass</button>
                    <button class="btn btn-mini btn-fail" data-step-index="${index}" title="Mark this step as Fail">❌ Fail</button>
                </div>
            `;
            
            stepsList.appendChild(stepElement);
        });
    }

    async injectContentScript() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (error) {
            console.error('Failed to inject content script:', error);
        }
    }

    // Remove all script and export related methods and just keep the comment
    
    // Script and export functionality is handled in the main extension popup

    formatTimestamp(timestamp) {
        try {
            let date;
            
            if (!timestamp) {
                return new Date().toLocaleString();
            }
            
            // Handle multiple timestamp formats
            if (timestamp instanceof Date) {
                date = timestamp;
            } else if (typeof timestamp === 'string') {
                // Handle ISO strings and other formats
                date = new Date(timestamp);
            } else if (typeof timestamp === 'number') {
                // Handle Unix timestamps (both seconds and milliseconds)
                date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
            } else {
                // Fallback: try to convert whatever we got
                date = new Date(timestamp);
            }
            
            // Verify the date is valid
            if (isNaN(date.getTime())) {
                console.warn('Invalid timestamp:', timestamp);
                return new Date().toLocaleString() + ' (now)';
            }
            
            return date.toLocaleString();
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestamp);
            return new Date().toLocaleString() + ' (fallback)';
        }
    }

    saveData() {
        const data = {
            currentSession: this.currentSession,
            testSteps: this.testSteps,
            screenshots: this.screenshots,
            // Script data now stored within testSteps with fromScript flag
        };
        
        chrome.storage.local.set({ testingAssistantData: data });
    }

    async loadSavedData() {
        try {
            const result = await chrome.storage.local.get('testingAssistantData');
            const data = result.testingAssistantData;
            
            if (data) {
                this.currentSession = data.currentSession || null;
                this.testSteps = data.testSteps || [];
                this.screenshots = data.screenshots || [];
                
                // Restore UI state
                this.updateStepsList();
                
                // Check if there's an active session
                if (this.currentSession && this.currentSession.status === 'active') {
                    this.sessionStartTime = new Date(this.currentSession.startTime).getTime();
                    document.getElementById('startSession').disabled = true;
                    document.getElementById('endSession').disabled = false;
                    document.getElementById('testInfo').style.display = 'block';
                    document.getElementById('actionButtons').style.display = 'block';
                    this.updateStatus('Testing in progress', 'warning');
                    this.startSessionTimer();
                    this.updateSessionInfo(); // Immediately update to show current values
                }
                
                // Always update session info to show current counts
                this.updateSessionInfo();
            }
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    }

    handleStorageChange(changes) {
        // Sync data changes between popup and sidepanel
        let shouldUpdate = false;
        let shouldUpdateUI = false;

        if (changes.testingAssistantData && changes.testingAssistantData.newValue) {
            const newData = changes.testingAssistantData.newValue;
            
            if (newData.testSteps) {
                this.testSteps = newData.testSteps;
                shouldUpdate = true;
            }
            
            if (newData.screenshots) {
                this.screenshots = newData.screenshots;
                shouldUpdate = true;
            }
            
            if (newData.currentSession) {
                const previousSessionStatus = this.currentSession ? this.currentSession.status : null;
                this.currentSession = newData.currentSession;
                
                // Update session UI state if session status changed
                if (this.currentSession && this.currentSession.status === 'active' && this.currentSession.startTime) {
                    this.sessionStartTime = new Date(this.currentSession.startTime).getTime();
                    
                    // Update UI to reflect active session
                    document.getElementById('startSession').disabled = true;
                    document.getElementById('endSession').disabled = false;
                    document.getElementById('testInfo').style.display = 'block';
                    document.getElementById('actionButtons').style.display = 'block';
                    this.updateStatus('Testing in progress', 'warning');
                    
                    if (!this.sessionTimer) {
                        this.startSessionTimer();
                    }
                    shouldUpdateUI = true;
                } else if (this.currentSession && this.currentSession.status === 'completed') {
                    // Handle session completion
                    if (this.sessionTimer) {
                        clearInterval(this.sessionTimer);
                        this.sessionTimer = null;
                    }
                    
                    // Update UI to reflect completed session
                    document.getElementById('startSession').disabled = false;
                    document.getElementById('endSession').disabled = true;
                    document.getElementById('actionButtons').style.display = 'none';
                    this.updateStatus('Session completed', 'success');
                    shouldUpdateUI = true;
                } else {
                    // No active session
                    if (this.sessionTimer) {
                        clearInterval(this.sessionTimer);
                        this.sessionTimer = null;
                    }
                    
                    document.getElementById('startSession').disabled = false;
                    document.getElementById('endSession').disabled = true;
                    this.updateStatus('Ready', 'ready');
                    shouldUpdateUI = true;
                }
                
                shouldUpdate = true;
            }
        }

        if (shouldUpdate || shouldUpdateUI) {
            this.updateStepsList();
            this.updateSessionInfo();
        }
    }
}

// Initialize the side panel application when loaded
const sidePanelTestingAssistant = new SidePanelTestingAssistant();

// Make it globally accessible
window.sidePanelTestingAssistant = sidePanelTestingAssistant;