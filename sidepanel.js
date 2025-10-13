// Side Panel JavaScript for Exploratory Testing Assistant
class SidePanelTestingAssistant {
    constructor() {
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.testSteps = [];
        this.screenshots = [];
        
        this.initializeUI();
        this.loadSavedData();
    }

    initializeUI() {
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

        // Modal controls
        document.getElementById('loadScript').addEventListener('click', () => this.showScriptModal());
        document.getElementById('exportData').addEventListener('click', () => this.showExportModal());

        // Script modal
        document.getElementById('closeScriptModal').addEventListener('click', () => this.hideScriptModal());
        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('loadScriptBtn').addEventListener('click', () => this.loadScript());
        document.getElementById('clearScript').addEventListener('click', () => this.clearScript());

        // Export modal
        document.getElementById('closeExportModal').addEventListener('click', () => this.hideExportModal());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        document.getElementById('clearData').addEventListener('click', () => this.clearAllData());

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
                console.log('Content script not available:', error);
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
            
            this.showNotification('Screenshot captured!', 'success');
            
        } catch (error) {
            console.error('Screenshot error:', error);
            this.showNotification('Failed to capture screenshot', 'error');
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

    updateStepsList() {
        const stepsList = document.getElementById('stepsList');
        stepsList.innerHTML = '';

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

    // Modal management
    showScriptModal() {
        document.getElementById('scriptModal').style.display = 'flex';
    }

    hideScriptModal() {
        document.getElementById('scriptModal').style.display = 'none';
    }

    showExportModal() {
        this.updateExportSummary();
        document.getElementById('exportModal').style.display = 'flex';
    }

    hideExportModal() {
        document.getElementById('exportModal').style.display = 'none';
    }

    // Script functionality
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

        // Update the view to show the steps
        this.updateStepsList();
        this.updateSessionInfo();
        this.saveData();
        
        this.hideScriptModal();
        this.showNotification(`Script loaded: ${scriptSteps.length} steps added`, 'success');
    }

    clearScript() {
        document.getElementById('scriptText').value = '';
        this.saveData();
    }

    // Export functionality
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

        this.hideExportModal();
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
            
            this.hideExportModal();
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

// Initialize the side panel application when loaded
const sidePanelTestingAssistant = new SidePanelTestingAssistant();

// Make it globally accessible
window.sidePanelTestingAssistant = sidePanelTestingAssistant;