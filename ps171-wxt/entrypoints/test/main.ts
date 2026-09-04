// PS171 Diagnostic Lab Script — WXT In-Browser ONNX Inference Suite

const PRIVACY_CLASSES: Record<number, string> = {
  0: "face",
  1: "password_field",
  2: "pii_field",
  3: "sensitive_text"
};

const CLASS_COLORS: Record<string, string> = {
  face: "#10b981",
  password_field: "#f43f5e",
  pii_field: "#f59e0b",
  sensitive_text: "#8b5cf6"
};

class YOLO26InBrowserDetector {
  private worker: Worker | null = null;
  public isReady: boolean = false;
  private msgId: number = 0;
  private pendingCallbacks: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  async init(modelName = "yolo26n.onnx"): Promise<boolean> {
    if (this.isReady && this.worker) return true;

    return new Promise((resolve, reject) => {
      try {
        const workerUrl = chrome.runtime.getURL("engine/yolo_worker.js");
        const modelUrl = chrome.runtime.getURL(`models/${modelName}`);
        const wasmDir = chrome.runtime.getURL("lib/") + "/";

        console.log(`[PS171 Lab] Spawning ONNX Worker at ${workerUrl}...`);
        this.worker = new Worker(workerUrl);

        this.worker.onmessage = (e: MessageEvent) => {
          const { id, success, type, error, output, inference_ms } = e.data;
          if (this.pendingCallbacks.has(id)) {
            const cb = this.pendingCallbacks.get(id)!;
            this.pendingCallbacks.delete(id);

            if (success) {
              cb.resolve({ type, output, inference_ms });
            } else {
              cb.reject(new Error(error || "Worker error"));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.error("[PS171 Lab Worker Error]:", err);
          reject(new Error("Worker initialization error"));
        };

        const reqId = ++this.msgId;
        this.pendingCallbacks.set(reqId, {
          resolve: () => {
            console.log("[PS171 Lab] [OK] ONNX Model Loaded!");
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
        console.error("[PS171 Lab] Worker spawn failed:", err);
        reject(err);
      }
    });
  }

  async preprocessImage(imageSource: string | HTMLImageElement, targetW = 640, targetH = 640) {
    let img: HTMLImageElement;
    if (typeof imageSource === "string") {
      img = new Image();
      img.src = imageSource;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
    } else {
      img = imageSource;
    }

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    const scale = Math.min(targetW / origW, targetH / origH);
    const newW = Math.round(origW * scale);
    const newH = Math.round(origH * scale);
    const padX = Math.round((targetW - newW) / 2);
    const padY = Math.round((targetH - newH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    ctx.fillStyle = "#727272";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, padX, padY, newW, newH);

    const imageData = ctx.getImageData(0, 0, targetW, targetH);
    const rgba = imageData.data;

    const float32Data = new Float32Array(3 * targetW * targetH);
    const channelSize = targetW * targetH;

    for (let i = 0; i < channelSize; i++) {
      float32Data[i] = rgba[i * 4] / 255.0;
      float32Data[channelSize + i] = rgba[i * 4 + 1] / 255.0;
      float32Data[2 * channelSize + i] = rgba[i * 4 + 2] / 255.0;
    }

    return { float32Data, origW, origH, scale, padX, padY };
  }

  async detect(imageSource: string | HTMLImageElement, confThreshold = 0.25) {
    if (!this.isReady) await this.init();

    const startTime = performance.now();
    const { float32Data, origW, origH, scale, padX, padY } = await this.preprocessImage(imageSource, 640, 640);

    const reqId = ++this.msgId;
    const workerResult: any = await new Promise((resolve, reject) => {
      this.pendingCallbacks.set(reqId, { resolve, reject });
      this.worker!.postMessage({
        id: reqId,
        type: "INFER",
        payload: { float32Data }
      });
    });

    const outputData = workerResult.output;
    const detections: any[] = [];
    const numPredictions = 300;

    for (let i = 0; i < numPredictions; i++) {
      const offset = i * 6;
      const score = outputData[offset + 4];

      if (score >= confThreshold) {
        const x1_640 = outputData[offset + 0];
        const y1_640 = outputData[offset + 1];
        const x2_640 = outputData[offset + 2];
        const y2_640 = outputData[offset + 3];
        const classId = Math.round(outputData[offset + 5]);

        const orig_x1 = Math.max(0.0, Math.min(origW, (x1_640 - padX) / scale));
        const orig_y1 = Math.max(0.0, Math.min(origH, (y1_640 - padY) / scale));
        const orig_x2 = Math.max(0.0, Math.min(origW, (x2_640 - padX) / scale));
        const orig_y2 = Math.max(0.0, Math.min(origH, (y2_640 - padY) / scale));

        const clsName = PRIVACY_CLASSES[classId] || `class_${classId}`;

        detections.push({
          class_id: classId,
          class_name: clsName,
          confidence: parseFloat(score.toFixed(4)),
          bbox: [Math.round(orig_x1), Math.round(orig_y1), Math.round(orig_x2), Math.round(orig_y2)]
        });
      }
    }

    const totalElapsedMs = Math.round(performance.now() - startTime);

    // Draw annotated preview
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = origW;
    previewCanvas.height = origH;
    const pCtx = previewCanvas.getContext("2d")!;

    let origImg: HTMLImageElement;
    if (typeof imageSource === "string") {
      origImg = new Image();
      origImg.src = imageSource;
      await new Promise((r) => { origImg.onload = r; });
    } else {
      origImg = imageSource;
    }
    pCtx.drawImage(origImg, 0, 0, origW, origH);

    detections.forEach((d) => {
      const [x1, y1, x2, y2] = d.bbox;
      const bw = x2 - x1;
      const bh = y2 - y1;
      const col = CLASS_COLORS[d.class_name] || "#3b82f6";

      pCtx.strokeStyle = col;
      pCtx.lineWidth = 3;
      pCtx.strokeRect(x1, y1, bw, bh);

      const labelText = `${d.class_name} ${Math.round(d.confidence * 100)}%`;
      pCtx.font = "bold 13px sans-serif";
      const textWidth = pCtx.measureText(labelText).width;

      pCtx.fillStyle = col;
      pCtx.fillRect(x1, Math.max(0, y1 - 22), textWidth + 10, 22);
      pCtx.fillStyle = "#ffffff";
      pCtx.fillText(labelText, x1 + 5, Math.max(16, y1 - 6));
    });

    return {
      success: true,
      detections,
      inference_ms: workerResult.inference_ms || totalElapsedMs,
      annotated_image: previewCanvas.toDataURL("image/jpeg", 0.85)
    };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const detector = new YOLO26InBrowserDetector();
  const statusBadge = document.getElementById("status-badge") as HTMLElement;

  const btnTestPhoto = document.getElementById("btn-test-photo") as HTMLButtonElement;
  const btnTestScreen = document.getElementById("btn-test-screen") as HTMLButtonElement;
  const btnUpload = document.getElementById("btn-upload") as HTMLButtonElement;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;

  const sliderConf = document.getElementById("slider-conf") as HTMLInputElement;
  const valConf = document.getElementById("val-conf") as HTMLElement;

  const statTime = document.getElementById("stat-time") as HTMLElement;
  const statFaces = document.getElementById("stat-faces") as HTMLElement;
  const statPwd = document.getElementById("stat-pwd") as HTMLElement;
  const statPii = document.getElementById("stat-pii") as HTMLElement;
  const statText = document.getElementById("stat-text") as HTMLElement;

  const imgOrig = document.getElementById("img-orig") as HTMLImageElement;
  const imgAnnotated = document.getElementById("img-annotated") as HTMLImageElement;
  const jsonOutput = document.getElementById("json-output") as HTMLElement;

  sliderConf.addEventListener("input", () => {
    valConf.textContent = `${sliderConf.value}%`;
  });

  try {
    statusBadge.textContent = "Loading YOLO26n Model...";
    await detector.init();
    statusBadge.textContent = "Engine Ready (WASM SIMD)";
    statusBadge.style.background = "#10b98122";
    statusBadge.style.color = "#10b981";
  } catch (e: any) {
    statusBadge.textContent = "Engine Error";
    statusBadge.style.background = "#f43f5e22";
    statusBadge.style.color = "#f43f5e";
    console.error(e);
  }

  async function runInference(imgUrl: string) {
    const conf = parseInt(sliderConf.value, 10) / 100;
    imgOrig.src = imgUrl;
    imgOrig.style.display = "block";
    statusBadge.textContent = "Running Inference...";

    try {
      const res = await detector.detect(imgUrl, conf);
      imgAnnotated.src = res.annotated_image;
      imgAnnotated.style.display = "block";

      statTime.textContent = `${res.inference_ms} ms`;

      const counts = { face: 0, password_field: 0, pii_field: 0, sensitive_text: 0 };
      res.detections.forEach((d: any) => {
        if (counts[d.class_name as keyof typeof counts] !== undefined) {
          counts[d.class_name as keyof typeof counts]++;
        }
      });

      statFaces.textContent = counts.face.toString();
      statPwd.textContent = counts.password_field.toString();
      statPii.textContent = counts.pii_field.toString();
      statText.textContent = counts.sensitive_text.toString();

      statusBadge.textContent = `Completed (${res.detections.length} masked)`;
      jsonOutput.textContent = JSON.stringify(res.detections, null, 2);
    } catch (err: any) {
      statusBadge.textContent = "Error";
      alert("Inference failed: " + err.message);
    }
  }

  btnTestPhoto.addEventListener("click", () => {
    runInference(chrome.runtime.getURL("assets/sample_face.jpg"));
  });

  btnTestScreen.addEventListener("click", () => {
    runInference(chrome.runtime.getURL("assets/sample_login.jpg"));
  });

  btnUpload.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => runInference(re.target?.result as string);
      reader.readAsDataURL(file);
    }
  });
});
