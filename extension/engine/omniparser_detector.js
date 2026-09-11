/**
 * Microsoft OmniParser v2 On-Device Pure-Vision UI Element Detector
 * Runs the fine-tuned OmniParser icon_detect model (YOLOv8 architecture) via WebGPU / ONNX Runtime Web.
 * Detects buttons, icons, inputs, and clickable elements directly from screenshot pixels
 * without requiring any HTML DOM parsing or querySelectorAll calls.
 */

class OmniParserDetector {
  constructor() {
    this.session = null;
    this.activeProvider = null;
    this.isLoading = false;
    this.isReady = false;
    this.modelPath = null;
    this.processor = typeof YoloProcessor !== 'undefined' ? YoloProcessor : (typeof require !== 'undefined' ? require('./yolo_processor') : null);
  }

  /**
   * Initializes the OmniParser detector with the ONNX model.
   *
   * @param {string} modelUrl - URL or file path to omniparser_icon_detect.onnx
   * @param {string} [preferredProvider='webgpu'] - 'webgpu' | 'wasm' | 'cpu'
   * @param {string} [wasmDir=null] - Optional WASM assets directory
   * @returns {Promise<{ activeProvider: string, inputNames: string[], outputNames: string[] }>}
   */
  async initialize(modelUrl, preferredProvider = 'webgpu', wasmDir = null) {
    return this.loadModel(modelUrl, wasmDir, preferredProvider);
  }

  /**
   * Loads the INT8 quantized OmniParser icon_detect ONNX model.
   * Prioritizes WebGPU execution provider with graceful WASM fallback.
   *
   * @param {string} modelUrl - URL or file path to omniparser_icon_detect.onnx
   * @param {string} [wasmDir] - Optional WASM assets directory
   * @param {string} [preferredProvider='webgpu'] - Optional provider
   * @returns {Promise<{ activeProvider: string, inputNames: string[], outputNames: string[] }>}
   */
  async loadModel(modelUrl, wasmDir = null, preferredProvider = 'webgpu') {
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

    // Configure WASM asset location and single-thread execution for Chrome MV3 CSP compatibility
    const defaultWasmDir = (typeof browserAPI !== 'undefined' && browserAPI.runtime?.getURL)
      ? browserAPI.runtime.getURL('lib/')
      : ((typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('lib/') : null);
    const effectiveWasmDir = wasmDir || defaultWasmDir;

    if (ortInstance.env && ortInstance.env.wasm) {
      if (effectiveWasmDir) {
        const base = effectiveWasmDir.endsWith('/') ? effectiveWasmDir : `${effectiveWasmDir}/`;
        ortInstance.env.wasm.wasmPaths = {
          'ort-wasm.wasm': `${base}ort-wasm.wasm`,
          'ort-wasm-simd.wasm': `${base}ort-wasm-simd.wasm`,
          'ort-wasm-threaded.wasm': `${base}ort-wasm-threaded.wasm`,
          'ort-wasm-simd-threaded.wasm': `${base}ort-wasm-simd-threaded.wasm`,
          'ort-wasm-simd-threaded.jsep.wasm': `${base}ort-wasm-simd-threaded.jsep.wasm`
        };
      }
      ortInstance.env.wasm.numThreads = 1;
      ortInstance.env.wasm.proxy = false;
    }

    let session = null;
    let provider = null;

    const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
    if (hasWebGPU) {
      try {
        console.log('[OmniParser] Attempting WebGPU execution provider...');
        session = await ortInstance.InferenceSession.create(modelUrl, {
          executionProviders: ['webgpu'],
          logSeverityLevel: 3
        });
        provider = 'webgpu';
        console.log('[OmniParser] WebGPU session initialized successfully on GPU.');
      } catch (err) {
        console.warn('[OmniParser] WebGPU session initialization failed, falling back to WASM:', err);
      }
    }

    if (!session) {
      try {
        console.log('[OmniParser] Loading session with WebAssembly (WASM) provider...');
        session = await ortInstance.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm'],
          logSeverityLevel: 3
        });
        provider = 'wasm';
        console.log('[OmniParser] WASM session initialized successfully.');
      } catch (err) {
        this.isLoading = false;
        throw new Error(`Failed to load OmniParser model with any provider: ${err.message}`);
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
   * Performs pure vision element detection on an image, canvas, or bitmap.
   * Returns normalized interactable bounding boxes.
   *
   * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} imageSource
   * @param {Object} [options]
   * @param {number} [options.confidenceThreshold=0.15]
   * @param {number} [options.iouThreshold=0.45]
   * @returns {Promise<{ elements: Array, inferenceTimeMs: number, provider: string, letterboxCanvas: HTMLCanvasElement }>}
   */
  async detectUIElements(imageSource, options = {}) {
    if (!this.session) {
      throw new Error('OmniParser model is not loaded. Call loadModel() first.');
    }

    const ortInstance = typeof ort !== 'undefined' ? ort : (typeof require !== 'undefined' ? require('onnxruntime-web') : null);
    const processor = this.processor;

    const srcW = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width;
    const srcH = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height;

    // 1. Letterbox to 640x640
    const letterboxResult = processor.letterboxImage(imageSource, 640, 640, options.createCanvasFn);

    // 2. Preprocess to Float32 Tensor [1, 3, 640, 640]
    const tensorData = processor.canvasToNCHW(letterboxResult.canvas, 640, 640);
    const inputTensor = new ortInstance.Tensor('float32', tensorData, [1, 3, 640, 640]);

    // 3. Run Inference
    const t0 = performance.now();
    const inputName = this.session.inputNames[0] || 'images';
    const feeds = { [inputName]: inputTensor };
    const results = await this.session.run(feeds);
    const inferenceTimeMs = Math.round(performance.now() - t0);

    // 4. Decode YOLOv8 Icon Detect Outputs
    const outputName = this.session.outputNames[0] || 'output0';
    const rawOutput = results[outputName];
    const detections = processor.decodeYoloOutput(rawOutput.data, {
      confidenceThreshold: options.confidenceThreshold ?? 0.15,
      iouThreshold: options.iouThreshold ?? 0.45,
      letterboxInfo: letterboxResult
    });

    // Convert raw bounding boxes into pure-vision interactive anchors
    const elements = detections.map((det, idx) => {
      const centerX = det.x + det.width / 2;
      const centerY = det.y + det.height / 2;
      return {
        index: idx + 1,
        label: `[INTERACTABLE_UI_${idx + 1}]`,
        tag: 'vision_element',
        role: 'button',
        confidence: det.score,
        x: det.x,
        y: det.y,
        width: det.width,
        height: det.height,
        normX: parseFloat((centerX / srcW).toFixed(3)),
        normY: parseFloat((centerY / srcH).toFixed(3)),
        source: 'omniparser_vision'
      };
    });

    return {
      elements,
      inferenceTimeMs,
      provider: this.activeProvider,
      letterboxCanvas: letterboxResult.canvas
    };
  }
}

// Explicit prototype mappings to guarantee initialize exists
OmniParserDetector.prototype.initialize = function(modelUrl, preferredProvider = 'webgpu', wasmDir = null) {
  return this.loadModel(modelUrl, wasmDir, preferredProvider);
};

// Universal export
if (typeof window !== 'undefined') {
  window.OmniParserDetector = OmniParserDetector;
}
if (typeof globalThis !== 'undefined') {
  globalThis.OmniParserDetector = OmniParserDetector;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OmniParserDetector };
}
