// PS171 Autonomous Privacy Agent — 100% In-Extension Controller (Zero-Server Standalone)
const DEFAULT_GEMINI_KEY = "AQ.Ab8RN6Klgw2tX10HWouzLpd0DtyOnjYBahVHZ93eI1N86xua4w";
let activeGeminiKey = DEFAULT_GEMINI_KEY;
let activeApiKey = DEFAULT_GEMINI_KEY; // backward compatibility
let activeOpenAiKey = "";
let activeOpenAiModel = "gpt-4o-mini";
let activeProvider = "openai";

let isAgentRunning = false;
let stopRequested = false;
let stepCounter = 0;
let agentHistory = [];

function initPopup() {
  // Load saved credentials & settings from browser storage
  chrome.storage.local.get(["gemini_api_key", "openai_api_key", "vlm_provider", "openai_model"], (result) => {
    if (result.gemini_api_key) {
      activeGeminiKey = result.gemini_api_key;
      activeApiKey = result.gemini_api_key;
    }
    if (result.openai_api_key) {
      activeOpenAiKey = result.openai_api_key;
    }
    if (result.vlm_provider) {
      activeProvider = result.vlm_provider;
    } else if (activeOpenAiKey) {
      activeProvider = "openai";
    }
    if (result.openai_model) {
      activeOpenAiModel = result.openai_model;
    }

    const geminiInput = document.getElementById("gemini-api-key");
    if (geminiInput) geminiInput.value = activeGeminiKey;

    const openAiInput = document.getElementById("openai-api-key");
    if (openAiInput) openAiInput.value = activeOpenAiKey;

    const modelSelect = document.getElementById("openai-model-select");
    if (modelSelect) modelSelect.value = activeOpenAiModel;

    const providerRadio = document.querySelector(`input[name="vlmProvider"][value="${activeProvider}"]`);
    if (providerRadio) providerRadio.checked = true;
  });

  // Save OpenAI API Key
  const btnSaveOpenAiKey = document.getElementById("btn-save-openai-key");
  if (btnSaveOpenAiKey) {
    btnSaveOpenAiKey.addEventListener("click", () => {
      const val = document.getElementById("openai-api-key").value.trim();
      const model = document.getElementById("openai-model-select").value;
      if (val) {
        activeOpenAiKey = val;
        activeOpenAiModel = model;
        activeProvider = "openai";
        chrome.storage.local.set({ openai_api_key: val, openai_model: model, vlm_provider: "openai" });
        const providerRadio = document.querySelector(`input[name="vlmProvider"][value="openai"]`);
        if (providerRadio) providerRadio.checked = true;

        const status = document.getElementById("openai-key-status");
        if (status) {
          status.textContent = `[OK] OpenAI Key saved (${model} active)`;
          status.style.color = "#ffffff";
          setTimeout(() => {
            status.textContent = "Persisted in chrome.storage.local • 85 tokens/image (~$0.00001)";
            status.style.color = "#888888";
          }, 2500);
        }
        logAgent(`[CONFIG] OpenAI active model: ${model}`);
      }
    });
  }

  // Model select change listener
  const modelSelect = document.getElementById("openai-model-select");
  if (modelSelect) {
    modelSelect.addEventListener("change", (e) => {
      activeOpenAiModel = e.target.value;
      chrome.storage.local.set({ openai_model: e.target.value });
      logAgent(`[CONFIG] OpenAI model set to: ${e.target.value}`);
    });
  }

  // Provider Radio Switcher
  document.querySelectorAll('input[name="vlmProvider"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      activeProvider = e.target.value;
      chrome.storage.local.set({ vlm_provider: activeProvider });
      logAgent(`[PROVIDER] Active VLM switched to: ${activeProvider.toUpperCase()}`);
    });
  });

  // Save Gemini API Key
  const btnSaveKey = document.getElementById("btn-save-key");
  if (btnSaveKey) {
    btnSaveKey.addEventListener("click", () => {
      const val = document.getElementById("gemini-api-key").value.trim();
      if (val) {
        activeGeminiKey = val;
        activeApiKey = val;
        chrome.storage.local.set({ gemini_api_key: val });
        const status = document.getElementById("key-status");
        if (status) {
          status.textContent = "[OK] Key saved to browser storage";
          status.style.color = "#ffffff";
          setTimeout(() => {
            status.textContent = "Persisted in chrome.storage.local (Fallback)";
            status.style.color = "#888888";
          }, 2500);
        }
      }
    });
  }

  // Tab Switchers
  const tabAgentBtn = document.getElementById("tab-agent-btn");
  const tabShieldBtn = document.getElementById("tab-shield-btn");
  if (tabAgentBtn) tabAgentBtn.addEventListener("click", () => switchTab("agent"));
  if (tabShieldBtn) tabShieldBtn.addEventListener("click", () => switchTab("shield"));

  // Autonomous Agent Controls
  const btnRun = document.getElementById("btn-run-agent");
  const btnStep = document.getElementById("btn-step-agent");
  const btnStop = document.getElementById("btn-stop-agent");

  if (btnRun) btnRun.addEventListener("click", runAutonomousLoop);
  if (btnStep) btnStep.addEventListener("click", stepOnce);
  if (btnStop) btnStop.addEventListener("click", stopAgentLoop);

  // Tab 2 Actions (In-Page Shield)
  const btnScan = document.getElementById("btn-scan");
  const btnClear = document.getElementById("btn-clear");
  if (btnScan) btnScan.addEventListener("click", scanAndProtectTab);
  if (btnClear) btnClear.addEventListener("click", clearTabMasks);

  // Confidence Slider
  const confSlider = document.getElementById("conf-slider");
  if (confSlider) {
    confSlider.addEventListener("input", (e) => {
      document.getElementById("conf-val").textContent = `${e.target.value}%`;
    });
  }

  // Pre-initialize in-browser YOLO Web Worker
  if (window.yoloDetector) {
    window.yoloDetector.init().catch(e => console.warn("[PS171 Worker Init]:", e));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPopup);
} else {
  initPopup();
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  if (tab === "agent") {
    document.getElementById("tab-agent-btn").classList.add("active");
    document.getElementById("tab-agent").classList.add("active");
  } else {
    document.getElementById("tab-shield-btn").classList.add("active");
    document.getElementById("tab-shield").classList.add("active");
  }
}

