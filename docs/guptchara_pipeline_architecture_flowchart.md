# GUPTCHARA: End-to-End System Pipeline Architecture & Flowchart Guide
### Light-Weight On-Device Visual Perception for Zero-Egress Browser Agents
**Problem Statement ID:** SIH26171 (ISRO PS-171)  
**Target Architecture:** Google Chrome Extension (Manifest V3) + WebGPU + ONNX Runtime Web  
**Test Suite Verification:** 143/143 Passing Tests Across 22 Suites (`npm test`)

---

## 1. End-to-End System Pipeline Flowchart

This flowchart illustrates the complete runtime cycle of a single agent step: from browser tab capture and parallel WebGPU perception to anchor fusion, local offline reasoning, and grounded container-aware click dispatch.

```mermaid
flowchart TD
    subgraph S1["STAGE 1: Viewport & Canvas Ingestion"]
        A["Active Web Page<br/>(DOM, Canvas, WebGL)"] --> B1["chrome.tabs.captureVisibleTab<br/>High-Res Screenshot Bitmap"]
        A --> B2["DOM Candidate Traversal<br/>(Buttons, Links, Inputs)"]
        A --> B3["Canvas Boundary Scanner<br/>(HTML5 &lt;canvas&gt; Rects)"]
    end

    subgraph S2["STAGE 2: Parallel On-Device WebGPU Perception (~25.2 ms)"]
        B1 --> C1["YOLOv26n INT8 WebGPU<br/>Faces &amp; Sensitive Inputs"]
        B1 --> C2["OmniParser INT8 WebGPU (19.6 MB)<br/>Visual Buttons &amp; Action Icons"]
        B2 --> C3["Presidio / Regex Pattern Engine<br/>4-Box Split Cards &amp; Indian PII"]
    end

    subgraph S3["STAGE 3: Hybrid Anchor Fusion &amp; Adaptive Redaction"]
        C1 & C2 & C3 & B2 & B3 --> D["anchor_fuser.js &amp; canvas_redactor.js"]
        D --> D1["IoU Overlap Matcher<br/>Aligns DOM nodes with Visual boxes"]
        D --> D2["Canvas Control Discoverer<br/>Discovers non-DOM controls as [CANVAS_CONTROL]"]
        D --> D3["Adaptive Cushion Blackout<br/>4px Safety Padding / 0px Button Clamp"]
        D --> D4["Normalized Coordinate Space<br/>normX, normY between 0.0 and 1.0"]
    end

    subgraph S4["STAGE 4: Local Multi-Modal Decision Engine (Zero Cloud Egress)"]
        D3 & D4 --> E["vlm_router.js Prompt Assembler<br/>(Sanitized Screenshot + Numbered Anchor List)"]
        E --> F1["Local Ollama Qwen3-VL:2B<br/>(100% Offline GPU, 558 ms)"]
        E --> F2["Chrome Built-in AI<br/>(Gemini Nano Prompt API, 380 ms)"]
        E --> F3["Sanitized Cloud Router<br/>(Zero Private Pixels Egressed)"]
        F1 & F2 & F3 --> G["Decision Parser &amp; Intent Recovery<br/>Strict JSON Extraction + Target Index Fallback"]
    end

    subgraph S5["STAGE 5: Grounded Execution &amp; Visual HUD"]
        G --> H["content.js: executeAgentAction"]
        H --> H1["DPI-Invariant Coordinate Translation<br/>normX * innerWidth, normY * innerHeight"]
        H --> H2["Container Resolution<br/>targetEl.closest('button, a, input')"]
        H --> H3["Dual Event Dispatch<br/>PointerEvents + MouseEvents + .click()"]
        H --> H4["Visual HUD &amp; Feedback<br/>Glowing Ripple Ring + Live Privacy Badge"]
        H3 --> A
    end
```

---

## 2. Detailed Stage-by-Stage Breakdown for Teammates

### Stage 1: Ingestion & Viewport Extraction
- **Code Location:** [`extension/sidepanel/sidepanel.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/sidepanel/sidepanel.js) and [`extension/content/content.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/content/content.js)
- **What Happens:**
  1. The user inputs a goal in the side panel (e.g., `"Buy the Sony WH-1000XM5 headphones"`).
  2. `chrome.tabs.captureVisibleTab` takes an instant screenshot of the current visible tab.
  3. `content.js` scans the DOM for interactive elements (`a`, `button`, `input`, `select`, `[role="button"]`) and collects all `<canvas>` bounding rectangles.
  4. Coordinate scaling factors (`scaleX = img.naturalWidth / viewportWidth`, `scaleY = img.naturalHeight / viewportHeight`) are computed to reconcile screenshot bitmap pixels with CSS viewport coordinates.
- **Output:** Raw screenshot `ImageBitmap`, list of DOM candidates, and bounding boxes of all HTML5 `<canvas>` elements.

---

