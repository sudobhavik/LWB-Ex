/**
 * YOLO Privacy Agent - Side Panel Controller
 * Handles WebGPU YOLO inference, Zero-Egress Canvas Redaction,
 * and Autonomous Vision-Language Agent Loop (OpenAI & Gemini).
 */

const browserAPI = (() => {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime) {
    return globalThis.browser;
  }
  if (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime) {
    return globalThis.chrome;
  }
  return {};
})();

// DOM Elements - Global & Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const providerBadge = document.getElementById('provider-badge');
const agentStatusBadge = document.getElementById('agent-status-badge');
const statusText = document.getElementById('status-text');

// DOM Elements - Agent Loop
const agentGoalInput = document.getElementById('agent-goal');
const selectProvider = document.getElementById('select-provider');
const maxStepsInput = document.getElementById('max-steps');
const btnStepAgent = document.getElementById('btn-step-agent');
const stepBtnText = document.getElementById('step-btn-text');
const stepSpinner = document.getElementById('step-spinner');
const btnStartAgent = document.getElementById('btn-start-agent');
const btnStopAgent = document.getElementById('btn-stop-agent');
const btnResetAgent = document.getElementById('btn-reset-agent');
const agentSpinner = document.getElementById('agent-spinner');
const agentStepCounter = document.getElementById('agent-step-counter');
const agentThought = document.getElementById('agent-thought');
const agentActionTaken = document.getElementById('agent-action-taken');
const agentActiveVLM = document.getElementById('agent-active-vlm');
const agentRedactedCount = document.getElementById('agent-redacted-count');
const agentAnchorsCount = document.getElementById('agent-anchors-count');
const sanitizedPreviewCanvas = document.getElementById('sanitized-preview-canvas');

// DOM Elements - Settings
const inputOpenAIKey = document.getElementById('input-openai-key');
const inputGeminiKey = document.getElementById('input-gemini-key');
const btnSaveKeys = document.getElementById('btn-save-keys');
const settingsStatus = document.getElementById('settings-status');

// DOM Elements - Manual Scanner
const btnDetect = document.getElementById('btn-detect');
const btnClear = document.getElementById('btn-clear');
const actionSpinner = document.getElementById('action-spinner');
const metricLatency = document.getElementById('metric-latency');
const metricTotal = document.getElementById('metric-total');
const countFace = document.getElementById('count-face');
const countInput = document.getElementById('count-input');
const countText = document.getElementById('count-text');
const previewSection = document.getElementById('preview-section');
const previewCanvas = document.getElementById('preview-canvas');
const confidenceSlider = document.getElementById('confidence-slider');
const thresholdVal = document.getElementById('threshold-val');
const modeRadios = document.querySelectorAll('input[name="overlay-mode"]');

// State
let runner = null;
let vlmRouter = null;
let isAgentRunning = false;
let isStepExecuting = false;
let currentAgentStep = 1;
let agentHistory = [];
let currentMode = 'outline';
let confidenceThreshold = 0.25;
let lastDetections = [];

// Tab Navigation
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = document.getElementById(btn.getAttribute('data-tab'));
    if (target) target.classList.add('active');
  });
});

// Load Saved API Keys
async function loadSavedKeys() {
  try {
    if (browserAPI.storage && browserAPI.storage.local) {
      const stored = await browserAPI.storage.local.get(['openaiKey', 'geminiKey', 'preferredProvider']);
      if (stored.openaiKey) inputOpenAIKey.value = stored.openaiKey;
      if (stored.geminiKey) inputGeminiKey.value = stored.geminiKey;
      if (stored.preferredProvider) selectProvider.value = stored.preferredProvider;

      vlmRouter = new (window.VLMRouter || globalThis.VLMRouter)({
        openaiKey: stored.openaiKey || '',
        geminiKey: stored.geminiKey || ''
      });
    } else {
      vlmRouter = new (window.VLMRouter || globalThis.VLMRouter)();
    }
  } catch (err) {
    console.warn('Could not load storage keys:', err);
    vlmRouter = new (window.VLMRouter || globalThis.VLMRouter)();
  }
}