function logAgent(msg) {
  const el = document.getElementById("agent-log");
  if (el) {
    el.innerHTML += `<br>> ${msg}`;
    el.scrollTop = el.scrollHeight;
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs.length > 0 && tabs[0].url && (tabs[0].url.startsWith("http://") || tabs[0].url.startsWith("https://"))) {
    return tabs[0];
  }
  const allTabs = await chrome.tabs.query({});
  const activeHttp = allTabs.find(t => t.active && t.url && (t.url.startsWith("http://") || t.url.startsWith("https://")));
  if (activeHttp) return activeHttp;

  for (const t of allTabs) {
    if (t.url && (t.url.startsWith("http://") || t.url.startsWith("https://"))) {
      return t;
    }
  }
  for (const t of allTabs) {
    if (t.url && !t.url.startsWith("chrome-extension://") && !t.url.startsWith("chrome://") && t.url !== "about:blank") {
      return t;
    }
  }
  if (tabs.length > 0) return tabs[0];
  throw new Error("No active web tab detected.");
}

async function askGeminiDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons = []) {
  const cleanB64 = redactedDataUrl.includes(",") ? redactedDataUrl.split(",", 2)[1] : redactedDataUrl;

  const buttonsSummary = (interactiveButtons || []).slice(0, 35).map(b => {
    const center = b.center_norm || [0.5, 0.5];
    return `- [Index ${b.idx}] "${b.text}" at coords [${center[0]}, ${center[1]}] (id: "${b.id || ''}")`;
  }).join("\n");

  const prompt = `You are an autonomous browser control agent operating under ISRO Problem Statement SIH26171.
The screenshot you see has been processed by an On-Device YOLO Privacy Shield.
Regions with heavy blur and tags like [REDACTED_FACE], [REDACTED_PASSWORD], [REDACTED_PII], or [REDACTED_SECRET]
are intentionally concealed user data (credit cards, passwords, phone numbers, faces, balances) to guarantee ZERO PRIVACY EGRESS.

Do NOT attempt to guess or unmask the blurred content.
Observe the visible UI layout, product listings, action buttons, navigation tabs, and inputs to achieve the user goal.

USER GOAL: "${goal}"
Current URL: ${currentUrl}
Recent actions taken: ${JSON.stringify(history.slice(-3))}

VISIBLE INTERACTIVE ACTION ELEMENTS DETECTED ON THIS SCREEN:
${buttonsSummary || "None detected"}

Decide the single next action to advance toward the goal.
SEARCH & FORMS RULE:
If the user wants to search for something (e.g. "search for headphones on Amazon"), target the search input box (marked with [INPUT]), use action "type", provide the search query in "text_to_type", and set "press_enter": true to automatically submit the search query.

If targeting one of the Visible Interactive Elements listed above, set "target_index" to that element's Index number (e.g. 1, 2, 3...) and use its coordinates.
If the goal is fully achieved (e.g. Order Success screen reached, or target page reached and reviewed), set "is_task_complete": true.

Return STRICT JSON adhering to this schema:
{
  "thought": "Analysis of current screen, matching button/input, and reason for next step",
  "action": "click" | "type" | "scroll" | "press_key" | "navigate" | "complete",
  "target_index": number or null,
  "coordinates": [x_norm, y_norm],
  "text_to_type": "string" (only if action is type),
  "press_enter": true | false (if action is type, whether to press Enter to submit search immediately),
  "scroll_direction": "down" | "up" (only if action is scroll),
  "key": "Enter" | "Tab" | "Escape" (only if action is press_key),
  "target_description": "short description of the button/input being interacted with",
  "is_task_complete": false
}
Note: "coordinates" are normalized floats between 0.0 and 1.0 representing [X, Y] center of the element to click.`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: cleanB64
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1
    }
  };

  const models = [
    "gemini-flash-latest",
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest"
  ];

  let lastError = null;
  const t0 = performance.now();

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeApiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7500);

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.status === 429 || resp.status === 503) {
        console.warn(`[Gemini] Model ${model} returned HTTP ${resp.status}, trying next model in pool...`);
        await new Promise(r => setTimeout(r, 600));
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${errText.slice(0, 120)}`);
      }

      const data = await resp.json();
      const candidate = data.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      let rawText = (part?.text || "{}").trim();
      if (rawText.startsWith("```")) {
        const firstLineEnd = rawText.indexOf("\n");
        if (firstLineEnd !== -1) {
          rawText = rawText.slice(firstLineEnd + 1);
        }
        if (rawText.endsWith("```")) {
          rawText = rawText.slice(0, -3);
        }
      }
      const decision = JSON.parse(rawText.trim());
      decision.active_model = model;

      const vlmLatencyMs = Math.round(performance.now() - t0);
      return { success: true, decision, latency_ms: vlmLatencyMs };
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = e;
      console.warn(`[Gemini Failover] Error with ${model}:`, e.message);
    }
  }

  throw new Error(lastError ? lastError.message : "All Gemini models failed");
}