### Stage 2: Parallel WebGPU On-Device Perception
- **Code Location:** [`extension/engine/yolo_runner.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/yolo_runner.js), [`extension/engine/omniparser_detector.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/omniparser_detector.js), and [`extension/engine/pii_detector.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/pii_detector.js)
- **What Happens:**
  1. **YOLOv26n (INT8 quantized):** Detects user profile faces and sensitive input boxes directly via WebGPU shaders in **25.2 ms**.
  2. **Microsoft OmniParser v2 `icon_detect` (INT8 quantized, 19.6 MB):** Detects visual interactive icons and UI buttons directly on the screenshot image.
  3. **Presidio DLP / Regex Engine:** Scans text content for credit cards, Aadhaar, PAN tax IDs, and 4-box segmented card inputs in **0.01 ms**.
- **Key Advantage:** Both models run in WebGPU shaders inside browser process memory. Zero data is transmitted to external servers.

---

### Stage 3: Hybrid Anchor Fusion & Adaptive Redaction
- **Code Location:** [`extension/engine/anchor_fuser.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/anchor_fuser.js) and [`extension/engine/canvas_redactor.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/canvas_redactor.js)
- **What Happens:**
  1. **IoU Matching:** Matches DOM interactive nodes with OmniParser visual boxes.
  2. **Canvas Discovery:** Any visual element detected inside an HTML5 `<canvas>` boundary where no DOM elements exist is promoted to an interactive anchor with the tag `[CANVAS_CONTROL]`.
  3. **Normalized Coordinates:** Every anchor receives `normX` and `normY` between `0.0` and `1.0`. This ensures DPI-invariance across retina laptops and responsive window resizing.
  4. **Adaptive Cushion Blackout:** Sensitive credentials and faces receive solid blackout boxes with a 4-pixel security cushion. If a button is immediately adjacent, the cushion clamps to 0 pixels to prevent covering clickable controls.
- **Output:** Unified numbered anchor list (`#1`, `#2`, `#3`...) and a sanitized screenshot canvas.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      HYBRID FUSION MATRIX                              │
├──────────────────┬─────────────────┬─────────────────┬─────────────────┤
│ Element Source   │ DOM Tag Present │ Visual Box Over │ Resulting Anchor│
├──────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Standard HTML    │ YES (button/a)  │ YES (IoU > 0.25)│ hybrid_fused    │
│ HTML Text Only   │ YES (span/div)  │ NO              │ dom_walker      │
│ Canvas / WebGL   │ NO (zero DOM)   │ YES (OmniParser)│ canvas_vision   │
│ Pure Visual Icon │ NO              │ YES (OmniParser)│ omniparser_vis  │
└──────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

### Stage 4: Local Multi-Modal Decision Engine
- **Code Location:** [`extension/engine/vlm_router.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/vlm_router.js)
- **What Happens:**
  1. Assembles a structured grounding prompt containing:
     - User goal.
     - Action history (previous steps).
     - Numbered anchor list with normalized coordinates (`[Index 1] "Buy Now" at [0.72, 0.65]`).
     - Sanitized screenshot with zero private pixels.
  2. **Model Selection:**
     - **Priority 1 (Ollama Qwen3-VL:2B):** Runs on local GPU via `http://localhost:11434` in 558 ms with 0% data egress.
     - **Priority 2 (Chrome Gemini Nano):** Runs via Chrome Prompt API in 380 ms directly on-device.
     - **Priority 3 (Cloud VLM):** If cloud keys are provided, only the sanitized (blacked-out) image is sent.
  3. **Reasoning Stream Intent Recovery:**
     - When models output extended chain-of-thought analysis without JSON wrappers, `vlm_router.js` automatically extracts target indices (`[Index 5]` or `target_index: 5`) and assigns `action: click`.
     - Internal self-dialogue monologues (`o, let's see...`, `looking at the current screen...`) are stripped so the user interface receives clean, conversational status updates.
- **Output:** Parsed decision object `{ action: "click", target_index: 5, coordinates: [0.72, 0.65], text: "" }`.

---

### Stage 5: Grounded Execution & Visual HUD
- **Code Location:** [`extension/content/content.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/content/content.js)
- **What Happens:**
  1. **Coordinate Scaling:** Computes exact viewport pixels:
     `clickClientX = meta.normX * window.innerWidth`
     `clickClientY = meta.normY * window.innerHeight`
  2. **Container Resolution:** If the coordinate lands on an inner text span, SVG icon, or image, `content.js` calls `targetEl.closest('button, a, input, select, textarea, [role="button"]')` to execute on the parent clickable element.
  3. **Dual Event Dispatch:**
     - Dispatches native `PointerEvents` (`pointerdown`, `pointerup`) and `MouseEvents` (`mousedown`, `mouseup`, `click`).
     - Calls native `.click()` for DOM elements.
     - Hits sub-element coordinates directly on the `<canvas>` surface for WebGL / Canvas games and banking vaults.
  4. **Visual Action HUD:** Displays an animated glowing ripple ring at the exact click location and updates the side panel step counter.
- **Output:** Page state transitions, and the loop advances to the next step.

---

## 3. Component Responsibility Matrix

| Component File | Role & Primary Responsibility | Key Functions / Classes |
| :--- | :--- | :--- |
| [`extension/sidepanel/sidepanel.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/sidepanel/sidepanel.js) | Main coordinator: runs perception, manages step loop, updates side panel UI. | `executeSingleAgentStep()`, `runContinuousLoop()`, `resetConversation()` |
| [`extension/content/content.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/content/content.js) | Injected page script: DOM anchor extraction, canvas detection, click/type dispatch. | `extractInteractiveAnchors()`, `executeAgentAction()`, `applyDetections()` |
| [`extension/engine/omniparser_detector.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/omniparser_detector.js) | Microsoft OmniParser INT8 WebGPU runner for visual UI buttons and icons. | `OmniParserDetector`, `detectUIElements()` |
| [`extension/engine/yolo_runner.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/yolo_runner.js) | WebGPU runner for fine-tuned YOLOv26n (faces and input fields). | `YoloRunner`, `detect()` |
| [`extension/engine/anchor_fuser.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/anchor_fuser.js) | Hybrid fusion engine: aligns DOM anchors with OmniParser boxes via IoU. | `fuseVisualAndDOMAnchors()`, `computeBoxIoU()` |
| [`extension/engine/canvas_redactor.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/canvas_redactor.js) | In-memory canvas privacy redactor with adaptive cushion padding. | `CanvasRedactor`, `sanitizeScreenshot()` |
| [`extension/engine/vlm_router.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/vlm_router.js) | VLM orchestrator: prompt generation, local Ollama/Gemini router, intent recovery. | `VLMRouter`, `buildPrompt()`, `parseDecision()`, `queryOllama()` |
| [`extension/engine/chrome_ai_engine.js`](file:///home/shreyas/SIH_brain/PS171V2/extension/engine/chrome_ai_engine.js) | Direct edge wrapper for Google Chrome Built-in AI (Gemini Nano Prompt API). | `ChromeAIEngine`, `pruneDOMAnchors()`, `decideLocalAction()` |

---

## 4. Primary Data Structures Flowing Through the Pipeline

### 1. Unified Anchor (`Anchor`)
```json
{
  "index": 5,
  "label": "Buy Now",
  "tag": "button",
  "role": "button",
  "x": 680,
  "y": 420,
  "width": 120,
  "height": 42,
  "normX": 0.531,
  "normY": 0.442,
  "isCanvas": false,
  "verifiedByVision": true,
  "source": "hybrid_fused"
}
```

### 2. VLM Decision (`Decision`)
```json
{
  "thought": "Located the Sony WH-1000XM5 card; clicking Buy Now to proceed to checkout",
  "action": "click",
  "target_index": 5,
  "coordinates": [0.531, 0.442],
  "text": "",
  "direction": "down",
  "answer": ""
}
```

---

## 5. Judge Presentation Talking Points ("Cheat Sheet" for Teammates)

When presenting this architecture to judges at Smart India Hackathon:

1. **When asked about Zero-Egress Privacy:**
   - *"All visual detection and redaction happen inside the browser's GPU memory before any network request is constructed. When using our local Ollama Qwen3-VL option, the image never leaves the local machine (`localhost:11434`), guaranteeing 0% cloud data egress."*

2. **When asked about Canvas & WebGL Support:**
   - *"Traditional ad-blockers and DOM scrapers are 100% blind to `<canvas>`, WebGL, and Flutter Web because there are no HTML tags. GUPTCHARA solves this by using Microsoft OmniParser to detect visual buttons directly from pixels, tagging them as `[CANVAS_CONTROL]` and dispatching native PointerEvents directly to the sub-element coordinates on the canvas surface."*

3. **When asked about Misclicks and Display Scaling:**
   - *"We use normalized coordinates (`normX`, `normY`) between 0.0 and 1.0, making our grounding mathematically invariant to retina display pixel ratios, window resize, and browser zoom. Furthermore, our container resolution engine checks `.closest(...)` so that clicks on inner SVG icons or text spans reliably trigger the parent button's event handler."*

4. **When asked about Lightweight Performance:**
   - *"Our WebGPU vision pipeline executes in **25.2 milliseconds** on modest laptop hardware (NVIDIA RTX 3050), using only **4.8% CPU** and **38.5 MB RAM**. It is 19.6 times faster than CPU execution and leaves the system responsive."*

5. **When asked about System Reliability:**
   - *"Our architecture is backed by **143 automated Vitest unit and integration tests across 22 test suites**, covering WebGPU inference, PII redaction, segmented card detection, and multi-turn autonomous loops with 100% pass rates."*