// Save API Keys
btnSaveKeys.addEventListener('click', async () => {
  const oKey = inputOpenAIKey.value.trim();
  const gKey = inputGeminiKey.value.trim();
  const prov = selectProvider.value;

  if (vlmRouter) {
    vlmRouter.setKeys(oKey, gKey);
  }

  if (browserAPI.storage && browserAPI.storage.local) {
    await browserAPI.storage.local.set({
      openaiKey: oKey,
      geminiKey: gKey,
      preferredProvider: prov
    });
  }

  settingsStatus.textContent = 'API keys saved securely in local extension storage.';
  settingsStatus.style.color = '#007600';
  setTimeout(() => { settingsStatus.textContent = ''; }, 3000);
});

// Initialize YOLO WebGPU Model
async function initializeModel() {
  try {
    statusText.textContent = 'Initializing ONNX WebGPU runtime...';
    providerBadge.className = 'badge badge-neutral';
    providerBadge.textContent = 'LOADING...';

    runner = new (window.YoloWebGPURunner || globalThis.YoloWebGPURunner)();
    const modelUrl = browserAPI.runtime.getURL('models/yolo26n.onnx');
    const wasmDir = browserAPI.runtime.getURL('lib/');

    const info = await runner.loadModel(modelUrl, wasmDir);

    if (info.activeProvider === 'webgpu') {
      providerBadge.className = 'badge badge-webgpu';
      providerBadge.textContent = 'WEBGPU';
      statusText.textContent = 'Engine ready. Running on WebGPU.';
    } else {
      providerBadge.className = 'badge badge-wasm';
      providerBadge.textContent = 'WASM (CPU)';
      statusText.textContent = 'Engine ready. Running on WASM fallback.';
    }
  } catch (err) {
    console.error('Failed to initialize model:', err);
    providerBadge.className = 'badge badge-wasm';
    providerBadge.textContent = 'ERROR';
    statusText.textContent = `Model init failed: ${err.message}`;
  }
}

// Active Tab Helper
async function getActiveTab() {
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length > 0 ? tabs[0] : null;
}

// Ensure Content Script is Injected
async function ensureContentScriptInjected(tabId) {
  try {
    const res = await browserAPI.tabs.sendMessage(tabId, { action: 'PING' });
    if (res && res.status === 'READY') return true;
  } catch (_) {
    try {
      if (browserAPI.scripting && browserAPI.scripting.executeScript) {
        await browserAPI.scripting.insertCSS({
          target: { tabId },
          files: ['content/overlay.css']
        });
        await browserAPI.scripting.executeScript({
          target: { tabId },
          files: ['engine/pii_detector.js', 'engine/ocr_detector.js', 'content/content.js']
        });
        return true;
      }
    } catch (injectErr) {
      console.warn('Could not inject content script:', injectErr);
    }
  }
  return false;
}

// ==========================================================================
// AUTONOMOUS AGENT LOOP ENGINE
// ==========================================================================

function updateProviderConfig() {
  const val = selectProvider.value;
  if (!vlmRouter) return;

  if (val === 'auto') {
    vlmRouter.preferredProvider = 'auto';
    vlmRouter.openaiModel = 'gpt-4o';
    vlmRouter.geminiModel = 'gemini-2.0-flash';
  } else if (val === 'openai-gpt4o') {
    vlmRouter.preferredProvider = 'openai';
    vlmRouter.openaiModel = 'gpt-4o';
  } else if (val === 'openai-gpt4o-mini') {
    vlmRouter.preferredProvider = 'openai';
    vlmRouter.openaiModel = 'gpt-4o-mini';
  } else if (val === 'gemini-2.0-flash') {
    vlmRouter.preferredProvider = 'gemini';
    vlmRouter.geminiModel = 'gemini-2.0-flash';
  } else if (val === 'gemini-1.5-flash') {
    vlmRouter.preferredProvider = 'gemini';
    vlmRouter.geminiModel = 'gemini-1.5-flash';
  }
}