async function askOpenAIDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons = []) {
  if (!activeOpenAiKey) {
    throw new Error("OpenAI API Key not configured. Please enter your API key (sk-...) in settings.");
  }

  const cleanB64 = redactedDataUrl.includes(",") ? redactedDataUrl.split(",", 2)[1] : redactedDataUrl;

  const buttonsSummary = (interactiveButtons || []).slice(0, 35).map(b => {
    const center = b.center_norm || [0.5, 0.5];
    return `- [Index ${b.idx}] "${b.text}" at coords [${center[0]}, ${center[1]}] (id: "${b.id || ''}")`;
  }).join("\n");

  const promptText = `USER GOAL: "${goal}"
Current URL: ${currentUrl}
Recent actions taken: ${JSON.stringify(history.slice(-3))}

VISIBLE INTERACTIVE ACTION ELEMENTS DETECTED ON THIS SCREEN:
${buttonsSummary || "None detected"}

Decide the single next action to advance toward the goal.
SEARCH & FORMS RULE:
If the user wants to search for something (e.g. "search for headphones on Amazon"), target the search input box (marked with [INPUT]), use action "type", provide the search query in "text_to_type", and set "press_enter": true to automatically submit the search query.

If targeting one of the Visible Interactive Elements listed above, set "target_index" to that element's Index number (e.g. 1, 2, 3...) and use its coordinates.
If the goal is fully achieved (e.g. Order Success screen reached, or target page reached and reviewed), set "is_task_complete": true.

Return STRICT JSON adhering to this schema:
{
  "thought": "Analysis of current screen, matching button/input, and reason for next step",
  "action": "click" | "type" | "scroll" | "press_key" | "navigate" | "complete",
  "target_index": number or null,
  "coordinates": [x_norm, y_norm],
  "text_to_type": "string" (only if action is type),
  "press_enter": true | false (if action is type, whether to press Enter to submit search immediately),
  "scroll_direction": "down" | "up" (only if action is scroll),
  "key": "Enter" | "Tab" | "Escape" (only if action is press_key),
  "target_description": "short description of the button/input being interacted with",
  "is_task_complete": false
}`;

  const payload = {
    model: activeOpenAiModel || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an autonomous browser control agent operating under ISRO Problem Statement SIH26171. The screenshot provided has been processed by an On-Device YOLO Privacy Shield. Regions with heavy blur and tags like [REDACTED_FACE], [REDACTED_PASSWORD], [REDACTED_PII], or [REDACTED_SECRET] are intentionally concealed sensitive data (credit cards, passwords, phone numbers, faces, balances) to guarantee ZERO PRIVACY EGRESS. Do not guess blurred content. Observe the visible layout, products, and interactive elements. Always respond in valid JSON matching the schema."
      },
      {
        role: "user",
        content: [
          { type: "text", text: promptText },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${cleanB64}`,
              detail: "low"
            }
          }
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500
  };

  const t0 = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${activeOpenAiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errText.slice(0, 150)}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let rawText = content.trim();
    if (rawText.startsWith("```")) {
      const firstLineEnd = rawText.indexOf("\n");
      if (firstLineEnd !== -1) rawText = rawText.slice(firstLineEnd + 1);
      if (rawText.endsWith("```")) rawText = rawText.slice(0, -3);
    }
    const decision = JSON.parse(rawText.trim());
    decision.active_model = `${payload.model} (OpenAI)`;

    const latencyMs = Math.round(performance.now() - t0);
    return { success: true, decision, latency_ms: latencyMs };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function askVlm(redactedDataUrl, goal, currentUrl, history, interactiveButtons = []) {
  if (activeProvider === "openai" && activeOpenAiKey) {
    try {
      return await askOpenAIDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons);
    } catch (err) {
      console.warn("[OpenAI failed, attempting Gemini failover]:", err);
      logAgent(`[VLM FAILOVER] OpenAI error: ${err.message}. Trying Gemini...`);
      return await askGeminiDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons);
    }
  } else if (activeProvider === "openai" && !activeOpenAiKey) {
    logAgent("[WARN] OpenAI selected but no key entered. Using Gemini fallback...");
    return await askGeminiDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons);
  } else {
    return await askGeminiDirect(redactedDataUrl, goal, currentUrl, history, interactiveButtons);
  }
}

