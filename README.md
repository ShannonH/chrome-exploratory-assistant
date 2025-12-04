# 🚀 Chrome Exploratory Testing Assistant

A Chrome extension for QA engineers and testers to document exploratory test sessions, capture screenshots, and export results with ease.

## ✨ Features

- 📝 **Test Step Management**: Add, view, and clear test steps with descriptions. Mark steps as completed.
- 📸 **Screenshot Tracking**: Capture screenshots (via popup or context menu) and track their count. Screenshots are linked to steps and stored in extension storage (last 50 kept).
- 📋 **Enhanced Script Import**: Upload or paste test scripts in multiple formats (TXT, CSV). Support for:
  - **Section headers** (`# Section Name`)
  - **Hierarchical naming** (`Feature/UserStory/TestCase`)
  - **Traditional numbered steps** (`1. Step description`)
  - **CSV format** with structured columns
  - **Selective import** (steps only, tests only, or both)
  - **Template downloads** for easy script creation
- 📤 **Export Results**: Export your session data and steps in JSON or HTML format. Optionally include screenshots.
- 🧩 **Multiple UIs**: Use the popup or sidepanel for flexible access to the assistant during testing.

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
- 📤 Upload or paste your script (supports .txt, .md, and .csv files).
- ⚙️ Configure import options:
  - Choose import type (steps, tests, or both)
  - Enable/disable validation
  - Preserve section information
- ⬇️ Download templates to help structure your test scripts.
- ✅ Imported steps appear in the Test Session tab.

### 📤 Exporting Results
- 🗃️ Go to the "Export" tab in the popup.
- ⚙️ Choose format (JSON/HTML), and whether to include screenshots.
- ⬇️ Click "Export Data" to download your report.

### 🧩 Using the Sidepanel
- 📌 Pin the assistant for persistent access via the sidepanel.

## 📚 Documentation

- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** - Comprehensive usage guide
- **[IMPORT_GUIDE.md](IMPORT_GUIDE.md)** - Detailed import functionality documentation
- **Sample Templates** - Included in the repository:
  - `sample-template.txt` - Text format examples
  - `sample-template.csv` - CSV format examples
  - `sample-test-script.txt` - Original example script

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