// 4-Phase Stepper Visualizer
function setStepperPhase(phaseNum) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`phase-${i}`);
    if (!el) continue;
    if (i < phaseNum) {
      el.className = 'stepper-phase phase-done';
    } else if (i === phaseNum) {
      el.className = 'stepper-phase phase-active';
    } else {
      el.className = 'stepper-phase';
    }
  }
}

function clearStepperPhases() {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById(`phase-${i}`);
    if (el) el.className = 'stepper-phase';
  }
}

function validateProviderKeys() {
  updateProviderConfig();
  if (!vlmRouter) {
    statusText.textContent = 'VLM Router is not initialized.';
    return false;
  }
  if (vlmRouter.preferredProvider === 'openai' && !vlmRouter.openaiKey) {
    statusText.textContent = 'Please configure your OpenAI API Key under API Settings.';
    return false;
  }
  if (vlmRouter.preferredProvider === 'gemini' && !vlmRouter.geminiKey) {
    statusText.textContent = 'Please configure your Gemini API Key under API Settings.';
    return false;
  }
  if (vlmRouter.preferredProvider === 'auto' && !vlmRouter.openaiKey && !vlmRouter.geminiKey) {
    statusText.textContent = 'Please configure at least one API Key (OpenAI or Gemini) in API Settings.';
    return false;
  }
  return true;
}