async function stepOnce() {
  const goal = document.getElementById("agent-goal").value.trim();
  if (!goal) {
    alert("Please enter a goal or instruction.");
    return false;
  }

  stepCounter++;
  document.getElementById("log-step-counter").textContent = `STEP: ${stepCounter}`;
  document.getElementById("tag-status").textContent = "ANALYZING";
  logAgent(`Running Step ${stepCounter}...`);

  try {
    const tab = await getActiveTab();

    // Ensure tab has finished loading if arriving from a previous navigation
    try {
      const freshTab = await chrome.tabs.get(tab.id);
      if (freshTab.status === "loading") {
        logAgent("[NAV] Waiting for page load to finish...");
        await new Promise(res => {
          const timer = setTimeout(res, 4500);
          const l = (tid, info) => {
            if (tid === tab.id && info.status === "complete") {
              clearTimeout(timer);
              chrome.tabs.onUpdated.removeListener(l);
              res();
            }
          };
          chrome.tabs.onUpdated.addListener(l);
        });
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (_) {}

    // 1. Get DOM Metadata & Anchors (API keys, passwords, PII, balances, buttons)
    let metadata = { url: tab.url, interactive_buttons: [], dom_anchors: [] };
    try {
      metadata = await chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_METADATA" });
    } catch (e) {
      console.warn("Content script unreachable, attempting dynamic injection:", e);
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"]
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ["content/overlay.css"]
        });
        await new Promise(r => setTimeout(r, 250));
        metadata = await chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_METADATA" });
      } catch (injErr) {
        console.warn("Dynamic script injection failed:", injErr);
      }
    }

    await chrome.tabs.update(tab.id, { active: true });
    await new Promise(r => setTimeout(r, 250));

    // 2. Capture Active Tab Viewport Screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 80
    });

    if (!screenshotDataUrl) {
      throw new Error("Failed to capture tab. Make sure you are not on a restricted chrome:// page.");
    }

    // =========================================================================
    // STAGE 1: 100% IN-BROWSER ONNX PRIVACY SHIELD (Zero Python Server)
    // =========================================================================
    logAgent("[STAGE 1] Running In-Browser YOLO26-nano ONNX Shield...");
    const confVal = parseInt(document.getElementById("conf-slider")?.value || "25", 10) / 100.0;

    const redactData = await window.yoloDetector.redact(screenshotDataUrl, {
      confThreshold: confVal,
      interactiveButtons: metadata?.interactive_buttons || [],
      domAnchors: metadata?.dom_anchors || []
    });

    if (!redactData.success) {
      throw new Error("Client-side on-device redaction failed.");
    }

    // Update UI Preview & Counters immediately
    if (redactData.redacted_screenshot) {
      document.getElementById("agent-preview-img").src = redactData.redacted_screenshot;
    }
    const stats = redactData.privacy_stats || {};
    const totalShielded = (stats.face || 0) + (stats.password_field || 0) + (stats.pii_field || 0) + (stats.sensitive_text || 0);
    document.getElementById("badge-shield-count").textContent = `${totalShielded} SHIELDED`;
    document.getElementById("tag-status").textContent = "REDACTED";

    logAgent(`[SHIELD] Redacted ${totalShielded} sensitive items in ${redactData.redact_latency_ms}ms (Zero-Egress).`);

    // In-Page Real DOM Blurring
    await chrome.tabs.sendMessage(tab.id, {
      action: "APPLY_PRIVACY_MASKS",
      detections: redactData.detections || [],
      settings: { maskStyle: "blur" }
    });

    // Presentation buffer
    const providerLabel = (activeProvider === "openai" && activeOpenAiKey) ? `OpenAI (${activeOpenAiModel})` : "Google Gemini";
    logAgent(`[VLM] Forwarding redacted telemetry directly to ${providerLabel}...`);
    document.getElementById("vlm-thought").textContent = `Zero-egress confirmed. Sending blurred viewport to ${providerLabel}...`;
    document.getElementById("tag-status").textContent = "THINKING";
    await new Promise(r => setTimeout(r, 450));

    // =========================================================================
    // STAGE 2: DIRECT CLOUD VLM REASONING (Zero Unredacted Data Leaves Device)
    // =========================================================================
    const vlmData = await askVlm(
      redactData.redacted_screenshot,
      goal,
      metadata?.url || tab.url,
      agentHistory,
      metadata?.interactive_buttons || []
    );

    const vlm = vlmData.decision || {};
    document.getElementById("vlm-thought").textContent = vlm.thought || "No thought reported.";
    document.getElementById("vlm-latency-tag").textContent = `${vlmData.latency_ms || 0} MS (${vlm.active_model || "VLM"})`;
    document.getElementById("tag-target").textContent = (vlm.target_description || "N/A").toUpperCase();
    document.getElementById("tag-action").textContent = (vlm.action || "NONE").toUpperCase();

    let isComplete = vlm.is_task_complete || false;
    if ((metadata?.url || tab.url || "").includes("success")) {
      isComplete = true;
    }
    document.getElementById("tag-status").textContent = isComplete ? "COMPLETED" : "EXECUTING";

    logAgent(`[ACTION] [${(vlm.action || "").toUpperCase()}] -> ${vlm.target_description}`);

    // =========================================================================
    // STAGE 3: EXECUTE ACTION ON ACTIVE TAB (With 4-Tier Intelligent Snapping)
    // =========================================================================
    await chrome.tabs.sendMessage(tab.id, {
      action: "EXECUTE_AGENT_ACTION",
      data: {
        action: vlm.action,
        target_index: vlm.target_index,
        coordinates: vlm.coordinates,
        target_description: vlm.target_description,
        text_to_type: vlm.text_to_type,
        press_enter: vlm.press_enter !== undefined ? vlm.press_enter : true,
        scroll_direction: vlm.scroll_direction,
        key: vlm.key,
        navigate_url: vlm.navigate_url,
        select_value: vlm.select_value,
        select_text: vlm.select_text,
        is_task_complete: isComplete,
        detections: redactData.detections || []
      }
    });

    // Settle wait: allow time for browser to execute search submission, click, or navigation
    if (vlm.action === "type" || vlm.action === "click" || vlm.action === "navigate") {
      await new Promise(r => setTimeout(r, 1200));
    }

    agentHistory.push({
      action: vlm.action,
      target: vlm.target_description,
      url: metadata?.url || tab.url
    });

    if (isComplete) {
      logAgent("[COMPLETE] Task finished successfully.");
      document.getElementById("tag-status").textContent = "COMPLETED";
      return true;
    }

    return false;
  } catch (err) {
    logAgent(`[ERROR]: ${err.message}`);
    document.getElementById("tag-status").textContent = "ERROR";
    return true;
  }
}

