# GUPTCHARA: Windows Setup & Execution Guide

Run and test the **GUPTCHARA Privacy-Preserving Agentic Web Assistant** locally on **Windows 10 / 11**.

---

## 1. Quick Start (Recommended)

### Prerequisites
- **Node.js (v18 or v20 LTS)** installed: [https://nodejs.org/](https://nodejs.org/)
- **Google Chrome** OR **Microsoft Edge** (Edge comes pre-installed on every Windows 10/11 system).

### Step 1: Open Terminal (PowerShell or CMD)
Open Windows Terminal, PowerShell, or Command Prompt and clone the repository:

```powershell
git clone https://github.com/sudobhavik/LWB-Ex.git
cd LWB-Ex
npm install
```

### Step 2: Launch Demo with 1 Command
Run either of these commands:

```powershell
# Launch with Google Chrome (auto-detects Chrome on your system)
npm run demo:chrome

# OR launch with Microsoft Edge (works on 100% of Windows PCs)
npm run demo:edge
```

**What happens automatically:**
1. Starts the local e-commerce demo server on `http://localhost:3000`.
2. Locates your installed Google Chrome or Microsoft Edge executable.
3. Creates a temporary profile with WebGPU and hardware acceleration flags enabled.
4. Pre-loads the GUPTCHARA extension and pins it to your browser toolbar.
5. Opens `http://localhost:3000/index.html` ready for evaluation!

To stop the demo, simply press **`Ctrl+C`** in the PowerShell / CMD window.

---

## 2. Option B: Double-Click 1-Click Batch Launcher

If you prefer not to type commands into a terminal:
1. Open File Explorer and navigate into the `LWB-Ex/scripts` folder.
2. Double-click **`run_windows.bat`**.
3. It will verify Node.js, start the local server, and open Chrome/Edge automatically.

---

## 3. Option C: Manual Extension Loading (Standard Chrome Method)

If your organization's security policy or a specific browser build restricts command-line extension loading (`--load-extension`):

1. **Start the local demo server**:
   ```powershell
   npm run demo:server
   ```
   *(Keep this terminal window open; the demo store is live at `http://localhost:3000`)*.

2. **Open Google Chrome or Microsoft Edge**.
3. In the URL bar, go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. In the top-right corner, toggle **Developer mode** to **ON**.
5. In the top-left corner, click **Load unpacked**.
6. Select the **`LWB-Ex\extension`** folder from the file dialog.
7. Navigate to `http://localhost:3000` in a new tab.
8. Click the GUPTCHARA extension icon in the toolbar (or open side panel) to start visual privacy protection!

---

## 4. Configuring OpenAI API Key on Windows

To run multimodal visual reasoning with **GPT-4o**:
1. Open the GUPTCHARA side panel in the browser.
2. Click the **Settings** icon at the bottom.
3. Under **Model Provider**, select **GPT-4o (Vision)**.
4. Paste your OpenAI API Key (`sk-proj-...`).
5. Click **Save Settings**.

Alternatively, create `extension/config.json`:
```json
{
  "openaiKey": "sk-proj-YOUR_ACTUAL_KEY_HERE",
  "preferredProvider": "openai-gpt4o",
  "acceleration": "wasm"
}
```

---

## 5. Troubleshooting on Windows

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `'node' is not recognized` | Node.js not installed or PATH not refreshed | Install Node.js LTS from [nodejs.org](https://nodejs.org) and restart PowerShell. |
| Chrome doesn't open | Chrome installed in non-standard folder | Run `npm run demo:edge` (uses Edge) or set `set CHROME_BIN=C:\path\to\chrome.exe`. |
| Port 3000 already in use | Another application is using port 3000 | Run `$env:PORT=3005; npm run demo:chrome` to run on port 3005. |
| WebGPU shows as WASM fallback | Outdated GPU drivers or integrated graphics | This is normal and fully supported! The extension automatically falls back to WASM WebAssembly compute. |
