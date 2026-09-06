---
name: browser-agent-patterns
description: >-
  Architectural patterns, mistake corrections, and best practices learned from building
  zero-egress browser privacy agents and autonomous VLM web automation extensions.
  Use when designing, implementing, debugging, or scaffolding fresh projects that involve
  cross-browser Manifest V3 extensions (Chrome and Firefox), native side panels/sidebars,
  on-device visual redaction (DOM + ONNX), semantic anchor click snapping, VLM API routing
  (OpenAI and Gemini), or autonomous browser navigation loops.
---

# Browser Privacy Agent & Autonomous VLM Engineering Patterns

## Overview

This skill synthesizes core architectural decisions, critical mistake corrections, and production runbooks derived from building client-side zero-egress browser privacy agents and autonomous VLM controllers.

When starting a fresh project combining WebExtensions, visual privacy engines, and vision-language model (VLM) automation, follow this runbook to avoid regressions, cross-browser incompatibilities, and architectural dead ends.

---

## 1. Cross-Browser Manifest V3 Architecture (Chrome & Firefox)

### The Incompatibilities & Corrections

| Feature / Area | Google Chrome MV3 | Mozilla Firefox MV3 | Universal Correction Pattern |
| :--- | :--- | :--- | :--- |
| **Background Script** | Requires `service_worker` | Historically disabled `service_worker`, requires `scripts` array | Declare **both** keys in `manifest.json`: `"background": { "service_worker": "bg.js", "scripts": ["bg.js"] }` |
| **Side Panel / Docked UI** | Native `side_panel` API (`chrome.sidePanel`) | Native `sidebar_action` API (`browser.sidebarAction`) | Declare `side_panel` and `sidebar_action` targeting the same HTML panel |
| **Toolbar Action Click** | Opens side panel if configured | If `action.default_popup` is declared, it intercepts clicks and blocks `sidebar_action` | **Do not** declare `default_popup` in `action`. Handle click in background script |
| **WASM / ONNX Execution** | Blocked without CSP directive | Blocked without CSP directive | Add: `"content_security_policy": { "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" }` |
| **Extension Identification** | Optional in development | Requires Gecko ID for add-on installation | Always add `"browser_specific_settings": { "gecko": { "id": "addon-name@domain", "strict_min_version": "109.0" } }` |

### Manifest V3 Cross-Browser Blueprint

```json
{
  "manifest_version": 3,
  "name": "Project Name",
  "version": "1.0.0",
  "description": "Zero-egress privacy agent and autonomous browser controller.",
  "browser_specific_settings": {
    "gecko": {
      "id": "project-agent@org.internal",
      "strict_min_version": "109.0"
    }
  },
  "permissions": [
    "sidePanel",
    "activeTab",
    "tabs",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  },
  "action": {
    "default_title": "Project Agent",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "popup/popup.html"
  },
  "sidebar_action": {
    "default_title": "Project Agent",
    "default_panel": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/background.js",
    "scripts": ["background/background.js"]
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["lib/*", "models/*", "engine/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### Background Script Action Listener Pattern

```javascript
const browserAPI = (() => {
  if (typeof globalThis.browser !== "undefined" && globalThis.browser.runtime) {
    return globalThis.browser;
  }
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime) {
    return globalThis.chrome;
  }
  return {};
})();

const sidePanelAPI = (typeof chrome !== "undefined" && chrome.sidePanel)
  ? chrome.sidePanel
  : ((typeof browser !== "undefined" && browser.sidePanel) ? browser.sidePanel : null);

if (sidePanelAPI && typeof sidePanelAPI.setPanelBehavior === "function") {
  try {
    sidePanelAPI.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  } catch (_) {}
}

const actionAPI = (typeof browser !== "undefined" && browser.action)
  ? browser.action
  : ((typeof chrome !== "undefined" && chrome.action) ? chrome.action : null);

