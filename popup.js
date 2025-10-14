// Popup JavaScript for Exploratory Testing Assistant
class TestingAssistant {
    constructor() {
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.testSteps = [];
        this.screenshots = [];
        this.selectedStepIndex = null; // Track which step is selected for pass/fail actions
        // Legacy script tracking removed - now using testSteps directly
        
        this.initializeUI();
        this.loadSavedData();
    }

    initializeUI() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Session controls
        document.getElementById('startSession').addEventListener('click', () => this.startSession());
        document.getElementById('endSession').addEventListener('click', () => this.endSession());

        // Action buttons
        document.getElementById('takeScreenshot').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('addStep').addEventListener('click', () => this.showStepInput());
        document.getElementById('markPass').addEventListener('click', () => this.markCurrentStep('pass'));
        document.getElementById('markFail').addEventListener('click', () => this.markCurrentStep('fail'));

        // Step input
        document.getElementById('saveStep').addEventListener('click', () => this.saveStep());
        document.getElementById('cancelStep').addEventListener('click', () => this.hideStepInput());

        // Script tab
        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('loadScript').addEventListener('click', () => this.loadScript());
        document.getElementById('clearScript').addEventListener('click', () => this.clearScript());

        // Export tab
        document.getElementById('exportData').addEventListener('click', () => this.exportData());
        document.getElementById('clearData').addEventListener('click', () => this.clearAllData());

        // Side panel
        document.getElementById('openSidePanel').addEventListener('click', () => this.openSidePanel());

        // Help toggle
        document.getElementById('helpToggle').addEventListener('click', () => this.toggleHelp());