// Single Agent Step Execution Pipeline
async function executeSingleAgentStep(goal, step, maxSteps) {
  agentStepCounter.textContent = `STEP ${step} / ${maxSteps}`;

  // Phase 1: Viewport Capture
  setStepperPhase(1);
  statusText.textContent = `Step #${step} [Phase 1/4]: Capturing viewport...`;

  const activeTab = await getActiveTab();
  if (!activeTab || !activeTab.id) {
    throw new Error('No active browser tab detected.');
  }

  await ensureContentScriptInjected(activeTab.id);

  const dataUrl = await browserAPI.tabs.captureVisibleTab(null, { format: 'png' });
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });

  // Phase 2: Shield PII & Face Detection
  setStepperPhase(2);
  statusText.textContent = `Step #${step} [Phase 2/4]: Scanning & blurring sensitive PII and faces...`;

  let pageState = { anchors: [], piiRegions: [] };
  try {
    pageState = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_STATE' });
  } catch (err) {
    console.warn('Could not retrieve page state:', err);
  }

  const anchors = pageState?.anchors || [];
  let piiRegions = pageState?.piiRegions || [];
  agentAnchorsCount.textContent = anchors.length;

  let faceRegions = [];
  if (runner && runner.isReady) {
    const yoloResult = await runner.detect(img, { confidenceThreshold: 0.35 });
    const processor = window.YoloProcessor || globalThis.YoloProcessor;
    const rawFaces = yoloResult.detections.filter(d => d.className === 'face');
    faceRegions = processor && processor.filterFaces
      ? processor.filterFaces(rawFaces, yoloResult.letterboxCanvas || img)
      : rawFaces;

    // Visual OCR Failover: If DOM text is unavailable (e.g. Flutter Web, HTML5 Canvas, WebGL, iframes)
    // or if YOLO detected visual text blocks, run OCRDetector on the screenshot
    const textBlocks = (yoloResult.detections || []).filter(d => d.className === 'text_block');
    if (textBlocks.length > 0 || piiRegions.length === 0) {
      try {
        const ocrClass = window.OCRDetector || globalThis.OCRDetector;
        if (ocrClass) {
          const ocr = new ocrClass();
          const visualPII = await ocr.scanImageForPII(img, textBlocks);
          if (visualPII && visualPII.length > 0) {
            piiRegions = [...piiRegions, ...visualPII];
          }
        }
      } catch (ocrErr) {
        console.warn('Visual OCR failover warning:', ocrErr);
      }
    }
  }

  // Zero-Egress On-Device Sanitization (Blur Faces + PII)
  const sanitized = (window.CanvasRedactor || globalThis.CanvasRedactor).sanitizeScreenshot(
    img,
    faceRegions,
    piiRegions
  );

  agentRedactedCount.textContent = `${sanitized.totalRedacted} items`;

  // Render sanitized preview to side panel canvas
  const ctx = sanitizedPreviewCanvas.getContext('2d');
  sanitizedPreviewCanvas.width = sanitized.canvas.width;
  sanitizedPreviewCanvas.height = sanitized.canvas.height;
  ctx.drawImage(sanitized.canvas, 0, 0);

  // Apply live blur overlays directly on main screen
  const liveOverlays = [
    ...faceRegions.map(f => ({ ...f, className: 'FACE' })),
    ...piiRegions.map(p => ({ ...p, className: p.type || 'PII' }))
  ];
  try {
    await browserAPI.tabs.sendMessage(activeTab.id, {
      action: 'APPLY_DETECTIONS',
      detections: liveOverlays,
      mode: 'redact'
    });
  } catch (e) {
    console.warn('Could not apply live blur overlays:', e);
  }

  // Phase 3: VLM Reason
  setStepperPhase(3);
  statusText.textContent = `Step #${step} [Phase 3/4]: Querying VLM (${vlmRouter.preferredProvider})...`;

  const { decision, providerUsed } = await vlmRouter.decide(
    goal,
    sanitized.dataUrl,
    anchors,
    step,
    agentHistory
  );

  agentActiveVLM.textContent = providerUsed;
  agentThought.textContent = decision.thought;

  if (decision.action === 'finish') {
    setStepperPhase(5); // All phases completed
    agentActionTaken.textContent = `[FINISH] Goal completed: ${decision.thought}`;
    statusText.textContent = `Agent successfully completed goal in ${step} steps!`;
    return { finished: true, decision };
  }

  // Phase 4: Grounded Execution on Page
  setStepperPhase(4);
  statusText.textContent = `Step #${step} [Phase 4/4]: Executing grounded action on page...`;
  agentActionTaken.textContent = `[${decision.action.toUpperCase()}] Target #${decision.target_index ?? 'coords'} ${decision.text ? `("${decision.text}")` : ''}`;

  await browserAPI.tabs.sendMessage(activeTab.id, {
    action: 'EXECUTE_ACTION',
    agentAction: decision.action,
    targetIndex: decision.target_index,
    coordinates: decision.coordinates,
    text: decision.text
  });

  agentHistory.push({
    action: decision.action,
    thought: decision.thought,
    target: decision.target_index
  });

  // Settling delay for DOM updates and page navigation
  statusText.textContent = `Action executed. Settling DOM...`;
  await new Promise(r => setTimeout(r, 650));

  return { finished: false, decision };
}

