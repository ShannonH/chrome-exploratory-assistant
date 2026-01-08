// Background script for Exploratory Testing Assistant
class BackgroundService {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Extension installation/startup
        chrome.runtime.onInstalled.addListener((details) => {
            console.log('Exploratory Testing Assistant installed');

            if (details.reason === 'install') {
                this.showWelcomeNotification();
            }
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });

        // Handle tab updates to maintain session context
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                this.handleTabUpdate(tabId, tab);
            }
        });

        // Context menu for quick actions
        this.setupContextMenus();

        // Handle keyboard shortcuts
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }

    setupContextMenus() {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'take-screenshot',
                title: 'Take Screenshot for Test',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'add-test-step',
                title: 'Add Test Step',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'mark-step-pass',
                title: 'Mark Last Step as Pass',
                contexts: ['page']
            });

            chrome.contextMenus.create({
                id: 'mark-step-fail',
                title: 'Mark Last Step as Fail',
                contexts: ['page']
            });
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'captureScreenshot':
                    const screenshot = await this.captureScreenshot(sender.tab);
                    sendResponse({ success: true, data: screenshot });
                    break;

                case 'CAPTURE_SCREENSHOT':
                    // New message handler for sidebar screenshot capture
                    try {
                        const windowId = message.windowId || null;
                        console.log('CAPTURE_SCREENSHOT request received, windowId:', windowId);
                        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
                            format: 'png',
                            quality: 90
                        });
                        console.log('Screenshot captured successfully, dataUrl length:', dataUrl?.length);
                        sendResponse({ success: true, dataUrl: dataUrl });
                    } catch (captureError) {
                        console.error('Screenshot capture failed:', captureError);
                        sendResponse({ success: false, error: captureError.message || 'Failed to capture screenshot' });
                    }
                    break;

                case 'saveTestStep':
                    await this.saveTestStep(message.data);
                    sendResponse({ success: true });
                    break;

                case 'openSidePanel':
                    await this.openSidePanel(sender.tab);
                    sendResponse({ success: true });
                    break;

                case 'getSessionData':
                    const sessionData = await this.getSessionData();
                    sendResponse({ success: true, data: sessionData });
                    break;

                case 'exportData':
                    await this.exportTestData(message.data);
                    sendResponse({ success: true });
                    break;

                case 'notifyUser':
                    this.showNotification(message.title, message.message, message.type);
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async captureScreenshot(tab) {
        try {
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
                format: 'png',
                quality: 90
            });

            const screenshot = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                dataUrl: dataUrl,
                url: tab.url,
                title: tab.title,
                tabId: tab.id
            };

            // Store screenshot in extension storage
            await this.storeScreenshot(screenshot);

            return screenshot;
        } catch (error) {
            console.error('Screenshot capture error:', error);
            throw error;
        }
    }

    async storeScreenshot(screenshot) {
        try {
            const result = await chrome.storage.local.get('screenshots');
            const screenshots = result.screenshots || [];
            screenshots.push(screenshot);

            // Keep only last 50 screenshots to manage storage
            if (screenshots.length > 50) {
                screenshots.splice(0, screenshots.length - 50);
            }

            await chrome.storage.local.set({ screenshots });
        } catch (error) {
            console.error('Screenshot storage error:', error);
            throw error;
        }
    }

    async saveTestStep(stepData) {
        try {
            const result = await chrome.storage.local.get('testSteps');
            const testSteps = result.testSteps || [];

            const step = {
                ...stepData,
                id: Date.now(),
                timestamp: new Date().toISOString()
            };

            testSteps.push(step);
            await chrome.storage.local.set({ testSteps });

            // Update badge with step count
            chrome.action.setBadgeText({
                text: testSteps.length.toString()
            });
            chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

        } catch (error) {
            console.error('Test step storage error:', error);
            throw error;
        }
    }

    async getSessionData() {
        try {
            const result = await chrome.storage.local.get(['testSteps', 'screenshots', 'currentSession']);
            return {
                testSteps: result.testSteps || [],
                screenshots: result.screenshots || [],
                currentSession: result.currentSession || null
            };
        } catch (error) {
            console.error('Session data retrieval error:', error);
            throw error;
        }
    }

    async exportTestData(exportOptions) {
        try {
            const sessionData = await this.getSessionData();

            const exportData = {
                ...sessionData,
                exportedAt: new Date().toISOString(),
                options: exportOptions
            };

            // Create export file based on format
            if (exportOptions.format === 'json') {
                await this.downloadJSON(exportData, exportOptions.filename);
            } else if (exportOptions.format === 'html') {
                await this.downloadHTML(exportData, exportOptions.filename);
            }

        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }

    async downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: url,
            filename: filename || `test-session-${Date.now()}.json`,
            saveAs: true
        });
    }

    async downloadHTML(data, filename) {
        const html = this.generateHTMLReport(data);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: url,
            filename: filename || `test-report-${Date.now()}.html`,
            saveAs: true
        });
    }

    generateHTMLReport(data) {
        const passedSteps = data.testSteps.filter(step => step.status === 'pass').length;
        const failedSteps = data.testSteps.filter(step => step.status === 'fail').length;
        const totalSteps = data.testSteps.length;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exploratory Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6; color: #333; background: #f8fafc;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #6366f1, #0ea5e9);
            color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;
            box-shadow: 0 10px 25px rgba(99, 102, 241, 0.2);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { font-size: 1.1em; opacity: 0.9; }
        .stats { 
            display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px; margin-bottom: 30px;
        }
        .stat-card { 
            background: white; padding: 20px; border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;
        }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .stat-number.pass { color: #10b981; }
        .stat-number.fail { color: #ef4444; }
        .stat-number.total { color: #6366f1; }
        .stat-number.screenshots { color: #0ea5e9; }
        .section { 
            background: white; margin-bottom: 30px; border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;
        }
        .section-header { 
            background: #f1f5f9; padding: 20px; border-bottom: 1px solid #e2e8f0;
            font-size: 1.3em; font-weight: 600;
        }
        .section-content { padding: 20px; }
        .step { 
            border-left: 4px solid #6366f1; padding: 15px; margin: 15px 0;
            background: #f8fafc; border-radius: 0 8px 8px 0;
        }
        .step.pass { border-left-color: #10b981; background: #f0fdf4; }
        .step.fail { border-left-color: #ef4444; background: #fef2f2; }
        .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .step-number { font-weight: bold; color: #6366f1; }
        .step-status { 
            padding: 4px 12px; border-radius: 20px; font-size: 0.85em;
            font-weight: 500; text-transform: uppercase;
        }
        .step-status.pass { background: #10b981; color: white; }
        .step-status.fail { background: #ef4444; color: white; }
        .step-status.in-progress { background: #f59e0b; color: white; }
        .step-description { font-size: 1.1em; margin-bottom: 8px; }
        .step-timestamp { color: #64748b; font-size: 0.9em; }
        .screenshot { 
            max-width: 100%; height: auto; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin: 15px 0;
        }
        .screenshot-container { margin: 20px 0; }
        .screenshot-info { 
            background: #f1f5f9; padding: 15px; border-radius: 8px;
            margin-bottom: 10px;
        }
        .screenshot-info strong { color: #374151; }
        .no-data { 
            text-align: center; padding: 40px; color: #64748b;
            font-style: italic;
        }
        .footer { 
            text-align: center; padding: 30px; color: #64748b;
            border-top: 1px solid #e2e8f0; margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Exploratory Test Report</h1>
            <p>Generated on ${new Date(data.exportedAt).toLocaleString()}</p>
            ${data.currentSession ? `
                <p>Session: ${new Date(data.currentSession.startTime).toLocaleString()} - 
                ${data.currentSession.endTime ? new Date(data.currentSession.endTime).toLocaleString() : 'Ongoing'}</p>
            ` : ''}
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number total">${totalSteps}</div>
                <div>Total Steps</div>
            </div>
            <div class="stat-card">
                <div class="stat-number pass">${passedSteps}</div>
                <div>Passed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number fail">${failedSteps}</div>
                <div>Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number screenshots">${data.screenshots.length}</div>
                <div>Screenshots</div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">📝 Test Steps</div>
            <div class="section-content">
                ${data.testSteps.length > 0 ? data.testSteps.map((step, index) => `
                    <div class="step ${step.status}">
                        <div class="step-header">
                            <span class="step-number">Step ${index + 1}</span>
                            <span class="step-status ${step.status}">${step.status}</span>
                        </div>
                        <div class="step-description">${step.description}</div>
                        <div class="step-timestamp">📅 ${new Date(step.timestamp).toLocaleString()}</div>
                    </div>
                `).join('') : '<div class="no-data">No test steps recorded</div>'}
            </div>
        </div>

        ${data.screenshots.length > 0 ? `
        <div class="section">
            <div class="section-header">📸 Screenshots</div>
            <div class="section-content">
                ${data.screenshots.map((screenshot, index) => `
                    <div class="screenshot-container">
                        <div class="screenshot-info">
                            <strong>Screenshot ${index + 1}</strong><br>
                            <strong>URL:</strong> ${screenshot.url}<br>
                            <strong>Page Title:</strong> ${screenshot.title}<br>
                            <strong>Captured:</strong> ${new Date(screenshot.timestamp).toLocaleString()}
                        </div>
                        <img src="${screenshot.dataUrl}" class="screenshot" alt="Screenshot ${index + 1}">
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="footer">
            <p>Report generated by Exploratory Testing Assistant</p>
            <p>📊 Summary: ${passedSteps} passed, ${failedSteps} failed out of ${totalSteps} total steps</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    handleTabUpdate(tabId, tab) {
        // Optionally track navigation for test context
        if (tab.url && tab.url.startsWith('http')) {
            this.updateTestContext(tabId, tab);
        }
    }

    async updateTestContext(tabId, tab) {
        try {
            const result = await chrome.storage.local.get('currentSession');
            if (result.currentSession && result.currentSession.status === 'active') {
                // Could add navigation tracking here if needed
                console.log('Page navigation during active session:', tab.url);
            }
        } catch (error) {
            console.error('Context update error:', error);
        }
    }

    async handleContextMenuClick(info, tab) {
        try {
            switch (info.menuItemId) {
                case 'take-screenshot':
                    await this.captureScreenshot(tab);
                    this.showNotification('Screenshot Captured', 'Screenshot saved successfully');
                    break;

                case 'add-test-step':
                    // Open sidebar to add step
                    await this.openSidePanel(tab);
                    break;

                case 'mark-step-pass':
                case 'mark-step-fail':
                    const status = info.menuItemId.includes('pass') ? 'pass' : 'fail';
                    await this.markLastStep(status);
                    this.showNotification('Step Updated', `Last step marked as ${status}`);
                    break;
            }
        } catch (error) {
            console.error('Context menu action error:', error);
            this.showNotification('Error', 'Failed to perform action');
        }
    }

    async markLastStep(status) {
        try {
            const result = await chrome.storage.local.get('testSteps');
            const testSteps = result.testSteps || [];

            if (testSteps.length > 0) {
                testSteps[testSteps.length - 1].status = status;
                await chrome.storage.local.set({ testSteps });
            }
        } catch (error) {
            console.error('Step marking error:', error);
            throw error;
        }
    }

    showNotification(title, message, type = 'basic') {
        // Note: notifications permission not included in manifest
        // Using console log as fallback
        console.log(`${title}: ${message}`);
    }

    showWelcomeNotification() {
        this.showNotification(
            'Exploratory Testing Assistant',
            'Extension installed! Click the icon to start your first test session.'
        );
    }

    async openSidePanel(tab) {
        try {
            // Multiple approaches for Chrome 141 compatibility
            if (chrome.sidePanel) {
                if (chrome.sidePanel.open) {
                    // Method 1: Modern API (Chrome 114+)
                    await chrome.sidePanel.open({
                        tabId: tab ? tab.id : undefined,
                        windowId: tab ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT
                    });
                } else if (chrome.sidePanel.setOptions) {
                    // Method 2: Set options and let user open manually
                    await chrome.sidePanel.setOptions({
                        tabId: tab ? tab.id : undefined,
                        path: 'sidepanel.html',
                        enabled: true
                    });
                    console.log('Side panel enabled - user can open it manually');
                } else {
                    console.error('Side panel API methods not available');
                }
            } else {
                console.error('Side panel API not available in this Chrome version');
            }
        } catch (error) {
            console.error('Failed to open side panel:', error);
        }
    }

    async handleCommand(command) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            switch (command) {
                case 'open-testing-assistant':
                    // Try to open side panel, fallback to detached window
                    try {
                        if (chrome.sidePanel && chrome.sidePanel.open) {
                            await chrome.sidePanel.open({ windowId: tab.windowId });
                        } else {
                            // Open detached window
                            await chrome.windows.create({
                                url: chrome.runtime.getURL('sidepanel.html'),
                                type: 'popup',
                                width: 350,
                                height: 600,
                                left: screen.width - 370,
                                top: 100,
                                focused: true
                            });
                        }
                    } catch (error) {
                        console.error('Failed to open testing assistant:', error);
                    }
                    break;

                case 'take-screenshot':
                    await this.captureScreenshot(tab);
                    break;

                case 'mark-pass':
                case 'mark-fail':
                    // Send message to content script or popup
                    const status = command === 'mark-pass' ? 'pass' : 'fail';
                    chrome.runtime.sendMessage({
                        action: 'markStep',
                        status: status
                    });
                    break;
            }
        } catch (error) {
            console.error('Command handling error:', error);
        }
    }

    openPopup() {
        // This will open the popup programmatically if needed
        console.log('Opening popup...');
    }
}

// Initialize the background service
const backgroundService = new BackgroundService();