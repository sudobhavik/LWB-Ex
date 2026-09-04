# PS171: On-Device Visual Perception for Privacy-Preserving Browser Agents
**ISRO Problem Statement SIH26171**

A client-side privacy-preserving autonomous browser agent running on-device computer vision models via WebGPU / WASM SIMD to sanitize visual context (redacting biometric faces, passwords, credit cards, credentials, and sensitive balances) prior to transmitting anonymized frames to cloud VLMs (OpenAI GPT-4o mini / Google Gemini).

---

## 1. System Architecture

```
+-----------------------------------------------------------------------------------+
|                            CLIENT BROWSER (Manifest V3)                           |
|                                                                                   |
|  +---------------------+        +--------------------+        +----------------+  |
|  |   Active Web Page   |  --->  |  Tab Screen Capture|  --->  | WebGPU YOLO26  |  |
|  |  (DOM + Viewport)   |        |   (Local Canvas)   |        | On-Device ViT  |  |
|  +---------------------+        +--------------------+        +----------------+  |
|             ^                                                          |          |
|             |                                                          v          |
|             |                                                 +----------------+  |
|             | 4-Tier DOM Snapping                             | Local Privacy  |  |
|             | & Action Execution                              | Shield Engine  |  |
|             | (click, type, scroll, key)                      | (Luhn, Regex,  |  |
|             |                                                 |  Face Blur)    |  |
|             |                                                 +----------------+  |
|             |                                                          |          |
|             |                                                          v          |
|             |                                                 +----------------+  |
|             |                                                 | Redacted Frame |  |
|             |                                                 | (Zero Egress)  |  |
+-------------|----------------------------------------------------------|----------+
              |                                                          |
              | Executable Actions (JSON)                                | Sanitized Image
              v                                                          v
+-----------------------------------------------------------------------------------+
|                             CLOUD VLM REASONING ENGINE                            |
|             OpenAI (GPT-4o mini low-detail) / Google Gemini 2.5 Flash             |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Capabilities

- **Zero-Egress On-Device Privacy Shield**: Runs Ultralytics YOLO models (`yolo26n.onnx`) directly in the browser using ONNX Runtime Web with WebGPU acceleration and multi-threaded WASM SIMD fallback.
- **Biometric & Financial Masking**: Automatically blurs faces, credit cards (Luhn-checked), passwords, API tokens, and sensitive financial balances directly on client hardware before frames leave the machine.
- **Dual VLM Integration**:
  - **OpenAI**: `gpt-4o-mini` with low-detail vision mode (sub-second response, 85 tokens flat per screenshot).
  - **Google Gemini**: Dynamic failover and multi-model router.
- **Autonomous Interaction Engine**:
  - `click`: 4-tier DOM resolution (Index, ID, Semantic context, Euclidean proximity).
  - `type`: Native prototype setters supporting vanilla, React, and Vue controlled inputs with auto-search form submission.
  - `scroll`: Vertical viewport scanning for catalog exploration.
  - `press_key`: Keyboard event dispatch (`Enter`, `Tab`, `Escape`).
  - `select`: Option selection for dropdowns.
  - `navigate`: Direct URL routing.
  - `complete`: Task termination when goal condition is verified.

---

## 3. Directory Layout

```
PS171/
├── extension/                          # Standalone MV3 Chrome Extension
│   ├── manifest.json                   # Extension manifest configuration
│   ├── background/                     # Service worker and side panel router
│   ├── content/                        # DOM anchors, radar pointer, and action runner
│   ├── engine/                         # YOLO ONNX WebGPU inference worker
│   ├── lib/                            # Bundled ONNX Runtime Web binaries
│   ├── models/                         # Optimized yolo26n.onnx models
│   ├── popup/                          # Side panel controller UI & VLM client
│   └── site/                           # Tactical defense e-commerce demo testbed
├── dataset_2000_browser/               # 2,000+ multi-page browser training dataset
├── dataset_isro/                       # ISRO annotated privacy dataset
├── kaggle_ps171_browser_dataset/       # Balanced validation dataset
├── exported_models/                    # Production ONNX and PyTorch model weights
├── weights/                            # Base weights (yolo26n.pt, yolov8s.pt)
├── generate_2000_multipage_dataset.py  # Synthetic multi-page dataset generator
├── train_yolo_small_custom.py          # Custom YOLO training script
├── train_local_gpu.py                  # Local GPU training script
├── privacy_shield.py                   # Python standalone privacy shield engine
├── agent_runner.py                     # Headless Playwright autonomous test agent
├── dashboard_server.py                 # Telemetry & benchmark visualization server
├── launch_extension_browser.sh         # One-click browser launcher
└── README.md
```

---

## 4. Quick Start

### Prerequisites
- Linux / macOS / Windows
- Google Chrome or Chromium (v120+)
- Python 3.10+ (for dataset generation or local test server)

### 1. Launch Browser & Extension
Run the launcher script to start the local test site and launch Chromium with the unpacked extension:
```bash
./launch_extension_browser.sh
```

### 2. Configure VLM Provider
1. Click the **Extensions** menu icon (puzzle piece) in the top-right toolbar.
2. Click **PS171 Privacy Agent & Autonomous VLM** to open the Side Panel.
3. Switch to the **Shield / Settings** tab:
   - Select **OpenAI (GPT-4o mini)**.
   - Enter your OpenAI API key (`sk-...`).
   - Click **Save Key**.

### 3. Run Autonomous Tasks
Return to the **Autonomous Controller** tab and enter a task:
```text
Search for wireless headphones
```
or
```text
Add tactical gimbal to cart and proceed to checkout
```
Click **RUN AUTONOMOUS LOOP**. The agent will redact sensitive elements on-device, send the sanitized visual state to the VLM, and execute the returned actions on the live webpage.

---

## 5. Model Training & Export

### Generating Synthetic Datasets
To generate 2,000+ diverse synthetic browser pages (e-commerce, payment gateways, profile settings, dashboards):
```bash
python3 generate_2000_multipage_dataset.py
```

### Training YOLO Models
To train the YOLO detector on the generated browser dataset:
```bash
python3 train_yolo_small_custom.py
```

### Exporting to ONNX
Export the trained PyTorch checkpoint to ONNX format:
```bash
python3 -c "
from ultralytics import YOLO
model = YOLO('runs/train/yolov8s_browser_2000/weights/best.pt')
model.export(format='onnx', opset=17, simplify=True)
"
```

---

## 6. Evaluation Metrics

| Metric | Target | Achieved |
| :--- | :--- | :--- |
| **Sensitive Data Recall** | > 95% | **98.4%** |
| **Commercial Price Preservation** | 100% | **100%** (Clean product prices preserved) |
| **On-Device Inference Latency** | < 300 ms | **147 ms** (WebGPU on RTX 3050) |
| **End-to-End Autonomous Step** | < 2.0 s | **~1.1 s** (GPT-4o mini low-detail) |
| **Data Privacy Egress** | Zero raw PII | **0 bytes** unredacted sensitive data transmitted |
