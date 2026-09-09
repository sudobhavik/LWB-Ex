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
  window.__AGENT_ANCHOR_META__ = {};

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
   * OmniParser-style visual icon classifier.
   * Infers visual icon semantics from SVGs, ARIA tags, class names, and button paths.
   */
  function detectVisualIcon(el) {
    if (!el) return null;
    const textToCheck = [
      el.className || '',
      el.getAttribute('aria-label') || '',
      el.id || '',
      el.title || '',
      el.getAttribute('data-icon') || '',
      el.innerHTML ? el.innerHTML.slice(0, 300) : ''
    ].join(' ').toLowerCase();

    if (/cart|basket|shopping-bag|checkout-btn/i.test(textToCheck)) return 'shopping_cart';
    if (/search|magnif|find-btn/i.test(textToCheck)) return 'search';
    if (/user|profile|account|avatar|person/i.test(textToCheck)) return 'user_profile';
    if (/menu|hamburger|navbar-toggler/i.test(textToCheck)) return 'hamburger_menu';
    if (/filter|funnel|sort/i.test(textToCheck)) return 'filter';
    if (/close|dismiss|cancel|clear|cross/i.test(textToCheck)) return 'close';
    if (/heart|wishlist|fav/i.test(textToCheck)) return 'heart_wishlist';
    if (/chevron|arrow|caret/i.test(textToCheck)) return 'chevron_nav';
    if (/trash|delete|remove/i.test(textToCheck)) return 'trash_delete';
    if (/edit|pencil|modify/i.test(textToCheck)) return 'edit';
    return null;
  }

  /**
   * Enumerates all visible, interactive anchors on the page for VLM grounding.
   * Enriches elements with OmniParser-style visual icons, roles, and normalized coordinates.
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

      const iconType = detectVisualIcon(el);
      const role = el.getAttribute('role') || (el.tagName.toLowerCase() === 'a' ? 'link' : el.tagName.toLowerCase());

      let label = '';
      if (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea') {
        const isSecret = el.type === 'password' || /password|card|cvv|secret|token|ssn|aadhaar|pan/i.test(
          (el.id || '') + ' ' + (el.name || '') + ' ' + (el.autocomplete || '') + ' ' + (el.placeholder || '')
        );
        label = isSecret ? '[REDACTED_SECURE_FIELD]' : (el.placeholder || el.value || el.name || el.id || el.type);
      } else if (el.tagName.toLowerCase() === 'select') {
        label = el.name || el.id || 'select dropdown';
      } else {
        label = (el.innerText || el.textContent || '').trim() || el.getAttribute('aria-label') || el.title || el.className || '';
      }
      label = label.replace(/\s+/g, ' ').trim().slice(0, 45);

      // Check if text itself contains sensitive PII (credit cards, Aadhaar, PAN)
      const piiDetectorInst = typeof PIIDetector !== 'undefined' ? PIIDetector : (typeof globalThis.PIIDetector !== 'undefined' ? globalThis.PIIDetector : null);
      if (piiDetectorInst && piiDetectorInst.extractPIIMatches && label !== '[REDACTED_SECURE_FIELD]') {
        const matches = piiDetectorInst.extractPIIMatches(label);
        if (matches && matches.length > 0) {
          label = `[REDACTED_${matches[0].type}]`;
        }
      }

      if (!label) {
        label = iconType ? `[ICON: ${iconType}]` : `${el.tagName.toLowerCase()}_${counter}`;
      } else if (iconType && !label.toLowerCase().includes(iconType.replace('_', ' '))) {
        label = `[ICON: ${iconType}] ${label}`;
      }

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
        role,
        iconType,
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
    const meta = window.__AGENT_ANCHOR_META__ ? window.__AGENT_ANCHOR_META__[targetIndex] : null;

    if (targetIndex && window.__AGENT_ANCHORS__[targetIndex]) {
      targetEl = window.__AGENT_ANCHORS__[targetIndex];
    }

    // Calculate exact viewport client coordinate
    const winW = window.innerWidth || document.documentElement?.clientWidth || 1920;
    const winH = window.innerHeight || document.documentElement?.clientHeight || 1080;

    let clickClientX, clickClientY;
    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      clickClientX = coordinates[0] * winW;
      clickClientY = coordinates[1] * winH;
    } else if (meta && meta.normX !== undefined && meta.normY !== undefined) {
      clickClientX = meta.normX * winW;
      clickClientY = meta.normY * winH;
    } else if (meta && meta.x !== undefined && meta.width !== undefined) {
      clickClientX = meta.x + meta.width / 2;
      clickClientY = meta.y + meta.height / 2;
    } else if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
      const rect = targetEl.getBoundingClientRect();
      clickClientX = rect.left + rect.width / 2;
      clickClientY = rect.top + rect.height / 2;
    } else {
      clickClientX = winW / 2;
      clickClientY = winH / 2;
    }

    if (!targetEl && typeof document.elementFromPoint === 'function') {
      targetEl = document.elementFromPoint(clickClientX, clickClientY);
    }

    // If targetEl is a text node, resolve parent element
    if (targetEl && targetEl.nodeType === 3) {
      targetEl = targetEl.parentElement;
    }

    // If targetEl is inside a clickable container (button, link, input, role=button), select the interactive container
    if (targetEl && typeof targetEl.closest === 'function') {
      const clickableParent = targetEl.closest('button, a, input, select, textarea, [role="button"], [onclick], [tabindex="0"]');
      if (clickableParent) {
        targetEl = clickableParent;
      }
    }

    if (!targetEl && document.body) {
      targetEl = document.body;
    }

    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    if (action === 'click') {
      if (!targetEl) throw new Error(`Click target not found (index: ${targetIndex})`);

      const isCanvas = (meta && meta.isCanvas) || (targetEl.tagName && targetEl.tagName.toLowerCase() === 'canvas');
      showActionRipple(clickClientX + scrollX, clickClientY + scrollY);

      // Check if target is currently visible in viewport; only scroll if necessary
      if (typeof targetEl.getBoundingClientRect === 'function') {
        const rect = targetEl.getBoundingClientRect();
        const inView = rect.top >= 0 && rect.bottom <= winH && rect.left >= 0 && rect.right <= winW;
        if (!inView && typeof targetEl.scrollIntoView === 'function') {
          targetEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
          const updatedRect = targetEl.getBoundingClientRect();
          clickClientX = updatedRect.left + updatedRect.width / 2;
          clickClientY = updatedRect.top + updatedRect.height / 2;
        }
      }

      if (typeof targetEl.focus === 'function') {
        targetEl.focus();
      }

      // Dispatch PointerEvents and MouseEvents for Canvas and DOM compatibility
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
        const EventCtor = (evtType.startsWith('pointer') && typeof PointerEvent !== 'undefined') ? PointerEvent : MouseEvent;
        const evt = new EventCtor(evtType, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: clickClientX,
          clientY: clickClientY
        });
        targetEl.dispatchEvent(evt);
      });

      if (typeof targetEl.click === 'function' && !isCanvas) {
        targetEl.click();
      }

      return { success: true, target: targetEl.tagName || 'ELEMENT', isCanvas };
    }

    if (action === 'type') {
      if (!targetEl) throw new Error(`Type target not found (index: ${targetIndex})`);
      showActionRipple(clickClientX + scrollX, clickClientY + scrollY);

      if (typeof targetEl.focus === 'function') {
        targetEl.focus();
      }

      if ('value' in targetEl) {
        targetEl.value = text;
        ['input', 'change'].forEach(evtType => {
          targetEl.dispatchEvent(new Event(evtType, { bubbles: true }));
        });
      } else {
        // Canvas or custom UI: dispatch keyboard input events
        for (const char of text) {
          const keyEvt = new KeyboardEvent('keydown', { key: char, bubbles: true });
          targetEl.dispatchEvent(keyEvt);
        }
      }

      return { success: true, target: targetEl.tagName || 'ELEMENT', typed: text };
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

          // Calculate internal canvas coordinate to CSS viewport pixel scale factor
          const isCanvasEl = el.tagName && el.tagName.toLowerCase() === 'canvas';
          const canvasScaleX = (isCanvasEl && el.width) ? (rect.width / el.width) : 1;
          const canvasScaleY = (isCanvasEl && el.height) ? (rect.height / el.height) : 1;

          regions.forEach(item => {
            const matches = piiDetector ? piiDetector.extractPIIMatches(item.text, item.context || '') : [];
            matches.forEach(m => {
              piiRegions.push({
                x: Math.round(rect.left + ((item.x || 0) * canvasScaleX)),
                y: Math.round(rect.top + ((item.y || 0) * canvasScaleY)),
                width: Math.round((item.width || 120) * canvasScaleX),
                height: Math.round((item.height || 28) * canvasScaleY),
                type: m.type,
                matchText: m.text
              });
            });
          });

          faces.forEach(f => {
            piiRegions.push({
              x: Math.round(rect.left + ((f.x || 0) * canvasScaleX)),
              y: Math.round(rect.top + ((f.y || 0) * canvasScaleY)),
              width: Math.round((f.width || 120) * canvasScaleX),
              height: Math.round((f.height || 140) * canvasScaleY),
              type: 'FACE',
              matchText: 'BIOMETRIC_FACE'
            });
          });
        });

        const anchors = extractInteractiveAnchors();
        const canvasRects = Array.from(document.querySelectorAll('canvas')).map(c => {
          const r = c.getBoundingClientRect();
          return {
            x: Math.round(r.left),
            y: Math.round(r.top),
            width: Math.round(r.width),
            height: Math.round(r.height)
          };
        });

        sendResponse({
          piiRegions,
          anchors,
          canvasRects,
          title: document.title,
          url: window.location.href,
          devicePixelRatio: window.devicePixelRatio || 1,
          viewportWidth: window.innerWidth || document.documentElement.clientWidth || 1920,
          viewportHeight: window.innerHeight || document.documentElement.clientHeight || 1080
        });
        return true;
      }

      if (message.action === 'EXECUTE_ACTION') {
        executeAgentAction(message.agentAction, message.targetIndex, message.coordinates, message.text)
          .then(res => sendResponse(res))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
      }

      if (message.action === 'SET_FUSED_ANCHORS' || message.action === 'SET_VISION_ANCHORS') {
        window.__AGENT_ANCHORS__ = {};
        window.__AGENT_ANCHOR_META__ = {};
        const elements = message.anchors || message.elements || [];
        const winW = window.innerWidth || document.documentElement?.clientWidth || 1920;
        const winH = window.innerHeight || document.documentElement?.clientHeight || 1080;
        elements.forEach(el => {
          window.__AGENT_ANCHOR_META__[el.index] = el;
          let px, py;
          if (el.normX !== undefined && el.normY !== undefined) {
            px = el.normX * winW;
            py = el.normY * winH;
          } else {
            px = el.x + el.width / 2;
            py = el.y + el.height / 2;
          }
          let target = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(px, py) : null;
          if (target && typeof target.closest === 'function') {
            const clickable = target.closest('button, a, input, select, textarea, [role="button"], [onclick], [tabindex="0"]');
            if (clickable) target = clickable;
          }
          if (target) {
            window.__AGENT_ANCHORS__[el.index] = target;
          }
        });
        sendResponse({ success: true, count: Object.keys(window.__AGENT_ANCHORS__).length });
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
