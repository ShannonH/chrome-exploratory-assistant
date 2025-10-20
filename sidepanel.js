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
        
        // Calculate session time based on marked step timestamps only
        if (this.testSteps.length > 0) {
            // Find all marked timestamps (when steps were marked as pass/fail)
            const markedTimes = this.testSteps
                .filter(step => step.markedTimestamp)
                .map(step => new Date(step.markedTimestamp))
                .filter(date => !isNaN(date));
            
            if (markedTimes.length > 0) {
                const startTime = new Date(Math.min(...markedTimes));
                const endTime = new Date(Math.max(...markedTimes));
                
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
                console.log('[DEBUG] Setting markedTimestamp for step', index, 'from', currentStatus, 'to', status);
                const newTimestamp = new Date();
                this.testSteps[index].markedTimestamp = newTimestamp;
                console.log('[DEBUG] markedTimestamp set to:', newTimestamp, 'type:', typeof newTimestamp, 'instanceof Date:', newTimestamp instanceof Date);
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
                ${step.markedTimestamp ? `<div class="step-timestamp">${this.formatTimestamp(step.markedTimestamp)}</div>` : ''}
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

    normalizeTimestamp(timestamp) {
        // Convert various timestamp formats to a proper Date object
        // Return null if no valid timestamp exists (don't create fallback dates)
        if (!timestamp) return null;
        
        if (timestamp instanceof Date) {
            return timestamp;
        } else if (typeof timestamp === 'string') {
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? null : date;
        } else if (typeof timestamp === 'number') {
            return new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
        } else if (typeof timestamp === 'object' && timestamp !== null) {
            // Check for empty objects first - CRITICAL FIX
            if (Object.keys(timestamp).length === 0) {
                console.warn('[DEBUG] Empty object detected in normalizeTimestamp:', timestamp);
                return null;
            }
            
            if (timestamp.getTime && typeof timestamp.getTime === 'function') {
                return new Date(timestamp.getTime());
            } else if (timestamp.$date) {
                return new Date(timestamp.$date);
            } else if (timestamp._seconds || timestamp.seconds) {
                const seconds = timestamp._seconds || timestamp.seconds;
                const nanoseconds = timestamp._nanoseconds || timestamp.nanoseconds || 0;
                return new Date(seconds * 1000 + nanoseconds / 1000000);
            } else {
                // Log what kind of object we're trying to parse
                console.warn('[DEBUG] Unknown object type in normalizeTimestamp:', timestamp, 'keys:', Object.keys(timestamp));
                // Try to extract a valid date from the object
                const date = new Date(timestamp.toString());
                return isNaN(date.getTime()) ? null : date;
            }
        }
        
        // Return null if we can't parse it (no fallback date)
        return null;
    }

    formatTimestamp(timestamp) {
        try {
            // If no timestamp is provided, return a placeholder instead of current time
            if (!timestamp) {
                return 'No timestamp';
            }
            
            // Use normalizeTimestamp to handle all the various timestamp formats
            const normalizedDate = this.normalizeTimestamp(timestamp);
            
            // If normalization failed, return an error message
            if (!normalizedDate) {
                return `Invalid timestamp (${typeof timestamp}: ${String(timestamp).substring(0, 50)})`;
            }
            
            return normalizedDate.toLocaleString();
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
                
                // Convert timestamps back to Date objects after loading from storage
                this.testSteps.forEach(step => {
                    // Only normalize timestamps if they exist (don't create fallback dates)
                    if (step.timestamp) {
                        step.timestamp = this.normalizeTimestamp(step.timestamp);
                    }
                    if (step.markedTimestamp) {
                        console.log('[DEBUG] Normalizing markedTimestamp (loadSavedData):', step.markedTimestamp, 'type:', typeof step.markedTimestamp);
                        const normalized = this.normalizeTimestamp(step.markedTimestamp);
                        console.log('[DEBUG] Normalized result (loadSavedData):', normalized, 'type:', typeof normalized);
                        step.markedTimestamp = normalized; // Could be null for invalid timestamps
                    }
                });
                
                this.screenshots.forEach(screenshot => {
                    if (screenshot.timestamp) {
                        screenshot.timestamp = this.normalizeTimestamp(screenshot.timestamp);
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
                // Convert timestamps back to Date objects when syncing
                this.testSteps.forEach(step => {
                    // Only normalize timestamps if they exist (don't create fallback dates)
                    if (step.timestamp) {
                        step.timestamp = this.normalizeTimestamp(step.timestamp);
                    }
                    if (step.markedTimestamp) {
                        console.log('[DEBUG] Normalizing markedTimestamp (handleStorageChange):', step.markedTimestamp, 'type:', typeof step.markedTimestamp);
                        const normalized = this.normalizeTimestamp(step.markedTimestamp);
                        console.log('[DEBUG] Normalized result (handleStorageChange):', normalized, 'type:', typeof normalized);
                        step.markedTimestamp = normalized; // Could be null for invalid timestamps
                    }
                });
                shouldUpdate = true;
            }
            
            if (newData.screenshots) {
                this.screenshots = newData.screenshots;
                // Convert timestamps back to Date objects when syncing
                this.screenshots.forEach(screenshot => {
                    if (screenshot.timestamp) {
                        screenshot.timestamp = this.normalizeTimestamp(screenshot.timestamp);
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