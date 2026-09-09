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
   * Loads the INT8 quantized OmniParser icon_detect ONNX model.
   * Prioritizes WebGPU execution provider with graceful WASM fallback.
   *
   * @param {string} modelUrl - URL or file path to omniparser_icon_detect.onnx
   * @param {string} [wasmDir] - Optional WASM assets directory
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

    if (wasmDir && ortInstance.env && ortInstance.env.wasm) {
      ortInstance.env.wasm.wasmPaths = wasmDir.endsWith('/') ? wasmDir : `${wasmDir}/`;
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
      activeProvider: provider,
      inputNames: session.inputNames,
      outputNames: session.outputNames
    };
  }

  /**
   * Detects all interactable UI elements purely from image pixels without DOM parsing.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap|Object} imageSource
   * @param {Object} [options]
   * @param {number} [options.confidenceThreshold=0.15]
   * @param {number} [options.iouThreshold=0.45]
   * @param {Function} [options.createCanvasFn]
   * @returns {Promise<{ elements: Array<Object>, inferenceTimeMs: number, provider: string }>}
   */
  async detectUIElements(imageSource, options = {}) {
    if (!this.isReady || !this.session) {
      throw new Error('OmniParser model is not loaded. Call loadModel() first.');
    }

    const ortInstance = typeof ort !== 'undefined' ? ort : (typeof require !== 'undefined' ? require('onnxruntime-web') : null);
    const confidenceThreshold = options.confidenceThreshold ?? 0.15;
    const iouThreshold = options.iouThreshold ?? 0.45;
    const createCanvasFn = options.createCanvasFn || null;

    const letterboxResult = this.processor.letterboxImage(imageSource, 640, 640, createCanvasFn);
    const tensorData = this.processor.canvasToNCHW(letterboxResult.canvas, 640, 640);

    const tensor = new ortInstance.Tensor('float32', tensorData, [1, 3, 640, 640]);
    const inputName = this.session.inputNames[0] || 'images';
    const feeds = { [inputName]: tensor };

    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const results = await this.session.run(feeds);
    const inferenceTimeMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);

    const outputName = this.session.outputNames[0] || 'output0';
    const outputTensor = results[outputName];
    if (!outputTensor || !outputTensor.data) {
      throw new Error(`OmniParser model did not return output tensor: ${outputName}`);
    }

    const detections = this.processor.decodeYoloOutput(outputTensor.data, {
      confidenceThreshold,
      iouThreshold,
      letterboxInfo: letterboxResult,
      numAnchors: 8400,
      numClasses: 1,
      classNames: ['interactable_element']
    });

    const srcW = letterboxResult.srcWidth || 1920;
    const srcH = letterboxResult.srcHeight || 1080;

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OmniParserDetector };
}
if (typeof window !== 'undefined') {
  window.OmniParserDetector = OmniParserDetector;
}
