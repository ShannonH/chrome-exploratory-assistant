# 🚀 Chrome Exploratory Testing Assistant

A Chrome extension for QA engineers and testers to document exploratory test sessions, capture screenshots, and export results with ease.

## ✨ Features

- 📝 **Test Step Management**: Add, view, and clear test steps with descriptions. Mark steps as completed.
- 📸 **Screenshot Tracking**: Capture screenshots (via popup or context menu) and track their count. Screenshots are linked to steps and stored in extension storage (last 50 kept).
- 📋 **Script-Guided Testing**: Upload or paste a test script to guide your session. Steps from the script are shown as a checklist.
- 📤 **Export Results**: Export your session data and steps in JSON or HTML format. Optionally include screenshots.
- 🧩 **Multiple UIs**: Use the popup, sidepanel, or overlay for flexible access to the assistant during testing.
- ⏹️ **No session timer or status indicator**: The extension does not track elapsed time or provide session status indicators.

## 🛠️ Installation

### 🗂️ Using as an Unpacked Extension (Chrome, Edge, Brave, etc.)

1. 📥 Download or clone this repository:
   ```bash
   git clone https://github.com/ShannonH/chrome-exploratory-assistant.git
   cd chrome-exploratory-assistant
   ```
2. 🌐 Open your browser and go to `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`)
3. 🧑‍💻 Enable "Developer mode" (toggle in top right)
4. 📂 Click "Load unpacked" and select the extension directory
5. 🧪 The Exploratory Testing Assistant icon will appear in your browser toolbar

## 🚦 Usage

### 📝 Adding Test Steps
- 🖱️ Click the extension icon or open the side panel.
- ➕ Click "Add Step" and enter a description.
- 💾 Save the step. View all steps in the list. 🧹 Clear steps if needed.

### 📸 Taking Screenshots
- 🖼️ Use the screenshot button in the popup or context menu.
- 📊 Screenshots are tracked and linked to steps.

### 📋 Script-Guided Testing
- 🗂️ Go to the "Test Script" tab in the popup.
- 📤 Upload or paste your script. Steps are shown as a checklist.
- ✅ Check off steps as you complete them.

### 📤 Exporting Results
- 🗃️ Go to the "Export" tab in the popup.
- ⚙️ Choose format (JSON/HTML), and whether to include screenshots.
- ⬇️ Click "Export Data" to download your report.

### 🧩 Using the Sidepanel and Overlay
- 📌 Pin the assistant for persistent access via the sidepanel.
- 🪟 Use the overlay for in-page interaction (content and actions are dynamic).

## ⚙️ Technical Details

- 🛡️ **Permissions**: Uses `activeTab`, `storage`, `downloads`, `scripting`, and `sidePanel`.
- 💾 **Storage**: Chrome local storage for steps and screenshots.
- 🧑‍💻 **Manifest V3**: Service worker and content scripts.

## 🌍 Browser Compatibility
- 🟢 Chrome 88+
- 🟢 Chromium-based browsers (Edge, Brave, etc.)
- 🔴 Firefox/Safari not supported

## 📄 License
MIT

---
Made with ❤️ for the QA community
