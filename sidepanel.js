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
            } else if (e.target.classList.contains('step-bug-report-btn') || e.target.closest('.step-bug-report-btn')) {
                const stepIndex = parseInt(e.target.dataset.stepIndex || e.target.closest('.step-bug-report-btn').dataset.stepIndex);
                this.showBugReportModal(stepIndex);
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

        // Stop any previous click tracking and start new tracking for this step
        this.startClickTrackingForStep();

        const step = {
            id: Date.now(),
            timestamp: new Date(),
            description: description,
            status: 'in-progress',
            screenshots: [],
            clickPath: [] // Will be populated when step is marked as failed
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

            // If marking as failed, capture click path and generate bug report
            if (status === 'fail') {
                this.captureClickPathForFailedStep(index);
            }

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

            stepElement.innerHTML = `
                <div class="step-header">
                    <span class="step-number">${scriptIndicator}Step ${stepNumber}</span>
                    <span class="step-status ${step.status}">${step.status}</span>
                </div>
                <div class="step-description">${step.description}</div>
                <div class="step-timestamp">${this.formatTimestamp(step.timestamp)}</div>
                <div class="step-actions">
                    <button class="btn btn-mini btn-pass" data-step-index="${index}" title="Mark this step as Pass">✅ Pass</button>
                    <button class="btn btn-mini btn-fail" data-step-index="${index}" title="Mark this step as Fail">❌ Fail</button>
                    ${step.status === 'fail' && step.bugReport ? `
                        <button class="btn btn-mini btn-warning step-bug-report-btn" data-step-index="${index}" title="Copy bug report for ADO ticket">🐛 Bug Report</button>
                    ` : ''}
                </div>
            `;

            stepsList.appendChild(stepElement);
        });
    }

    async startClickTrackingForStep() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'startClickTracking' });
            console.log('Started click tracking for new step');
        } catch (error) {
            console.error('Failed to start click tracking:', error);
        }
    }

    async captureClickPathForFailedStep(stepIndex) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopClickTracking' });

            if (response && response.clickPath) {
                this.testSteps[stepIndex].clickPath = response.clickPath;
                this.testSteps[stepIndex].bugReport = this.generateBugReport(this.testSteps[stepIndex]);
                console.log('Captured click path for failed step:', response.clickPath);
            }
        } catch (error) {
            console.error('Failed to capture click path:', error);
        }
    }

    generateBugReport(step) {
        const stepName = step.description;
        const clickPath = step.clickPath || [];

        let stepsToReproduce = '';
        if (clickPath.length > 0) {
            stepsToReproduce = clickPath.map((click, index) => {
                return `${index + 1}. Click on "${click.elementText}" (${click.elementType}) at ${click.url}`;
            }).join('\n');
        } else {
            stepsToReproduce = 'No click path captured for this step';
        }

        return `Issue: Bug encountered during ${stepName}

Steps to reproduce:
${stepsToReproduce}

Additional Information:
- Step Status: Failed
- Timestamp: ${this.formatTimestamp(step.timestamp)}
- Session ID: ${this.currentSession?.id || 'N/A'}`;
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
            <div>
                <h4>Screenshot ${index + 1}</h4>
                <p><strong>URL:</strong> ${screenshot.url}</p>
                <p><strong>Title:</strong> ${screenshot.title}</p>
                <div class="timestamp">${new Date(screenshot.timestamp).toLocaleString()}</div>
                <img src="${screenshot.dataUrl}" class="screenshot" alt="Screenshot ${index + 1}">
            </div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>
        `;
    }

    downloadBlob(blob, filename) {
        try {
            chrome.downloads.download({
                url: URL.createObjectURL(blob),
                filename: filename,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('Download failed:', chrome.runtime.lastError);
                    this.showNotification('Download failed', 'error');
                } else {
                    this.showNotification('File downloaded successfully', 'success');
                }
            });
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed', 'error');
        }
    }

    showBugReportModal(stepIndex) {
        const step = this.testSteps[stepIndex];
        if (!step || !step.bugReport) {
            this.showNotification('No bug report available for this step', 'warning');
            return;
        }

        // Create a simple modal for the sidepanel
        const modal = document.createElement('div');
        modal.className = 'bug-report-modal-overlay';
        modal.innerHTML = `
            <div class="bug-report-modal-content">
                <div class="bug-report-header">
                    <h4>🐛 Bug Report for Step ${stepIndex + 1}</h4>
                    <button class="close-btn" onclick="this.closest('.bug-report-modal-overlay').remove()">×</button>
                </div>
                <div class="bug-report-body">
                    <label>Copy this text to your ADO ticket description:</label>
                    <textarea id="sidepanelBugReportText" readonly>${step.bugReport}</textarea>
                    <div class="bug-report-actions">
                        <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('sidepanelBugReportText').value).then(() => sidePanelTestingAssistant.showNotification('Bug report copied to clipboard!', 'success')).catch(() => sidePanelTestingAssistant.showNotification('Failed to copy to clipboard', 'error'))">📋 Copy</button>
                        <button class="btn btn-secondary" onclick="this.closest('.bug-report-modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles for the modal
        const styles = `
            <style>
                .bug-report-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .bug-report-modal-content {
                    background: white;
                    border-radius: 8px;
                    width: 100%;
                    max-width: 400px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .bug-report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #e2e8f0;
                }
                .bug-report-header h4 {
                    margin: 0;
                    color: #ef4444;
                    font-size: 14px;
                }
                .close-btn {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #64748b;
                    padding: 4px;
                }
                .bug-report-body {
                    padding: 16px;
                }
                .bug-report-body label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 500;
                    font-size: 12px;
                }
                .bug-report-body textarea {
                    width: 100%;
                    height: 150px;
                    padding: 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 11px;
                    margin-bottom: 12px;
                    resize: vertical;
                }
                .bug-report-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }
            </style>
        `;

        modal.innerHTML = styles + modal.innerHTML;
        document.body.appendChild(modal);

        // Auto-select text
        setTimeout(() => {
            const textarea = document.getElementById('sidepanelBugReportText');
            if (textarea) {
                textarea.select();
            }
        }, 100);
    }

    showNotification(message, type = 'info') {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-size: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease-out;
            max-width: 280px;
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

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