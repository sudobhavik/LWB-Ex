# LWB-Ex
# 🛡️ PS171 — Privacy-First Browser Agent

> **On-device Visual Perception for Lightweight Browser Agents**

PS171 is a privacy-first browser agent that combines **on-device computer vision, DOM analysis, and local privacy protection** to understand web pages while keeping sensitive information on the user's device.

The system detects sensitive information locally, sanitizes the browser context, sends only safe information to the AI, and executes the resulting actions locally in the browser.

### Core principle

```text
See locally → Protect locally → Reason safely → Act locally
```

---

# 🎯 Problem

Modern browser agents need access to the user's screen and webpage structure to perform tasks such as:

> "Find the cheapest flight from Delhi to Mumbai next Friday."

However, sending raw screenshots and DOM information to cloud AI can expose:

- Email addresses
- Phone numbers
- Passwords
- Credit card information
- API keys
- Faces
- Private images
- Sensitive documents
- Other personally identifiable information

PS171 addresses this problem by performing **visual perception and privacy filtering locally inside the browser**.

---

# 💡 Solution

Instead of:

```text
Browser
   │
   ▼
Raw Screenshot + Raw DOM
   │
   ▼
Cloud AI
```

PS171 uses:

```text
                    BROWSER
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
    LOCAL VISION                 DOM ANALYSIS
    ONNX Runtime                 Semantic Data
          │                         │
          └────────────┬────────────┘
                       ▼
                DETECTION FUSION
                       │
                       ▼
                PRIVACY ENGINE
                       │
                       ▼
               SANITIZED CONTEXT
                       │
                       ▼
                  CLOUD AI
                       │
                       ▼
               STRUCTURED ACTION
                       │
                       ▼
              LOCAL EXECUTOR
                       │
                       ▼
                    BROWSER
```

The raw browser state stays local as much as possible.

---

# 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         USER BROWSER                          │
│                                                              │
│  ┌──────────────────┐       ┌─────────────────────────────┐ │
│  │ Screenshot /     │       │          DOM Tree           │ │
│  │ Screen State     │       │                             │ │
│  └────────┬─────────┘       └─────────────┬───────────────┘ │
│           │                               │                 │
│           ▼                               ▼                 │
│  ┌──────────────────┐       ┌─────────────────────────────┐ │
│  │ Local Vision     │       │       DOM Analyzer          │ │
│  │ ONNX Runtime Web │       │                             │ │
│  │                  │       │ Interactive + Semantic Data │ │
│  └────────┬─────────┘       └─────────────┬───────────────┘ │
│           │                               │                 │
│           └──────────────┬────────────────┘                 │
│                          ▼                                  │
│                ┌───────────────────┐                        │
│                │ Detection Fusion  │                        │
│                └─────────┬─────────┘                        │
│                          ▼                                  │
│                ┌───────────────────┐                        │
│                │  Privacy Engine   │                        │
│                └─────────┬─────────┘                        │
│                          ▼                                  │
│                ┌───────────────────┐                        │
│                │ Sanitization      │                        │
│                │ Blur / Mask /     │                        │
│                │ Remove / Replace  │                        │
│                └─────────┬─────────┘                        │
│                          │                                  │
│                          ▼                                  │
│                  SANITIZED CONTEXT                           │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ SAFE CONTEXT ONLY
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                         AI SERVER                            │
│                                                              │
│                  ┌─────────────────────┐                     │
│                  │   Agent / LLM       │                     │
│                  │     Reasoning       │                     │
│                  └──────────┬──────────┘                     │
│                             │                                │
│                             ▼                                │
│                    Structured Action                         │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│                                                              │
│                   LOCAL ACTION EXECUTOR                      │
│                                                              │
│      Click • Type • Scroll • Drag • Select • Keypress       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 🔐 Privacy Boundary

PS171 establishes a strict boundary between **raw browser information** and the cloud AI.

