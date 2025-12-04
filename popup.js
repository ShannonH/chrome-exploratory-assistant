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
        
        // Initialize import parser
        this.importParser = new ImportParser();
        
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

        // Action buttons
        document.getElementById('addStep').addEventListener('click', () => this.showStepInput());
        document.getElementById('openMainExtension').addEventListener('click', () => this.openMainExtension());

        // Step input
        document.getElementById('saveStep').addEventListener('click', () => this.saveStep());
        document.getElementById('cancelStep').addEventListener('click', () => this.hideStepInput());

        // UI enhancements
        document.getElementById('expandTextarea').addEventListener('click', () => this.toggleTextareaExpansion());
        document.getElementById('toggleCompletedSteps').addEventListener('click', () => this.toggleCompletedSteps());
        document.getElementById('clearSteps').addEventListener('click', () => this.clearSteps());

        // Script tab
        document.getElementById('uploadArea').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        document.getElementById('loadScript').addEventListener('click', () => this.loadScript());
        document.getElementById('clearScript').addEventListener('click', () => this.clearScript());
        document.getElementById('downloadTemplate').addEventListener('click', () => this.downloadTemplate());

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

    toggleTextareaExpansion() {
        const textarea = document.getElementById('scriptText');
        const button = document.getElementById('expandTextarea');
        
        if (textarea.classList.contains('expanded')) {
            textarea.classList.remove('expanded');
            button.innerHTML = '<span class="btn-icon">🔍</span> Expand';
        } else {
            textarea.classList.add('expanded');
            button.innerHTML = '<span class="btn-icon">🔼</span> Collapse';
        }
    }

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

    updateStatus(text, type = 'ready') {
        // Status indicator removed from UI - this function is now a no-op
        // but kept for backward compatibility with existing code
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

    async takeScreenshotForStep(stepIndex) {
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

    showStepInput() {
        document.getElementById('stepInput').style.display = 'block';
        document.getElementById('stepDescription').focus();
    }

    hideStepInput() {
        document.getElementById('stepInput').style.display = 'none';
        document.getElementById('stepDescription').value = '';
    }

    async saveStep() {
        const description = document.getElementById('stepDescription').value.trim();
        if (!description) return;

        const pageContext = await this.capturePageContext();
        
        const step = {
            id: Date.now(),
            description: description,
            status: 'in-progress',
            screenshots: [],
            pageContext: pageContext
        };

        this.testSteps.push(step);
        this.updateStepsList();
        this.updateSessionInfo();
        this.hideStepInput();
        this.saveData();
    }

    async capturePageContext() {
        try {
            // Try to get current tab information
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
                return {
                    url: tabs[0].url,
                    title: tabs[0].title,
                    timestamp: new Date().toISOString()
                };
            }
            return null;
        } catch (error) {
            return null;
        }
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
            
            const screenshotIndicator = (step.screenshots && step.screenshots.length > 0) ? ` 📸${step.screenshots.length}` : '';
            
            stepElement.innerHTML = `
                <div class="step-header">
                    <span class="step-number">${scriptIndicator}Step ${stepNumber}${screenshotIndicator}</span>
                    <span class="step-status ${step.status}">${step.status}</span>
                </div>
                <div class="step-description">${step.description}</div>
                ${step.markedTimestamp ? `<div class="step-timestamp">${this.formatTimestamp(step.markedTimestamp)}</div>` : ''}
                <div class="step-actions">
                    <button class="btn-mini btn-success step-pass-btn" data-index="${index}" title="Mark this step as Pass">✅ Pass</button>
                    <button class="btn-mini btn-danger step-fail-btn" data-index="${index}" title="Mark this step as Fail">❌ Fail</button>
                    <button class="btn-mini btn-screenshot step-screenshot-btn" data-index="${index}" title="Take Screenshot for this step">📸 Screenshot</button>
                </div>
            `;
            
            // Add event listeners for step buttons using event delegation
            const passBtn = stepElement.querySelector('.step-pass-btn');
            const failBtn = stepElement.querySelector('.step-fail-btn');
            const screenshotBtn = stepElement.querySelector('.step-screenshot-btn');
            
            passBtn.addEventListener('click', () => this.markStep(index, 'pass'));
            failBtn.addEventListener('click', () => this.markStep(index, 'fail'));
            screenshotBtn.addEventListener('click', () => this.takeScreenshotForStep(index));
            
            // Remove click handler and selected state since we're using individual buttons now
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
        // Check file extension
        const fileName = file.name.toLowerCase();
        const isSupported = fileName.endsWith('.txt') || 
                           fileName.endsWith('.md') || 
                           fileName.endsWith('.csv');
        
        if (!isSupported) {
            this.showNotification('Unsupported file format. Please use .txt, .md, or .csv files.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('scriptText').value = e.target.result;
            
            // Show notification about successful file read
            const fileType = fileName.endsWith('.csv') ? 'CSV' : 'text';
            this.showNotification(`${fileType} file loaded successfully. Click "Load Script" to import.`, 'success');
        };
        reader.onerror = (e) => {
            console.error('File read error:', e);
            this.showNotification('Failed to read file. Please try again.', 'error');
        };
        reader.readAsText(file);
    }

    async loadScript() {
        const scriptText = document.getElementById('scriptText').value.trim();
        if (!scriptText) {
            this.showNotification('Please enter or upload a script', 'warning');
            return;
        }

        try {
            // Get import options
            const importTypeEl = document.querySelector('input[name="importType"]:checked');
            const importType = importTypeEl ? importTypeEl.value : 'steps';
            
            const validateStepsEl = document.getElementById('validateSteps');
            const validateSteps = validateStepsEl ? validateStepsEl.checked : true;
            
            const preserveSectionsEl = document.getElementById('preserveSections');
            const preserveSections = preserveSectionsEl ? preserveSectionsEl.checked : true;

            // Detect format - check for CSV structure (comma-separated with headers)
            let format = 'txt';
            const lines = scriptText.split('\n');
            if (lines.length > 0) {
                const firstLine = lines[0].toLowerCase();
                // Check if first line looks like a CSV header
                if (firstLine.includes(',') && 
                    (firstLine.includes('feature') || 
                     firstLine.includes('test case') || 
                     firstLine.includes('step description'))) {
                    format = 'csv';
                }
            }

            // Parse the script
            const parsed = this.importParser.parse(scriptText, format, {
                importType,
                validateSteps,
                preserveSections
            });

            // Show validation errors/warnings if any
            if (parsed.validation && !parsed.validation.valid) {
                const errorMsg = parsed.validation.errors.map(e => 
                    `Line ${e.line}: ${e.message}`
                ).join('\n');
                
                if (!confirm(`Found ${parsed.validation.errors.length} validation error(s):\n\n${errorMsg}\n\nContinue anyway?`)) {
                    return;
                }
            }

            if (parsed.validation && parsed.validation.warnings.length > 0) {
                const warningMsg = parsed.validation.warnings.slice(0, 5).map(w => 
                    `Line ${w.line}: ${w.message}`
                ).join('\n');
                console.warn('Import warnings:', parsed.validation.warnings);
                this.showNotification(`Import completed with ${parsed.validation.warnings.length} warning(s). Check console for details.`, 'warning');
            }

            // Convert parsed data to test steps
            const newSteps = this.importParser.convertToTestSteps(parsed, {
                importType,
                status: 'pending',
                markAsFromScript: true
            });

            // Add steps to existing test steps (use spread for better performance)
            this.testSteps.push(...newSteps);

            // Update the main view to show the steps
            this.updateStepsList();
            this.updateSessionInfo();
            this.saveData();
            
            // Switch to the main test session tab to show the loaded steps
            this.switchTab('test');
            
            // Show success message with details
            let message = `Script loaded: ${newSteps.length} items added`;
            if (parsed.metadata.hasSections) {
                message += ` (${parsed.sections.length} sections)`;
            }
            if (parsed.metadata.hasHierarchy) {
                message += ` (${parsed.tests.length} test cases)`;
            }
            
            this.showNotification(message, 'success');
            
        } catch (error) {
            console.error('Failed to load script:', error);
            this.showNotification(`Failed to load script: ${error.message}`, 'error');
        }
    }

    clearScript() {
        document.getElementById('scriptText').value = '';
        document.getElementById('scriptProgress').style.display = 'none';
        this.saveData();
    }

    async downloadTemplate() {
        // Show template format options
        const format = await this.showTemplateFormatDialog();
        if (!format) return;

        try {
            const content = this.importParser.generateTemplate(format);
            const blob = new Blob([content], { 
                type: format === 'csv' ? 'text/csv' : 'text/plain' 
            });
            const filename = `test-template-${Date.now()}.${format}`;
            
            this.downloadBlob(blob, filename);
            this.showNotification(`Template downloaded: ${filename}`, 'success');
        } catch (error) {
            console.error('Failed to download template:', error);
            this.showNotification('Failed to download template', 'error');
        }
    }

    showTemplateFormatDialog() {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'modal-overlay';
            dialog.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Choose Template Format</h3>
                    </div>
                    <div class="modal-body">
                        <p>Select the template format you'd like to download:</p>
                        <div style="margin: 20px 0;">
                            <label class="radio-label" style="display: block; margin: 10px 0;">
                                <input type="radio" name="templateFormat" value="txt" checked>
                                <span>Text Format (.txt) - Supports sections, numbered steps, and hierarchical naming</span>
                            </label>
                            <label class="radio-label" style="display: block; margin: 10px 0;">
                                <input type="radio" name="templateFormat" value="csv">
                                <span>CSV Format (.csv) - Structured with columns for Feature, Story, Test, Step</span>
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" id="confirmTemplate">Download</button>
                        <button class="btn btn-secondary" id="cancelTemplate">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            document.getElementById('confirmTemplate').addEventListener('click', () => {
                const selected = document.querySelector('input[name="templateFormat"]:checked');
                const format = selected ? selected.value : 'txt';
                dialog.remove();
                resolve(format);
            });
            
            document.getElementById('cancelTemplate').addEventListener('click', () => {
                dialog.remove();
                resolve(null);
            });
            
            // Close on background click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.remove();
                    resolve(null);
                }
            });
        });
    }

    exportData() {
        const format = document.querySelector('input[name="format"]:checked').value;
        const includeScreenshots = document.getElementById('includeScreenshots').checked;
        const includeTimestamps = document.getElementById('includeTimestamps').checked;

        // Create session info based on marked step timestamps only
        let sessionInfo = null;
        if (this.testSteps.length > 0) {
            // Find all marked timestamps (when steps were marked as pass/fail)
            const markedTimes = this.testSteps
                .filter(step => step.markedTimestamp)
                .map(step => new Date(step.markedTimestamp))
                .filter(date => !isNaN(date));
            
            if (markedTimes.length > 0) {
                const startTime = new Date(Math.min(...markedTimes));
                const endTime = new Date(Math.max(...markedTimes));
                
                sessionInfo = {
                    id: `session-${this.testSteps[0]?.id || Date.now()}`,
                    startTime: startTime,
                    endTime: endTime,
                    status: 'completed'
                };
            }
        }

        const exportData = {
            session: sessionInfo,
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
        .step { border-left: 4px solid #6366f1; padding: 10px; margin: 10px 0; background: #f8fafc; position: relative; }
        .step.pass { border-left-color: #10b981; }
        .step.fail { border-left-color: #ef4444; }
        .screenshot { max-width: 100%; height: auto; border: 1px solid #ddd; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
        .bug-template-btn { 
            background: #ef4444; 
            color: white; 
            border: none; 
            padding: 8px 12px; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 0.85em; 
            margin-top: 8px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .bug-template-btn:hover { background: #dc2626; }
        .modal { 
            display: none; 
            position: fixed; 
            z-index: 1000; 
            left: 0; 
            top: 0; 
            width: 100%; 
            height: 100%; 
            background-color: rgba(0,0,0,0.5); 
        }
        .modal-content { 
            background-color: #fefefe; 
            margin: 5% auto; 
            padding: 20px; 
            border: none; 
            border-radius: 8px; 
            width: 80%; 
            max-width: 600px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .modal-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 20px; 
            padding-bottom: 10px; 
            border-bottom: 1px solid #e5e7eb; 
        }
        .modal-title { margin: 0; color: #ef4444; }
        .close { 
            color: #aaa; 
            float: right; 
            font-size: 28px; 
            font-weight: bold; 
            cursor: pointer; 
        }
        .close:hover { color: #000; }
        .bug-template-textarea { 
            width: 100%; 
            height: 300px; 
            border: 1px solid #d1d5db; 
            border-radius: 4px; 
            padding: 12px; 
            font-family: monospace; 
            font-size: 14px; 
            resize: vertical; 
            box-sizing: border-box;
        }
        .modal-actions { 
            margin-top: 15px; 
            display: flex; 
            gap: 10px; 
            justify-content: flex-end; 
        }
        .btn { 
            padding: 8px 16px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 14px; 
        }
        .btn-primary { background: #6366f1; color: white; }
        .btn-primary:hover { background: #5856eb; }
        .btn-secondary { background: #6b7280; color: white; }
        .btn-secondary:hover { background: #4b5563; }
        .copy-success { 
            color: #10b981; 
            font-size: 12px; 
            margin-left: 8px; 
            opacity: 0; 
            transition: opacity 0.3s; 
        }
        .copy-success.show { opacity: 1; }
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
                ${step.markedTimestamp ? `<div class="timestamp">Marked: ${this.formatTimestamp(step.markedTimestamp)}</div>` : ''}
                ${step.timestamp ? `<div class="timestamp">Created: ${this.formatTimestamp(step.timestamp)}</div>` : ''}
                ${step.screenshots && step.screenshots.length > 0 ? `
                    <div class="step-screenshots">
                        <h5>Screenshots (${step.screenshots.length}):</h5>
                        ${step.screenshots.map((screenshot, screenshotIndex) => `
                            <div style="margin: 10px 0;">
                                <img src="${screenshot.dataUrl}" class="screenshot" alt="Step ${index + 1} Screenshot ${screenshotIndex + 1}" style="max-width: 300px; height: auto; border: 1px solid #ddd;">
                                <div class="timestamp">Taken: ${this.formatTimestamp(screenshot.timestamp)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${step.status === 'fail' ? `
                    <button class="bug-template-btn" 
                            data-step-index="${index}" 
                            data-step-description="${step.description.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" 
                            data-step-timestamp="${step.timestamp ? this.formatTimestamp(step.timestamp).replace(/"/g, '&quot;') : ''}" 
                            data-marked-timestamp="${step.markedTimestamp ? this.formatTimestamp(step.markedTimestamp).replace(/"/g, '&quot;') : ''}"
                            data-screenshot-count="${step.screenshots ? step.screenshots.length : 0}"
                            onclick="openBugTemplateFromButton(this)">
                        🐛 Create Bug Template
                    </button>
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

    <!-- Bug Template Modal -->
    <div id="bugTemplateModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Bug Report Template</h3>
                <span class="close" onclick="closeBugTemplate()">&times;</span>
            </div>
            <textarea id="bugTemplateText" class="bug-template-textarea" placeholder="Loading bug template..."></textarea>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="copyBugTemplate()">📋 Copy to Clipboard</button>
                <button class="btn btn-secondary" onclick="closeBugTemplate()">Close</button>
                <span id="copySuccess" class="copy-success">✅ Copied to clipboard!</span>
            </div>
        </div>
    </div>

    <script>
        function openBugTemplateFromButton(button) {
            const stepIndex = parseInt(button.dataset.stepIndex);
            const stepDescription = button.dataset.stepDescription;
            const timestamp = button.dataset.stepTimestamp;
            const markedTimestamp = button.dataset.markedTimestamp;
            const screenshotCount = parseInt(button.dataset.screenshotCount) || 0;
            
            openBugTemplate(stepIndex, stepDescription, timestamp, markedTimestamp, screenshotCount);
        }
        
        function openBugTemplate(stepIndex, stepDescription, timestamp, markedTimestamp, screenshotCount = 0) {
            const modal = document.getElementById('bugTemplateModal');
            const textarea = document.getElementById('bugTemplateText');
            
            // Try to get captured interactions from sessionStorage
            let interactionSteps = '';
            try {
                const interactions = JSON.parse(sessionStorage.getItem('testingAssistantInteractions') || '[]');
                if (interactions.length > 0) {
                    // Get recent interactions (last 10)
                    const recentInteractions = interactions.slice(-10);
                    interactionSteps = recentInteractions.map((interaction, index) => {
                        const actionText = {
                            'click': 'Clicked',
                            'submit': 'Submitted',
                            'change': 'Changed',
                            'input': 'Entered data in'
                        }[interaction.type] || 'Interacted with';
                        
                        return \`\${index + 1}. \${actionText} \${interaction.element}\`;
                    }).join('\\n');
                    
                    if (interactionSteps) {
                        interactionSteps = '\\n\\n**Captured User Interactions:**\\n' + interactionSteps;
                    }
                }
            } catch (error) {
                console.log('Could not retrieve interaction data:', error);
            }
            
            // Get browser name more reliably
            function getBrowserName() {
                const userAgent = navigator.userAgent;
                if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
                if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
                if (userAgent.indexOf('Safari') > -1) return 'Safari';
                if (userAgent.indexOf('Edge') > -1) return 'Edge';
                if (userAgent.indexOf('Opera') > -1) return 'Opera';
                return 'Unknown Browser';
            }
            
            // Generate bug template
            const template = \`**Bug Report**

**Test Step:** Step \${stepIndex + 1}
**Description:** \${stepDescription}
**Step Created:** \${timestamp || 'N/A'}
**Failed At:** \${markedTimestamp || 'N/A'}
**Status:** FAILED

**Summary:** 
[Brief description of the issue]

**Steps to Reproduce:**
1. \${stepDescription}
2. [Add any additional steps]\${interactionSteps}

**Expected Result:**
[What should have happened]

**Actual Result:**
[What actually happened]

**Environment:**
- Browser: \${getBrowserName()}
- URL: \${window.location.origin}
- Test Date/Time: \${new Date().toLocaleString()}

**Screenshots:**
\${screenshotCount > 0 ? \`\${screenshotCount} screenshot(s) associated with this step\` : 'No screenshots associated with this step'}

**Additional Information:**
[Any other relevant details, screenshots, or context]

**Test Data Used:**
[Username/Password combinations, test data, etc.]

**Priority:** [High/Medium/Low]
**Severity:** [Critical/Major/Minor]
\`;
            
            textarea.value = template;
            modal.style.display = 'block';
            
            // Focus on the summary section
            textarea.focus();
            const summaryIndex = template.indexOf('[Brief description of the issue]');
            if (summaryIndex !== -1) {
                textarea.setSelectionRange(summaryIndex, summaryIndex + '[Brief description of the issue]'.length);
            }
        }
        
        function closeBugTemplate() {
            document.getElementById('bugTemplateModal').style.display = 'none';
        }
        
        async function copyBugTemplate() {
            const textarea = document.getElementById('bugTemplateText');
            const copySuccess = document.getElementById('copySuccess');
            
            // Try modern Clipboard API first, then fallback to deprecated method
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(textarea.value);
                    copySuccess.classList.add('show');
                    setTimeout(() => {
                        copySuccess.classList.remove('show');
                    }, 2000);
                } else {
                    // Fallback for older browsers
                    textarea.select();
                    textarea.setSelectionRange(0, 99999); // For mobile devices
                    
                    const successful = document.execCommand('copy');
                    if (successful) {
                        copySuccess.classList.add('show');
                        setTimeout(() => {
                            copySuccess.classList.remove('show');
                        }, 2000);
                    } else {
                        throw new Error('Copy command failed');
                    }
                }
            } catch (err) {
                console.error('Failed to copy text: ', err);
                // Ultimate fallback: select text and show instructions
                textarea.select();
                textarea.setSelectionRange(0, 99999);
                alert('Text selected! Press Ctrl+C (or Cmd+C on Mac) to copy.');
            }
        }
        
        // Close modal when clicking outside of it
        window.onclick = function(event) {
            const modal = document.getElementById('bugTemplateModal');
            if (event.target === modal) {
                closeBugTemplate();
            }
        }
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeBugTemplate();
            }
        });
    </script>
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
                    // Mark that a download has occurred for this session
                    this.markDownloadCompleted();
                }
            });
        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed', 'error');
        }
    }

    markDownloadCompleted() {
        // Track that a download has been completed for the current session
        const downloadTime = new Date().toISOString();
        chrome.storage.local.set({ 
            lastDownloadTime: downloadTime,
            hasDownloadedCurrentSession: true 
        });
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
        this.updateExportSummary();
        this.saveData();
        
        this.showNotification('All steps and screenshots cleared', 'success');
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
        

        
        // Mock Chrome storage for testing environment
        if (!chrome || !chrome.storage) {
            console.log('Mock saving data:', data);
            return;
        }
        
        chrome.storage.local.set({ testingAssistantData: data });
    }

    async loadSavedData() {
        try {
            // Mock Chrome storage for testing environment
            if (!chrome || !chrome.storage) {
                console.warn('Chrome storage not available, using mock data');
                this.testSteps = [];
                this.screenshots = [];
                this.currentSession = null;
                this.updateStepsList();
                this.updateExportSummary();
                this.updateSessionInfo();
                return;
            }
            
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