# Chrome Exploratory Testing Assistant

A powerful Chrome extension that helps QA engineers and testers document test cases, capture screenshots, and manage exploratory testing sessions with ease.

## Features

🔍 **Test Session Management**
- Start and track testing sessions with timer
- Real-time step counting and progress tracking
- Session status indicators

📸 **Screenshot Capture**
- One-click screenshot capture during testing
- Automatic screenshot organization and storage
- Screenshots linked to test steps

📝 **Test Documentation**
- Add detailed test step descriptions
- Mark steps as pass/fail with visual indicators
- Track expected vs actual results

📋 **Script-Guided Testing**
- Upload or paste test scripts to guide your testing
- Track progress through script steps
- Interactive checklist for systematic testing

📊 **Export & Reporting**
- Export test results in JSON or HTML format
- Include/exclude screenshots and timestamps
- Beautiful HTML reports with visual summaries
- Pass/fail statistics and session summaries

🎨 **Modern UI**
- Clean, intuitive interface with dark mode support
- Responsive design that works on any screen size
- Smooth animations and visual feedback
- Accessibility features built-in

## Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/ShannonH/chrome-exploratory-assistant.git
   cd chrome-exploratory-assistant
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. The Exploratory Testing Assistant icon should appear in your Chrome toolbar

## Usage

### Starting a Test Session

1. Click the extension icon in your Chrome toolbar
2. Click "Start Session" to begin tracking your testing
3. The timer will start and you can begin documenting your test steps

### Taking Screenshots

1. During an active session, click the "Screenshot" button
2. Screenshots are automatically captured and stored
3. Each screenshot is tagged with timestamp and page information

### Adding Test Steps

1. Click "Add Step" to document what you're testing
2. Enter a description of the test step
3. Optionally add expected results
4. Mark the step as Pass or Fail when complete

### Using Test Scripts

1. Switch to the "Test Script" tab
2. Either upload a text file or paste your test script
3. Click "Load Script" to create a checklist
4. Check off steps as you complete them during testing

### Exporting Results

1. Go to the "Export" tab
2. Choose your export format (JSON or HTML)
3. Select options for screenshots and timestamps
4. Click "Export Data" to download your test report

## File Structure

```
chrome-exploratory-assistant/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── background.js          # Background service worker
├── content.js             # Content script for web page interaction
├── content.css            # Content script styles
├── overlay.html           # Overlay component
├── overlay.css            # Overlay styling
├── icons/                 # Extension icons
│   ├── super-qa.png
└── README.md              # This file
```

## Technical Details

### Permissions Used

- `activeTab`: Capture screenshots of current tab
- `storage`: Save test data locally
- `downloads`: Export test reports
- `scripting`: Inject content scripts for enhanced functionality

### Storage

The extension uses Chrome's local storage to save:
- Test session data
- Screenshots (as base64 data URLs)
- Test steps and results
- User preferences

### Content Security Policy

The extension follows Chrome's security guidelines and uses:
- Manifest V3 for modern Chrome compatibility
- Service worker for background processing
- Content scripts for safe page interaction

## Development

### Prerequisites

- Chrome browser (version 88 or higher)
- Text editor or IDE
- Basic knowledge of HTML, CSS, and JavaScript

### Local Development

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test your changes in the popup and on web pages

### Building for Production

The extension is ready to use as-is. For distribution:

1. Zip the entire directory (excluding .git and other development files)
2. Upload to the Chrome Web Store developer dashboard
3. Follow Chrome Web Store review process

## Browser Compatibility

- ✅ Chrome 88+
- ✅ Chromium-based browsers (Edge, Brave, etc.)
- ❌ Firefox (would need manifest v2 conversion)
- ❌ Safari (would need significant modifications)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, issues, or feature requests:
- Open an issue on GitHub
- Check existing issues for known problems
- Provide detailed information about your Chrome version and operating system

## Changelog

### Version 1.0.0
- Initial release
- Basic test session management
- Screenshot capture functionality
- Test step documentation
- Script-guided testing
- Export to JSON and HTML
- Modern responsive UI

---

Made with ❤️ for the QA community