```text
┌───────────────────────────────────────┐
│             USER DEVICE               │
│                                       │
│  Raw Screenshot                       │
│  Raw DOM                              │
│  PII                                  │
│  Passwords                            │
│  Private Images                       │
│                                       │
│          LOCAL PRIVACY ENGINE         │
│                  │                    │
│                  ▼                    │
│           SANITIZED CONTEXT           │
└──────────────────┬────────────────────┘
                   │
                   │ SAFE DATA ONLY
                   ▼
┌───────────────────────────────────────┐
│              CLOUD AI                 │
│                                       │
│         Reasoning / Planning          │
└───────────────────────────────────────┘
```

**Sanitization happens before network transmission.**

---

# 🧠 Hybrid Perception

PS171 combines two complementary sources.

### Local Vision

Powered by:

- ONNX
- ONNX Runtime Web
- YOLO-family vision model
- WebGPU
- WASM fallback

Used for:

- Faces
- Images
- Visual objects
- Visual regions
- Screen layout
- Elements that may not have useful DOM semantics

### DOM Analysis

Used for:

- Buttons
- Input fields
- Password fields
- Links
- Labels
- Form elements
- Semantic roles
- Element coordinates

The two sources are combined:

```text
Vision
   +
DOM
   +
PII Rules
   ↓
Detection Fusion
   ↓
Unified Browser State
```

---

# 🎯 Privacy Detection

PS171 detects sensitive information using multiple methods.

| Data | Detection |
|---|---|
| Faces | Local Vision |
| Email | DOM + Regex |
| Phone | DOM + Regex |
| Password | DOM |
| Credit Card | DOM + Rules |
| API Keys | Pattern Detection |
| Private Images | Local Vision |
| Sensitive Documents | Local Vision |
| Sensitive Inputs | DOM |
| Other PII | Local Rules |

This hybrid approach avoids depending entirely on computer vision.

---

# 📐 Coordinate Fusion

Visual detections and DOM elements are mapped into the same browser coordinate system.

```text
DOM Detection
     │
     │
     ├── x
     ├── y
     ├── width
     └── height
          │
          ▼
     Bounding Box
          │
          │
Vision Detection
          │
          ▼
     Bounding Box
          │
          ▼
       IoU Match
          │
          ▼
   Unified Region
```

This allows PS171 to perform precise visual redaction.

---

# 🔒 Sanitization

Sensitive regions can be transformed using:

```text
MASK
BLUR
REMOVE
REPLACE
```

Example:

```text
Before:

Email: shantanu@example.com
Phone: +91 XXXXX XXXXX


After:

Email: [REDACTED]
Phone: [REDACTED]
```

Visual information:

```text
Face
 ↓
Blur

Sensitive document
 ↓
Mask

Private image
 ↓
Remove
```

---

# ⚡ Event-Driven Perception

The vision model should not continuously process every frame.

Perception is triggered by meaningful events:

```text
Page Load
Navigation
DOM Mutation
Modal Appears
Major Layout Change
User Interaction
Agent Action
        │
        ▼
   New Observation
```

This reduces unnecessary CPU/GPU usage.

The ONNX model is loaded once and reused:

```text
Browser Start
      ↓
Load Model
      ↓
Create ONNX Session
      ↓
Keep Session Alive
      ↓
Reuse for Inference
```

---

# 🤖 Agent Loop

Once perception and privacy are available, the browser agent follows:

```text
┌────────────┐
│  OBSERVE   │
└─────┬──────┘
      ↓
┌────────────┐
│  PERCEIVE  │
└─────┬──────┘
      ↓
┌────────────┐
│  PRIVACY   │
└─────┬──────┘
      ↓
┌────────────┐
│   REASON   │
└─────┬──────┘
      ↓
┌────────────┐
│    ACT     │
└─────┬──────┘
      ↓
┌────────────┐
│  VERIFY    │
└─────┬──────┘
      │
      ├──── FAIL ────→ OBSERVE
      │
      └──── PASS ────→ COMPLETE
```

---

# 🖥️ Product UI

PS171 will have a small, focused browser-extension UI.

## 1. Welcome / Onboarding

