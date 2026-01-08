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
        // Action buttons
        document.getElementById('addStep').addEventListener('click', () => this.showStepInput());
        document.getElementById('openMainExtension').addEventListener('click', () => this.openMainExtension());

        // Step input
        document.getElementById('saveStep').addEventListener('click', () => this.saveStep());
        document.getElementById('cancelStep').addEventListener('click', () => this.hideStepInput());

        // Toggle completed steps and clear steps
        document.getElementById('toggleCompletedSteps').addEventListener('click', () => this.toggleCompletedSteps());
        document.getElementById('clearSteps').addEventListener('click', () => this.clearSteps());

        // Context header close button
        document.getElementById('closeContext').addEventListener('click', () => {
            document.getElementById('contextHeader').style.display = 'none';
        });

        // Add event delegation for step action buttons
        document.getElementById('stepsList').addEventListener('click', (e) => {
            if (e.target.classList.contains('step-pass-btn') || e.target.closest('.step-pass-btn')) {
                const stepIndex = parseInt(e.target.dataset.index || e.target.closest('.step-pass-btn').dataset.index);
                this.markStep(stepIndex, 'pass');
            } else if (e.target.classList.contains('step-fail-btn') || e.target.closest('.step-fail-btn')) {
                const stepIndex = parseInt(e.target.dataset.index || e.target.closest('.step-fail-btn').dataset.index);
                this.markStep(stepIndex, 'fail');
            } else if (e.target.classList.contains('step-screenshot-btn') || e.target.closest('.step-screenshot-btn')) {
                const stepIndex = parseInt(e.target.dataset.index || e.target.closest('.step-screenshot-btn').dataset.index);
                this.takeScreenshotForStep(stepIndex);
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
            
            // Create step header
            const stepHeader = document.createElement('div');
            stepHeader.className = 'step-header';
            stepHeader.innerHTML = `
                <span class="step-number">${scriptIndicator}Step ${stepNumber}${screenshotIndicator}</span>
                <span class="step-status ${step.status}">${step.status}</span>
            `;
            stepElement.appendChild(stepHeader);
            
            // Create step description
            const stepDescription = document.createElement('div');
            stepDescription.className = 'step-description';
            stepDescription.textContent = step.description;
            stepElement.appendChild(stepDescription);
            
            // Create timestamp if exists
            if (step.markedTimestamp) {
                const stepTimestamp = document.createElement('div');
                stepTimestamp.className = 'step-timestamp';
                stepTimestamp.textContent = this.formatTimestamp(step.markedTimestamp);
                stepElement.appendChild(stepTimestamp);
            }
            
            // Create screenshots container if screenshots exist
            if (step.screenshots && step.screenshots.length > 0) {
                const screenshotsContainer = document.createElement('div');
                screenshotsContainer.className = 'step-screenshots';
                
                step.screenshots.forEach((screenshot, screenshotIndex) => {
                    // Validate dataUrl format to prevent XSS - must be a valid data URL with image MIME type
                    const isValidDataUrl = screenshot.dataUrl && 
                        typeof screenshot.dataUrl === 'string' &&
                        /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(screenshot.dataUrl);
                    
                    if (isValidDataUrl) {
                        const screenshotPreview = document.createElement('div');
                        screenshotPreview.className = 'screenshot-preview';
                        
                        const img = document.createElement('img');
                        img.src = screenshot.dataUrl;
                        img.alt = `Screenshot ${screenshotIndex + 1}`;
                        img.className = 'screenshot-thumbnail';
                        
                        screenshotPreview.appendChild(img);
                        screenshotsContainer.appendChild(screenshotPreview);
                    }
                });
                
                stepElement.appendChild(screenshotsContainer);
            }
            
            // Create step actions
            const stepActions = document.createElement('div');
            stepActions.className = 'step-actions';
            stepActions.innerHTML = `
                <button class="btn btn-mini btn-success step-pass-btn" data-index="${index}" title="Mark this step as Pass">✅ Pass</button>
                <button class="btn btn-mini btn-danger step-fail-btn" data-index="${index}" title="Mark this step as Fail">❌ Fail</button>
                <button class="btn btn-mini btn-screenshot step-screenshot-btn" data-index="${index}" title="Take Screenshot for this step">📸 Screenshot</button>
            `;
            stepElement.appendChild(stepActions);
            
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

    /**
     * Display metadata in the context header
     */
    displayContextHeader(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) {
            document.getElementById('contextHeader').style.display = 'none';
            return;
        }
        
        const contextHeader = document.getElementById('contextHeader');
        const contextContent = document.getElementById('contextContent');
        
        // Clear existing content
        contextContent.innerHTML = '';
        
        // Display metadata items
        for (const [key, value] of Object.entries(metadata)) {
            const item = document.createElement('div');
            item.className = 'context-item';
            item.innerHTML = `
                <div class="context-label">${this.escapeHtml(key)}</div>
                <div class="context-value">${this.escapeHtml(value)}</div>
            `;
            contextContent.appendChild(item);
        }
        
        contextHeader.style.display = 'block';
    }

    /**
     * Helper function to escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    saveData() {
        // Properly serialize Date objects to prevent empty object corruption
        const serializedTestSteps = this.testSteps.map(step => ({
            ...step,
            timestamp: step.timestamp instanceof Date ? step.timestamp.toISOString() : step.timestamp,
            markedTimestamp: step.markedTimestamp instanceof Date ? step.markedTimestamp.toISOString() : step.markedTimestamp,
            // Also serialize timestamps in step-level screenshots
            screenshots: step.screenshots ? step.screenshots.map(screenshot => ({
                ...screenshot,
                timestamp: screenshot.timestamp instanceof Date ? screenshot.timestamp.toISOString() : screenshot.timestamp
            })) : step.screenshots
        }));
        
        const serializedScreenshots = this.screenshots.map(screenshot => ({
            ...screenshot,
            timestamp: screenshot.timestamp instanceof Date ? screenshot.timestamp.toISOString() : screenshot.timestamp
        }));
        
        const data = {
            currentSession: this.currentSession,
            testSteps: serializedTestSteps,
            screenshots: serializedScreenshots,
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
                
                // Load and display context metadata if available
                if (data.contextMetadata) {
                    this.displayContextHeader(data.contextMetadata);
                }
                
                // Convert timestamps back to Date objects after loading from storage
                this.testSteps.forEach(step => {
                    // Only normalize timestamps if they exist (don't create fallback dates)
                    if (step.timestamp) {
                        step.timestamp = this.normalizeTimestamp(step.timestamp);
                    }
                    if (step.markedTimestamp) {
                        const normalized = this.normalizeTimestamp(step.markedTimestamp);
                        step.markedTimestamp = normalized; // Could be null for invalid timestamps
                    }
                    // Also normalize timestamps in step-level screenshots
                    if (step.screenshots) {
                        step.screenshots.forEach(screenshot => {
                            if (screenshot.timestamp) {
                                screenshot.timestamp = this.normalizeTimestamp(screenshot.timestamp);
                            }
                        });
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
                        const normalized = this.normalizeTimestamp(step.markedTimestamp);
                        step.markedTimestamp = normalized; // Could be null for invalid timestamps
                    }
                    // Also normalize timestamps in step-level screenshots
                    if (step.screenshots) {
                        step.screenshots.forEach(screenshot => {
                            if (screenshot.timestamp) {
                                screenshot.timestamp = this.normalizeTimestamp(screenshot.timestamp);
                            }
                        });
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

    async takeScreenshot() {
        try {
            // Check if we're in a Chrome extension environment
            if (!chrome || !chrome.tabs || !chrome.runtime || !chrome.runtime.getManifest) {
                this.showFallbackActions();
                return;
            }

            // Get the last focused window (not the sidepanel)
            const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
            const lastFocusedWindow = windows.sort((a, b) => b.id - a.id)[0];
            
            if (!lastFocusedWindow) {
                this.showNotification('No browser window found for screenshot', 'error');
                return;
            }
            
            const tab = lastFocusedWindow.tabs.find(t => t.active);
            if (!tab) {
                this.showNotification('No active tab found for screenshot', 'error');
                return;
            }
            
            // Send message to content script to prepare for screenshot
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'prepareScreenshot' });
            } catch (error) {
                // Content script might not be injected yet, try to inject it
                try {
                    await this.injectContentScript();
                } catch (injectError) {
                    console.log('Content script injection failed:', injectError);
                }
            }
            
            // Capture screenshot using background script message, pass window ID
            const response = await chrome.runtime.sendMessage({ 
                action: 'CAPTURE_SCREENSHOT',
                windowId: lastFocusedWindow.id
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to capture screenshot');
            }
            
            const screenshot = {
                id: Date.now(),
                timestamp: new Date(),
                dataUrl: response.dataUrl,
                url: tab.url,
                title: tab.title
            };

            this.screenshots.push(screenshot);
            
            this.updateSessionInfo();
            this.saveData();
            
            // Show success feedback
            this.showNotification('Screenshot captured successfully!', 'success');
            
        } catch (error) {
            console.error('Screenshot error:', error);
            
            // Show fallback actions instead of just error message
            this.showFallbackActions();
        }
    }

    async takeScreenshotForStep(stepIndex) {
        try {
            // Check if we're in a Chrome extension environment
            if (!chrome || !chrome.tabs || !chrome.runtime || !chrome.runtime.getManifest) {
                this.showFallbackActions();
                return;
            }

            // Get the last focused window (not the sidepanel)
            const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
            const lastFocusedWindow = windows.sort((a, b) => b.id - a.id)[0];
            
            if (!lastFocusedWindow) {
                this.showNotification('No browser window found for screenshot', 'error');
                return;
            }
            
            const tab = lastFocusedWindow.tabs.find(t => t.active);
            if (!tab) {
                this.showNotification('No active tab found for screenshot', 'error');
                return;
            }
            
            // Send message to content script to prepare for screenshot
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'prepareScreenshot' });
            } catch (error) {
                // Content script might not be injected yet, try to inject it
                try {
                    await this.injectContentScript();
                } catch (injectError) {
                    console.log('Content script injection failed:', injectError);
                }
            }
            
            // Capture screenshot using background script message, pass window ID
            const response = await chrome.runtime.sendMessage({ 
                action: 'CAPTURE_SCREENSHOT',
                windowId: lastFocusedWindow.id
            });
            
            if (!response.success) {
                throw new Error(response.error || 'Failed to capture screenshot');
            }
            
            const screenshot = {
                id: Date.now(),
                timestamp: new Date(),
                dataUrl: response.dataUrl,
                url: tab.url,
                title: tab.title
            };

            this.screenshots.push(screenshot);
            
            // Associate screenshot with the specific step
            if (stepIndex >= 0 && stepIndex < this.testSteps.length) {
                const targetStep = this.testSteps[stepIndex];
                if (!targetStep.screenshots) {
                    targetStep.screenshots = [];
                }
                targetStep.screenshots.push(screenshot);
                
                this.updateStepsList(); // Update steps list to show associated screenshots
                this.showNotification(`Screenshot associated with Step ${stepIndex + 1}!`, 'success');
            }
            
            this.updateSessionInfo();
            this.saveData();
            
        } catch (error) {
            console.error('Screenshot error:', error);
            this.showFallbackActions();
        }
    }

    showFallbackActions() {
        const actionButtons = document.getElementById('actionButtons');
        const fallbackActions = document.getElementById('fallbackActions');
        
        if (actionButtons && fallbackActions) {
            actionButtons.style.display = 'none';
            fallbackActions.style.display = 'block';
        }
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

    async checkDownloadStatus() {
        try {
            const result = await chrome.storage.local.get(['hasDownloadedCurrentSession', 'lastDownloadTime']);
            return {
                hasDownloaded: result.hasDownloadedCurrentSession || false,
                lastDownloadTime: result.lastDownloadTime || null
            };
        } catch (error) {
            console.error('Error checking download status:', error);
            return { hasDownloaded: false, lastDownloadTime: null };
        }
    }

    clearSteps() {
        if (this.testSteps.length === 0 && this.screenshots.length === 0) {
            this.showNotification('No data to clear', 'info');
            return;
        }

        this.showClearStepsConfirmDialog();
    }

    async showClearStepsConfirmDialog() {
        const downloadStatus = await this.checkDownloadStatus();
        
        let message = 'Are you sure you want to clear all test steps and screenshots? This action cannot be undone.';
        let extraWarning = '';
        
        if (!downloadStatus.hasDownloaded && (this.testSteps.length > 0 || this.screenshots.length > 0)) {
            extraWarning = '\n\n⚠️ WARNING: You haven\'t downloaded a report yet. Consider exporting your data first!';
        } else if (downloadStatus.hasDownloaded && downloadStatus.lastDownloadTime) {
            const downloadDate = new Date(downloadStatus.lastDownloadTime);
            extraWarning = `\n\n✅ Last download: ${downloadDate.toLocaleString()}`;
        }

        const fullMessage = message + extraWarning;
        
        if (confirm(fullMessage)) {
            this.performClearSteps();
        }
    }

    performClearSteps() {
        this.testSteps = [];
        this.screenshots = [];
        
        // Reset download tracking for new session
        chrome.storage.local.set({ hasDownloadedCurrentSession: false });
        
        this.updateStepsList();
        this.updateSessionInfo();
        this.saveData();
        
        this.showNotification('All steps and screenshots cleared', 'success');
    }
}

// Initialize the side panel application when loaded
const sidePanelTestingAssistant = new SidePanelTestingAssistant();

// Make it globally accessible
window.sidePanelTestingAssistant = sidePanelTestingAssistant;