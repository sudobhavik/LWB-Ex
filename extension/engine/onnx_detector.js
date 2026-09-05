/**
 * In-Browser Client-Side ONNX Inference Engine for YOLO26-nano
 * PS171 Privacy Agent — Zero-Egress, 100% Client-Side WebGPU/WASM
 */

const PRIVACY_CLASSES = {
  0: "face",
  1: "input_field",
  2: "text_block",
  3: "sensitive_text"
};

const CLASS_BADGES = {
  face: "REDACTED_FACE",
  password_field: "REDACTED_PASSWORD",
  pii_field: "REDACTED_PII",
  sensitive_text: "REDACTED_SECRET",
  input_field: "REDACTED_INPUT",
  text_block: "REDACTED_TEXT"
};

class YOLO26InBrowserDetector {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.msgId = 0;
    this.pendingCallbacks = new Map();
  }

  async init(modelName = "yolo26n.onnx") {
    if (this.isReady && this.worker) return true;

    return new Promise((resolve, reject) => {
      try {
        const extRuntime = (typeof globalThis.browser !== "undefined" && globalThis.browser.runtime)
          ? globalThis.browser.runtime
          : (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime ? globalThis.chrome.runtime : null);

        const workerUrl = extRuntime ? extRuntime.getURL("engine/yolo_worker.js") : "engine/yolo_worker.js";
        const modelUrl = extRuntime ? extRuntime.getURL(`models/${modelName}`) : `models/${modelName}`;
        const wasmDir = (extRuntime ? extRuntime.getURL("lib/") : "lib/") + "/";

        console.log(`[PS171] Spawning ONNX Worker at ${workerUrl}...`);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e) => {
          const { id, success, type, error, output, dims, inference_ms } = e.data;
          if (this.pendingCallbacks.has(id)) {
            const { resolve: cbResolve, reject: cbReject } = this.pendingCallbacks.get(id);
            this.pendingCallbacks.delete(id);

            if (success) {
              cbResolve({ type, output, dims, inference_ms });
            } else {
              cbReject(new Error(error || "Worker error"));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.error("[PS171 Worker Error]:", err);
          reject(new Error("Worker initialization error: " + (err.message || "Failed to load worker")));
        };

        const reqId = ++this.msgId;
        this.pendingCallbacks.set(reqId, {
          resolve: () => {
            console.log("[PS171] [OK] In-Browser ONNX Privacy Shield Ready!");
            this.isReady = true;
            resolve(true);
          },
          reject: (err) => {
            this.isReady = false;
            reject(err);
          }
        });

        this.worker.postMessage({
          id: reqId,
          type: "INIT",
          payload: { modelUrl, wasmDir }
        });
      } catch (err) {
        console.error("[PS171] Failed to create Web Worker:", err);
        reject(err);
      }
    });
  }

  async preprocessImage(imageSource, targetW = 640, targetH = 640) {
    let img;
    if (typeof imageSource === "string") {
      img = new Image();
      img.src = imageSource;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
    } else {
      img = imageSource;
    }

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // Ultralytics standard Letterbox scaling
    const scale = Math.min(targetW / origW, targetH / origH);
    const newW = Math.round(origW * scale);
    const newH = Math.round(origH * scale);
    const padX = Math.round((targetW - newW) / 2);
    const padY = Math.round((targetH - newH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // YOLO standard letterbox background (114, 114, 114)
    ctx.fillStyle = "#727272";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, padX, padY, newW, newH);

    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const rgba = imageData.data;

    // Convert RGBA to CHW Normalized Float32 Array
    const float32Data = new Float32Array(3 * targetW * targetH);
    const channelSize = targetW * targetH;

    for (let i = 0; i < channelSize; i++) {
      float32Data[i] = rgba[i * 4] / 255.0;
      float32Data[channelSize + i] = rgba[i * 4 + 1] / 255.0;
      float32Data[2 * channelSize + i] = rgba[i * 4 + 2] / 255.0;
    }

    return { img, float32Data, origW, origH, scale, padX, padY };
  }

  /**
   * Complete 100% In-Browser Privacy Redaction
   * Runs YOLO26 Web Worker + merges DOM Anchors + applies hardware-accelerated Canvas Gaussian blur
   */
  async redact(imageSource, options = {}) {
    if (!this.isReady) {
      await this.init();
    }

    const startTime = performance.now();
    const confThreshold = options.confThreshold !== undefined ? options.confThreshold : 0.25;
    const interactiveButtons = options.interactiveButtons || [];
    const domAnchors = options.domAnchors || [];

    const { img, float32Data, origW, origH, scale, padX, padY } = await this.preprocessImage(imageSource, 640, 640);

    // 1. Run inference in Web Worker
    const reqId = ++this.msgId;
    const workerResult = await new Promise((resolve, reject) => {
      this.pendingCallbacks.set(reqId, { resolve, reject });
      this.worker.postMessage({
        id: reqId,
        type: "INFER",
        payload: { float32Data }
      });
    });

    const outputData = workerResult.output;
    const dims = workerResult.dims || [1, 7, 8400];
    const rawBoxes = [];
    const candidates = [];

    // Parse YOLOv8s raw anchors [1, 7, 8400] or legacy NMS [1, 300, 6]
    if (dims.length === 3 && dims[2] === 8400) {
      const numAnchors = dims[2]; // 8400
      const numClasses = dims[1] - 4; // 3 classes: 0: face, 1: input_field, 2: text_block

      for (let c = 0; c < numAnchors; c++) {
        let bestClass = 0;
        let maxScore = outputData[4 * numAnchors + c];
        for (let k = 1; k < numClasses; k++) {
          const score = outputData[(4 + k) * numAnchors + c];
          if (score > maxScore) {
            maxScore = score;
            bestClass = k;
          }
        }

        if (maxScore >= confThreshold) {
          const cx = outputData[0 * numAnchors + c];
          const cy = outputData[1 * numAnchors + c];
          const w  = outputData[2 * numAnchors + c];
          const h  = outputData[3 * numAnchors + c];

          candidates.push({
            x1: cx - w / 2,
            y1: cy - h / 2,
            x2: cx + w / 2,
            y2: cy + h / 2,
            score: maxScore,
            classId: bestClass
          });
        }
      }
    } else {
      // Legacy NMS shape [1, 300, 6]
      const numPredictions = Math.floor(outputData.length / 6);
      for (let i = 0; i < numPredictions; i++) {
        const offset = i * 6;
        const score = outputData[offset + 4];
        if (score >= confThreshold) {
          candidates.push({
            x1: outputData[offset + 0],
            y1: outputData[offset + 1],
            x2: outputData[offset + 2],
            y2: outputData[offset + 3],
            score: score,
            classId: Math.round(outputData[offset + 5])
          });
        }
      }
    }

    // Fast Non-Maximum Suppression (IoU threshold 0.45)
    candidates.sort((a, b) => b.score - a.score);
    const nmsBoxes = [];
    for (const cand of candidates) {
      let isSuppressed = false;
      for (const accepted of nmsBoxes) {
        if (cand.classId === accepted.classId) {
          const ix1 = Math.max(cand.x1, accepted.x1);
          const iy1 = Math.max(cand.y1, accepted.y1);
          const ix2 = Math.min(cand.x2, accepted.x2);
          const iy2 = Math.min(cand.y2, accepted.y2);
          if (ix2 > ix1 && iy2 > iy1) {
            const inter = (ix2 - ix1) * (iy2 - iy1);
            const a1 = (cand.x2 - cand.x1) * (cand.y2 - cand.y1);
            const a2 = (accepted.x2 - accepted.x1) * (accepted.y2 - accepted.y1);
            const union = a1 + a2 - inter;
            if (inter / union > 0.45) {
              isSuppressed = true;
              break;
            }
          }
        }
      }
      if (!isSuppressed) {
        nmsBoxes.push(cand);
        if (nmsBoxes.length >= 150) break;
      }
    }

    // Scale candidate boxes back to original viewport space
    for (const b of nmsBoxes) {
      const orig_x1 = Math.max(0, Math.min(origW, Math.round((b.x1 - padX) / scale)));
      const orig_y1 = Math.max(0, Math.min(origH, Math.round((b.y1 - padY) / scale)));
      const orig_x2 = Math.max(orig_x1 + 4, Math.min(origW, Math.round((b.x2 - padX) / scale)));
      const orig_y2 = Math.max(orig_y1 + 4, Math.min(origH, Math.round((b.y2 - padY) / scale)));

      const clsName = PRIVACY_CLASSES[b.classId] || `class_${b.classId}`;
      rawBoxes.push({
        class_id: b.classId,
        class_name: clsName,
        confidence: parseFloat(b.score.toFixed(4)),
        bbox: [orig_x1, orig_y1, orig_x2, orig_y2],
        is_dom_anchor: false
      });
    }

    // 2. Add Verified Sensitive DOM Anchors (API keys, passwords, balances, credit cards)
    domAnchors.forEach(anchor => {
      const b = anchor.box || [0, 0, 0, 0];
      const ax1 = Math.max(0, Math.min(origW, Math.round(b[0])));
      const ay1 = Math.max(0, Math.min(origH, Math.round(b[1])));
      const ax2 = Math.max(ax1 + 4, Math.min(origW, Math.round(b[2])));
      const ay2 = Math.max(ay1 + 4, Math.min(origH, Math.round(b[3])));

      rawBoxes.push({
        class_id: anchor.class_id !== undefined ? anchor.class_id : 3,
        class_name: anchor.class_name || "sensitive_text",
        confidence: anchor.confidence || 0.999,
        bbox: [ax1, ay1, ax2, ay2],
        is_dom_anchor: true
      });
    });

    // 3. Dual-Tier Semantic Verification & Collision Filtering
    const finalDetections = [];
    const appliedBoxes = [];

    for (const det of rawBoxes) {
      const [x1, y1, x2, y2] = det.bbox;
      const detArea = Math.max(1, (x2 - x1) * (y2 - y1));

      // Rule A: Never blur interactive action buttons unless password or PII
      if (!det.is_dom_anchor) {
        let isButton = false;
        for (const btn of interactiveButtons) {
          const [bx1, by1, bx2, by2] = btn.box || [0, 0, 0, 0];
          const ix1 = Math.max(x1, bx1), iy1 = Math.max(y1, by1);
          const ix2 = Math.min(x2, bx2), iy2 = Math.min(y2, by2);
          if (ix2 > ix1 && iy2 > iy1) {
            const ia = (ix2 - ix1) * (iy2 - iy1);
            if ((ia / detArea > 0.25) && (det.class_name !== "password_field" && det.class_name !== "pii_field")) {
              isButton = true;
              break;
            }
          }
        }
        if (isButton) continue;
      }

      // Rule B: Dual-Tier Semantic Text/PII Verification
      // YOLO detects visual candidate regions (text_block, input_field).
      // A detected text_block or input_field MUST ONLY be blurred if verified as sensitive
      // (passwords, credit cards, API keys, confidential balances).
      // Harmless commercial text (product descriptions, specs tables, blueprints, prices $899.00,
      // quantities, usernames, labels) MUST REMAIN 100% VISIBLE!
      if (!det.is_dom_anchor && !options.isDiagnostic) {
        if (det.class_name === "text_block" || det.class_name === "input_field") {
          let matchedSensitiveAnchor = null;
          for (const anchor of domAnchors) {
            const [ax1, ay1, ax2, ay2] = anchor.box || [0, 0, 0, 0];
            const ix1 = Math.max(x1, ax1), iy1 = Math.max(y1, ay1);
            const ix2 = Math.min(x2, ax2), iy2 = Math.min(y2, ay2);
            if (ix2 > ix1 && iy2 > iy1) {
              const ia = (ix2 - ix1) * (iy2 - iy1);
              if (ia / detArea > 0.15 || ia / Math.max(1, (ax2 - ax1) * (ay2 - ay1)) > 0.15) {
                matchedSensitiveAnchor = anchor;
                break;
              }
            }
          }

          if (!matchedSensitiveAnchor) {
            // Harmless commercial text, product spec, blueprint, price, or general input
            // NEVER BLUR! Keep visible!
            continue;
          } else {
            // Upgrade candidate to verified sensitive class
            det.class_name = matchedSensitiveAnchor.class_name;
            det.class_id = matchedSensitiveAnchor.class_id;
          }
        }
      }

      // Rule C: Check duplicate overlaps
      let isDup = false;
      for (const pb of appliedBoxes) {
        const [px1, py1, px2, py2] = pb;
        const ix1 = Math.max(x1, px1), iy1 = Math.max(y1, py1);
        const ix2 = Math.min(x2, px2), iy2 = Math.min(y2, py2);
        if (ix2 > ix1 && iy2 > iy1) {
          const ia = (ix2 - ix1) * (iy2 - iy1);
          if (ia / detArea > 0.60) {
            isDup = true;
            break;
          }
        }
      }
      if (isDup) continue;

      appliedBoxes.push([x1, y1, x2, y2]);
      finalDetections.push({
        class_id: det.class_id,
        class_name: det.class_name,
        confidence: det.confidence,
        bbox: [x1, y1, x2, y2],
        norm_bbox: [
          parseFloat((x1 / origW).toFixed(6)),
          parseFloat((y1 / origH).toFixed(6)),
          parseFloat((x2 / origW).toFixed(6)),
          parseFloat((y2 / origH).toFixed(6))
        ]
      });
    }

    // 4. In-Memory Canvas Hardware Gaussian Blur + Monochrome Badges
    const redactCanvas = document.createElement("canvas");
    redactCanvas.width = origW;
    redactCanvas.height = origH;
    const rCtx = redactCanvas.getContext("2d");

    // Draw base image
    rCtx.drawImage(img, 0, 0, origW, origH);

    finalDetections.forEach(d => {
      const [x1, y1, x2, y2] = d.bbox;
      const bw = Math.max(4, x2 - x1);
      const bh = Math.max(4, y2 - y1);

      // Hardware Gaussian Blur on clipped ROI
      rCtx.save();
      rCtx.beginPath();
      rCtx.rect(x1, y1, bw, bh);
      rCtx.clip();
      rCtx.filter = "blur(18px)";
      rCtx.drawImage(img, 0, 0, origW, origH);
      rCtx.restore();

      // Monochrome 1.5px border
      rCtx.strokeStyle = "#ffffff";
      rCtx.lineWidth = 1.5;
      rCtx.strokeRect(x1, y1, bw, bh);

      // Monochrome badge
      const badgeLabel = `[${CLASS_BADGES[d.class_name] || "REDACTED"}]`;
      rCtx.font = "bold 10px monospace";
      const tw = rCtx.measureText(badgeLabel).width;
      const badgeH = 15;
      const badgeY = Math.max(0, y1 - badgeH);

      rCtx.fillStyle = "#000000";
      rCtx.fillRect(x1, badgeY, tw + 8, badgeH);
      rCtx.strokeStyle = "#ffffff";
      rCtx.lineWidth = 1;
      rCtx.strokeRect(x1, badgeY, tw + 8, badgeH);
      rCtx.fillStyle = "#ffffff";
      rCtx.fillText(badgeLabel, x1 + 4, badgeY + 11);
    });

    const stats = { face: 0, password_field: 0, pii_field: 0, sensitive_text: 0 };
    finalDetections.forEach(d => {
      if (stats[d.class_name] !== undefined) stats[d.class_name]++;
    });

    const totalElapsedMs = Math.round(performance.now() - startTime);
    const redactedDataUrl = redactCanvas.toDataURL("image/jpeg", 0.82);

    return {
      success: true,
      redacted_screenshot: redactedDataUrl,
      detections: finalDetections,
      privacy_stats: stats,
      redact_latency_ms: totalElapsedMs
    };
  }

  // Backward compatibility alias for diagnostic lab
  async detect(imageSource, confThreshold = 0.20) {
    return this.redact(imageSource, { confThreshold });
  }
}

window.yoloDetector = new YOLO26InBrowserDetector();
