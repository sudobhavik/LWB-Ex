import os
import sys
import time
import json
import base64
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import uvicorn

from demo_website.app import app as site_app
from agent_runner import AutonomousPrivacyBrowserAgent
from privacy_shield import YOLOPrivacyShield

app = FastAPI(title="ISRO PS171 Privacy Agent & VLM Live Demo")

# Enable CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount demo website directly on /site
app.mount("/site", site_app)

# Single-threaded executor: Guarantees all Playwright calls run on the EXACT same thread
agent_executor = ThreadPoolExecutor(max_workers=1)

# Global shield & agent state
SHIELD = YOLOPrivacyShield()
AGENT = None
CURRENT_HISTORY = []
LAST_STEP_DATA = None

DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISRO PS171 — Visual Privacy Shield & Autonomous VLM Agent</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d30;
      --border: #23304d;
      --primary: #38bdf8;
      --accent: #2563eb;
      --text: #f8fafc;
      --sub: #94a3b8;
      --success: #10b981;
      --danger: #ef4444;
      --amber: #f59e0b;
      --purple: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    
    header { background: #0f172a; border-bottom: 1px solid var(--border); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
    .brand-title { font-size: 17px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--text); }
    .brand-title span { color: var(--primary); }
    .badges { display: flex; gap: 10px; align-items: center; }
    .pill { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; }
    .pill-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .pill-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }

    .main-layout { display: grid; grid-template-columns: 380px 1fr; flex: 1; overflow: hidden; }

    /* Left Control Sidebar */
    .sidebar { background: #0d1322; border-right: 1px solid var(--border); padding: 18px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
    .side-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .side-title { font-size: 12px; font-weight: 700; color: var(--sub); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    
    .quick-btn { width: 100%; text-align: left; background: #0b1120; border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .quick-btn:hover { border-color: var(--primary); background: rgba(56, 189, 248, 0.08); }

    .chat-box { width: 100%; height: 75px; background: #0b1120; border: 1px solid var(--border); border-radius: 6px; padding: 10px; color: #fff; font-size: 13px; resize: none; margin-bottom: 10px; }
    .chat-box:focus { outline: none; border-color: var(--primary); }

    .btn-run { width: 100%; background: linear-gradient(135deg, #0284c7, #2563eb); color: #fff; border: none; padding: 12px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: filter 0.15s; }
    .btn-run:hover { filter: brightness(1.15); }
    .btn-run:disabled { opacity: 0.5; cursor: not-allowed; }

    .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
    .btn-action { background: #1e293b; border: 1px solid var(--border); color: var(--text); padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-action:hover { background: #334155; }

    .step-log { font-family: monospace; font-size: 11px; background: #070a12; border: 1px solid var(--border); border-radius: 6px; padding: 10px; height: 180px; overflow-y: auto; color: #38bdf8; }

    /* Right Split Screen Content */
    .content-area { display: flex; flex-direction: column; overflow-y: auto; padding: 18px; gap: 16px; }
    
    .metrics-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .m-card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; }
    .m-icon { font-size: 24px; }
    .m-val { font-size: 20px; font-weight: 800; font-family: monospace; }
    .m-lbl { font-size: 11px; color: var(--sub); }

    .viewers-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .viewer-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
    .viewer-head { background: #0e1626; border-bottom: 1px solid var(--border); padding: 8px 14px; font-size: 12px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
    .viewer-body { height: 350px; background: #000; display: flex; align-items: center; justify-content: center; position: relative; }
    .viewer-body img { max-width: 100%; max-height: 100%; object-fit: contain; }

    /* Bottom Gemini Reasoning Card */
    .gemini-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
    .gemini-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .thought-bubble { background: rgba(56, 189, 248, 0.08); border-left: 3px solid var(--primary); padding: 10px 14px; font-size: 13px; line-height: 1.5; color: #e2e8f0; border-radius: 0 6px 6px 0; margin-bottom: 10px; }
    .action-pill-box { display: flex; gap: 12px; font-size: 12px; }
    .act-tag { background: #0b1120; border: 1px solid var(--border); padding: 4px 10px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <header>
    <div class="brand-title">
      [SHIELD] <span>ISRO PS171</span> &nbsp;|&nbsp; Autonomous Visual Privacy Shield & Cloud VLM
    </div>
    <div class="badges">
      <div class="pill pill-green">● On-Device YOLO26 Shield Active</div>
      <div class="pill pill-blue"> Gemini 2.5 Flash Lite Multimodal</div>
    </div>
  </header>

  <div class="main-layout">
    <!-- Left Sidebar -->
    <div class="sidebar">
      <div class="side-card">
        <div class="side-title">[FAST] Quick Judge Demos</div>
        <button class="quick-btn" onclick="setGoal('Buy the Aegis 4K Drone, proceed to checkout, and complete the order.')">
           Buy Drone & Checkout Flow
        </button>
        <button class="quick-btn" onclick="setGoal('Navigate to the user profile and check security settings.')">
           User Profile & Face Shield
        </button>
        <button class="quick-btn" onclick="setGoal('Navigate to the business dashboard and inspect treasury.')">
          [STATS] Treasury & Financial Balances
        </button>
      </div>

      <div class="side-card">
        <div class="side-title">[TARGET] User Instruction / Query</div>
        <textarea id="txt-goal" class="chat-box">Buy the Aegis 4K Drone, proceed to checkout, and complete the order.</textarea>
        <button id="btn-run-loop" class="btn-run" onclick="runAutonomousLoop()">
          ▶ Run Autonomous Privacy Loop
        </button>
        <div class="action-row">
          <button class="btn-action" onclick="stepOnce()"> Single Step</button>
          <button class="btn-action" onclick="resetDemo()"> Reset Page</button>
        </div>
      </div>

      <div class="side-card" style="flex: 1; display: flex; flex-direction: column;">
        <div class="side-title">
          <span> Real-Time Agent Log</span>
          <span id="step-counter" style="color: var(--primary);">Step: 0</span>
        </div>
        <div id="step-log" class="step-log">
[System] Privacy Agent ready.
[Security] Zero-Egress enabled. No unredacted screens leave this host.
        </div>
      </div>
    </div>

    <!-- Right Content Area -->
    <div class="content-area">
      <!-- Top Metrics Bar -->
      <div class="metrics-bar">
        <div class="m-card">
          <div class="m-icon"></div>
          <div>
            <div id="stat-face" class="m-val" style="color: var(--success);">0</div>
            <div class="m-lbl">Faces Shielded</div>
          </div>
        </div>
        <div class="m-card">
          <div class="m-icon">[SECURE]</div>
          <div>
            <div id="stat-pwd" class="m-val" style="color: var(--danger);">0</div>
            <div class="m-lbl">Passwords Concealed</div>
          </div>
        </div>
        <div class="m-card">
          <div class="m-icon"></div>
          <div>
            <div id="stat-pii" class="m-val" style="color: var(--amber);">0</div>
            <div class="m-lbl">Cards & PII Redacted</div>
          </div>
        </div>
        <div class="m-card">
          <div class="m-icon">[SHIELD]</div>
          <div>
            <div id="stat-text" class="m-val" style="color: var(--purple);">0</div>
            <div class="m-lbl">Confidential Balances</div>
          </div>
        </div>
      </div>

      <!-- Split-Screen Viewers -->
      <div class="viewers-grid">
        <div class="viewer-card">
          <div class="viewer-head">
            <span> Feed 1: Raw Browser Screen (Local Host View)</span>
            <span style="color: var(--sub); font-size: 10px;">Unredacted Client View</span>
          </div>
          <div class="viewer-body">
            <img id="img-raw" src="/site/static/profile_user.jpg" alt="Raw Screen">
          </div>
        </div>

        <div class="viewer-card" style="border-color: rgba(56, 189, 248, 0.4);">
          <div class="viewer-head" style="background: rgba(56, 189, 248, 0.1);">
            <span style="color: var(--primary);">[SHIELD] Feed 2: On-Device Redacted Stream (Sent to Gemini Cloud)</span>
            <span style="background: #059669; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 9px;">100% Zero-Egress</span>
          </div>
          <div class="viewer-body">
            <img id="img-redacted" src="/site/static/profile_user.jpg" alt="Redacted Screen">
          </div>
        </div>
      </div>

      <!-- Gemini Reasoning Section -->
      <div class="gemini-card">
        <div class="gemini-head">
          <div style="font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span> Gemini VLM Visual Perception & Action Decision</span>
          </div>
          <div id="latency-tag" style="font-size: 11px; color: var(--primary); font-family: monospace;">Latency: -- ms</div>
        </div>

        <div id="gemini-thought" class="thought-bubble">
          Waiting for agent instruction. Click "Run Autonomous Privacy Loop" or "Single Step" to start.
        </div>

        <div class="action-pill-box">
          <div class="act-tag">Target: <strong id="act-target" style="color: var(--primary);">None</strong></div>
          <div class="act-tag">Action: <strong id="act-type" style="color: var(--success);">None</strong></div>
          <div class="act-tag">Coordinates: <strong id="act-coords" style="color: var(--amber);">[0, 0]</strong></div>
          <div class="act-tag">Task Status: <strong id="act-status" style="color: #fff;">Idle</strong></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let isRunning = false;
    let stepNumber = 0;

    function logMessage(msg) {
      const el = document.getElementById("step-log");
      el.innerHTML += "<br>> " + msg;
      el.scrollTop = el.scrollHeight;
    }

    function setGoal(g) {
      document.getElementById("txt-goal").value = g;
    }

    async function stepOnce() {
      const goal = document.getElementById("txt-goal").value;
      stepNumber++;
      document.getElementById("step-counter").textContent = "Step: " + stepNumber;
      logMessage("Running Step " + stepNumber + "...");

      try {
        const resp = await fetch("/api/step", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({ goal: goal })
        });
        const data = await resp.json();

        if (data.error) {
          logMessage("[Error] " + data.error);
          return false;
        }

        // Update Images
        if (data.raw_screenshot) document.getElementById("img-raw").src = data.raw_screenshot;
        if (data.redacted_screenshot) document.getElementById("img-redacted").src = data.redacted_screenshot;

        // Update Stats
        document.getElementById("stat-face").textContent = data.privacy_stats?.face || 0;
        document.getElementById("stat-pwd").textContent = data.privacy_stats?.password_field || 0;
        document.getElementById("stat-pii").textContent = data.privacy_stats?.pii_field || 0;
        document.getElementById("stat-text").textContent = data.privacy_stats?.sensitive_text || 0;

        // Update Gemini Output
        const vlm = data.vlm_decision || {};
        document.getElementById("gemini-thought").textContent = vlm.thought || "No thought reported.";
        document.getElementById("latency-tag").textContent = "Latency: " + (data.vlm_latency_ms || 0) + " ms (" + (vlm.active_model || 'VLM') + ")";
        document.getElementById("act-target").textContent = vlm.target_description || "N/A";
        document.getElementById("act-type").textContent = (vlm.action || "None").toUpperCase();
        document.getElementById("act-coords").textContent = JSON.stringify(vlm.coordinates || []);
        document.getElementById("act-status").textContent = data.is_complete ? "COMPLETED " : "In Progress...";

        logMessage("Action: [" + (vlm.action || "") + "] -> " + (vlm.target_description || ""));
        if (data.is_complete) {
          logMessage(" GOAL ACHIEVED! Task successfully completed.");
          return true;
        }
        return false;
      } catch (err) {
        logMessage("[Network Error]: " + err.message);
        return true;
      }
    }

    async function runAutonomousLoop() {
      if (isRunning) return;
      isRunning = true;
      const btn = document.getElementById("btn-run-loop");
      btn.disabled = true;
      btn.textContent = " Agent Loop Executing...";

      let maxSteps = 8;
      for (let s = 0; s < maxSteps; s++) {
        const done = await stepOnce();
        if (done) break;
        await new Promise(r => setTimeout(r, 2500));
      }

      btn.disabled = false;
      btn.textContent = "▶ Run Autonomous Privacy Loop";
      isRunning = false;
    }

    async function resetDemo() {
      stepNumber = 0;
      document.getElementById("step-counter").textContent = "Step: 0";
      logMessage("Resetting browser to storefront...");
      await fetch("/api/reset", { method: "POST" });
    }

    // Ready state
    window.addEventListener("load", () => {
      logMessage("Demo dashboard ready. Click 'Run Autonomous Privacy Loop' or 'Single Step' to begin.");
    });
  </script>
</body>
</html>
"""

class StepRequest(BaseModel):
    goal: str

class ExtensionStepRequest(BaseModel):
    image: str  # Base64 data URL
    goal: str
    url: str = ""
    interactive_buttons: list = []
    dom_anchors: list = []
    history: list = []

class ExtensionRedactRequest(BaseModel):
    image: str  # Base64 raw screenshot
    interactive_buttons: list = []
    dom_anchors: list = []

class ExtensionVlmRequest(BaseModel):
    redacted_image: str  # Base64 already-redacted screenshot
    goal: str
    url: str = ""
    history: list = []
    provider: str = "auto"
    model: str = ""

def _sync_step(goal: str):
    global AGENT, CURRENT_HISTORY, LAST_STEP_DATA
    if AGENT is None:
        AGENT = AutonomousPrivacyBrowserAgent(target_url="http://127.0.0.1:8080/site/", headless=True)
    step_data = AGENT.run_step(goal, CURRENT_HISTORY)
    CURRENT_HISTORY.append({
        "action": step_data["vlm_decision"].get("action"),
        "target": step_data["vlm_decision"].get("target_description"),
        "url": step_data["current_url"]
    })
    LAST_STEP_DATA = step_data
    return step_data

def _sync_reset():
    global AGENT, CURRENT_HISTORY
    if AGENT:
        AGENT.stop_browser()
        AGENT = None
    CURRENT_HISTORY = []
    return {"status": "reset"}

@app.get("/", response_class=HTMLResponse)
def index():
    return HTMLResponse(DASHBOARD_HTML)

@app.post("/api/step")
async def run_agent_step(req: StepRequest):
    loop = asyncio.get_running_loop()
    try:
        step_data = await loop.run_in_executor(agent_executor, _sync_step, req.goal)
        return step_data
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/reset")
async def reset_agent():
    loop = asyncio.get_running_loop()
    try:
        return await loop.run_in_executor(agent_executor, _sync_reset)
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/redact")
def handle_redact(req: ExtensionRedactRequest):
    """
    Decoupled Fast On-Device Redaction (< 35ms):
    Runs YOLO26 on-device, blurs all sensitive PII/passwords/faces/balances,
    and returns immediately so the UI & webpage can be blurred in real-time.
    """
    t0 = time.time()
    try:
        b64_data = req.image
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        image_bgr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)

        redacted_bgr, detections = SHIELD.redact(
            image_bgr,
            interactive_buttons=req.interactive_buttons,
            dom_anchors=req.dom_anchors
        )

        stats = {"face": 0, "password_field": 0, "pii_field": 0, "sensitive_text": 0}
        for d in detections:
            c = d["class_name"]
            if c in stats:
                stats[c] += 1

        _, buf = cv2.imencode(".jpg", redacted_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        redacted_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"
        redact_latency_ms = int((time.time() - t0) * 1000)

        return {
            "success": True,
            "redacted_screenshot": redacted_b64,
            "detections": detections,
            "privacy_stats": stats,
            "redact_latency_ms": redact_latency_ms
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/vlm-act")
def handle_vlm_act(req: ExtensionVlmRequest):
    """
    Decoupled Cloud VLM Decision:
    Transmits ONLY the ALREADY-REDACTED screenshot to Gemini Cloud VLM.
    Zero unredacted visual data leaves this device.
    """
    t0 = time.time()
    try:
        b64_data = req.redacted_image
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        redacted_bgr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)

        temp_agent = AutonomousPrivacyBrowserAgent(provider=req.provider)
        temp_agent.page = type("MockPage", (), {"url": req.url or ""})()

        vlm_decision = temp_agent.ask_vlm(redacted_bgr, req.goal, req.history, provider=req.provider)
        vlm_latency_ms = int((time.time() - t0) * 1000)

        is_complete = vlm_decision.get("is_task_complete", False)
        if "success" in (req.url or "").lower():
            is_complete = True
            vlm_decision["is_task_complete"] = True

        return {
            "success": True,
            "vlm_decision": vlm_decision,
            "vlm_latency_ms": vlm_latency_ms,
            "is_complete": is_complete
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/extension-step")
def handle_extension_step(req: ExtensionStepRequest):
    """
    Direct endpoint for the Chrome Extension:
    1. Redacts sensitive elements on-device via YOLO26 (Zero-Egress).
    2. Sends blurred image to Gemini Cloud VLM.
    3. Returns action decision to extension to click on active browser tab.
    """
    try:
        b64_data = req.image
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        image_bgr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)

        redacted_bgr, detections = SHIELD.redact(
            image_bgr,
            interactive_buttons=req.interactive_buttons,
            dom_anchors=req.dom_anchors
        )

        stats = {"face": 0, "password_field": 0, "pii_field": 0, "sensitive_text": 0}
        for d in detections:
            c = d["class_name"]
            if c in stats:
                stats[c] += 1

        temp_agent = AutonomousPrivacyBrowserAgent()
        temp_agent.page = type("MockPage", (), {"url": req.url or "http://127.0.0.1:8080/site/"})()

        start_vlm = time.time()
        vlm_decision = temp_agent.ask_gemini(redacted_bgr, req.goal, req.history)
        vlm_latency_ms = int((time.time() - start_vlm) * 1000)

        is_complete = vlm_decision.get("is_task_complete", False)
        if "success" in (req.url or "").lower():
            is_complete = True
            vlm_decision["is_task_complete"] = True

        _, buf = cv2.imencode(".jpg", redacted_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        redacted_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

        return {
            "success": True,
            "redacted_screenshot": redacted_b64,
            "detections": detections,
            "privacy_stats": stats,
            "vlm_decision": vlm_decision,
            "vlm_latency_ms": vlm_latency_ms,
            "is_complete": is_complete
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("[RUN] Starting ISRO PS171 Privacy Agent & VLM Live Demo Server on http://127.0.0.1:8080...")
    uvicorn.run("dashboard_server:app", host="0.0.0.0", port=8080, log_level="warning")
