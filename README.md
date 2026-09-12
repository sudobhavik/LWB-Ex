# GUPTCHARA (गुप्तचर) — On-Device Visual Privacy Agent

> **Smart India Hackathon (SIH26171 / ISRO PS-171)**: *On-Device Visual Perception for Light-Weight Browser Agents*  
> Chrome & Firefox Manifest V3 Extension | Zero-Egress Privacy | WebGPU-Accelerated Perception

---

## What is GUPTCHARA?
Modern AI browser agents stream raw screenshots to remote cloud Vision-Language Models (VLMs), risking sensitive data exposure (passwords, bank accounts, Aadhaar/PAN, personal faces) and failing on graphical HTML5 `<canvas>` elements that have no DOM representation.

**GUPTCHARA** solves this by embedding lightweight neural vision models directly inside the browser using **WebGPU**. It sanitizes sensitive content on-device before any AI sees it and fuses visual bounding boxes with DOM anchors, enabling safe, autonomous web navigation with **zero cloud data leaks**.

---

## Core Technical Capabilities

1. **Zero-Egress Privacy Redactor**:
   - In-memory HTML5 `<canvas>` redaction barrier.
   - Detects faces via **YOLOv26n** and sensitive PII (credit cards, passwords, Aadhaar, PAN) via DOM Regex & Luhn algorithms.
   - Masks private data with high-contrast badges (`[REDACTED_FACE]`, `[REDACTED_CARD]`) before screen frames reach reasoning engines.

2. **Sub-25ms WebGPU Vision Inference**:
   - Runs **ONNX Runtime Web** (`ort-wasm-simd-threaded`) with native WebGPU shaders and WASM SIMD fallback.
   - Parallel inference: YOLOv26n (faces & input boxes) and **Microsoft OmniParser INT8** (UI buttons and icons) in ~25.2 ms using under 40 MB RAM.

3. **Hybrid DOM + Visual Anchor Fusion**:
   - Custom `anchor_fuser.js` matches DOM tree interactive nodes with visual bounding boxes via Intersection-over-Union (IoU).
   - Solves the **"Canvas Blindspot"**: Identifies buttons inside HTML5 `<canvas>` and WebGL surfaces without underlying DOM tags.

4. **DPI-Invariant Set-of-Mark (SoM) Grounding**:
   - Renders numbered tags (`#1`, `#2`...) with normalized viewport coordinates (`normX`, `normY`).
   - Automatically resolves parent clickable containers via `.closest(...)` and dispatches native `PointerEvents` with visual ripple feedback.

5. **Multi-Modal Agent Router**:
   - Supports offline on-device execution (Chrome **Gemini Nano** Prompt API & local **Ollama Qwen3-VL**) or sanitized cloud routing (OpenAI GPT-4o, Google Gemini) with zero sensitive pixels egressed.

---

## Quick Start

### 1. Run Automated Test Suites (180 Tests)
```bash
npm test
```

### 2. Launch Browser with Extension & Demo
```bash
# Launch Chromium/Chrome with extension loaded + Amazon demo testbed:
npm start

# Or test in Firefox:
npm run start:firefox
```

### 3. Package Extension for Store Distribution
```bash
npm run package
# Produces dist/yolo_webgpu_extension_chrome.zip and dist/yolo_webgpu_extension_firefox.xpi
```

---

## Repository Structure
- `extension/`: Chrome MV3 extension (WebGPU engines, anchor fuser, sidepanel UI).
- `demo/`: Real-world e-commerce testbed (storefront, product, checkout, success, account vault).
- `tests/`: 24 test suites covering redaction integrity, anchor fusion, VLM router, and grounding.
- `scripts/`: Cross-platform demo runners and packaging automation.
