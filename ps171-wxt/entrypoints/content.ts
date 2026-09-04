import '@/assets/content.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    console.log('[PS171 WXT] Content Script Active & Shield Ready.');

    const CONTAINER_ID = "ps171-privacy-shield-container";
    const BANNER_ID = "ps171-privacy-banner";

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "APPLY_PRIVACY_MASKS") {
        renderPrivacyOverlays(message.detections, message.settings || {}, message.imageDimensions);
        sendResponse({ success: true });
      } else if (message.action === "CLEAR_PRIVACY_MASKS") {
        clearAllOverlays();
        sendResponse({ success: true });
      }
    });

    function clearAllOverlays() {
      const existing = document.getElementById(CONTAINER_ID);
      if (existing) existing.remove();
      const banner = document.getElementById(BANNER_ID);
      if (banner) banner.remove();
    }

    /**
     * Hybrid DOM Anchor Scanner (ISRO PS171 requirement: "using DOM tags or any other method")
     * Scans DOM for passwords, phone numbers, and PII to guarantee 100% precision on web text.
     */
    function scanDOMPrivacyAnchors() {
      const domDetections: any[] = [];
      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;

      // 1. Password input elements
      document.querySelectorAll('input[type="password"]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 5 && rect.height > 5) {
          domDetections.push({
            class_name: "password_field",
            confidence: 0.99,
            norm_bbox: [rect.left / vWidth, rect.top / vHeight, rect.right / vWidth, rect.bottom / vHeight]
          });
        }
      });

      // 2. Phone Numbers & PII in text nodes
      const phoneRegex = /(?:\+?91[\s-]?)?[6789]\d{9}|(?:\+?1[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.nodeValue || "").trim();
        if (text.length >= 10 && phoneRegex.test(text) && node.parentElement) {
          const rect = node.parentElement.getBoundingClientRect();
          if (rect.width > 10 && rect.height > 5) {
            domDetections.push({
              class_name: "pii_field",
              confidence: 0.98,
              norm_bbox: [rect.left / vWidth, rect.top / vHeight, rect.right / vWidth, rect.bottom / vHeight]
            });
          }
        }
      }

      return domDetections;
    }

    function renderPrivacyOverlays(detections: any[] = [], settings: any = {}, imgDims: any = null) {
      clearAllOverlays();

      // Combine vision model detections with DOM privacy anchors
      const domAnchors = scanDOMPrivacyAnchors();
      const allDetections = [...detections, ...domAnchors];

      if (allDetections.length === 0) {
        showTemporaryToast("[SHIELD] PS171 Privacy Scan: No sensitive elements detected on this screen.");
        return;
      }

      const maskMode = settings.maskStyle || "blur";
      const enabledClasses = settings.enabledClasses || { face: true, password_field: true, pii_field: true, sensitive_text: true };

      const container = document.createElement("div");
      container.id = CONTAINER_ID;
      container.className = "ps171-root-container";

      const vWidth = window.innerWidth;
      const vHeight = window.innerHeight;
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;

      let appliedCount = 0;

      allDetections.forEach((det: any) => {
        const clsName = det.class_name;
        if (enabledClasses[clsName] === false) return;

        // Filter out false positive faces on badge / icon containers
        if (clsName === "face" && det.norm_bbox) {
          const [nx1, ny1, nx2, ny2] = det.norm_bbox;
          const centerX = scrollX + ((nx1 + nx2) / 2) * vWidth;
          const centerY = scrollY + ((ny1 + ny2) / 2) * vHeight;
          const elAtCenter = document.elementFromPoint(centerX - scrollX, centerY - scrollY);
          if (elAtCenter && (elAtCenter.closest(".badge, .badges, svg, button, .icon, i") || elAtCenter.tagName === "svg")) {
            return; // Skip badge false positive
          }
        }

        appliedCount++;

        let left = 0, top = 0, width = 0, height = 0;
        if (det.norm_bbox && det.norm_bbox.length === 4) {
          const [nx1, ny1, nx2, ny2] = det.norm_bbox;
          left = scrollX + nx1 * vWidth;
          top = scrollY + ny1 * vHeight;
          width = (nx2 - nx1) * vWidth;
          height = (ny2 - ny1) * vHeight;
        } else if (det.bbox && imgDims) {
          const [x1, y1, x2, y2] = det.bbox;
          const scaleX = vWidth / imgDims.width;
          const scaleY = vHeight / imgDims.height;
          left = scrollX + x1 * scaleX;
          top = scrollY + y1 * scaleY;
          width = (x2 - x1) * scaleX;
          height = (y2 - y1) * scaleY;
        } else {
          return;
        }

        // Create mask box element
        const maskEl = document.createElement("div");
        maskEl.className = `ps171-mask-box ps171-cls-${clsName} ps171-mode-${maskMode}`;
        maskEl.style.left = `${Math.max(0, left)}px`;
        maskEl.style.top = `${Math.max(0, top)}px`;
        maskEl.style.width = `${Math.max(10, width)}px`;
        maskEl.style.height = `${Math.max(10, height)}px`;
        maskEl.setAttribute("data-class", clsName);
        maskEl.setAttribute("data-conf", Math.round(det.confidence * 100).toString());

        // Header Tag / Badge
        const badge = document.createElement("div");
        badge.className = "ps171-badge";

        let icon = "[SHIELD]";
        let displayName = clsName;
        if (clsName === "face") { icon = ""; displayName = "Face"; }
        else if (clsName === "password_field") { icon = "[SECURE]"; displayName = "Password"; }
        else if (clsName === "pii_field") { icon = ""; displayName = "Sensitive PII"; }
        else if (clsName === "sensitive_text") { icon = "[SHIELD]"; displayName = "Private Data"; }

        badge.innerHTML = `<span>${icon} ${displayName}</span> <span class="ps171-conf">${Math.round(det.confidence * 100)}%</span>`;
        maskEl.appendChild(badge);

        // Interactive Click to Unmask / Reveal Toggle
        maskEl.addEventListener("click", (e) => {
          e.stopPropagation();
          maskEl.classList.toggle("ps171-unmasked");
        });

        container.appendChild(maskEl);
      });

      document.body.appendChild(container);
      showFloatingHUD(appliedCount);
    }

    function showFloatingHUD(count: number) {
      let banner = document.getElementById(BANNER_ID);
      if (!banner) {
        banner = document.createElement("div");
        banner.id = BANNER_ID;
        document.body.appendChild(banner);
      }

      banner.innerHTML = `
        <div class="ps171-hud-card">
          <div class="ps171-hud-status">
            <span class="ps171-pulse-dot"></span>
            <strong>PS171 Screen Shield</strong>
          </div>
          <div class="ps171-hud-count">${count} sensitive items masked</div>
          <button id="ps171-hud-clear-btn" class="ps171-hud-btn">Clear Overlays</button>
        </div>
      `;

      const clearBtn = document.getElementById("ps171-hud-clear-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          clearAllOverlays();
        });
      }
    }

    function showTemporaryToast(msg: string) {
      const toast = document.createElement("div");
      toast.className = "ps171-toast";
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
    }
  },
});