// Step-by-Step Interactive Execution (for Demos & Presentations)
async function runSingleStep() {
  if (isAgentRunning || isStepExecuting) return;

  const goal = agentGoalInput.value.trim();
  if (!goal) {
    statusText.textContent = 'Please enter a goal prompt.';
    return;
  }

  if (!validateProviderKeys()) return;

  const maxSteps = parseInt(maxStepsInput.value, 10) || 10;
  if (currentAgentStep > maxSteps) {
    statusText.textContent = `Max steps (${maxSteps}) reached. Click RESET to start a new run.`;
    return;
  }

  isStepExecuting = true;
  btnStepAgent.disabled = true;
  btnStartAgent.disabled = true;
  btnStopAgent.disabled = false;
  stepSpinner.style.display = 'inline-block';
  agentStatusBadge.className = 'badge badge-running';
  agentStatusBadge.textContent = `STEP ${currentAgentStep}`;

  try {
    const result = await executeSingleAgentStep(goal, currentAgentStep, maxSteps);

    if (result.finished) {
      agentStatusBadge.className = 'badge badge-neutral';
      agentStatusBadge.textContent = 'COMPLETED';
      stepBtnText.textContent = 'COMPLETED ✔';
      btnStepAgent.disabled = true;
      btnStartAgent.disabled = true;
      btnStopAgent.disabled = true;
    } else {
      currentAgentStep++;
      if (currentAgentStep > maxSteps) {
        agentStatusBadge.className = 'badge badge-neutral';
        agentStatusBadge.textContent = 'MAX REACHED';
        stepBtnText.textContent = 'MAX REACHED';
        statusText.textContent = `Reached maximum steps (${maxSteps}). Click RESET to restart.`;
        btnStepAgent.disabled = true;
        btnStartAgent.disabled = true;
        btnStopAgent.disabled = true;
      } else {
        agentStatusBadge.className = 'badge badge-neutral';
        agentStatusBadge.textContent = 'PAUSED';
        stepBtnText.textContent = `STEP ${currentAgentStep}: EXECUTE ▶`;
        statusText.textContent = `Step #${currentAgentStep - 1} complete. Paused for demo inspection. Click STEP ${currentAgentStep} to proceed.`;
        btnStepAgent.disabled = false;
        btnStartAgent.disabled = false;
        btnStopAgent.disabled = true;
      }
    }
  } catch (err) {
    console.error('Step execution error:', err);
    agentThought.textContent = `Step Error: ${err.message}`;
    agentStatusBadge.className = 'badge badge-error';
    agentStatusBadge.textContent = 'ERROR';
    statusText.textContent = `Error: ${err.message}`;
    btnStepAgent.disabled = false;
    btnStartAgent.disabled = false;
    btnStopAgent.disabled = true;
  } finally {
    isStepExecuting = false;
    stepSpinner.style.display = 'none';
  }
}

// Continuous Execution Loop
async function runContinuousLoop() {
  if (isAgentRunning || isStepExecuting) return;

  const goal = agentGoalInput.value.trim();
  if (!goal) {
    statusText.textContent = 'Please enter a goal prompt.';
    return;
  }

  if (!validateProviderKeys()) return;

  const maxSteps = parseInt(maxStepsInput.value, 10) || 10;
  if (currentAgentStep > maxSteps) {
    statusText.textContent = `Max steps (${maxSteps}) reached. Click RESET to start a new run.`;
    return;
  }

  isAgentRunning = true;
  btnStartAgent.disabled = true;
  btnStepAgent.disabled = true;
  btnStopAgent.disabled = false;
  agentSpinner.style.display = 'inline-block';
  agentStatusBadge.className = 'badge badge-running';
  agentStatusBadge.textContent = 'RUNNING';

  try {
    while (isAgentRunning && currentAgentStep <= maxSteps) {
      stepBtnText.textContent = `STEP ${currentAgentStep}: RUNNING`;
      const result = await executeSingleAgentStep(goal, currentAgentStep, maxSteps);

      if (result.finished) {
        agentStatusBadge.className = 'badge badge-neutral';
        agentStatusBadge.textContent = 'COMPLETED';
        stepBtnText.textContent = 'COMPLETED ✔';
        break;
      }

      currentAgentStep++;
      if (currentAgentStep <= maxSteps) {
        stepBtnText.textContent = `STEP ${currentAgentStep}: EXECUTE ▶`;
      }
    }

    if (currentAgentStep > maxSteps && isAgentRunning) {
      statusText.textContent = `Agent reached maximum step limit (${maxSteps}).`;
      agentStatusBadge.className = 'badge badge-neutral';
      agentStatusBadge.textContent = 'MAX REACHED';
      stepBtnText.textContent = 'MAX REACHED';
    }
  } catch (err) {
    console.error('Agent loop encountered error:', err);
    agentThought.textContent = `Loop Error: ${err.message}`;
    agentStatusBadge.className = 'badge badge-error';
    agentStatusBadge.textContent = 'ERROR';
    statusText.textContent = `Error: ${err.message}`;
  } finally {
    isAgentRunning = false;
    btnStartAgent.disabled = false;
    btnStepAgent.disabled = currentAgentStep > maxSteps;
    btnStopAgent.disabled = true;
    agentSpinner.style.display = 'none';
    if (agentStatusBadge.textContent === 'RUNNING') {
      agentStatusBadge.className = 'badge badge-neutral';
      agentStatusBadge.textContent = 'PAUSED';
    }
  }
}