        // Drag and drop for script upload
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileDrop(e);
        });

        this.updateExportSummary();
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Show corresponding tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}Tab`).style.display = 'block';

        // Update content based on tab
        if (tabName === 'export') {
            this.updateExportSummary();
        }
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
        if (!this.sessionStartTime) return;

        const elapsed = Date.now() - this.sessionStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        document.getElementById('sessionTime').textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('stepCount').textContent = this.testSteps.length;
        document.getElementById('screenshotCount').textContent = this.screenshots.length;
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

    async takeScreenshot() {
        try {
            // Check if we're in a Chrome extension environment
            if (!chrome || !chrome.tabs) {
                this.showNotification('Screenshot capture requires Chrome extension environment', 'warning');
                return;
            }

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showNotification('No active tab found', 'error');
                return;
            }
            
            const tab = tabs[0];
            
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
            
            // Capture screenshot
            const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
            
            const screenshot = {
                id: Date.now(),
                timestamp: new Date(),
                dataUrl: dataUrl,
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
            
            // Provide more helpful error messages
            if (error.message.includes('activeTab')) {
                this.showNotification('Screenshot permission denied. Please ensure the extension has activeTab permission.', 'error');
            } else if (error.message.includes('tabs')) {
                this.showNotification('Tab access denied. Please reload the extension and try again.', 'error');
            } else {
                this.showNotification('Screenshot capture failed. Try reloading the page and extension.', 'error');
            }
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
            this.showNotification('No steps to mark. Add a step first.', 'warning');
            return;
        }

        let targetStep;
        let stepIndex;

        // If a step is selected, use that one
        if (this.selectedStepIndex !== null && this.selectedStepIndex < this.testSteps.length) {
            targetStep = this.testSteps[this.selectedStepIndex];
            stepIndex = this.selectedStepIndex;
            
            const previousStatus = targetStep.status;
            targetStep.status = status;
            this.updateStepsList();
            this.saveData();
            
            if (previousStatus === status) {
                this.showNotification(`Step ${stepIndex + 1} is already marked as ${status}`, 'warning');
            } else {
                this.showNotification(`Step ${stepIndex + 1} changed from ${previousStatus} to ${status}`, 'success');
            }
            
        } else {
            // Find the first pending or in-progress step, or use the last step
            targetStep = this.testSteps.find(step => step.status === 'pending' || step.status === 'in-progress');
            if (!targetStep) {
                // If no pending/in-progress steps, auto-select the last step
                targetStep = this.testSteps[this.testSteps.length - 1];
                stepIndex = this.testSteps.length - 1;
                this.selectedStepIndex = stepIndex;
                this.showNotification(`Auto-selected Step ${stepIndex + 1}. Click again to mark as ${status}.`, 'info');
                this.updateStepsList();
                return;
            }
            stepIndex = this.testSteps.indexOf(targetStep);
            
            const previousStatus = targetStep.status;
            targetStep.status = status;
            this.updateStepsList();
            this.saveData();
            
            this.showNotification(`Step ${stepIndex + 1} marked as ${status} (was ${previousStatus})`, 'success');
        }
    }

    selectStep(index) {
        // If clicking the same step that's already selected, deselect it
        if (this.selectedStepIndex === index) {
            this.selectedStepIndex = null;
            this.showNotification(`Step ${index + 1} deselected`, 'info');
        } else {
            this.selectedStepIndex = index;
            this.showNotification(`Step ${index + 1} selected for Pass/Fail actions`, 'info');
        }
        this.updateStepsList();
    }

    markStep(index, status) {
        if (index >= 0 && index < this.testSteps.length) {
            const currentStatus = this.testSteps[index].status;
            this.testSteps[index].status = status;
            this.updateStepsList();
            this.saveData();
            
            // Provide clear feedback about the status change
            if (currentStatus === status) {
                this.showNotification(`Step ${index + 1} is already marked as ${status}`, 'warning');
            } else {
                this.showNotification(`Step ${index + 1} changed from ${currentStatus} to ${status}`, 'success');
            }
        }
    }

    updateStepsList() {
        const stepsList = document.getElementById('stepsList');
        stepsList.innerHTML = '';

        this.testSteps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = `step-item ${step.status} fade-in`;
            stepElement.dataset.stepIndex = index;
            
            const stepNumber = index + 1;
            const scriptIndicator = step.fromScript ? '📋 ' : '';
            const isSelected = this.selectedStepIndex === index;
            
            stepElement.innerHTML = `
                <div class="step-header">
                    <span class="step-number">${scriptIndicator}Step ${stepNumber}</span>
                    <span class="step-status ${step.status}">${step.status}</span>
                    ${isSelected ? '<span class="step-selected">🎯 Selected</span>' : ''}
                </div>
                <div class="step-description">${step.description}</div>
                <div class="step-timestamp">${this.formatTimestamp(step.timestamp)}</div>
                <div class="step-actions">
                    <button class="btn-mini btn-success" onclick="testingAssistant.markStep(${index}, 'pass')" title="Mark this step as Pass (overrides any previous status)">✅</button>
                    <button class="btn-mini btn-danger" onclick="testingAssistant.markStep(${index}, 'fail')" title="Mark this step as Fail (overrides any previous status)">❌</button>
                    <button class="btn-mini btn-outline" onclick="testingAssistant.selectStep(${index})" title="${isSelected ? 'Deselect this step' : 'Select this step for main Pass/Fail buttons'}">${isSelected ? '🎯' : '👆'}</button>
                </div>
            `;
            
            // Add click handler to select step
            stepElement.addEventListener('click', (e) => {
                if (!e.target.closest('.step-actions')) {
                    this.selectStep(index);
                }
            });
            
            if (isSelected) {
                stepElement.classList.add('selected');
            }
            
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

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.readScriptFile(file);
        }
    }

    handleFileDrop(event) {
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.readScriptFile(files[0]);
        }
    }

    readScriptFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('scriptText').value = e.target.result;
        };
        reader.readAsText(file);
    }

    loadScript() {
        const scriptText = document.getElementById('scriptText').value.trim();
        if (!scriptText) {
            this.showNotification('Please enter or upload a script', 'warning');
            return;
        }

        // Check if there's an active session, if not start one
        if (!this.currentSession || this.currentSession.status !== 'active') {
            this.startSession();
        }

        // Parse script into test steps and add them to the main test steps
        const scriptSteps = scriptText.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => line.replace(/^\d+\.\s*/, '')); // Remove numbering

        // Add each script step as a test step
        scriptSteps.forEach(stepText => {
            const step = {
                id: Date.now() + Math.random(), // Ensure unique IDs
                timestamp: new Date(),
                description: stepText,
                status: 'pending',
                screenshots: [],
                fromScript: true // Mark as script-generated
            };
            this.testSteps.push(step);
        });

        // Update the main view to show the steps
        this.updateStepsList();
        this.updateSessionInfo();
        this.saveData();
        
        // Switch to the main test session tab to show the loaded steps
        this.switchTab('test');
        
        this.showNotification(`Script loaded: ${scriptSteps.length} steps added`, 'success');
    }

    clearScript() {
        document.getElementById('scriptText').value = '';
        document.getElementById('scriptProgress').style.display = 'none';
        this.saveData();
    }

    exportData() {
        const format = document.querySelector('input[name="format"]:checked').value;
        const includeScreenshots = document.getElementById('includeScreenshots').checked;
        const includeTimestamps = document.getElementById('includeTimestamps').checked;

        const exportData = {
            session: this.currentSession,
            steps: this.testSteps.map(step => ({
                ...step,
                timestamp: includeTimestamps ? step.timestamp : undefined
            })),
            screenshots: includeScreenshots ? this.screenshots : [],
            scriptSteps: this.testSteps.filter(step => step.fromScript).length,
            exportedAt: new Date()
        };

        if (format === 'json') {
            this.downloadJSON(exportData);
        } else {
            this.downloadHTML(exportData);
        }
    }

    downloadJSON(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadBlob(blob, `test-session-${Date.now()}.json`);
    }

    downloadHTML(data) {
        const html = this.generateHTMLReport(data);
        const blob = new Blob([html], { type: 'text/html' });
        this.downloadBlob(blob, `test-report-${Date.now()}.html`);
    }

    generateHTMLReport(data) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #6366f1; color: white; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; }
        .step { border-left: 4px solid #6366f1; padding: 10px; margin: 10px 0; background: #f8fafc; }
        .step.pass { border-left-color: #10b981; }
        .step.fail { border-left-color: #ef4444; }
        .screenshot { max-width: 100%; height: auto; border: 1px solid #ddd; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Exploratory Test Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Session Information</h2>
        <p><strong>Session ID:</strong> ${data.session?.id || 'N/A'}</p>
        <p><strong>Start Time:</strong> ${data.session?.startTime ? new Date(data.session.startTime).toLocaleString() : 'N/A'}</p>
        <p><strong>End Time:</strong> ${data.session?.endTime ? new Date(data.session.endTime).toLocaleString() : 'N/A'}</p>
        <p><strong>Status:</strong> ${data.session?.status || 'N/A'}</p>
    </div>
    
    <div class="section">
        <h2>Test Steps (${data.steps.length})</h2>
        ${data.steps.map((step, index) => `
            <div class="step ${step.status}">
                <h4>Step ${index + 1}: ${step.status.toUpperCase()}</h4>
                <p>${step.description}</p>
                ${step.timestamp ? `<div class="timestamp">${new Date(step.timestamp).toLocaleString()}</div>` : ''}
            </div>
        `).join('')}
    </div>
    
    ${data.screenshots.length > 0 ? `
    <div class="section">
        <h2>Screenshots (${data.screenshots.length})</h2>
        ${data.screenshots.map((screenshot, index) => `
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

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            this.currentSession = null;
            this.testSteps = [];
            this.screenshots = [];
            
            // Clear only this extension's data
            chrome.storage.local.remove('testingAssistantData');
            
            this.updateStepsList();
            this.updateExportSummary();
            this.updateSessionInfo();
            
            this.showNotification('All data cleared', 'success');
        }
    }

    updateExportSummary() {
        const summaryElement = document.getElementById('exportSummary');
        const passedSteps = this.testSteps.filter(step => step.status === 'pass').length;
        const failedSteps = this.testSteps.filter(step => step.status === 'fail').length;
        
        summaryElement.innerHTML = `
            <h4>Session Summary</h4>
            <div class="summary-item">
                <span>Total Steps:</span>
                <span>${this.testSteps.length}</span>
            </div>
            <div class="summary-item">
                <span>Passed Steps:</span>
                <span>${passedSteps}</span>
            </div>
            <div class="summary-item">
                <span>Failed Steps:</span>
                <span>${failedSteps}</span>
            </div>
            <div class="summary-item">
                <span>Screenshots:</span>
                <span>${this.screenshots.length}</span>
            </div>
            <div class="summary-item">
                <span>Script Steps:</span>
                <span>${this.testSteps.filter(step => step.fromScript).length}</span>
            </div>
        `;
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
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async openSidePanel() {
        try {
            // Try multiple methods for opening side panel (Chrome 141 compatibility)
            if (chrome.sidePanel) {
                if (chrome.sidePanel.open) {
                    // Method 1: Direct open
                    await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
                    this.showNotification('Side panel opened!', 'success');
                    return;
                } else if (chrome.sidePanel.setOptions) {
                    // Method 2: Set options then send message to background
                    await chrome.sidePanel.setOptions({
                        path: 'sidepanel.html',
                        enabled: true
                    });
                    // Send message to background to handle opening
                    chrome.runtime.sendMessage({ action: 'openSidePanel' });
                    this.showNotification('Side panel enabled - check browser sidebar', 'success');
                    return;
                }
            }
            
            // Fallback: Try to open detached popup window
            this.openDetachedWindow();
            
        } catch (error) {
            console.error('Failed to open side panel:', error);
            // Fallback: Try to open detached popup window  
            this.openDetachedWindow();
        }
    }

    async openDetachedWindow() {
        try {
            // Check if we're in a Chrome extension environment
            if (typeof chrome !== 'undefined' && chrome.windows && chrome.runtime) {
                // Create a detached popup window as alternative to side panel
                const windowInfo = await chrome.windows.create({
                    url: chrome.runtime.getURL('sidepanel.html'),
                    type: 'popup',
                    width: 350,
                    height: 600,
                    left: screen.width - 370, // Position on the right side
                    top: 100,
                    focused: false // Don't steal focus from main window
                });
                
                this.showNotification('Testing window opened - stays on top for easy access!', 'success');
                
                // Store window ID to potentially close it later
                chrome.storage.local.set({ 'detachedWindowId': windowInfo.id });
            } else {
                // Fallback for browser testing environment
                this.showDetachedWindowInstructions();
            }
            
        } catch (error) {
            console.error('Failed to open detached window:', error);
            this.showDetachedWindowInstructions();
        }
    }

    showDetachedWindowInstructions() {
        // Create a more helpful instruction modal
        const instructionsHtml = `
            <div class="pin-instructions">
                <h4>📌 Keep Extension Accessible</h4>
                <div class="instruction-item">
                    <strong>1. Pin to Toolbar:</strong> Right-click extension icon → "Pin"
                </div>
                <div class="instruction-item">
                    <strong>2. Keyboard Shortcuts:</strong> 
                    <ul>
                        <li><kbd>Alt+T</kbd> - Open assistant</li>
                        <li><kbd>Alt+S</kbd> - Take screenshot</li>
                        <li><kbd>Alt+P</kbd> - Mark Pass</li>
                        <li><kbd>Alt+F</kbd> - Mark Fail</li>
                    </ul>
                </div>
                <div class="instruction-item">
                    <strong>3. Browser Bookmarks:</strong> Bookmark this popup for quick access
                </div>
                <div class="instruction-item">
                    <strong>4. Context Menu:</strong> Right-click on pages for quick actions
                </div>
            </div>
        `;
        
        // Show modal with instructions
        this.showModal('Pin Extension', instructionsHtml);
    }

    showModal(title, content) {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">${content}</div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Got it!</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-remove after delay
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 15000); // 15 seconds
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

    toggleHelp() {
        const helpSection = document.getElementById('helpSection');
        if (helpSection.style.display === 'none' || !helpSection.style.display) {
            helpSection.style.display = 'flex';
            // Close help when clicking outside
            setTimeout(() => {
                const closeHelp = (e) => {
                    if (e.target === helpSection) {
                        helpSection.style.display = 'none';
                        document.removeEventListener('click', closeHelp);
                    }
                };
                document.addEventListener('click', closeHelp);
            }, 100);
        } else {
            helpSection.style.display = 'none';
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
                this.updateExportSummary();
                
                // Check if there's an active session
                if (this.currentSession && this.currentSession.status === 'active') {
                    this.sessionStartTime = new Date(this.currentSession.startTime).getTime();
                    document.getElementById('startSession').disabled = true;
                    document.getElementById('endSession').disabled = false;
                    document.getElementById('testInfo').style.display = 'block';
                    document.getElementById('actionButtons').style.display = 'block';
                    this.updateStatus('Testing in progress', 'warning');
                    this.startSessionTimer();
                }
            }
        } catch (error) {
            console.error('Failed to load saved data:', error);
        }
    }
}

// Initialize the application when the popup loads
const testingAssistant = new TestingAssistant();

// Make it globally accessible for HTML event handlers
window.testingAssistant = testingAssistant;