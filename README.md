# YOLO WebGPU Privacy Agent & Autonomous VLM Controller

A cross-browser (Google Chrome & Mozilla Firefox) Manifest V3 extension featuring:
1. **On-Device Zero-Egress Privacy Engine**: Local YOLO model (`yolo26n.onnx`) running via WebGPU (with WASM fallback) detecting faces, and a DOM PII walker detecting passwords, Luhn-valid credit cards, phone numbers, Aadhaar, PAN, and developer secrets.
2. **On-Device Canvas Sanitization**: Multi-pass Gaussian box blur with high-contrast semantic badges (`[REDACTED_FACE]`, `[REDACTED_CARD]`, etc.) ensuring zero sensitive bytes leave the local client.
3. **Autonomous Agent Loop with Dual VLM Routing**: Supports OpenAI (`gpt-4o`, `gpt-4o-mini`) and Google Gemini (`gemini-2.0-flash`, `gemini-1.5-flash`) with automatic cascading failover on rate limits.
4. **Semantic Anchor Grounding**: Content-script anchor extraction (`#1`, `#2`...) with normalized coordinates, click ripple visual feedback, and reliable DOM navigation handling.
5. **Amazon-Themed E-Commerce Testbed**: End-to-end buying workflow with extra-large typography, real face photo, and day-to-day sensitive secrets.

---

## E-Commerce Buying Lifecycle

- **Storefront ([`demo/index.html`](demo/index.html))**: Header tabs, product catalog, real face portrait verification, 1-Click Buy button.
- **Product Detail ([`demo/product.html`](demo/product.html))**: Detailed specs, SKU serials, and Buy Box.
- **Checkout ([`demo/checkout.html`](demo/checkout.html))**: Pre-filled sensitive inputs, recipient face check, and "Place your order" button.
- **Order Success ([`demo/order_success.html`](demo/order_success.html))**: Confirmation receipt, order ID `#AMZ-84920-2026`, and tracking status.
- **Account Vault ([`demo/account.html`](demo/account.html))**: Stored credit cards, bank accounts, passwords, Aadhaar, and API keys.

---

## Running the Project

### 1. Run Automated Test Suite (39 Tests Across 9 Suites)
```bash
npm test
```

### 2. Launch Browsers & Demo Store
```bash
# Launches both Chrome/Brave and Firefox with extension loaded + demo on http://localhost:3000
npm start

# Or launch individually:
npm run start:chrome
npm run start:firefox
npm run start:demo
```

### 3. Package Extension Archives
```bash
npm run package
# Outputs:
# dist/yolo_webgpu_extension_chrome.zip
# dist/yolo_webgpu_extension_firefox.xpi
```

---

## Using the Autonomous Agent Loop

1. Click the extension toolbar icon to open the **Side Panel**.
2. Go to **"API Settings"** and paste your **OpenAI API Key** and/or **Google Gemini API Key** (saved locally in `chrome.storage.local`).
3. Under the **"Agent Loop"** tab:
   - Enter your goal prompt (e.g. *"Buy the Apple MacBook Pro 16 and complete checkout"*).
   - Select your model router (`Auto Failover`, `OpenAI gpt-4o`, `Gemini 2.0 Flash`).
   - Click **"START AGENT LOOP"**.
4. The agent will:
   - Capture the viewport.
   - Blur faces (via YOLO WebGPU) and PII text (via DOM Regex/Luhn scanner).
   - Display the sanitized frame in the side panel preview (zero sensitive bytes leaked).
   - Query the VLM for the next grounded action (`click`, `type`, `scroll`, `finish`).
   - Execute the action with an on-page animated click ripple indicator.
   - Transition through product selection &rarr; checkout &rarr; order placement.
