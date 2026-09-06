/**
 * YOLO Privacy Agent - Content Script
 * 1. Renders on-page monochromatic overlays (outlines or solid/backdrop blur masks).
 * 2. Displays live on-screen privacy HUD showing what things are blurred on the main screen.
 * 3. Extracts interactive anchors for VLM autonomous grounding.
 * 4. Scans DOM text for zero-egress PII detection.
 * 5. Executes grounded actions (clicks, typing, scrolling) with visual ripple feedback.
 */

(() => {
  const OVERLAY_CONTAINER_ID = 'yolo-agent-overlay-container';
  window.__AGENT_ANCHORS__ = {};

  function getOverlayContainer() {
    let container = document.getElementById(OVERLAY_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = OVERLAY_CONTAINER_ID;
      document.body.appendChild(container);
    }
    return container;
  }

  function clearOverlay() {
    const existing = document.getElementById(OVERLAY_CONTAINER_ID);
    if (existing) {
      existing.remove();
    }
  }

  function applyDetections(detections, mode = 'outline') {
    clearOverlay();
    const container = getOverlayContainer();
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // Add floating live screen status banner showing what is blurred
    if (mode === 'redact') {
      const pill = document.createElement('div');
      pill.id = 'yolo-live-privacy-pill';
      if (!detections || detections.length === 0) {
        pill.innerHTML = `<span>&#10003;</span> GUPTCHARA LIVE PRIVACY SHIELD: <strong>0 SENSITIVE ITEMS (PAGE SAFE)</strong>`;
        pill.style.borderColor = '#007600';
      } else {
        const categories = [...new Set(detections.map(d => (d.className || d.type || 'SENSITIVE').toUpperCase()))];
        const catList = categories.slice(0, 4).join(', ') + (categories.length > 4 ? ` +${categories.length - 4} more` : '');
        pill.innerHTML = `<span>&#128737;</span> GUPTCHARA LIVE PRIVACY SHIELD: <strong>${detections.length} SENSITIVE AREAS BLURRED</strong> <span class="pill-categories" style="opacity:0.85; font-size:11px; margin-left:4px; font-weight:600;">(${catList})</span>`;
        pill.style.borderColor = '#FF9900';
      }
      container.appendChild(pill);
    }

    if (!detections || detections.length === 0) return 0;

    detections.forEach((det, index) => {
      const box = document.createElement('div');
      box.className = `yolo-box yolo-box-${mode}`;
      box.id = `yolo-detection-${index}`;

      const left = det.x + scrollX;
      const top = det.y + scrollY;

      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${det.width}px`;
      box.style.height = `${det.height}px`;

      const badge = document.createElement('div');
      badge.className = 'yolo-badge';

      const rawTag = det.className || det.type || 'SENSITIVE';
      const tagText = rawTag.toUpperCase();
      if (mode === 'redact') {
        badge.textContent = `[BLURRED: ${tagText}]`;
      } else {
        const scorePercent = det.score ? Math.round(det.score * 100) : 100;
        badge.textContent = `[${tagText}] ${scorePercent}%`;
      }

      box.appendChild(badge);
      container.appendChild(box);
    });

    return detections.length;
  }

  /**
   * Enumerates all visible, interactive anchors on the page for VLM grounding.
   */
  function extractInteractiveAnchors() {
    window.__AGENT_ANCHORS__ = {};
    const selector = 'a, button, input, select, textarea, [role="button"], [tabindex="0"], [onclick]';
    const candidates = Array.from(document.querySelectorAll(selector));

    const viewportW = window.innerWidth || 1920;
    const viewportH = window.innerHeight || 1080;
    const anchors = [];
    let counter = 1;

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      if (rect.bottom < 0 || rect.top > viewportH || rect.right < 0 || rect.left > viewportW) continue;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      let label = '';
      if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
        label = el.placeholder || el.value || el.name || el.id || el.type;
      } else if (el.tagName.toLowerCase() === 'select') {
        label = el.name || el.id || 'select dropdown';
      } else {
        label = (el.innerText || el.textContent || '').trim() || el.getAttribute('aria-label') || el.title || el.className || '';
      }
      label = label.replace(/\s+/g, ' ').trim().slice(0, 45);
      if (!label) label = `${el.tagName.toLowerCase()}_${counter}`;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normX = parseFloat((centerX / viewportW).toFixed(3));
      const normY = parseFloat((centerY / viewportH).toFixed(3));

      const index = counter++;
      window.__AGENT_ANCHORS__[index] = el;

      anchors.push({
        index,
        label,
        tag: el.tagName.toLowerCase(),
        normX,
        normY,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });

      if (counter > 50) break;
    }

    return anchors;
  }

  /**
   * Displays an animated ripple at coordinates to visualize agent actions.
   */
  function showActionRipple(pageX, pageY) {
    const ripple = document.createElement('div');
    ripple.className = 'agent-action-ripple';
    ripple.style.left = `${pageX}px`;
    ripple.style.top = `${pageY}px`;
    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 850);
  }

  /**
   * Executes grounded browser actions on the page.
   */
  async function executeAgentAction(action, targetIndex, coordinates, text) {
    let targetEl = null;

    if (targetIndex && window.__AGENT_ANCHORS__[targetIndex]) {
      targetEl = window.__AGENT_ANCHORS__[targetIndex];
    }

    if (!targetEl && coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      const [nx, ny] = coordinates;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      let minDistance = 0.12;

      for (const idx in window.__AGENT_ANCHORS__) {
        const el = window.__AGENT_ANCHORS__[idx];
        const rect = el.getBoundingClientRect();
        const candNx = (rect.left + rect.width / 2) / viewportW;
        const candNy = (rect.top + rect.height / 2) / viewportH;
        const dist = Math.hypot(candNx - nx, candNy - ny);

        if (dist < minDistance) {
          minDistance = dist;
          targetEl = el;
        }
      }
    }

    if (!targetEl && coordinates) {
      const px = coordinates[0] * window.innerWidth;
      const py = coordinates[1] * window.innerHeight;
      targetEl = document.elementFromPoint(px, py);
    }

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (action === 'click') {
      if (!targetEl) throw new Error(`Click target not found (index: ${targetIndex})`);
      const rect = targetEl.getBoundingClientRect();
      const clickX = rect.left + rect.width / 2 + scrollX;
      const clickY = rect.top + rect.height / 2 + scrollY;

      showActionRipple(clickX, clickY);

      if (typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      targetEl.focus();

      ['mousedown', 'mouseup', 'click'].forEach(evtType => {
        const evt = new MouseEvent(evtType, {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        });
        targetEl.dispatchEvent(evt);
      });

      if (typeof targetEl.click === 'function') {
        targetEl.click();
      }

      return { success: true, target: targetEl.tagName };
    }

    if (action === 'type') {
      if (!targetEl) throw new Error(`Type target not found (index: ${targetIndex})`);
      const rect = targetEl.getBoundingClientRect();
      showActionRipple(rect.left + rect.width / 2 + scrollX, rect.top + rect.height / 2 + scrollY);

      targetEl.focus();
      targetEl.value = text;

      ['input', 'change'].forEach(evtType => {
        targetEl.dispatchEvent(new Event(evtType, { bubbles: true }));
      });

      return { success: true, target: targetEl.tagName, typed: text };
    }

    if (action === 'scroll') {
      const scrollDelta = (coordinates && coordinates[1] < 0) ? -500 : 500;
      window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
      return { success: true, scrolled: scrollDelta };
    }

    return { success: true, action: 'none' };
  }

  // Runtime messaging
  const runtimeAPI = (typeof chrome !== 'undefined' && chrome.runtime)
    ? chrome.runtime
    : ((typeof browser !== 'undefined' && browser.runtime) ? browser.runtime : null);

  if (runtimeAPI && runtimeAPI.onMessage) {
    runtimeAPI.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'PING') {
        sendResponse({ status: 'READY' });
        return true;
      }

      if (message.action === 'GET_PAGE_STATE') {
        const piiDetector = typeof PIIDetector !== 'undefined' ? PIIDetector : (typeof globalThis.PIIDetector !== 'undefined' ? globalThis.PIIDetector : null);
        let piiRegions = piiDetector ? piiDetector.scanDOMForPII(document) : [];

        const ocrClass = typeof OCRDetector !== 'undefined' ? OCRDetector : (typeof globalThis.OCRDetector !== 'undefined' ? globalThis.OCRDetector : null);
        if (ocrClass) {
          try {
            const ocr = new ocrClass();
            const imgRegions = ocr.scanDOMImagesForPII(document);
            piiRegions = [...piiRegions, ...imgRegions];
          } catch (_) {}
        }

        // 3. Scan HTML5 Canvas Rendered Text & Graphic ID elements (Flutter Web / Canvas apps fallback)
        const canvasLike = document.querySelectorAll('canvas, img[data-sensitive="true"], #flattened-raster-img');
        canvasLike.forEach(el => {
          const rect = el.getBoundingClientRect();
          let regions = [];
          let faces = [];

          if (el.dataset && el.dataset.textRegions) {
            try { regions = JSON.parse(el.dataset.textRegions); } catch (_) {}
          } else if (typeof window !== 'undefined' && Array.isArray(window.__CANVAS_TEXT_REGIONS__)) {
            regions = window.__CANVAS_TEXT_REGIONS__;
          }

          if (el.dataset && el.dataset.faceRegions) {
            try { faces = JSON.parse(el.dataset.faceRegions); } catch (_) {}
          } else if (typeof window !== 'undefined' && Array.isArray(window.__CANVAS_FACE_REGIONS__)) {
            faces = window.__CANVAS_FACE_REGIONS__;
          }

          regions.forEach(item => {
            const matches = piiDetector ? piiDetector.extractPIIMatches(item.text, item.context || '') : [];
            matches.forEach(m => {
              piiRegions.push({
                x: Math.round(rect.left + (item.x || 0)),
                y: Math.round(rect.top + (item.y || 0)),
                width: Math.round(item.width || 120),
                height: Math.round(item.height || 28),
                type: m.type,
                matchText: m.text
              });
            });
          });

          faces.forEach(f => {
            piiRegions.push({
              x: Math.round(rect.left + (f.x || 0)),
              y: Math.round(rect.top + (f.y || 0)),
              width: Math.round(f.width || 120),
              height: Math.round(f.height || 140),
              type: 'FACE',
              matchText: 'BIOMETRIC_FACE'
            });
          });
        });

        const anchors = extractInteractiveAnchors();

        sendResponse({
          piiRegions,
          anchors,
          title: document.title,
          url: window.location.href
        });
        return true;
      }

      if (message.action === 'EXECUTE_ACTION') {
        executeAgentAction(message.agentAction, message.targetIndex, message.coordinates, message.text)
          .then(res => sendResponse(res))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
      }

      if (message.action === 'APPLY_DETECTIONS') {
        const count = applyDetections(message.detections, message.mode || 'outline');
        sendResponse({ success: true, count });
        return true;
      }

      if (message.action === 'CLEAR_DETECTIONS') {
        clearOverlay();
        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      applyDetections,
      clearOverlay,
      extractInteractiveAnchors,
      executeAgentAction,
      OVERLAY_CONTAINER_ID
    };
  }
})();
