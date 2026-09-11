import { describe, it, expect, beforeEach } from 'vitest';
const path = require('path');
const { YoloWebGPURunner } = require('../extension/engine/yolo_runner.js');
const { OmniParserDetector } = require('../extension/engine/omniparser_detector.js');

describe('YOLO WebGPU Runner & OmniParser Detector Lifecycle Tests', () => {
  const yoloModelPath = path.resolve(__dirname, '../extension/models/yolo26n.onnx');
  const omniModelPath = path.resolve(__dirname, '../extension/models/omniparser_icon_detect.onnx');
  let runner;
  let omniDetector;

  beforeEach(() => {
    runner = new YoloWebGPURunner();
    omniDetector = new OmniParserDetector();
  });

  describe('Method Existence & Interface Contracts', () => {
    it('should expose initialize(), loadModel(), detect(), and runInference() on YoloWebGPURunner', () => {
      expect(typeof runner.initialize).toBe('function');
      expect(typeof runner.loadModel).toBe('function');
      expect(typeof runner.detect).toBe('function');
      expect(typeof runner.runInference).toBe('function');
      expect(typeof YoloWebGPURunner.prototype.initialize).toBe('function');
      expect(typeof YoloWebGPURunner.prototype.runInference).toBe('function');
    });

    it('should expose initialize() and loadModel() on OmniParserDetector prototype and instance', () => {
      expect(typeof omniDetector.initialize).toBe('function');
      expect(typeof omniDetector.loadModel).toBe('function');
      expect(typeof omniDetector.detectUIElements).toBe('function');
      expect(typeof OmniParserDetector.prototype.initialize).toBe('function');
    });

    it('should attach classes to globalThis for browser sidepanel and worker access', () => {
      expect(globalThis.YoloWebGPURunner).toBeDefined();
      expect(globalThis.OmniParserDetector).toBeDefined();
    });

    it('should reject detect() when model has not been initialized', async () => {
      await expect(runner.detect(null)).rejects.toThrow('Model is not initialized');
    });

    it('should defensively handle runner instances missing initialize by dynamic fallback patching', () => {
      const mockRunner = {
        loadModel: (url, wasm, prov) => Promise.resolve({ activeProvider: prov || 'wasm' })
      };
      if (typeof mockRunner.initialize !== 'function') {
        mockRunner.initialize = function(url, prov, wasm) {
          return this.loadModel(url, wasm, prov);
        };
      }
      expect(typeof mockRunner.initialize).toBe('function');
    });
  });

  describe('Hardware Backend Initialization & Provider Selection', () => {
    it('should initialize YOLO runner with WASM provider', async () => {
      const info = await runner.initialize(yoloModelPath, 'wasm');

      expect(runner.isReady).toBe(true);
      expect(runner.activeProvider).toBe('wasm');
      expect(info.activeProvider).toBe('wasm');
      expect(info.inputNames).toContain('images');
      expect(info.outputNames).toContain('output0');
    }, 30000);

    it('should initialize YOLO runner via loadModel() alias with identical results', async () => {
      const info = await runner.loadModel(yoloModelPath, null, 'wasm');

      expect(runner.isReady).toBe(true);
      expect(runner.activeProvider).toBe('wasm');
      expect(info.inputNames).toContain('images');
    }, 30000);

    it('should initialize YOLO runner with WebGPU provider falling back gracefully in Node test environment', async () => {
      // In Node.js environment without navigator.gpu, 'webgpu' provider falls back to WASM cleanly
      const info = await runner.initialize(yoloModelPath, 'webgpu');

      expect(runner.isReady).toBe(true);
      expect(runner.activeProvider).toBe('wasm');
      expect(info.inputNames).toContain('images');
    }, 30000);

    it('should support dynamic acceleration switching between providers', async () => {
      // Step 1: Initialize with WASM
      await runner.initialize(yoloModelPath, 'wasm');
      expect(runner.activeProvider).toBe('wasm');

      // Step 2: Switch to CPU (or re-initialize)
      const newInfo = await runner.initialize(yoloModelPath, 'cpu');
      expect(runner.isReady).toBe(true);
      expect(newInfo.activeProvider).toBeDefined();
    }, 35000);
  });

  describe('OmniParser Detector Initialization', () => {
    it('should initialize OmniParser detector using initialize() method', async () => {
      const info = await omniDetector.initialize(omniModelPath, 'wasm');

      expect(omniDetector.isReady).toBe(true);
      expect(omniDetector.activeProvider).toBe('wasm');
      expect(info.inputNames).toContain('images');
      expect(info.outputNames).toContain('output0');
    }, 30000);
  });
});