```text
┌──────────────────────────────────┐
│                                  │
│              🛡                  │
│                                  │
│        Welcome to PS171          │
│                                  │
│   Privacy-first Browser Agent    │
│                                  │
│  Your sensitive information is   │
│  protected before AI sees it.    │
│                                  │
│  ✓ Local privacy detection       │
│  ✓ Sensitive data masking        │
│  ✓ AI browser automation         │
│                                  │
│         [ Get Started → ]        │
│                                  │
└──────────────────────────────────┘
```

---

# 2. AI Configuration

```text
┌──────────────────────────────────┐
│ ← AI Configuration               │
├──────────────────────────────────┤
│                                  │
│ Choose AI Provider               │
│                                  │
│  ● OpenAI                        │
│  ○ Gemini                        │
│  ○ Local Model (Coming Soon)     │
│                                  │
│ Model                            │
│  [ GPT-4.x                ▼ ]    │
│                                  │
│ API Key                          │
│  [ ••••••••••••••••••••• ]       │
│                                  │
│  🔒 Screenshot is sanitized      │
│     before being sent to AI      │
│                                  │
│       [ Continue ]               │
└──────────────────────────────────┘
```

API keys should be stored securely and never exposed to webpage content scripts.

---

# 3. Privacy Shield

The main extension dashboard shows the current privacy state.

```text
┌──────────────────────────────────┐
│ 🛡 PS171                    ● ON │
├──────────────────────────────────┤
│                                  │
│ 🛡 Privacy Shield                │
│                                  │
│ ✓ Monitoring this page           │
│                                  │
│ Faces              2             │
│ Sensitive fields   3             │
│ PII                1             │
│                                  │
│          [ View Details ]        │
│                                  │
├──────────────────────────────────┤
│                                  │
│ 🤖 Browser Agent                 │
│                                  │
│ What would you like to do?       │
│                                  │
│ [                              ] │
│                                  │
│          [ Start Agent ]         │
│                                  │
└──────────────────────────────────┘
```

The user can immediately understand:

```text
Is PS171 active?
       ↓
What did it detect?
       ↓
What information is protected?
```

---

# 4. Browser Agent

```text
┌──────────────────────────────────┐
│ 🤖 Browser Agent                 │
├──────────────────────────────────┤
│                                  │
│ What would you like to do?       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ Find the cheapest flight     │ │
│ │ from Delhi to Mumbai next    │ │
│ │ Friday                      │ │
│ └──────────────────────────────┘ │
│                                  │
│ Max steps: [ 10 ▼ ]             │
│                                  │
│       [ ✨ Start Agent ]         │
│                                  │
└──────────────────────────────────┘
```

---

# 5. Agent Running

The user can observe the agent's current state.

```text
┌──────────────────────────────────┐
│ 🤖 Agent Running           ● LIVE│
├──────────────────────────────────┤
│                                  │
│ ✓ Observed webpage               │
│ ✓ Detected sensitive data        │
│ ✓ Sanitized screenshot           │
│ ✓ AI analyzed safe page          │
│                                  │
│ ● Typing "Delhi"                 │
│                                  │
│ ○ Searching flights              │
│ ○ Comparing prices               │
│                                  │
│ Step 3 of 10                     │
│                                  │
│ [ Pause ]       [ Stop ]         │
└──────────────────────────────────┘
```

---

# 6. Agent Activity

A detailed action timeline allows users to understand what the agent did.

```text
┌──────────────────────────────────┐
│ Agent Activity                   │
├──────────────────────────────────┤
│                                  │
│ ✓ OBSERVE                        │
│   Page analyzed                  │
│                                  │
│ ✓ PRIVACY                        │
│   4 regions protected            │
│                                  │
│ ✓ CLICK                          │
│   "Flights"                      │
│                                  │
│ ✓ TYPE                           │
│   "Delhi"                        │
│                                  │
│ ● CLICK                          │
│   "Search"                       │
│                                  │
└──────────────────────────────────┘
```

This provides transparency into agent actions.