// Reset Entire Agent Demo State
async function resetAgentDemo() {
  isAgentRunning = false;
  isStepExecuting = false;
  currentAgentStep = 1;
  agentHistory = [];

  const maxSteps = parseInt(maxStepsInput.value, 10) || 10;
  agentStepCounter.textContent = `STEP 0 / ${maxSteps}`;
  stepBtnText.textContent = 'STEP 1: EXECUTE ▶';
  agentThought.textContent = 'Ready. Enter a goal prompt and click Step 1 or Run All.';
  agentActionTaken.textContent = 'None';
  agentActiveVLM.textContent = '--';
  agentRedactedCount.textContent = '0 items';
  agentAnchorsCount.textContent = '0';
  agentStatusBadge.className = 'badge badge-neutral';
  agentStatusBadge.textContent = 'IDLE';

  btnStartAgent.disabled = false;
  btnStepAgent.disabled = false;
  btnStopAgent.disabled = true;
  agentSpinner.style.display = 'none';
  stepSpinner.style.display = 'none';

  clearStepperPhases();

  // Clear sanitized preview canvas
  const ctx = sanitizedPreviewCanvas.getContext('2d');
  ctx.clearRect(0, 0, sanitizedPreviewCanvas.width, sanitizedPreviewCanvas.height);

  // Clear live blur overlays on active tab
  try {
    const activeTab = await getActiveTab();
    if (activeTab && activeTab.id) {
      await browserAPI.tabs.sendMessage(activeTab.id, { action: 'CLEAR_DETECTIONS' });
    }
  } catch (_) {}

  statusText.textContent = 'Demo reset. Ready for step 1.';
}

btnStepAgent.addEventListener('click', runSingleStep);
btnStartAgent.addEventListener('click', runContinuousLoop);
btnStopAgent.addEventListener('click', () => {
  isAgentRunning = false;
  isStepExecuting = false;
  btnStopAgent.disabled = true;
  btnStartAgent.disabled = false;
  btnStepAgent.disabled = false;
  agentSpinner.style.display = 'none';
  stepSpinner.style.display = 'none';
  agentStatusBadge.className = 'badge badge-neutral';
  agentStatusBadge.textContent = 'PAUSED';
  statusText.textContent = `Execution paused at step ${currentAgentStep}.`;
});
btnResetAgent.addEventListener('click', resetAgentDemo);

// ==========================================================================
// MANUAL SCANNER CONTROLLER (PART 1)
// ==========================================================================

function drawPreviewWithBoxes(letterboxCanvas, detections, letterboxInfo) {
  previewSection.style.display = 'block';
  previewCanvas.width = 640;
  previewCanvas.height = 640;
  const ctx = previewCanvas.getContext('2d');
  ctx.drawImage(letterboxCanvas, 0, 0);

  const { scale, padX, padY } = letterboxInfo;
  detections.forEach(det => {
    const bx = det.x * scale + padX;
    const by = det.y * scale + padY;
    const bw = det.width * scale;
    const bh = det.height * scale;

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1A1A1A';
    ctx.strokeRect(bx, by, bw, bh);

    const tag = `[${det.className.toUpperCase()}] ${(det.score * 100).toFixed(0)}%`;
    ctx.font = 'bold 10px monospace';
    const textWidth = ctx.measureText(tag).width;

    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(bx, Math.max(0, by - 14), textWidth + 6, 14);

    ctx.fillStyle = '#F7F7F5';
    ctx.fillText(tag, bx + 3, Math.max(10, by - 3));
  });
}

