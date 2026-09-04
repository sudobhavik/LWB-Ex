// Content Script for PS171 Privacy Agent — In-Page Screen Redaction & Autonomous Click Execution
(() => {
  const CONTAINER_ID = "ps171-privacy-shield-container";

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "GET_PAGE_METADATA") {
      const metadata = extractPageMetadata();
      sendResponse(metadata);
      return true;
    }

    if (message.action === "EXECUTE_AGENT_ACTION") {
      handleExecuteAction(message.data)
        .then((res) => sendResponse({ success: true, ...res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === "APPLY_PRIVACY_MASKS") {
      renderPrivacyOverlays(message.detections, message.settings || {});
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "CLEAR_PRIVACY_MASKS") {
      clearAllOverlays();
      sendResponse({ success: true });
      return true;
    }
  });

  function clearAllOverlays() {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();
    document.querySelectorAll(".ps171-agent-radar").forEach(el => el.remove());
  }

  function extractPageMetadata() {
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    // 1. Interactive inputs, search boxes, buttons & navigation links
    const interactive = [];
    const elements = Array.from(document.querySelectorAll(
      'input[type="text"], input[type="search"], input:not([type]), textarea, select, button, a.btn, .btn, a, input[type="submit"], input[type="button"], nav a, [role="button"], [role="searchbox"]'
    ));

    // Prioritize inputs and prominent buttons first, then regular links
    elements.sort((a, b) => {
      const aIsInput = a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.getAttribute("role") === "searchbox";
      const bIsInput = b.tagName === "INPUT" || b.tagName === "TEXTAREA" || b.getAttribute("role") === "searchbox";
      if (aIsInput && !bIsInput) return -1;
      if (!aIsInput && bIsInput) return 1;
      return 0;
    });

    let assignedIdx = 0;
    elements.forEach((el) => {
      const r = el.getBoundingClientRect();
      // Only include elements currently visible in or near the viewport
      const inViewport = r.bottom >= -50 && r.top <= (vHeight + 50) && r.right >= 0 && r.left <= vWidth;
      if (r.width > 8 && r.height > 8 && el.offsetParent !== null && inViewport) {
        assignedIdx++;
        const elemId = el.id || `ps171-action-${assignedIdx}`;
        el.setAttribute("data-ps171-idx", assignedIdx);
        if (!el.id) el.setAttribute("data-ps171-id", elemId);

        let contextTitle = "";
        const parentCard = el.closest('.card, .product-card, section, form, header, nav');
        if (parentCard) {
          const heading = parentCard.querySelector('h1, h2, h3, h4, .title, .page-title');
          if (heading && heading !== el) {
            contextTitle = heading.innerText.trim();
          }
        }

        const isInput = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.getAttribute("role") === "searchbox";
        const placeholder = el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.getAttribute("name") || "";
        const rawText = el.innerText ? el.innerText.trim() : el.value || "";

        let displayText = "";
        if (isInput) {
          displayText = `[INPUT] ${placeholder || rawText || el.id || "Search/Text field"}`;
        } else {
          displayText = contextTitle ? `${rawText} for ${contextTitle}` : rawText;
        }

        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;

        interactive.push({
          idx: assignedIdx,
          id: el.id || elemId,
          is_input: isInput,
          text: displayText,
          raw_text: rawText,
          box: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
          center_norm: [
            parseFloat((cx / vWidth).toFixed(4)),
            parseFloat((cy / vHeight).toFixed(4))
          ]
        });
      }
    });

    // 2. DOM Privacy Anchors & Context-Aware Semantic Classifier
    const anchors = [];

    function isValidLuhn(digits) {
      let sum = 0;
      let shouldDouble = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits.charAt(i), 10);
        if (shouldDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
      }
      return (sum % 10) === 0;
    }

    function classifyTextSemantics(text = "", context = "", inputType = "") {
      const clean = text.trim();
      const ctx = (context || "").toLowerCase();

      // 1. Password or secret field
      if (inputType === "password" || /^[•●*]{3,}$/.test(clean)) {
        return { isSensitive: true, class_id: 1, class_name: "password_field" };
      }

      // 2. API Key / Secret Token
      const apiKeyRegex = /(?:live_sk|sk_live|sk_test|sk-|ghp_|AKIA|sec_|secret_|auth_token|token_|AQ\.|AIza)[a-zA-Z0-9_\-]{6,}/i;
      if (apiKeyRegex.test(clean)) {
        return { isSensitive: true, class_id: 3, class_name: "sensitive_text" };
      }

      // 3. Payment Card with Luhn validation
      const cardDigits = clean.replace(/[\s\-]/g, "");
      if (/^\d{13,19}$/.test(cardDigits) && isValidLuhn(cardDigits)) {
        return { isSensitive: true, class_id: 2, class_name: "pii_field" };
      }

      // 4. CVV / PIN in payment context
      if (/^\d{3,4}$/.test(clean) && (ctx.includes("cvv") || ctx.includes("cvc") || ctx.includes("pin") || ctx.includes("security code"))) {
        return { isSensitive: true, class_id: 1, class_name: "password_field" };
      }

      // 5. Email & Phone Number PII
      const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
      const phoneRegex = /^(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
      if (emailRegex.test(clean) || phoneRegex.test(clean)) {
        return { isSensitive: true, class_id: 2, class_name: "pii_field" };
      }

      // 5. Currency Amounts: Commercial Price vs Confidential Balance
      const isCurrency = /(?:\$|€|£|USD|INR)\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:\$|€|£|USD|INR)/.test(clean);
      if (isCurrency) {
        const financialWords = ["mrr", "treasury", "reserve", "reserves", "ledger", "balance", "net worth", "vault", "stipend"];
        const commercialWords = ["price", "msrp", "cost", "subtotal", "total", "cart", "catalog", "order", "charge", "unit price", "due", "pay", "buy"];

        const isFinancial = financialWords.some(w => ctx.includes(w));
        const isCommercial = commercialWords.some(w => ctx.includes(w));

        if (isFinancial && !isCommercial) {
          // Confidential financial balance
          return { isSensitive: true, class_id: 3, class_name: "sensitive_text" };
        } else {
          // Harmless commercial price -> DO NOT REDACT
          return { isSensitive: false, class_id: -1, class_name: "common_price" };
        }
      }

      return { isSensitive: false, class_id: -1, class_name: "common_text" };
    }

    // A. Explicit data-privacy elements
    document.querySelectorAll('[data-privacy]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        const ptype = el.getAttribute('data-privacy');
        let cid = 3, cname = "sensitive_text";
        if (ptype === "face") { cid = 0; cname = "face"; }
        else if (ptype === "password") { cid = 1; cname = "password_field"; }
        else if (ptype === "pii") { cid = 2; cname = "pii_field"; }
        else if (ptype === "sensitive_text") { cid = 3; cname = "sensitive_text"; }

        anchors.push({
          class_id: cid,
          class_name: cname,
          confidence: 0.999,
          box: [r.left, r.top, r.right, r.bottom],
          norm_bbox: [r.left / vWidth, r.top / vHeight, r.right / vWidth, r.bottom / vHeight]
        });
      }
    });

    // B. Passwords
    document.querySelectorAll('input[type="password"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        anchors.push({
          class_id: 1,
          class_name: "password_field",
          confidence: 0.999,
          box: [r.left, r.top, r.right, r.bottom],
          norm_bbox: [r.left / vWidth, r.top / vHeight, r.right / vWidth, r.bottom / vHeight]
        });
      }
    });

    // C. Portrait Images
    document.querySelectorAll('img[data-privacy="face"], img.avatar, img.profile').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.height > 20) {
        anchors.push({
          class_id: 0,
          class_name: "face",
          confidence: 0.999,
          box: [r.left, r.top, r.right, r.bottom],
          norm_bbox: [r.left / vWidth, r.top / vHeight, r.right / vWidth, r.bottom / vHeight]
        });
      }
    });

    // D. Semantic Classification across input fields and text nodes
    document.querySelectorAll('input, div, span, code, pre, p, h1, h2, h3').forEach(el => {
      if (el.hasAttribute('data-privacy')) return;
      const text = el.value || (el.children.length === 0 ? el.innerText : "");
      if (!text || text.length < 3) return;

      const parentCard = el.closest('.card, .field, form, section');
      const contextText = parentCard ? parentCard.innerText : (el.title || el.name || el.id || "");
      const inputType = el.getAttribute('type') || "";

      const res = classifyTextSemantics(text, contextText, inputType);
      if (res.isSensitive) {
        const r = el.getBoundingClientRect();
        if (r.width > 8 && r.height > 4) {
          anchors.push({
            class_id: res.class_id,
            class_name: res.class_name,
            confidence: 0.999,
            box: [r.left, r.top, r.right, r.bottom],
            norm_bbox: [r.left / vWidth, r.top / vHeight, r.right / vWidth, r.bottom / vHeight]
          });
        }
      }
    });

    return {
      url: window.location.href,
      width: vWidth,
      height: vHeight,
      interactive_buttons: interactive,
      dom_anchors: anchors
    };
  }

  function isElementVisible(el) {
    if (!el || el.offsetParent === null) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function resolveTargetElement(px, py, targetDesc = "", targetIndex = null, elementId = null) {
    // Tier 1: Direct Index or ID match
    if (targetIndex !== null && targetIndex !== undefined) {
      const elByIndex = document.querySelector(`[data-ps171-idx="${targetIndex}"]`);
      if (elByIndex && isElementVisible(elByIndex)) return elByIndex;
    }
    if (elementId) {
      const elById = document.getElementById(elementId) || document.querySelector(`[data-ps171-id="${elementId}"]`);
      if (elById && isElementVisible(elById)) return elById;
    }

    const allClickables = Array.from(document.querySelectorAll(
      'button, a.btn, .btn, a, input[type="submit"], input[type="button"], nav a, input, textarea, select, [role="button"], [role="searchbox"]'
    )).filter(isElementVisible);

    const descLower = (targetDesc || "").toLowerCase();

    // Tier 2: Semantic Keyword & Parent Context Match
    let bestSemanticEl = null;
    let highestSemanticScore = 0;

    for (const el of allClickables) {
      const r = el.getBoundingClientRect();
      const rawText = [
        el.innerText,
        el.value,
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("name"),
        el.getAttribute("title"),
        el.id
      ].filter(Boolean).join(" ").toLowerCase();

      let score = 0;
      if (descLower && rawText) {
        if (descLower === rawText) score += 100;
        else if (descLower.includes(rawText) && rawText.length > 2) score += 60;
        else if (rawText.includes(descLower)) score += 60;

        // Search input boost
        if (descLower.includes("search")) {
          const isSearchElement = el.type === "search" || 
            rawText.includes("search") || 
            el.getAttribute("role") === "searchbox" || 
            (el.name && el.name.includes("keywords")) || 
            el.id.includes("search") || 
            el.id.includes("twotabsearch");
          if (isSearchElement) score += 90;
        }

        const parentCard = el.closest(".card, .product-card, section, form, header, nav");
        if (parentCard) {
          const cardText = parentCard.innerText.toLowerCase();
          if (descLower.includes("drone") && cardText.includes("drone")) score += 40;
          if (descLower.includes("cyberdeck") && cardText.includes("cyberdeck")) score += 40;
          if (descLower.includes("receiver") && cardText.includes("receiver")) score += 40;
        }

        if (descLower.includes("cart") && (rawText.includes("cart") || el.id.includes("cart"))) score += 30;
        if (descLower.includes("checkout") && (rawText.includes("checkout") || el.id.includes("checkout"))) score += 35;
        if (descLower.includes("order") && (rawText.includes("order") || el.id.includes("order"))) score += 35;
      }

      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const dist = Math.hypot(px - cx, py - cy);
      const proxBonus = Math.max(0, 40 - (dist * 0.1));

      const totalScore = score + proxBonus;
      if (totalScore > highestSemanticScore) {
        highestSemanticScore = totalScore;
        bestSemanticEl = el;
      }
    }

    if (bestSemanticEl && highestSemanticScore >= 50) {
      console.log(`[PS171 Resolver] Tier 2 Semantic match found: <${bestSemanticEl.tagName.toLowerCase()} id="${bestSemanticEl.id}"> (score: ${highestSemanticScore})`);
      return bestSemanticEl;
    }

    // Tier 3: Direct Hit & Container Subtree Traversal
    const directEl = document.elementFromPoint(px, py);
    if (directEl) {
      const clickable = directEl.closest('button, a.btn, .btn, a, input[type="submit"], input[type="button"], nav a, input, select');
      if (clickable) {
        console.log(`[PS171 Resolver] Tier 3 Closest Clickable found: <${clickable.tagName.toLowerCase()} id="${clickable.id}">`);
        return clickable;
      }

      const innerBtn = directEl.querySelector('button, a.btn, .btn, a, input[type="submit"], input[type="button"]');
      if (innerBtn && isElementVisible(innerBtn)) {
        console.log(`[PS171 Resolver] Tier 3 Inner Clickable found: <${innerBtn.tagName.toLowerCase()} id="${innerBtn.id}">`);
        return innerBtn;
      }
    }

    // Tier 4: Euclidean Proximity Snapping (Radius < 140px)
    let closestEl = null;
    let minDistance = Infinity;

    for (const el of allClickables) {
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - px, 0, px - r.right);
      const dy = Math.max(r.top - py, 0, py - r.bottom);
      const boxDist = Math.hypot(dx, dy);

      if (boxDist < minDistance && boxDist < 140) {
        minDistance = boxDist;
        closestEl = el;
      }
    }

    if (closestEl) {
      console.log(`[PS171 Resolver] Tier 4 Proximity Snap found (<${closestEl.tagName.toLowerCase()} id="${closestEl.id}">, dist: ${minDistance.toFixed(1)}px)`);
      return closestEl;
    }

    console.log(`[PS171 Resolver] Fallback direct element:`, directEl);
    return directEl;
  }

  function dispatchRealClick(el, px, py) {
    console.log(`[PS171 Click] Dispatching real click on <${el.tagName.toLowerCase()} id="${el.id}" href="${el.href || ''}"> at (${px}, ${py})`);
    el.focus();
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: px,
      clientY: py
    };
    el.dispatchEvent(new PointerEvent("pointerdown", opts));
    el.dispatchEvent(new MouseEvent("mousedown", opts));
    el.dispatchEvent(new PointerEvent("pointerup", opts));
    el.dispatchEvent(new MouseEvent("mouseup", opts));
    el.click();

    // In Chromium extension content scripts, programmatic click() on <a> elements 
    // does not follow the link due to untrusted event restrictions (isTrusted === false).
    // Explicitly navigate if target is an anchor tag with a valid URL.
    const anchor = el.closest('a');
    if (anchor && anchor.href) {
      const href = anchor.getAttribute("href") || "";
      if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
        console.log(`[PS171 Click] Anchor detected. Explicitly navigating to: ${anchor.href}`);
        window.location.href = anchor.href;
      }
    } else if ((el.type === "submit" || el.getAttribute("type") === "submit") && el.form) {
      console.log(`[PS171 Click] Submit button detected. Explicitly submitting form.`);
      if (typeof el.form.requestSubmit === "function") {
        el.form.requestSubmit(el);
      } else {
        el.form.submit();
      }
    }
  }

  async function handleExecuteAction(data = {}) {
    const action = data.action || "click";
    const targetDesc = data.target_description || "Target element";
    const rawCoords = data.coordinates || [0.5, 0.5];
    const targetIndex = data.target_index !== undefined ? data.target_index : null;
    const elementId = data.element_id || null;
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    let cx = 0.5, cy = 0.5;
    if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
      cx = parseFloat(rawCoords[0]);
      cy = parseFloat(rawCoords[1]);
      if (cx > 1.0) cx = (cx <= 1000) ? (cx / 1000.0) : (cx / vWidth);
      if (cy > 1.0) cy = (cy <= 1000) ? (cy / 1000.0) : (cy / vHeight);
      cx = Math.max(0.0, Math.min(1.0, cx));
      cy = Math.max(0.0, Math.min(1.0, cy));
    }

    let px = Math.round(cx * vWidth);
    let py = Math.round(cy * vHeight);

    // 4-Tier Intelligent Target Resolution
    const targetEl = resolveTargetElement(px, py, targetDesc, targetIndex, elementId);

    // Snap cursor radar pointer to resolved element center
    if (targetEl) {
      const r = targetEl.getBoundingClientRect();
      px = Math.round((r.left + r.right) / 2);
      py = Math.round((r.top + r.bottom) / 2);
    }

    // Show Clean Monochrome AI Radar Click Pointer at snapped location
    showAgentRadar(px, py, targetDesc, action);

    if (data.detections && data.detections.length > 0) {
      renderPrivacyOverlays(data.detections, { maskStyle: "blur" });
    }

    await new Promise(r => setTimeout(r, 450));

    // Real Execution
    if (action === "click") {
      if (targetEl) {
        dispatchRealClick(targetEl, px, py);
      }
    } else if (action === "type") {
      let inputEl = (targetEl && "value" in targetEl) ? targetEl : null;
      if (!inputEl && targetEl && targetEl.querySelector) {
        inputEl = targetEl.querySelector('input, textarea');
      }
      if (!inputEl) {
        const direct = document.elementFromPoint(px, py);
        if (direct) {
          inputEl = ("value" in direct) ? direct : (direct.closest('input, textarea') || direct.querySelector('input, textarea'));
        }
      }
      if (inputEl) {
        inputEl.focus();
        inputEl.click();
        const textVal = data.text_to_type || "";

        // Compatible value setter for vanilla, React, Vue
        const proto = (inputEl.tagName === "TEXTAREA") ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (nativeSetter) {
          try {
            nativeSetter.call(inputEl, textVal);
          } catch (_) {
            inputEl.value = textVal;
          }
        } else {
          inputEl.value = textVal;
        }

        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));

        // Auto-submit search forms or when press_enter is requested
        const shouldSubmit = data.press_enter || data.submit || 
          inputEl.type === "search" || 
          (inputEl.getAttribute("role") === "searchbox") ||
          (data.target_description || "").toLowerCase().includes("search") ||
          (inputEl.id && inputEl.id.toLowerCase().includes("search"));

        if (shouldSubmit) {
          console.log("[PS171 Agent] Submitting typed search form via Enter / requestSubmit...");
          const keyOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
          inputEl.dispatchEvent(new KeyboardEvent("keydown", keyOpts));
          inputEl.dispatchEvent(new KeyboardEvent("keypress", keyOpts));
          inputEl.dispatchEvent(new KeyboardEvent("keyup", keyOpts));

          if (inputEl.form) {
            try {
              if (typeof inputEl.form.requestSubmit === "function") {
                inputEl.form.requestSubmit();
              } else {
                inputEl.form.submit();
              }
            } catch (err) {
              console.warn("[PS171 Agent] Form submit fallback:", err);
            }
          }
        }
      }
    } else if (action === "scroll") {
      const dir = (data.scroll_direction || (py > vHeight * 0.6 ? "down" : "down")).toLowerCase();
      const dist = data.scroll_amount || Math.round(vHeight * 0.65);
      window.scrollBy({
        top: dir === "up" ? -dist : dist,
        behavior: "smooth"
      });
    } else if (action === "press_key" || action === "key") {
      const keyName = data.key || "Enter";
      const target = document.activeElement || targetEl || document.body;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, code: keyName, bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keypress", { key: keyName, code: keyName, bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key: keyName, code: keyName, bubbles: true }));
    } else if (action === "select") {
      const selectEl = (targetEl && targetEl.tagName === "SELECT") ? targetEl : document.elementFromPoint(px, py);
      if (selectEl && selectEl.tagName === "SELECT") {
        if (data.select_value) {
          selectEl.value = data.select_value;
        } else if (data.select_text) {
          const opt = Array.from(selectEl.options).find(o => o.text.toLowerCase().includes(data.select_text.toLowerCase()));
          if (opt) selectEl.value = opt.value;
        }
        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (action === "navigate" && data.navigate_url) {
      window.location.href = data.navigate_url;
    }

    return { px, py, target: targetDesc, action };
  }

  function showAgentRadar(px, py, targetDesc, action) {
    document.querySelectorAll(".ps171-agent-radar").forEach(el => el.remove());

    const radar = document.createElement("div");
    radar.className = "ps171-agent-radar";
    radar.style.left = `${px}px`;
    radar.style.top = `${py}px`;

    radar.innerHTML = `
      <div class="ps171-radar-ring"></div>
      <div class="ps171-radar-dot"></div>
      <div class="ps171-radar-tooltip">[ACTION // ${action.toUpperCase()}]: ${targetDesc}</div>
    `;

    document.body.appendChild(radar);
    setTimeout(() => radar.remove(), 2200);
  }

  function renderPrivacyOverlays(detections = [], settings = {}) {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }
    container.innerHTML = "";

    const maskStyle = settings.maskStyle || "blur";
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    detections.forEach(det => {
      let norm = det.norm_bbox;
      if (!norm && det.bbox && det.bbox.length === 4) {
        norm = [det.bbox[0] / vWidth, det.bbox[1] / vHeight, det.bbox[2] / vWidth, det.bbox[3] / vHeight];
      }
      if (!norm || norm.length < 4) return;

      const left = norm[0] * vWidth;
      const top = norm[1] * vHeight + window.scrollY;
      const width = (norm[2] - norm[0]) * vWidth;
      const height = (norm[3] - norm[1]) * vHeight;

      if (width < 4 || height < 4) return;

      const mask = document.createElement("div");
      mask.className = `ps171-mask-overlay ps171-mask-${maskStyle}`;

      let clsKey = "text";
      let label = "REDACTED";
      if (det.class_name === "face") { clsKey = "face"; label = "REDACTED_FACE"; }
      else if (det.class_name === "password_field") { clsKey = "pwd"; label = "REDACTED_PASSWORD"; }
      else if (det.class_name === "pii_field") { clsKey = "pii"; label = "REDACTED_PII"; }
      else if (det.class_name === "sensitive_text") { clsKey = "text"; label = "REDACTED_SECRET"; }

      mask.classList.add(`ps171-badge-${clsKey}`);
      mask.style.left = `${left}px`;
      mask.style.top = `${top}px`;
      mask.style.width = `${width}px`;
      mask.style.height = `${height}px`;

      mask.innerHTML = `<span class="ps171-label ps171-label-${clsKey}">[${label}]</span>`;
      container.appendChild(mask);
    });
  }

  // Instant DOM Auto-Shield
  function autoShieldSensitiveInputs() {
    const meta = extractPageMetadata();
    if (meta.dom_anchors && meta.dom_anchors.length > 0) {
      renderPrivacyOverlays(meta.dom_anchors, { maskStyle: "blur" });
    }
  }

  window.addEventListener("DOMContentLoaded", autoShieldSensitiveInputs);
  window.addEventListener("load", autoShieldSensitiveInputs);
  setTimeout(autoShieldSensitiveInputs, 350);
})();