async function runAutonomousLoop() {
  if (isAgentRunning) return;
  isAgentRunning = true;
  stopRequested = false;

  const btn = document.getElementById("btn-run-agent");
  const stopBtn = document.getElementById("btn-stop-agent");
  const btnText = document.getElementById("agent-btn-text");

  btn.disabled = true;
  btnText.textContent = "EXECUTING...";
  stopBtn.classList.remove("hidden");

  let maxSteps = 8;
  for (let s = 0; s < maxSteps; s++) {
    if (stopRequested) {
      logAgent("[HALT] Loop stopped by user.");
      break;
    }
    const done = await stepOnce();
    if (done) break;

    await new Promise(r => setTimeout(r, 2000));
  }

  btn.disabled = false;
  btnText.textContent = "RUN AUTONOMOUS LOOP";
  stopBtn.classList.add("hidden");
  isAgentRunning = false;
}

function stopAgentLoop() {
  stopRequested = true;
  logAgent("Stop requested. Halting after current step...");
}

// TAB 2: IN-PAGE PRIVACY SHIELD
async function scanAndProtectTab() {
  try {
    const tab = await getActiveTab();
    await chrome.tabs.update(tab.id, { active: true });
    await new Promise(r => setTimeout(r, 150));

    // Query DOM anchors & buttons
    let metadata = { url: tab.url, interactive_buttons: [], dom_anchors: [] };
    try {
      metadata = await chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_METADATA" });
    } catch (e) {
      console.warn("Could not query metadata:", e);
    }

    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 80 });
    if (!screenshot) throw new Error("Could not capture screenshot.");

    const confVal = parseInt(document.getElementById("conf-slider")?.value || "25", 10) / 100.0;

    // Direct In-Browser ONNX Redaction
    const data = await window.yoloDetector.redact(screenshot, {
      confThreshold: confVal,
      interactiveButtons: metadata?.interactive_buttons || [],
      domAnchors: metadata?.dom_anchors || []
    });

    if (data.success) {
      const stats = data.privacy_stats || {};
      document.getElementById("stat-face").textContent = stats.face || 0;
      document.getElementById("stat-pwd").textContent = stats.password_field || 0;
      document.getElementById("stat-pii").textContent = stats.pii_field || 0;
      document.getElementById("stat-text").textContent = stats.sensitive_text || 0;

      // Render masks directly onto the active webpage
      const maskStyle = document.querySelector('input[name="maskStyle"]:checked')?.value || "blur";
      await chrome.tabs.sendMessage(tab.id, {
        action: "APPLY_PRIVACY_MASKS",
        detections: data.detections || [],
        settings: { maskStyle: maskStyle }
      });
    } else {
      throw new Error("Client-side scanning failed");
    }
  } catch (err) {
    alert("Scan failed: " + err.message);
  }
}

async function clearTabMasks() {
  try {
    const tab = await getActiveTab();
    await chrome.tabs.sendMessage(tab.id, { action: "CLEAR_PRIVACY_MASKS" });
    document.getElementById("stat-face").textContent = "0";
    document.getElementById("stat-pwd").textContent = "0";
    document.getElementById("stat-pii").textContent = "0";
    document.getElementById("stat-text").textContent = "0";
  } catch (e) {
    console.warn("Error clearing masks:", e);
  }
}
