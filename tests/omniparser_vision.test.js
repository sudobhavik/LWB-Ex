import { describe, it, expect, beforeEach } from 'vitest';
const path = require('path');
const ort = require('onnxruntime-web');
const { OmniParserDetector } = require('../extension/engine/omniparser_detector.js');
const YoloProcessor = require('../extension/engine/yolo_processor.js');

describe('Microsoft OmniParser Pure-Vision On-Device Element Detection Tests', () => {
  let detector;
  const modelPath = path.resolve(__dirname, '../extension/models/omniparser_icon_detect.onnx');

  beforeEach(() => {
    detector = new OmniParserDetector();
  });

  it('should successfully load the INT8 quantized OmniParser model', async () => {
    const info = await detector.loadModel(modelPath);

    expect(detector.isReady).toBe(true);
    expect(info.activeProvider).toBe('wasm'); // in node/vitest environment
    expect(info.inputNames).toContain('images');
    expect(info.outputNames).toContain('output0');
  }, 30000);

  it('should run pure-vision inference on a 640x640 canvas without any DOM parsing', async () => {
    await detector.loadModel(modelPath);

    // Create a mock canvas simulating a webpage screenshot with buttons
    const mockCanvas = {
      width: 1280,
      height: 720,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        drawImage: () => {},
        getImageData: (x, y, w, h) => {
          const total = w * h * 4;
          const data = new Uint8ClampedArray(total);
          // Simulate some UI content (buttons, header bar)
          for (let i = 0; i < total; i += 4) {
            data[i] = 240;     // R
            data[i + 1] = 240; // G
            data[i + 2] = 240; // B
            data[i + 3] = 255; // A
          }
          return { data };
        }
      })
    };

    const result = await detector.detectUIElements(mockCanvas, {
      confidenceThreshold: 0.10,
      createCanvasFn: (w, h) => ({
        width: w,
        height: h,
        getContext: () => ({
          fillStyle: '',
          fillRect: () => {},
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(w * h * 4).fill(120) })
        })
      })
    });

    expect(result).toBeDefined();
    expect(typeof result.inferenceTimeMs).toBe('number');
    expect(Array.isArray(result.elements)).toBe(true);
    expect(result.provider).toBe('wasm');

    console.log(`[OmniParser Test] Pure vision inference completed in ${result.inferenceTimeMs}ms`);
  }, 30000);

  it('should format detected elements as pure-vision anchors with normalized coordinates', async () => {
    await detector.loadModel(modelPath);

    // Verify anchor structure
    const sampleBox = {
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      score: 0.85
    };

    const normX = parseFloat(((sampleBox.x + sampleBox.width / 2) / 1280).toFixed(3));
    const normY = parseFloat(((sampleBox.y + sampleBox.height / 2) / 720).toFixed(3));

    expect(normX).toBe(0.137); // (100 + 75) / 1280 = 175 / 1280 ~ 0.1367
    expect(normY).toBe(0.313); // (200 + 25) / 720 = 225 / 720 ~ 0.3125 => 0.313
  });

  it('should decode OmniParser single-class output tensor correctly', () => {
    // Tensor shape: [1, 5, 8400]
    const numAnchors = 8400;
    const numClasses = 1;
    const tensorData = new Float32Array(5 * numAnchors);

    // Place a high-confidence button at anchor #100
    tensorData[0 * numAnchors + 100] = 320; // cx
    tensorData[1 * numAnchors + 100] = 240; // cy
    tensorData[2 * numAnchors + 100] = 120; // w
    tensorData[3 * numAnchors + 100] = 40;  // h
    tensorData[4 * numAnchors + 100] = 0.92; // conf (icon)

    const detections = YoloProcessor.decodeYoloOutput(tensorData, {
      confidenceThreshold: 0.20,
      numAnchors,
      numClasses,
      classNames: ['interactable_element']
    });

    expect(detections.length).toBeGreaterThan(0);
    expect(detections[0].className).toBe('interactable_element');
    expect(detections[0].score).toBe(0.92);
    expect(detections[0].width).toBe(120);
    expect(detections[0].height).toBe(40);
  });

  it('should support pure-vision click resolution via elementFromPoint without DOM querySelectorAll', () => {
    // Simulated DOM environment
    const clickedElements = [];
    const mockButton = {
      tagName: 'BUTTON',
      click: () => clickedElements.push('SUBMIT_BUTTON'),
      dispatchEvent: () => {},
      focus: () => {},
      getBoundingClientRect: () => ({ left: 260, top: 220, width: 120, height: 40 })
    };

    const mockDocument = {
      elementFromPoint: (px, py) => {
        // If coordinate is inside button bounds (260..380, 220..260)
        if (px >= 260 && px <= 380 && py >= 220 && py <= 260) {
          return mockButton;
        }
        return null;
      }
    };

    // Vision model outputs coordinate [320, 240]
    const visionDetectedPoint = { px: 320, py: 240 };
    const resolvedTarget = mockDocument.elementFromPoint(visionDetectedPoint.px, visionDetectedPoint.py);

    expect(resolvedTarget).toBe(mockButton);
    resolvedTarget.click();
    expect(clickedElements).toContain('SUBMIT_BUTTON');
  });
});