---

# 🔄 Complete User Journey

```text
┌──────────────────────┐
│ 1. INSTALL PS171     │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 2. PRIVACY SETUP     │
│ Choose what to mask  │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 3. AI SETUP          │
│ Provider + Model     │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 4. BROWSE WEB        │
│ Open any website     │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 5. OPEN EXTENSION    │
│ Privacy status shown  │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 6. ENTER GOAL        │
│ "Book a flight..."   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 7. START AGENT       │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 8. PRIVACY ENGINE    │
│ DOM + YOLO async     │
│ Sanitize page        │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 9. AI REASONS        │
│ Safe context only    │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 10. AGENT USES TOOLS │
│ Click • Type • Scroll │
│ Drag • Select         │
└──────────┬───────────┘
           ▼
       ┌───────────┐
       │ VERIFIED? │
       └─────┬─────┘
             │
      NO ────┴──── YES
      │              │
      ▼              ▼
   OBSERVE       COMPLETE
      │              │
      └──── LOOP     ▼
                ┌─────────────┐
                │ 11. RESULT  │
                │ Show user   │
                └─────────────┘
```

---

# 🛠️ Technology Stack

## Extension

| Technology | Purpose |
|---|---|
| WXT | Browser extension framework |
| TypeScript | Application language |
| Chrome Extension APIs | Browser integration |
| Content Scripts | DOM + page interaction |
| Background Service Worker | Agent coordination |
| Extension Storage | Local configuration/state |

## On-Device AI

| Technology | Purpose |
|---|---|
| ONNX | Portable model format |
| ONNX Runtime Web | Browser inference |
| WebGPU | Hardware acceleration |
| WASM | Fallback inference |
| YOLO-family model | Visual detection |

## Backend

| Technology | Purpose |
|---|---|
| Bun | Runtime |
| TypeScript | Backend language |
| Express / Hono | API |
| LLM / VLM | Reasoning and planning |

The backend should remain lightweight during the initial prototype.

---

# 📁 Project Structure

## 📁 Folder Structure

```text
ps171/
│
├── entrypoints/
│   │
│   ├── content.ts
│   │
│   ├── background.ts
│   │
│   └── popup/
│       ├── index.html
│       ├── main.ts
│       │
│       └── components/
│           ├── Welcome.ts
│           ├── AIConfiguration.ts
│           ├── PrivacyShield.ts
│           ├── AgentInput.ts
│           ├── AgentRunning.ts
│           └── AgentActivity.ts
│
├── vision/
│   ├── yolo.onnx
│   ├── detector.ts
│   ├── screenshot.ts
│   └── types.ts
│
├── dom/
│   ├── scanner.ts
│   ├── extractor.ts
│   └── bbox.ts
│
├── privacy/
│   ├── piiDetector.ts
│   ├── sanitizer.ts
│   └── blur.ts
│
├── agent/
│   ├── controller.ts
│   ├── planner.ts
│   ├── verifier.ts
│   └── types.ts
│
├── executor/
│   ├── executor.ts
│   ├── click.ts
│   ├── type.ts
│   ├── scroll.ts
│   └── select.ts
│
├── api/
│   ├── client.ts
│   └── types.ts
│
├── public/
│   └── icons/
│
├── assets/
│
├── wxt.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Directory Responsibilities

| Directory                       | Responsibility                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `entrypoints/`                  | WXT extension entrypoints                                                                                  |
| `entrypoints/content.ts`        | Runs on webpages; coordinates DOM analysis, visual perception, privacy processing, and browser interaction |
| `entrypoints/background.ts`     | Handles extension-level background tasks and communication                                                 |
| `entrypoints/popup/`            | Extension popup UI                                                                                         |
| `entrypoints/popup/components/` | Popup screens and UI components                                                                            |
| `vision/`                       | Local visual perception using YOLO + ONNX Runtime Web                                                      |
| `dom/`                          | DOM scanning, element extraction, and bounding-box calculation                                             |
| `privacy/`                      | Detects sensitive information and locally blurs sensitive regions                                          |
| `agent/`                        | Agent control loop, planning, verification, and agent state                                                |
| `executor/`                     | Executes structured browser actions such as click, type, scroll, and select                                |
| `api/`                          | Communication between the extension and backend AI services                                                |
| `public/`                       | Static extension assets such as icons                                                                      |
| `assets/`                       | Project assets used by the extension                                                                       |

````

### Core flow

```text
Web Page
    │
    ▼
