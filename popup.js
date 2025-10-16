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
        
        // Listen for storage changes to sync between popup and sidepanel
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                this.handleStorageChange(changes);
            }
        });
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
        document.getElementById('openMainExtension').addEventListener('click', () => this.openMainExtension());

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

    async takeScreenshot() {
        try {
            // Check if we're in a Chrome extension environment
            if (!chrome || !chrome.tabs || !chrome.runtime || !chrome.runtime.getManifest) {
                this.showFallbackActions();
                return;
            }

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                this.showNotification('No active tab found for screenshot', 'error');
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
            
            // Show fallback actions instead of just error message
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

        this.testSteps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = `step-item ${step.status} fade-in`;
            stepElement.dataset.stepIndex = index;
            
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
                    <button class="btn-mini btn-success step-pass-btn" data-index="${index}" title="Mark this step as Pass">✅ Pass</button>
                    <button class="btn-mini btn-danger step-fail-btn" data-index="${index}" title="Mark this step as Fail">❌ Fail</button>
                    ${step.status === 'fail' && step.bugReport ? `
                        <button class="btn-mini btn-warning step-bug-report-btn" data-index="${index}" title="Copy bug report for ADO ticket">🐛 Bug Report</button>
                    ` : ''}
                </div>
            `;
            
            // Add event listeners for step buttons using event delegation
            const passBtn = stepElement.querySelector('.step-pass-btn');
            const failBtn = stepElement.querySelector('.step-fail-btn');
            const bugReportBtn = stepElement.querySelector('.step-bug-report-btn');
            
            passBtn.addEventListener('click', () => this.markStep(index, 'pass'));
            failBtn.addEventListener('click', () => this.markStep(index, 'fail'));
            
            if (bugReportBtn) {
                bugReportBtn.addEventListener('click', () => this.showBugReportModal(index));
            }
            
            // Remove click handler and selected state since we're using individual buttons now
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
            // Check if Chrome APIs are available
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                // Use mock data for testing without Chrome extension APIs
                const mockClickPath = this.getMockClickPath();
                this.testSteps[stepIndex].clickPath = mockClickPath;
                this.testSteps[stepIndex].bugReport = this.generateBugReport(this.testSteps[stepIndex]);
                console.log('Generated mock bug report for testing');
                
                // Update the UI to show the bug report button
                this.updateStepsList();
                return;
            }
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'stopClickTracking' });
            
            if (response && response.clickPath) {
                this.testSteps[stepIndex].clickPath = response.clickPath;
                this.testSteps[stepIndex].bugReport = this.generateBugReport(this.testSteps[stepIndex]);
                console.log('Captured click path for failed step:', response.clickPath);
            }
        } catch (error) {
            console.error('Failed to capture click path:', error);
            // Fallback to mock data for testing
            this.testSteps[stepIndex].clickPath = this.getMockClickPath();
            this.testSteps[stepIndex].bugReport = this.generateBugReport(this.testSteps[stepIndex]);
        }
    }

    getMockClickPath() {
        return [
            {
                timestamp: new Date().toISOString(),
                elementType: 'input',
                elementText: 'username field',
                selector: '#username',
                url: 'http://localhost:8080/test-page.html',
                pageTitle: 'Test Page for Exploratory Testing Assistant'
            },
            {
                timestamp: new Date().toISOString(),
                elementType: 'input',
                elementText: 'password field',
                selector: '#password',
                url: 'http://localhost:8080/test-page.html',
                pageTitle: 'Test Page for Exploratory Testing Assistant'
            },
            {
                timestamp: new Date().toISOString(),
                elementType: 'button',
                elementText: 'Login',
                selector: '.login-btn',
                url: 'http://localhost:8080/test-page.html',
                pageTitle: 'Test Page for Exploratory Testing Assistant'
            }
        ];
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

    async loadScript() {
        const scriptText = document.getElementById('scriptText').value.trim();
        if (!scriptText) {
            this.showNotification('Please enter or upload a script', 'warning');
            return;
        }

        // Check if there's an active session, if not start one
        if (!this.currentSession || this.currentSession.status !== 'active') {
            await this.startSession();
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
        .bug-report-section { 
            margin-top: 15px; 
            padding: 15px; 
            background: #fef2f2; 
            border-radius: 8px;
            border-left: 4px solid #ef4444;
        }
        .bug-report-section h5 { 
            color: #ef4444; 
            margin-bottom: 10px; 
            font-size: 14px;
        }
        .bug-report-text { 
            width: 100%; 
            height: 150px; 
            font-family: monospace; 
            font-size: 12px; 
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            background: white;
            resize: vertical;
            margin-bottom: 10px;
        }
        .copy-bug-report-btn {
            background: #ef4444;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
        }
        .copy-bug-report-btn:hover {
            background: #dc2626;
        }
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
        <p><strong>Start Time:</strong> ${data.session?.startTime ? this.formatTimestamp(data.session.startTime) : 'N/A'}</p>
        <p><strong>End Time:</strong> ${data.session?.endTime ? this.formatTimestamp(data.session.endTime) : 'N/A'}</p>
        <p><strong>Status:</strong> ${data.session?.status || 'N/A'}</p>
    </div>
    
    <div class="section">
        <h2>Test Steps (${data.steps.length})</h2>
        ${data.steps.map((step, index) => `
            <div class="step ${step.status}">
                <h4>Step ${index + 1}: ${step.status.toUpperCase()}</h4>
                <p>${step.description}</p>
                ${step.timestamp ? `<div class="timestamp">${this.formatTimestamp(step.timestamp)}</div>` : ''}
                ${step.status === 'fail' && step.bugReport ? `
                    <div class="bug-report-section">
                        <h5>🐛 Bug Report for ADO Ticket</h5>
                        <div class="bug-report-content">
                            <textarea readonly class="bug-report-text">${step.bugReport}</textarea>
                            <button class="copy-bug-report-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => alert('Bug report copied to clipboard!')).catch(() => alert('Failed to copy to clipboard'))">📋 Copy Bug Report</button>
                        </div>
                    </div>
                ` : ''}
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
                <div class="timestamp">${this.formatTimestamp(screenshot.timestamp)}</div>
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

    showBugReportModal(stepIndex) {
        const step = this.testSteps[stepIndex];
        if (!step || !step.bugReport) {
            this.showNotification('No bug report available for this step', 'warning');
            return;
        }

        const modalContent = `
            <div class="bug-report-modal">
                <h4>🐛 Bug Report for Step ${stepIndex + 1}</h4>
                <div class="bug-report-content">
                    <label for="bugReportText">Copy this text to your ADO ticket description:</label>
                    <textarea id="bugReportText" readonly>${step.bugReport}</textarea>
                    <div class="bug-report-actions">
                        <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('bugReportText').value).then(() => testingAssistant.showNotification('Bug report copied to clipboard!', 'success')).catch(() => testingAssistant.showNotification('Failed to copy to clipboard', 'error'))">📋 Copy to Clipboard</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;

        this.showModal('Bug Report', modalContent);
        
        // Auto-select the text for easy copying
        setTimeout(() => {
            const textarea = document.getElementById('bugReportText');
            if (textarea) {
                textarea.select();
            }
        }, 100);
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
                this.currentSession = newData.currentSession;
                
                // Update session timer if session status changed
                if (this.currentSession && this.currentSession.status === 'active' && this.currentSession.startTime) {
                    this.sessionStartTime = new Date(this.currentSession.startTime).getTime();
                    if (!this.sessionTimer) {
                        this.startSessionTimer();
                    }
                } else if (this.sessionTimer) {
                    clearInterval(this.sessionTimer);
                    this.sessionTimer = null;
                }
                
                shouldUpdate = true;
            }
        }

        if (shouldUpdate) {
            this.updateStepsList();
            this.updateSessionInfo();
            this.updateExportSummary();
        }
    }
}

// Initialize the application when the popup loads
const testingAssistant = new TestingAssistant();

// Make it globally accessible for HTML event handlers
window.testingAssistant = testingAssistant;