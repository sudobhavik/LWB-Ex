/**
 * GUPTCHARA - Zero-Egress Privacy Agent
 * Side Panel Chat Controller (Claude Desktop Inspired Interface)
 * Handles WebGPU YOLO inference, Presidio on-device DLP,
 * and conversational Vision-Language Agent Loop (OpenAI & Gemini).
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

// DOM Elements - Header & Status
const providerBadge = document.getElementById('provider-badge');
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnResetChat = document.getElementById('btn-reset-chat');
const footerStatusText = document.getElementById('footer-status-text');

// DOM Elements - Chat Feed
const chatStream = document.getElementById('chat-stream');
const chatWelcome = document.getElementById('chat-welcome');
const messagesList = document.getElementById('messages-list');
const promptChips = document.querySelectorAll('.prompt-chip');
const stepProgressIndicator = document.getElementById('step-progress-indicator');
const progressStatusText = document.getElementById('progress-status-text');

// DOM Elements - Execution Controls
const btnStepAgent = document.getElementById('btn-step-agent');
const stepBtnText = document.getElementById('step-btn-text');
const btnStartAgent = document.getElementById('btn-start-agent');
const btnStopAgent = document.getElementById('btn-stop-agent');
const btnResetAgent = document.getElementById('btn-reset-agent');
const selectProvider = document.getElementById('select-provider');
const maxStepsInput = document.getElementById('max-steps');

// DOM Elements - Chat Input
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');

// DOM Elements - Settings Modal
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const inputOpenAIKey = document.getElementById('input-openai-key');
const inputGeminiKey = document.getElementById('input-gemini-key');
const btnSaveKeys = document.getElementById('btn-save-keys');
const settingsStatus = document.getElementById('settings-status');

// Offscreen Sanitized Preview Canvas
const sanitizedPreviewCanvas = document.getElementById('sanitized-preview-canvas');

// State
let runner = null;
let vlmRouter = null;
let isAgentRunning = false;
let isStepExecuting = false;
let currentAgentStep = 1;
let currentGoal = '';
let agentHistory = [];

// ==========================================================================
// Settings Modal & API Keys
// ==========================================================================

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

btnOpenSettings.addEventListener('click', () => {
  settingsModal.style.display = 'flex';
});

btnCloseSettings.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.style.display = 'none';
  }
});

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

  settingsStatus.textContent = 'Settings saved securely in local storage.';
  settingsStatus.style.color = 'var(--emerald-text)';
  setTimeout(() => {
    settingsStatus.textContent = '';
    settingsModal.style.display = 'none';
  }, 1200);
});

// ==========================================================================
// YOLO WebGPU Model Initialization
// ==========================================================================

async function initializeModel() {
  try {
    footerStatusText.textContent = 'Initializing ONNX WebGPU runtime...';
    providerBadge.className = 'pill-badge pill-loading';
    providerBadge.textContent = 'INITIALIZING';

    runner = new (window.YoloWebGPURunner || globalThis.YoloWebGPURunner)();
    const modelUrl = browserAPI.runtime.getURL('models/yolo26n.onnx');
    const wasmDir = browserAPI.runtime.getURL('lib/');

    const info = await runner.loadModel(modelUrl, wasmDir);

    if (info.activeProvider === 'webgpu') {
      providerBadge.className = 'pill-badge pill-webgpu';
      providerBadge.textContent = 'WEBGPU ACTIVE';
      footerStatusText.textContent = 'Zero-Egress Active • WebGPU accelerated on-device vision';
    } else {
      providerBadge.className = 'pill-badge pill-wasm';
      providerBadge.textContent = 'WASM FALLBACK';
      footerStatusText.textContent = 'Zero-Egress Active • Running on WASM CPU';
    }
  } catch (err) {
    console.error('Failed to initialize model:', err);
    providerBadge.className = 'pill-badge pill-error';
    providerBadge.textContent = 'ENGINE ERROR';
    footerStatusText.textContent = `Model init notice: ${err.message}`;
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

function validateProviderKeys() {
  updateProviderConfig();
  if (!vlmRouter) {
    appendSystemMessage('VLM Router is not initialized.', true);
    return false;
  }
  if (vlmRouter.preferredProvider === 'openai' && !vlmRouter.openaiKey) {
    appendSystemMessage('Please configure your OpenAI API Key in Settings (⚙️ top right).', true);
    settingsModal.style.display = 'flex';
    return false;
  }
  if (vlmRouter.preferredProvider === 'gemini' && !vlmRouter.geminiKey) {
    appendSystemMessage('Please configure your Gemini API Key in Settings (⚙️ top right).', true);
    settingsModal.style.display = 'flex';
    return false;
  }
  if (vlmRouter.preferredProvider === 'auto' && !vlmRouter.openaiKey && !vlmRouter.geminiKey) {
    appendSystemMessage('Please configure at least one API Key (OpenAI or Gemini) in Settings.', true);
    settingsModal.style.display = 'flex';
    return false;
  }
  return true;
}

// ==========================================================================
// Chat UI Rendering Functions
// ==========================================================================

function scrollToBottom() {
  setTimeout(() => {
    chatStream.scrollTop = chatStream.scrollHeight;
  }, 30);
}

function showProgress(message) {
  progressStatusText.textContent = message;
  stepProgressIndicator.style.display = 'flex';
  scrollToBottom();
}

function hideProgress() {
  stepProgressIndicator.style.display = 'none';
}

function appendUserMessage(text) {
  chatWelcome.style.display = 'none';

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message-user';
  msgDiv.textContent = text;
  messagesList.appendChild(msgDiv);
  scrollToBottom();
}

function appendSystemMessage(text, isError = false) {
  chatWelcome.style.display = 'none';

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message-assistant';

  const content = document.createElement('div');
  content.className = 'assistant-content';
  content.style.color = isError ? 'var(--red-text)' : 'var(--text-secondary)';
  content.textContent = text;

  msgDiv.appendChild(content);
  messagesList.appendChild(msgDiv);
  scrollToBottom();
}

function appendAssistantStepMessage({
  step,
  maxSteps,
  thought,
  action,
  targetIndex,
  coordinates,
  text,
  providerUsed,
  sanitizedCanvas,
  faceCount,
  piiCount,
  piiTypes,
  totalRedacted,
  finished
}) {
  chatWelcome.style.display = 'none';

  const container = document.createElement('div');
  container.className = 'message-assistant';

  // Header: GUPTCHARA + Step tag
  const header = document.createElement('div');
  header.className = 'assistant-header';
  header.innerHTML = `
    <span class="assistant-avatar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
      </svg>
    </span>
    <span class="assistant-sender">GUPTCHARA</span>
    <span class="assistant-step-tag">Step ${step}/${maxSteps}</span>
  `;
  container.appendChild(header);

  // Body: VLM Thought
  const thoughtEl = document.createElement('div');
  thoughtEl.className = 'assistant-content';
  thoughtEl.textContent = thought;
  container.appendChild(thoughtEl);

  // Grounded Action Pill
  const actionPill = document.createElement('div');
  actionPill.className = 'action-card-pill';

  let actionDesc = '';
  if (finished) {
    actionDesc = 'Completed Goal ✔';
  } else if (action === 'click') {
    actionDesc = `Click Target #${targetIndex ?? 'coords'}`;
  } else if (action === 'type') {
    actionDesc = `Type "${text ?? ''}" into Target #${targetIndex ?? 'field'}`;
  } else if (action === 'scroll') {
    actionDesc = `Scroll ${text || 'down'}`;
  } else {
    actionDesc = `${action.toUpperCase()}`;
  }

  actionPill.innerHTML = `
    <div class="action-card-info">
      <span class="action-card-badge">${finished ? 'DONE' : action.toUpperCase()}</span>
      <span class="action-card-text">${actionDesc}</span>
    </div>
  `;
  container.appendChild(actionPill);

  // Zero-Egress Privacy Shield Card with Expandable Inspection Drawer
  const piiSummary = piiTypes.length > 0 ? ` (${piiTypes.join(', ')})` : '';
  const shieldCard = document.createElement('div');
  shieldCard.className = 'privacy-shield-card';

  const shieldId = `shield-${step}-${Date.now()}`;
  shieldCard.innerHTML = `
    <div class="shield-header">
      <div class="shield-summary">
        <span class="shield-summary-icon">🛡️</span>
        <span>Zero-Egress: ${totalRedacted} items blurred (${faceCount} Faces, ${piiCount} PII${piiSummary})</span>
      </div>
      <button class="btn-inspect-toggle" data-target="${shieldId}">Inspect Viewport ▼</button>
    </div>
    <div class="shield-details" id="${shieldId}">
      <div class="shield-preview-wrapper">
        <img src="${sanitizedCanvas.toDataURL('image/jpeg', 0.85)}" alt="Sanitized Viewport (Zero-Egress)" />
      </div>
      <div style="font-size: 10px; color: var(--emerald-text); text-align: center;">
        ✓ Client-Side Blurred &bull; Transmitted securely to ${providerUsed}
      </div>
    </div>
  `;

  // Attach toggle listener
  const toggleBtn = shieldCard.querySelector('.btn-inspect-toggle');
  const detailsEl = shieldCard.querySelector(`#${shieldId}`);
  toggleBtn.addEventListener('click', () => {
    const isOpen = detailsEl.classList.contains('open');
    if (isOpen) {
      detailsEl.classList.remove('open');
      toggleBtn.textContent = 'Inspect Viewport ▼';
    } else {
      detailsEl.classList.add('open');
      toggleBtn.textContent = 'Hide Viewport ▲';
      scrollToBottom();
    }
  });

  container.appendChild(shieldCard);
  messagesList.appendChild(container);
  scrollToBottom();
}

// ==========================================================================
// Single Agent Step Execution Pipeline
// ==========================================================================

async function executeSingleAgentStep(goal, step, maxSteps) {
  showProgress(`Step ${step}/${maxSteps}: Capturing viewport...`);

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

  showProgress(`Step ${step}/${maxSteps}: Scanning & shielding PII and faces on WebGPU...`);

  let pageState = { anchors: [], piiRegions: [] };
  try {
    pageState = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_STATE' });
  } catch (err) {
    console.warn('Could not retrieve page state:', err);
  }

  const anchors = pageState?.anchors || [];
  let piiRegions = pageState?.piiRegions || [];

  let faceRegions = [];
  if (runner && runner.isReady) {
    const yoloResult = await runner.detect(img, { confidenceThreshold: 0.35 });
    const processor = window.YoloProcessor || globalThis.YoloProcessor;
    const rawFaces = yoloResult.detections.filter(d => d.className === 'face');
    faceRegions = processor && processor.filterFaces
      ? processor.filterFaces(rawFaces, yoloResult.letterboxCanvas || img)
      : rawFaces;

    // Visual OCR Failover: If DOM text is unavailable (Canvas Vault, Flutter, WebGL)
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
        console.warn('Visual OCR failover notice:', ocrErr);
      }
    }
  }

  // Zero-Egress On-Device Sanitization (Blur Faces + PII)
  const sanitized = (window.CanvasRedactor || globalThis.CanvasRedactor).sanitizeScreenshot(
    img,
    faceRegions,
    piiRegions
  );

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

  // VLM Reasoning
  showProgress(`Step ${step}/${maxSteps}: Querying VLM (${vlmRouter.preferredProvider})...`);

  const { decision, providerUsed } = await vlmRouter.decide(
    goal,
    sanitized.dataUrl,
    anchors,
    step,
    agentHistory
  );

  // Extract detected PII types for inspection summary
  const piiTypes = Array.from(new Set(piiRegions.map(p => p.type || 'PII')));

  if (decision.action === 'finish') {
    hideProgress();
    appendAssistantStepMessage({
      step,
      maxSteps,
      thought: decision.thought,
      action: 'finish',
      targetIndex: null,
      coordinates: null,
      text: null,
      providerUsed,
      sanitizedCanvas: sanitized.canvas,
      faceCount: faceRegions.length,
      piiCount: piiRegions.length,
      piiTypes,
      totalRedacted: sanitized.totalRedacted,
      finished: true
    });
    footerStatusText.textContent = `Goal completed in ${step} steps! Zero data leaked.`;
    return { finished: true, decision };
  }

  // Grounded Execution on Page
  showProgress(`Step ${step}/${maxSteps}: Executing grounded action on page...`);

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

  hideProgress();

  appendAssistantStepMessage({
    step,
    maxSteps,
    thought: decision.thought,
    action: decision.action,
    targetIndex: decision.target_index,
    coordinates: decision.coordinates,
    text: decision.text,
    providerUsed,
    sanitizedCanvas: sanitized.canvas,
    faceCount: faceRegions.length,
    piiCount: piiRegions.length,
    piiTypes,
    totalRedacted: sanitized.totalRedacted,
    finished: false
  });

  // Settling delay for DOM updates and page navigation
  await new Promise(r => setTimeout(r, 650));

  return { finished: false, decision };
}

// ==========================================================================
// Execution Handlers: Single Step, Run All, Reset, Stop
// ==========================================================================

async function runSingleStep() {
  if (isAgentRunning || isStepExecuting) return;

  const inputVal = chatInput.value.trim();
  if (inputVal && !currentGoal) {
    currentGoal = inputVal;
    appendUserMessage(currentGoal);
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  const goal = currentGoal || inputVal;
  if (!goal) {
    appendSystemMessage('Please enter a goal or question first.');
    chatInput.focus();
    return;
  }

  if (!validateProviderKeys()) return;

  const maxSteps = parseInt(maxStepsInput.value, 10) || 10;
  if (currentAgentStep > maxSteps) {
    appendSystemMessage(`Maximum step limit (${maxSteps}) reached. Click Reset to start a new exploration.`);
    return;
  }

  isStepExecuting = true;
  btnStepAgent.disabled = true;
  btnStartAgent.disabled = true;
  btnStopAgent.disabled = false;
  stepBtnText.textContent = `Running...`;

  try {
    const result = await executeSingleAgentStep(goal, currentAgentStep, maxSteps);

    if (result.finished) {
      stepBtnText.textContent = 'Completed ✔';
      btnStepAgent.disabled = true;
      btnStartAgent.disabled = true;
      btnStopAgent.disabled = true;
    } else {
      currentAgentStep++;
      if (currentAgentStep > maxSteps) {
        stepBtnText.textContent = 'Max Reached';
        btnStepAgent.disabled = true;
        btnStartAgent.disabled = true;
        btnStopAgent.disabled = true;
        appendSystemMessage(`Reached step limit (${maxSteps}). Click Reset to continue.`);
      } else {
        stepBtnText.textContent = `Step ${currentAgentStep}`;
        btnStepAgent.disabled = false;
        btnStartAgent.disabled = false;
        btnStopAgent.disabled = true;
      }
    }
  } catch (err) {
    console.error('Step execution error:', err);
    hideProgress();
    appendSystemMessage(`Error: ${err.message}`, true);
    btnStepAgent.disabled = false;
    btnStartAgent.disabled = false;
    btnStopAgent.disabled = true;
    stepBtnText.textContent = `Step ${currentAgentStep}`;
  } finally {
    isStepExecuting = false;
  }
}

async function runContinuousLoop() {
  if (isAgentRunning || isStepExecuting) return;

  const inputVal = chatInput.value.trim();
  if (inputVal && !currentGoal) {
    currentGoal = inputVal;
    appendUserMessage(currentGoal);
    chatInput.value = '';
    chatInput.style.height = 'auto';
  }

  const goal = currentGoal || inputVal;
  if (!goal) {
    appendSystemMessage('Please enter a goal or question first.');
    chatInput.focus();
    return;
  }

  if (!validateProviderKeys()) return;

  const maxSteps = parseInt(maxStepsInput.value, 10) || 10;
  if (currentAgentStep > maxSteps) {
    appendSystemMessage(`Maximum step limit (${maxSteps}) reached. Click Reset to start a new exploration.`);
    return;
  }

  isAgentRunning = true;
  btnStartAgent.disabled = true;
  btnStepAgent.disabled = true;
  btnStopAgent.disabled = false;

  try {
    while (isAgentRunning && currentAgentStep <= maxSteps) {
      stepBtnText.textContent = `Step ${currentAgentStep}`;
      const result = await executeSingleAgentStep(goal, currentAgentStep, maxSteps);

      if (result.finished) {
        stepBtnText.textContent = 'Completed ✔';
        break;
      }

      currentAgentStep++;
    }

    if (currentAgentStep > maxSteps && isAgentRunning) {
      stepBtnText.textContent = 'Max Reached';
      appendSystemMessage(`Reached maximum step limit (${maxSteps}). Click Reset to continue.`);
    }
  } catch (err) {
    console.error('Loop error:', err);
    hideProgress();
    appendSystemMessage(`Loop Error: ${err.message}`, true);
  } finally {
    isAgentRunning = false;
    btnStartAgent.disabled = false;
    btnStepAgent.disabled = currentAgentStep > maxSteps;
    btnStopAgent.disabled = true;
    if (currentAgentStep <= maxSteps && stepBtnText.textContent !== 'Completed ✔') {
      stepBtnText.textContent = `Step ${currentAgentStep}`;
    }
  }
}

async function resetConversation() {
  isAgentRunning = false;
  isStepExecuting = false;
  currentAgentStep = 1;
  currentGoal = '';
  agentHistory = [];

  // Clear messages list and restore welcome state
  messagesList.innerHTML = '';
  chatWelcome.style.display = 'flex';
  hideProgress();

  stepBtnText.textContent = 'Step 1';
  btnStepAgent.disabled = false;
  btnStartAgent.disabled = false;
  btnStopAgent.disabled = true;

  // Clear live overlays on active tab
  try {
    const activeTab = await getActiveTab();
    if (activeTab && activeTab.id) {
      await browserAPI.tabs.sendMessage(activeTab.id, { action: 'CLEAR_DETECTIONS' });
    }
  } catch (_) {}

  footerStatusText.textContent = 'Conversation reset. Zero-Egress active.';
  chatInput.value = '';
  chatInput.style.height = 'auto';
}

function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  currentGoal = text;
  appendUserMessage(text);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Automatically start executing step 1
  runSingleStep();
}

// Event Listeners - Controls
btnStepAgent.addEventListener('click', runSingleStep);
btnStartAgent.addEventListener('click', runContinuousLoop);
btnStopAgent.addEventListener('click', () => {
  isAgentRunning = false;
  isStepExecuting = false;
  btnStopAgent.disabled = true;
  btnStartAgent.disabled = false;
  btnStepAgent.disabled = false;
  hideProgress();
  appendSystemMessage(`Agent paused at step ${currentAgentStep}. You can resume with "Step ${currentAgentStep}" or "Run All".`);
});
btnResetAgent.addEventListener('click', resetConversation);
btnResetChat.addEventListener('click', resetConversation);

// Event Listeners - Chat Input
btnSend.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Auto-expand textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// Prompt Chips
promptChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    if (prompt) {
      chatInput.value = prompt;
      handleSendMessage();
    }
  });
});

// Firefox Right-Panel Tip Banner
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

// Boot
loadSavedKeys();
initializeModel();