content.ts
    │
    ├── DOM Analysis
    │
    ├── Screenshot
    │
    ├── YOLO Vision
    │
    ▼
Privacy Engine
    │
    └── Blur Sensitive Regions
    │
    ▼
Sanitized Context
    │
    ▼
API / AI Backend
    │
    ▼
Agent Plan
    │
    ▼
executor/
    │
    ├── Click
    ├── Type
    ├── Scroll
    └── Select
    │
    ▼
Web Page
    │
    ▼
Verification
    │
    └── Continue / Retry / Complete
````


---

# 🧩 Development Phases

The system will be built incrementally.

## Phase 1 — Extension Foundation

```text
WXT
 ↓
TypeScript
 ↓
Popup
 ↓
Content Script
 ↓
Background Worker
```

Build:

- WXT project
- Extension UI
- Content script
- Background service worker
- Message passing
- Local storage

### Goal

A functioning PS171 browser extension.

---

# Phase 2 — Privacy Setup & UI

Build:

```text
Welcome
   ↓
Privacy Setup
   ↓
AI Configuration
   ↓
Dashboard
```

Implement the initial user experience.

### Goal

A user can install PS171 and configure privacy + AI settings.

---

# Phase 3 — DOM Perception

Build:

```text
DOM
 ↓
Scanner
 ↓
Interactive Elements
 ↓
Bounding Boxes
 ↓
Semantic Representation
```

Detect:

- Buttons
- Inputs
- Links
- Forms
- Password fields
- Labels

### Goal

PS171 understands webpage structure.

---

# Phase 4 — Local Vision

Integrate:

```text
Screenshot
    ↓
ONNX Runtime Web
    ↓
YOLO
    ↓
Visual Detections
```

Implement:

- Model loading
- Model caching
- Preprocessing
- Inference
- Postprocessing
- Bounding boxes
- Confidence scores

### Goal

PS171 can understand visual browser state locally.

---

# Phase 5 — Hybrid Perception

Combine:

```text
        DOM
         +
       Vision
         ↓
      Fusion
         ↓
 Unified Screen State
```

Implement:

- Bounding-box matching
- IoU
- Duplicate removal
- Confidence handling
- Semantic enrichment

### Goal

Create a unified representation of the webpage.

---

# Phase 6 — Privacy Engine

Implement local detection:

```text
DOM
 │
 ├── Password
 ├── Email
 ├── Phone
 └── Sensitive Inputs

Vision
 │
 ├── Faces
 ├── Documents
 └── Sensitive Visual Regions

Rules
 │
 ├── API Keys
 ├── Credit Cards
 └── Other PII
```

### Goal

Generate a list of sensitive regions before anything is sent to the server.

---

# Phase 7 — Sanitization

Implement:

```text
Sensitive Regions
       ↓
Privacy Policy
       ↓
Redaction
       ↓
Sanitized Context
```

Support:

```text
Blur
Mask
Remove
Replace
```

### Goal

Guarantee that cloud AI receives only sanitized context.

---

# Phase 8 — AI Configuration & Reasoning

Support:

```text
OpenAI
Gemini
Local Model (Future)
```

Pipeline:

```text
User Goal
    ↓
Sanitized Browser Context
    ↓
AI
    ↓
Structured Action
```

Example:

```json
{
  "action": "click",
  "target": {
    "type": "text",
    "value": "Search Flights"
  }
}
```

---

# Phase 9 — Browser Tool Executor

Implement:

```text
click
type
scroll
select
drag
keypress
```

The executor validates actions before performing them.