function updateResultsUI(detections, latencyMs) {
  metricLatency.textContent = `${latencyMs} ms`;
  metricTotal.textContent = detections.length;

  let faces = 0, inputs = 0, texts = 0;
  detections.forEach(d => {
    if (d.className === 'face') faces++;
    else if (d.className === 'input_field') inputs++;
    else if (d.className === 'text_block') texts++;
  });

  countFace.textContent = faces;
  countInput.textContent = inputs;
  countText.textContent = texts;
}

btnDetect.addEventListener('click', async () => {
  if (!runner || !runner.isReady) return;
  const activeTab = await getActiveTab();
  if (!activeTab) return;

  btnDetect.disabled = true;
  actionSpinner.style.display = 'inline-block';

  try {
    const dataUrl = await browserAPI.tabs.captureVisibleTab(null, { format: 'png' });
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });

    const result = await runner.detect(img, { confidenceThreshold });
    const processor = window.YoloProcessor || globalThis.YoloProcessor;
    if (processor && processor.filterDetections) {
      result.detections = processor.filterDetections(result.detections, result.letterboxCanvas || img);
    }
    lastDetections = result.detections;

    drawPreviewWithBoxes(result.letterboxCanvas, result.detections, result.letterboxInfo);
    updateResultsUI(result.detections, result.latencyMs);

    await ensureContentScriptInjected(activeTab.id);
    let liveDetections = result.detections;
    if (currentMode === 'redact') {
      let pageState = { piiRegions: [] };
      try {
        pageState = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_STATE' });
      } catch (_) {}
      const piiDets = (pageState?.piiRegions || []).map(p => ({ ...p, className: p.type || 'PII' }));
      const validFaces = result.detections.filter(d => d.className === 'face');
      const sensitiveInputs = result.detections.filter(d => d.className === 'input_field' && d.score >= 0.5);
      liveDetections = [...validFaces, ...sensitiveInputs, ...piiDets];
    }
    await browserAPI.tabs.sendMessage(activeTab.id, {
      action: 'APPLY_DETECTIONS',
      detections: liveDetections,
      mode: currentMode
    });
  } catch (err) {
    console.error('Scan error:', err);
  } finally {
    btnDetect.disabled = false;
    actionSpinner.style.display = 'none';
  }
});

btnClear.addEventListener('click', async () => {
  const activeTab = await getActiveTab();
  if (activeTab && activeTab.id) {
    try {
      await browserAPI.tabs.sendMessage(activeTab.id, { action: 'CLEAR_DETECTIONS' });
    } catch (_) {}
  }
  lastDetections = [];
  metricLatency.textContent = '-- ms';
  metricTotal.textContent = '0';
  countFace.textContent = '0';
  countInput.textContent = '0';
  countText.textContent = '0';
  previewSection.style.display = 'none';
});

confidenceSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  thresholdVal.textContent = `${val}%`;
  confidenceThreshold = val / 100.0;
});

modeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentMode = e.target.value;
  });
});

// Boot
loadSavedKeys();
initializeModel();

// Firefox Right-Panel Tip Banner Initialization
const isFirefox = typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent);
const tipBanner = document.getElementById('firefox-tip-banner');
const btnCloseTip = document.getElementById('btn-close-tip');

if (isFirefox && tipBanner) {
  let dismissed = false;
  try {
    dismissed = !!localStorage.getItem('dismissed_firefox_dock_tip');
  } catch (_) {}
  if (!dismissed) {
    tipBanner.style.display = 'flex';
  }
}

if (btnCloseTip && tipBanner) {
  btnCloseTip.addEventListener('click', () => {
    tipBanner.style.display = 'none';
    try {
      localStorage.setItem('dismissed_firefox_dock_tip', '1');
    } catch (_) {}
  });
}
