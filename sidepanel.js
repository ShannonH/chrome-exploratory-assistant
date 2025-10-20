// Side Panel JavaScript for Exploratory Testing Assistant
class SidePanelTestingAssistant {
    constructor() {
        this.currentSession = null;
        this.sessionStartTime = null; // For backward compatibility with timing calculations
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
                    
                    // Session is now managed automatically based on step activity
                    document.getElementById('testInfo').style.display = 'block';
                    this.updateStatus('Ready', 'ready');
                }
            }
        } catch (error) {
            console.error('Sync check failed:', error);
        }
    }

    initializeUI() {
        // Remove session controls - sessions are now automatic
        
        // Remove action buttons - steps are managed automatically

        // Step input
        document.getElementById('saveStep').addEventListener('click', () => this.saveStep());
        document.getElementById('cancelStep').addEventListener('click', () => this.hideStepInput());

        // Toggle completed steps
        document.getElementById('toggleCompletedSteps').addEventListener('click', () => this.toggleCompletedSteps());

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

    // Automatic session management - no manual start/stop
    initializeSession() {
        if (!this.currentSession) {
            this.currentSession = {
                id: Date.now(),
                startTime: null, // Will be set on first step action
                endTime: null,   // Will be updated on each step action
                status: 'active'
            };
        }
    }

    autoUpdateSessionTiming() {
        if (this.testSteps.length === 0) {
            return; // No steps yet
        }

        // Find earliest step timestamp for start time
        const stepTimestamps = this.testSteps
            .filter(step => step.timestamp)
            .map(step => new Date(step.timestamp));
        
        if (stepTimestamps.length > 0) {
            const earliestTime = new Date(Math.min(...stepTimestamps));
            const latestTime = new Date(Math.max(...stepTimestamps));
            
            if (!this.currentSession.startTime) {
                this.currentSession.startTime = earliestTime;
                this.sessionStartTime = earliestTime.getTime();
            }
            
            // Always update end time to latest step action
            this.currentSession.endTime = latestTime;
        }
    }

    updateSessionInfo() {
        // Always show current counts
        document.getElementById('stepCount').textContent = this.testSteps.length;
        document.getElementById('screenshotCount').textContent = this.screenshots.length;
        
        // Calculate session time based on step timestamps - find earliest and latest
        if (this.testSteps.length > 0) {
            // Find the earliest timestamp (step creation time)
            const startTimes = this.testSteps.map(step => new Date(step.timestamp)).filter(date => !isNaN(date));
            const startTime = startTimes.length > 0 ? new Date(Math.min(...startTimes)) : null;
            
            // Find the latest timestamp (either marked time or creation time)
            const endTimes = this.testSteps.map(step => {
                const markedTime = step.markedTimestamp ? new Date(step.markedTimestamp) : null;
                const createdTime = new Date(step.timestamp);
                return markedTime && !isNaN(markedTime) ? markedTime : createdTime;
            }).filter(date => !isNaN(date));
            const endTime = endTimes.length > 0 ? new Date(Math.max(...endTimes)) : null;
            
            if (startTime && endTime) {
                const elapsed = endTime - startTime;
                const hours = Math.floor(elapsed / 3600000);
                const minutes = Math.floor((elapsed % 3600000) / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                
                document.getElementById('sessionTime').textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                document.getElementById('sessionTime').textContent = '00:00:00';
            }
        } else {
            document.getElementById('sessionTime').textContent = '00:00:00';
        }
    }

    updateStatus(text, type = 'ready') {
        // Status indicator removed from UI - this function is now a no-op
        // but kept for backward compatibility with existing code
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
        
        // Initialize session automatically if needed
        this.initializeSession();
        
        // Update session timing based on step activity
        this.autoUpdateSessionTiming();
        
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
            // Only update the timestamp when the step gets marked as pass or fail (not pending/in-progress)
            if (currentStatus !== status && (status === 'pass' || status === 'fail')) {
                this.testSteps[index].markedTimestamp = new Date();
            }
            
            this.updateStepsList();
            this.updateSessionInfo();
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
            stepsList.innerHTML = '<div class="no-steps">No test steps yet. Add some steps to get started!</div>';
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
                <div class="step-timestamp">${this.formatTimestamp(step.markedTimestamp || step.timestamp)}</div>
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

    showNotification(message, type = 'info') {
        // Simple notification implementation for sidepanel
        console.log(`[${type.toUpperCase()}] ${message}`);
        // You could implement a more sophisticated notification here
    }

    // Remove all script and export related methods and just keep the comment
    
    // Script and export functionality is handled in the main extension popup

    toggleCompletedSteps() {
        const stepsList = document.getElementById('stepsList');
        const button = document.getElementById('toggleCompletedSteps');
        
        if (stepsList.classList.contains('hide-completed')) {
            stepsList.classList.remove('hide-completed');
            button.innerHTML = '<span class="btn-icon">👁️</span> Hide Completed';
        } else {
            stepsList.classList.add('hide-completed');
            button.innerHTML = '<span class="btn-icon">👁️‍🗨️</span> Show Completed';
        }
    }

    formatTimestamp(timestamp) {
        try {
            let date;
            
            // If no timestamp is provided, return a placeholder instead of current time
            if (!timestamp) {
                return 'No timestamp';
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
                console.warn('Invalid timestamp detected:', timestamp, 'Type:', typeof timestamp);
                // Return a more helpful error message showing what we tried to parse
                return `Invalid timestamp (${typeof timestamp}: ${String(timestamp).substring(0, 50)})`;
            }
            
            return date.toLocaleString();
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestamp);
            return `Error formatting timestamp (${typeof timestamp}: ${String(timestamp).substring(0, 50)})`;
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
                
                // Convert timestamp strings back to Date objects after loading from storage
                this.testSteps.forEach(step => {
                    if (step.timestamp && typeof step.timestamp === 'string') {
                        step.timestamp = new Date(step.timestamp);
                    }
                    if (step.markedTimestamp && typeof step.markedTimestamp === 'string') {
                        step.markedTimestamp = new Date(step.markedTimestamp);
                    }
                });
                
                this.screenshots.forEach(screenshot => {
                    if (screenshot.timestamp && typeof screenshot.timestamp === 'string') {
                        screenshot.timestamp = new Date(screenshot.timestamp);
                    }
                });
                
                // Restore UI state
                this.updateStepsList();
                this.updateSessionInfo();
                
                // Session is now managed automatically
                document.getElementById('testInfo').style.display = 'block';
                this.updateStatus('Ready', 'ready');
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
                // Convert timestamp strings back to Date objects when syncing
                this.testSteps.forEach(step => {
                    if (step.timestamp && typeof step.timestamp === 'string') {
                        step.timestamp = new Date(step.timestamp);
                    }
                    if (step.markedTimestamp && typeof step.markedTimestamp === 'string') {
                        step.markedTimestamp = new Date(step.markedTimestamp);
                    }
                });
                shouldUpdate = true;
            }
            
            if (newData.screenshots) {
                this.screenshots = newData.screenshots;
                // Convert timestamp strings back to Date objects when syncing
                this.screenshots.forEach(screenshot => {
                    if (screenshot.timestamp && typeof screenshot.timestamp === 'string') {
                        screenshot.timestamp = new Date(screenshot.timestamp);
                    }
                });
                shouldUpdate = true;
            }
            
            if (newData.currentSession) {
                this.currentSession = newData.currentSession;
                shouldUpdate = true;
                shouldUpdateUI = true;
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