if (actionAPI && actionAPI.onClicked) {
  actionAPI.onClicked.addListener(async (tab) => {
    // 1. Firefox native sidebarAction
    const sidebarAPI = (typeof browser !== "undefined" && browser.sidebarAction)
      ? browser.sidebarAction
      : null;

    if (sidebarAPI) {
      try {
        if (typeof sidebarAPI.toggle === "function") {
          await sidebarAPI.toggle();
          return;
        } else if (typeof sidebarAPI.open === "function") {
          await sidebarAPI.open();
          return;
        }
      } catch (err) {
        console.warn("Could not toggle Firefox sidebar:", err);
      }
    }

    // 2. Chrome native sidePanel
    if (sidePanelAPI && typeof sidePanelAPI.open === "function") {
      try {
        await sidePanelAPI.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn("Could not open Chrome side panel:", err);
      }
    }
  });
}
```

---

## 2. On-Device Zero-Egress Privacy Architecture

### The Mistake: Relying Solely on DOM Masks OR Solely on Computer Vision
- Relying purely on DOM inspection fails on rendered canvas graphics, images, SVGs, and third-party iframes.
- Relying purely on computer vision (YOLO/ONNX) misses high-entropy text tokens (passwords, tokens, Luhn-valid card numbers) rendered in standard typography without specific visual bounding patterns.

### The Correction: Two-Tier Defense-in-Depth Shield

```
[Web Page DOM & Canvas]
          |
          +-- Tier 1: DOM Semantic Walker (Synchronous, Content Script)
          |    |-- Input type="password", type="tel", autocomplete="cc-number"
          |    |-- Luhn-checked Credit Card regex scanner
          |    |-- High-entropy Secret / Key detector (sk-..., bearer, etc.)
          |    +-- Injects high-contrast black SVG/CSS masks with text badges
          |
          +-- Tier 2: Visual Detection (ONNX Runtime Web / YOLO WASM)
               |-- Face / Biometric bounding box detection
               |-- Profile badge / sensitive visual entity detection
               +-- Generates Gaussian-blurred patches onto captured canvas
          |
          v
[Sanitized Canvas] (Zero sensitive bytes exist in image payload)
          |
          v
[Forwarded to VLM] (OpenAI / Gemini Vision API)
```

### Redaction Rules
1. **Never use semi-transparent overlays**: VLMs can infer characters beneath low-opacity alpha layers. Use 100% opaque fills or heavy multi-pass box blurs.
2. **Always include semantic placeholder badges**: Label concealed regions with text such as `[REDACTED_PASSWORD]`, `[REDACTED_SECRET]`, `[REDACTED_PII]`. This instructs the VLM that the area is intentionally masked, preventing hallucinated guesses while preserving layout context.
3. **Strict client-side capture pipeline**: The capture-and-redact step must execute entirely inside extension context (`chrome.tabs.captureVisibleTab`) and WebGL/Canvas before any `fetch` call leaves the client.

---

## 3. Autonomous Grounding: Semantic Anchor Snapping

### The Mistake: Raw Normalized Coordinates from VLMs
VLMs trained on diverse visual datasets frequently predict coordinates with 15-50 pixel offsets due to:
- High-DPI screens (`window.devicePixelRatio > 1`).
- Variable browser viewports and inner scrollbars.
- Layout shifts or responsive CSS hover states.
Blindly dispatching `click` at `[x_norm, y_norm]` often hits empty whitespace adjacent to buttons.

### The Correction: Content-Script Anchor Enumeration & Proximity Snapping

1. **Before querying the VLM**:
   The content script extracts all visible, interactable elements:
   - Elements: `a`, `button`, `input`, `select`, `textarea`, `[role="button"]`, `[onclick]`.
   - Filters out hidden elements (`getClientRects().length === 0`, `visibility === 'hidden'`).
   - Normalizes center coordinates to `[0.0, 1.0]` relative to viewport (`window.innerWidth`, `window.innerHeight`).
   - Assigns a sequential index (`#1`, `#2`, `#3...`) to each visible anchor.

2. **Supply Anchors to the VLM Prompt**:
   ```text
   VISIBLE INTERACTIVE ACTION ELEMENTS DETECTED ON THIS SCREEN:
   - [Index 1] "Search" input at coords [0.35, 0.08] (id: "twotabsearchtextbox")
   - [Index 2] "Go" button at coords [0.68, 0.08] (class: "nav-search-submit")
   - [Index 3] "Add to Cart" button at coords [0.82, 0.65] (id: "add-to-cart-button")

   Decide the single next action. Specify target_index and normalized coordinates.
   ```

3. **Execution Snapping Algorithm**:
   - If the VLM provides a valid `target_index`, look up the exact DOM element by index and calculate its exact bounding box center.
   - If the VLM provides `coordinates: [x, y]` without an index, find the candidate anchor within euclidean distance threshold radius <= 0.08. Snap execution to that anchor's true bounding center.
   - Fall back to raw coordinates only if no anchor is within snapping radius.

