import { describe, it, expect } from 'vitest';
const path = require('path');
const ort = require('onnxruntime-web');
const { decodeYoloOutput } = require('../extension/engine/yolo_processor.js');

describe('YOLO Model Graph Integration Test', () => {
  it('should load yolo26n.onnx and execute inference on a 640x640 tensor', async () => {
    const modelPath = path.resolve(__dirname, '../extension/models/yolo26n.onnx');

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['wasm']
    });

    expect(session.inputNames).toContain('images');
    expect(session.outputNames).toContain('output0');

    // Prepare 640x640 synthetic input
    const inputData = new Float32Array(1 * 3 * 640 * 640);
    // Fill with neutral gray (letterbox fill standard: 114 / 255 ~ 0.447)
    inputData.fill(0.447);

    const tensor = new ort.Tensor('float32', inputData, [1, 3, 640, 640]);
    const feeds = { images: tensor };

    const start = performance.now();
    const results = await session.run(feeds);
    const duration = performance.now() - start;

    expect(results.output0).toBeDefined();
    expect(results.output0.dims).toEqual([1, 7, 8400]);
    expect(results.output0.data.length).toBe(58800);

    const detections = decodeYoloOutput(results.output0.data, {
      confidenceThreshold: 0.25,
      iouThreshold: 0.45
    });

    // Valid array should be returned without throwing
    expect(Array.isArray(detections)).toBe(true);
    console.log(`[Integration] Execution time: ${Math.round(duration)}ms, detections on neutral image: ${detections.length}`);
  }, 30000);
});
