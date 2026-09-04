/**
 * Dedicated Web Worker for YOLO26 In-Browser ONNX Inference
 * Running in a worker thread guarantees that the browser UI NEVER freezes.
 */

// Import official ONNX Runtime Web bundle
importScripts("../lib/ort.all.min.js");

let session = null;
let isInitializing = false;

// Configure WASM paths
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.simd = true;

async function initSession(modelUrl, wasmDir) {
  if (session) return true;
  if (isInitializing) return false;

  isInitializing = true;
  try {
    if (wasmDir) {
      ort.env.wasm.wasmPaths = wasmDir;
    }

    console.log("[Worker] Fetching model:", modelUrl);
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const modelBytes = new Uint8Array(arrayBuffer);

    console.log(`[Worker] Initializing ONNX session (${(modelBytes.byteLength / 1024 / 1024).toFixed(2)} MB)...`);
    
    // Create session with robust WASM provider (Opset 12 compatible)
    session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all"
    });

    console.log("[Worker] [OK] ONNX InferenceSession Ready!", {
      inputs: session.inputNames,
      outputs: session.outputNames
    });

    isInitializing = false;
    return true;
  } catch (err) {
    isInitializing = false;
    console.error("[Worker] Failed to init ONNX session:", err);
    throw err;
  }
}

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    if (type === "INIT") {
      await initSession(payload.modelUrl, payload.wasmDir);
      self.postMessage({ id, success: true, type: "INIT_DONE" });
    } else if (type === "INFER") {
      if (!session) {
        await initSession(payload.modelUrl, payload.wasmDir);
      }

      const startTime = performance.now();
      const inputTensor = new ort.Tensor("float32", payload.float32Data, [1, 3, 640, 640]);
      const feeds = { [session.inputNames[0]]: inputTensor };

      const results = await session.run(feeds);
      const outputTensor = results[session.outputNames[0]];
      const outputData = outputTensor.data; // Float32Array of [1, 300, 6]

      const elapsedMs = Math.round(performance.now() - startTime);

      self.postMessage({
        id,
        success: true,
        type: "INFER_DONE",
        output: Array.from(outputData),
        inference_ms: elapsedMs
      });
    }
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err.message
    });
  }
};
