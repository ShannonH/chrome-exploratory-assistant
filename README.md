# 🚀 Chrome Exploratory Testing Assistant

A Chrome extension for QA engineers and testers to document exploratory test sessions, capture screenshots, and export results with ease.

## ✨ Features

- 📝 **Test Step Management**: Add, view, and clear test steps with descriptions. Mark steps as completed.
- 📸 **Screenshot Tracking**: Capture screenshots directly in the sidebar and attach them to test steps. Screenshots are stored in extension storage.
- 📋 **Script-Guided Testing**: Upload or paste a test script to guide your session. Steps from the script are shown as a checklist.
- 📤 **Export Results**: Export your session data and steps in JSON or HTML format. Optionally include screenshots.
- 🧩 **Sidebar Access**: Open the extension in the browser sidebar for always-visible testing interface.

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
- 📤 Upload or paste your script in Markdown or YAML format. 
- 🎯 **New Format Support**: Use YAML frontmatter to define test context (Mission, Charter, Persona, Tour, ADO)
- ✅ Create checklist items using `- [ ]` for pending steps and `- [x]` for completed steps
- 📊 Context metadata appears in a high-contrast header to keep you in character
- ✅ Check off steps as you complete them.

**Example Format:**
```markdown
---
Mission: The Block Stacker
Charter: 1 - Content Designer Siege
Persona: Overwhelmed Instructor 🧑‍🏫
Tour: Chaos Tour 🤯
ADO: 2408587
---

### Setup
- [ ] Log in as `BASH_INST_01`
- [ ] Navigate to "Ultra Course Alpha"

### Execution
- [ ] Add 10 mixed blocks (Text/Image)
- [ ] Verify blocks don't overlap
```

### 📤 Exporting Results
- 🗃️ Go to the "Export" tab in the popup.
- ⚙️ Choose format (JSON/HTML), and whether to include screenshots.
- ⬇️ Click "Export Data" to download your report.

### 🧩 Using the Sidebar
- 📋 Click "Open in Sidebar" button in the popup or click the extension icon to open in the browser sidebar.
- 📸 Use the screenshot button within each test step card to capture and attach screenshots.
- ✅ Mark steps as Pass or Fail directly from the sidebar.

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
