/**
 * YOLO WebGPU Inference Runner
 * Manages the ONNX Runtime Web session, executes the YOLO model using WebGPU,
 * handles automatic graceful fallback to WASM when WebGPU is unavailable,
 * and formats detection results.
 */

class YoloWebGPURunner {
  constructor() {
    this.session = null;
    this.activeProvider = null;
    this.isLoading = false;
    this.isReady = false;
    this.modelPath = null;
    this.processor = typeof YoloProcessor !== 'undefined' ? YoloProcessor : (typeof require !== 'undefined' ? require('./yolo_processor') : null);
  }

  /**
   * Initializes the ONNX Runtime Web session.
   * Prioritizes WebGPU execution provider with automatic WASM fallback.
   *
   * @param {string} modelUrl - URL or relative path to yolo26n.onnx
   * @param {string} [wasmDir] - URL or path to WASM assets directory
   * @returns {Promise<{ activeProvider: string, inputNames: string[], outputNames: string[] }>}
   */
  async loadModel(modelUrl, wasmDir = null) {
    if (this.isReady && this.session) {
      return {
        activeProvider: this.activeProvider,
        inputNames: this.session.inputNames,
        outputNames: this.session.outputNames
      };
    }

    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(res => setTimeout(res, 50));
      }
      return {
        activeProvider: this.activeProvider,
        inputNames: this.session.inputNames,
        outputNames: this.session.outputNames
      };
    }

    this.isLoading = true;
    this.modelPath = modelUrl;

    const ortInstance = typeof ort !== 'undefined' ? ort : (typeof require !== 'undefined' ? require('onnxruntime-web') : null);
    if (!ortInstance) {
      this.isLoading = false;
      throw new Error('ONNX Runtime Web library (ort) is not available');
    }

    if (ortInstance.env) {
      ortInstance.env.logLevel = 'error';
    }

    // Configure WASM asset location for MV3 CSP compatibility
    if (wasmDir && ortInstance.env && ortInstance.env.wasm) {
      ortInstance.env.wasm.wasmPaths = wasmDir.endsWith('/') ? wasmDir : `${wasmDir}/`;
    }

    // Attempt 1: WebGPU Provider
    let session = null;
    let provider = null;

    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    if (hasWebGPU) {
      try {
        console.log('[YoloRunner] WebGPU detected in browser. Querying adapter...');
        if (ortInstance.env && ortInstance.env.webgpu) {
          ortInstance.env.webgpu.validateInputContent = false;
        }

        try {
          const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
            || await navigator.gpu.requestAdapter();
          if (adapter && adapter.info) {
            console.log('[YoloRunner] GPU Adapter:', adapter.info.vendor, adapter.info.architecture || adapter.info.device || '');
          }
        } catch (_) {}

        console.log('[YoloRunner] Attempting to load model with WebGPU provider...');
        try {
          session = await ortInstance.InferenceSession.create(modelUrl, {
            executionProviders: [{
              name: 'webgpu',
              deviceType: 'gpu',
              powerPreference: 'high-performance'
            }],
            logSeverityLevel: 3
          });
        } catch (optsErr) {
          console.log('[YoloRunner] Trying standard executionProviders array:', optsErr.message);
          session = await ortInstance.InferenceSession.create(modelUrl, {
            executionProviders: ['webgpu'],
            logSeverityLevel: 3
          });
        }

        provider = 'webgpu';
        console.log('[YoloRunner] WebGPU session initialized successfully on GPU.');
      } catch (err) {
        console.warn('[YoloRunner] WebGPU session initialization failed, falling back to WASM:', err);
      }
    } else {
      console.log('[YoloRunner] navigator.gpu not detected (ensure browser is launched with --enable-unsafe-webgpu --ignore-gpu-blocklist), using WASM.');
    }

    // Attempt 2: WASM Fallback Provider
    if (!session) {
      try {
        console.log('[YoloRunner] Initializing with WASM provider...');
        session = await ortInstance.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          logSeverityLevel: 3
        });
        provider = 'wasm';
        console.log('[YoloRunner] WASM session initialized successfully.');
      } catch (err) {
        this.isLoading = false;
        throw new Error(`Failed to load ONNX model with both WebGPU and WASM: ${err.message}`);
      }
    }

    this.session = session;
    this.activeProvider = provider;
    this.isReady = true;
    this.isLoading = false;

    return {
      activeProvider: this.activeProvider,
      inputNames: session.inputNames,
      outputNames: session.outputNames
    };
  }

  /**
   * Runs inference on an image source (Image, Canvas, or Bitmap).
   *
   * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} imageSource
   * @param {Object} [options]
   * @param {number} [options.confidenceThreshold=0.25]
   * @param {number} [options.iouThreshold=0.45]
   * @returns {Promise<{ detections: Array, latencyMs: number, activeProvider: string, letterbox: Object }>}
   */
  async detect(imageSource, options = {}) {
    if (!this.session) {
      throw new Error('Model is not initialized. Call loadModel() first.');
    }

    const ortInstance = typeof ort !== 'undefined' ? ort : (typeof require !== 'undefined' ? require('onnxruntime-web') : null);
    const processor = this.processor;

    // 1. Letterbox image to 640x640
    const letterbox = processor.letterboxImage(imageSource, 640, 640);

    // 2. Extract NCHW Float32Array
    const tensorData = processor.canvasToNCHW(letterbox.canvas, 640, 640);
    const inputTensor = new ortInstance.Tensor('float32', tensorData, [1, 3, 640, 640]);

    // 3. Measure inference execution
    const startTime = performance.now();
    const feeds = {};
    const inputName = this.session.inputNames[0] || 'images';
    feeds[inputName] = inputTensor;

    const results = await this.session.run(feeds);
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    // 4. Decode outputs
    const outputName = this.session.outputNames[0] || 'output0';
    const rawOutput = results[outputName];
    const detections = processor.decodeYoloOutput(rawOutput.data, {
      confidenceThreshold: options.confidenceThreshold ?? 0.25,
      iouThreshold: options.iouThreshold ?? 0.45,
      letterboxInfo: letterbox
    });

    return {
      detections,
      latencyMs,
      activeProvider: this.activeProvider,
      letterboxCanvas: letterbox.canvas,
      letterboxInfo: letterbox
    };
  }
}

if (typeof exports !== 'undefined') {
  module.exports = { YoloWebGPURunner };
} else if (typeof globalThis !== 'undefined') {
  globalThis.YoloWebGPURunner = YoloWebGPURunner;
}