```text
AI Action
   ↓
Validate
   ↓
Resolve Target
   ↓
Execute
```

### Goal

Allow the AI to safely interact with websites.

---

# Phase 10 — Agent Loop & Verification

Connect the complete system:

```text
OBSERVE
   ↓
PERCEIVE
   ↓
PROTECT
   ↓
REASON
   ↓
ACT
   ↓
VERIFY
   │
   ├── Failed → OBSERVE
   │
   └── Success → RESULT
```

Implement:

- Maximum step limit
- Pause
- Stop
- Action history
- Verification
- Failure recovery
- Agent activity UI

### Goal

Create the complete browser agent.

---

# 🧪 Example End-to-End Flow

User enters:

> **Find the cheapest flight from Delhi to Mumbai next Friday.**

PS171 performs:

```text
1. OBSERVE
      ↓
2. Capture screenshot + DOM
      ↓
3. Local YOLO inference
      ↓
4. DOM analysis
      ↓
5. Detection fusion
      ↓
6. Detect sensitive information
      ↓
7. Sanitize screenshot/context
      ↓
8. Send SAFE context to AI
      ↓
9. AI generates action
      ↓
10. Local executor performs action
      ↓
11. Observe new state
      ↓
12. Verify action
      ↓
13. Repeat if required
      ↓
14. Show result
```

---

# 🔐 Security Rules

PS171 follows several important security rules.

### Rule 1 — Raw screenshots stay local

```text
RAW SCREEN
     ↓
LOCAL PROCESSING
     ↓
SANITIZED SCREEN
     ↓
NETWORK
```

### Rule 2 — API keys never enter webpage context

Credentials are handled by the extension's trusted environment.

### Rule 3 — AI cannot execute arbitrary JavaScript

The AI can only request predefined actions:

```text
click
type
scroll
select
drag
keypress
```

### Rule 4 — Every action is validated

```text
AI
 ↓
Action Validator
 ↓
Target Resolver
 ↓
Executor
```

### Rule 5 — Agent execution has limits

```text
Maximum steps
Timeout
Pause
Stop
Verification
```

---

# 🚀 Current Development Priority

The implementation order is intentionally:

```text
                    PS171
                      │
        ┌─────────────┴─────────────┐
        │                           │
     PRIVACY                    AGENT
        │                           │
        ▼                           ▼
      DOM                        Goal
        │                           │
      Vision                     Reason
        │                           │
      Fusion                     Action
        │                           │
   Sanitization                  Execute
        │                           │
        └─────────────┬─────────────┘
                      ▼
                Complete Agent
```

The first priority is **not** building a sophisticated agent.

The first priority is establishing the **trusted local perception + privacy pipeline**.

Once that works reliably, the agent layer can be added on top.

---

# 📌 Project Structure Philosophy

The repository intentionally separates:

```text
UI
 │
 ├── pages/
 └── components/

PERCEPTION
 │
 ├── vision/
 ├── dom/
 └── fusion/

PRIVACY
 │
 ├── detectors/
 ├── policy/
 └── redaction/

AGENT
 │
 ├── controller/
 ├── planner/
 └── verifier/

EXECUTION
 │
 └── executor/

NETWORK
 │
 └── AI API
```

This separation makes it possible to independently improve:

- Vision models
- Privacy detection
- DOM perception
- Agent reasoning
- Browser execution
- UI

without rewriting the entire system.

---

# 🌟 Vision

PS171 aims to demonstrate a new approach to browser agents:

```text
                 TRADITIONAL AGENT

Browser ───────────────→ Cloud AI
          RAW DATA


                 PS171

Browser
   │
   ├── Local Vision
   ├── DOM Perception
   ├── Privacy Detection
   └── Sanitization
          │
          ▼
     SAFE CONTEXT
          │
          ▼
       Cloud AI
          │
          ▼
    Structured Action
          │
          ▼
      Local Browser
```

### **See locally. Protect locally. Reason intelligently. Act locally.**

---

# 📜 License

License information will be added as the project is finalized.