4. **Handling Page Navigation & Loading States**:
   When an action triggers navigation (`press_enter: true` or clicking a submit button):
   - Do **not** immediately capture the next frame.
   - Wait for `tabs.onUpdated` status to become `'complete'`.
   - Add a brief settling delay (250-500ms) for client-side frameworks (React/Vue/Next.js) to finish mounting DOM elements.
   - Re-inject content scripts dynamically if the page context was destroyed during full navigation.

---

## 4. VLM Provider Architecture: Dual Routing & Failover

### The Mistake: Heavy Local VLMs vs Fragile Single Cloud Provider
- Running local multi-gigabyte VLMs (like 7B/11B parameters via Ollama) on consumer workstations with 4GB-8GB VRAM causes excessive latencies (15-45 seconds per step), thermal throttling, and frequent CUDA OOM crashes.
- Hardcoding a single cloud API key creates total failure when encountering quota rate limits (HTTP 429) or transient server errors (HTTP 503).

### The Correction: Dual Cloud Providers with Instant Cascading Failover

```
                      [Autonomous Loop Step]
                                 |
                                 v
                     Check Active Provider Preference
                     |-- Default / Active: OpenAI
                     +-- Secondary / Fallback: Google Gemini
                                 |
                     +-----------+-----------+
                     |                       |
                     v                       v
            [Primary: OpenAI]        [Primary: Gemini]
              gpt-4o-mini              gemini-2.5-flash
                     |                       |
                 Success?                Success?
                 |-- Yes: Return         |-- Yes: Return
                 +-- No (Error/Quota)    +-- No (Error/Quota)
                         |                       |
                         v                       v
                [Failover to Gemini]    [Failover to OpenAI]
```

### Model Selection Recommendations
- **OpenAI `gpt-4o-mini`**:
  - Image token mode: Set detail to `"low"` for UI automation. Consumes exactly 85 tokens per screenshot (~$0.00001 per step).
  - Sub-second round-trip latency. High JSON adherence.
- **Google Gemini `gemini-2.5-flash` / `gemini-2.0-flash`**:
  - Extremely high multimodal reasoning and precision.
  - Fast response time and low latency vision parsing.
- **Strict JSON Parsing Hygiene**:
  Always clean markdown fences and locate first/last curly braces before `JSON.parse`:
  ```javascript
  let clean = rawResponseText.trim();
  if (clean.includes("```")) {
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) clean = match[1];
  }
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.slice(start, end + 1);
  }
  const decision = JSON.parse(clean);
  ```

---

## 5. Codebase Hygiene & Refactoring Discipline

### Common Failure Modes in Multi-Iterative Projects
1. **Accumulating Legacy Artifacts**:
   - As experiments evolve, obsolete training scripts, scratch notebooks, dead model weights, and abandoned provider branches clutter the repository.
   - **Correction**: Maintain strict separation between `extension/` (the standalone browser runtime) and offline experimentation pipelines. Prune deprecated files before releasing or tagging milestones.
2. **User-Specified Constraints**:
   - When constraints are specified (such as zero emojis, specific casing, strict JSON output formats), enforce them globally across all files, test suites, and commit logs from step one.
3. **Automated Verification Scripting**:
   - Provide a zero-dependency packaging and verification shell script (e.g., `package_firefox_extension.sh`) that runs syntax checks (`node -c`, `python3 -m py_compile`), verifies manifest completeness, and produces distribution archives (`.zip`, `.xpi`).

---

## 6. Quick Reference Checklist for Fresh Projects

- [ ] `manifest.json` specifies `service_worker` and `scripts` in `background`.
- [ ] `manifest.json` declares `sidebar_action` for Firefox and `side_panel` for Chrome.
- [ ] `action` does **not** contain `default_popup` to ensure native sidebar toggle works.
- [ ] CSP includes `'wasm-unsafe-eval'` for WebAssembly / ONNX inference.
- [ ] Gecko ID is declared under `browser_specific_settings.gecko`.
- [ ] Content script provides normalized interactive anchor points for VLM grounding.
- [ ] Click execution includes proximity snapping to candidate bounding boxes.
- [ ] Autonomous loop handles page navigation lifecycle without crashing disconnected scripts.
- [ ] Dual-provider failover (OpenAI `gpt-4o-mini` and Gemini `gemini-2.5-flash`) is implemented.
- [ ] Redaction pipeline is strictly on-device before any API request.
- [ ] Verification script checks syntax across all JS/Python files and packages `.xpi` / `.zip`.\n