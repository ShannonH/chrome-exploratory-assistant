// Popup JavaScript for Exploratory Testing Assistant
class TestingAssistant {
    constructor() {
        this.currentSession = null;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.testSteps = [];
        this.screenshots = [];
        this.selectedStepIndex = null; // Track which step is selected for pass/fail actions
        this.contextMetadata = null; // Store metadata from YAML frontmatter
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

        // Help toggle
        document.getElementById('helpToggle').addEventListener('click', () => this.toggleHelp());

        // Context header close button
        document.getElementById('closeContext').addEventListener('click', () => {
            document.getElementById('contextHeader').style.display = 'none';
        });

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
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('scriptText').value = e.target.result;
        };
        reader.readAsText(file);
    }

    /**
     * Parse YAML frontmatter from markdown/YAML content
     * Extracts metadata between --- delimiters
     */
    parseYAMLFrontmatter(content) {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        const match = content.match(frontmatterRegex);
        
        if (!match) {
            return { metadata: null, content: content };
        }
        
        const yamlContent = match[1];
        const remainingContent = content.slice(match[0].length);
        
        // Simple YAML parser for key-value pairs
        const metadata = {};
        const lines = yamlContent.split('\n');
        
        lines.forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                if (key && value) {
                    metadata[key] = value;
                }
            }
        });
        
        return { metadata, content: remainingContent };
    }

    /**
     * Extract checklist items from markdown content
     * Looks for lines starting with - [ ] or - [x]
     */
    extractChecklistItems(content) {
        const lines = content.split('\n');
        const checklistItems = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Match checkbox patterns: - [ ] or - [x] or - [X]
            const checkboxMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)/);
            
            if (checkboxMatch) {
                const isChecked = checkboxMatch[1].toLowerCase() === 'x';
                const text = checkboxMatch[2].trim();
                
                checklistItems.push({
                    text: text,
                    checked: isChecked
                });
            }
        }
        
        return checklistItems;
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

    async loadScript() {
        const scriptText = document.getElementById('scriptText').value.trim();
        if (!scriptText) {
            this.showNotification('Please enter or upload a script', 'warning');
            return;
        }

        // Parse YAML frontmatter and extract metadata
        const { metadata, content } = this.parseYAMLFrontmatter(scriptText);
        
        // Store and display metadata in context header if present
        if (metadata) {
            this.contextMetadata = metadata;
            this.displayContextHeader(metadata);
        }
        
        // Extract checklist items from content
        const checklistItems = this.extractChecklistItems(content);
        
        if (checklistItems.length === 0) {
            this.showNotification('No checklist items found. Use - [ ] or - [x] format', 'warning');
            return;
        }

        // Add each checklist item as a test step
        checklistItems.forEach(item => {
            const step = {
                id: Date.now() + Math.random(), // Ensure unique IDs
                description: item.text,
                status: item.checked ? 'pass' : 'pending',
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
        
        this.showNotification(`Script loaded: ${checklistItems.length} steps added`, 'success');
    }

    clearScript() {
        document.getElementById('scriptText').value = '';
        document.getElementById('scriptProgress').style.display = 'none';
        // Clear context metadata when script is cleared
        this.contextMetadata = null;
        document.getElementById('contextHeader').style.display = 'none';
        this.saveData();
    }

    downloadTemplate() {
        // Create a template file with example YAML frontmatter and checklist items
        const template = `---
Mission: [Your Test Mission Name]
Charter: [Charter Number - Description]
Persona: [Tester Persona with emoji]
Tour: [Tour Type with emoji]
ADO: [Work Item ID]
---

### Setup
- [ ] [First setup step]
- [ ] [Second setup step]

### Test Steps
- [ ] [Action to perform and what to verify - mark pass/fail based on result]
- [ ] [Second action and expected outcome]
- [ ] [Third action and verification criteria]

### Cleanup (Optional)
- [ ] [Cleanup step if needed]

---
## Template Instructions

Replace the bracketed placeholders above with your actual test information:

**YAML Frontmatter Fields:**
- Mission: Brief name describing what you're testing
- Charter: Charter number and description
- Persona: The role/mindset you're testing as (e.g., "New User 👤", "Power User ⚡")
- Tour: Testing approach (e.g., "Happy Path ✅", "Edge Cases 🔍", "Chaos Tour 🤯")
- ADO: Azure DevOps or other work item ID

**Writing Test Steps:**
- Each checklist item becomes a card with Pass/Fail buttons
- Include BOTH the action AND what to verify in each step
- Example: "Click Submit button and verify confirmation message appears"
- Mark Pass if the step works as expected, Fail if it doesn't
- Use \`- [ ]\` for pending/unchecked items
- Use \`- [x]\` for completed/checked items

**Sections (Optional):**
You can organize your steps with markdown headers like:
- ### Setup
- ### Test Steps
- ### Cleanup

Delete these instructions before using the template!
---
`;

        // Create blob and download
        const blob = new Blob([template], { type: 'text/markdown' });
        const timestamp = new Date().toISOString().split('T')[0];
        this.downloadBlob(blob, `test-template-${timestamp}.md`);
        
        this.showNotification('Template downloaded successfully!', 'success');
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

**Severity:** [Critical/Major/Minor]
**Urgency:** [High/Medium/Low]
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
            contextMetadata: this.contextMetadata, // Save metadata for sync
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
                this.contextMetadata = data.contextMetadata || null;
                
                // Display context metadata if available
                if (this.contextMetadata) {
                    this.displayContextHeader(this.contextMetadata);
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