# Chrome Exploratory Testing Assistant - Installation & Usage Guide

## Quick Start

### 1. Installation
1. Download or clone the extension files to your computer
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. The extension icon 🔍 should appear in your toolbar

### 2. Basic Usage
1. Click the extension icon to open the popup
2. Click "Start Session" to begin tracking your testing
3. Use the "Screenshot" button to capture images
4. Use "Add Step" to document what you're testing
5. Mark steps as "Pass" or "Fail"
6. Use the "Export" tab to download your test results

## Detailed Features

### Test Session Management
- **Start Session**: Begins timing and tracking your test session
- **Session Timer**: Shows how long you've been testing
- **Step Counter**: Tracks the number of test steps documented
- **Screenshot Counter**: Shows how many screenshots you've captured

### Screenshot Capture
- **One-Click Screenshots**: Capture the current browser tab
- **Automatic Storage**: Screenshots are saved with timestamp and page info
- **Export Integration**: Screenshots can be included in exported reports

### Test Documentation
- **Step Descriptions**: Document what you're testing in detail
- **Pass/Fail Marking**: Mark each step with its outcome
- **Timestamps**: All steps are automatically timestamped
- **Visual History**: See your recent steps in the popup

### Script-Guided Testing
- **Upload Scripts**: Drag and drop text files with test scripts
- **Paste Scripts**: Copy and paste test procedures directly
- **Progress Tracking**: Check off steps as you complete them
- **Persistent Progress**: Your progress is saved between sessions

### Export and Reporting
- **Multiple Formats**: Export as JSON or HTML reports
- **Customizable Options**: Include/exclude screenshots and timestamps
- **Beautiful Reports**: HTML reports with visual summaries and statistics
- **Download Management**: Files are saved to your Downloads folder

## Tips for Effective Testing

### Before You Start
1. Plan your testing scope and objectives
2. Prepare test data if needed
3. Clear your browser cache if testing performance
4. Ensure you have the necessary test accounts/credentials

### During Testing
1. Start a new session for each major test run
2. Take screenshots of important UI states
3. Document both positive and negative test cases
4. Be specific in your step descriptions
5. Mark steps as pass/fail immediately after testing

### Test Script Best Practices
- Write clear, actionable steps
- Number your steps for easy reference
- Include expected results where helpful
- Group related tests together
- Use comments (starting with #) for section headers

### Example Test Script Format:
```
# Login Testing
1. Navigate to login page
2. Enter valid username and password
3. Click login button
4. Verify successful login and redirect

# Error Handling
5. Navigate back to login page
6. Enter invalid credentials
7. Click login button
8. Verify error message is displayed
```

## Keyboard Shortcuts

While the extension doesn't have built-in keyboard shortcuts, you can use Chrome's built-in shortcuts:
- `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac): Open Developer Tools
- `F12`: Open Developer Tools
- `Ctrl+Shift+J` (or `Cmd+Option+J` on Mac): Open Console
- `F5` or `Ctrl+R`: Refresh page

## Troubleshooting

### Extension Not Working
1. Check that Developer Mode is enabled in `chrome://extensions/`
2. Ensure the extension is enabled (toggle switch is on)
3. Try reloading the extension (click the reload icon)
4. Check the browser console for error messages

### Screenshots Not Capturing
1. Ensure you have an active test session
2. Check that the tab has finished loading
3. Try refreshing the page and taking another screenshot
4. Verify you have sufficient storage space

### Export Not Working
1. Check your browser's download settings
2. Ensure popup blockers aren't interfering
3. Try a different export format (JSON vs HTML)
4. Clear your browser cache and try again

### Data Not Saving
1. Check Chrome's storage permissions
2. Ensure you have sufficient local storage space
3. Try closing and reopening the extension popup
4. Check for browser updates

## Privacy and Security

### Data Storage
- All data is stored locally in your browser
- No data is sent to external servers
- Screenshots are stored as base64 data in local storage
- You can clear all data using the "Clear All Data" button

### Permissions Used
- **activeTab**: Required to capture screenshots of the current tab
- **storage**: Required to save your test data locally
- **downloads**: Required to export your test reports
- **scripting**: Required for enhanced page interaction features

### Security Best Practices
- Don't include sensitive information in test descriptions
- Be careful when testing with real user credentials
- Clear extension data after testing sensitive applications
- Use test environments when possible

## Advanced Usage

### Custom Test Templates
Create reusable test script templates for common testing scenarios:
- Login/Authentication testing
- Form validation testing
- E-commerce checkout flows
- Mobile responsiveness testing
- Performance testing

### Integration with Testing Tools
The extension can complement other testing tools:
- Use with browser developer tools for technical analysis
- Combine with accessibility testing tools
- Use alongside performance monitoring tools
- Document bugs found with other testing software

### Team Collaboration
- Export reports to share with team members
- Use consistent test script formats across your team
- Include detailed screenshots for bug reports
- Maintain a library of standard test scripts

## Support and Updates

### Getting Help
1. Check this documentation first
2. Look for similar issues in the GitHub repository
3. Create a detailed issue report if needed
4. Include browser version and operating system information

### Providing Feedback
- Report bugs through the GitHub issues page
- Suggest new features or improvements
- Share your testing workflows and best practices
- Contribute to the documentation

### Version Updates
The extension will notify you of updates through Chrome's extension management system. Always review update notes before upgrading to understand new features and changes.

---

Happy Testing! 🔍✨