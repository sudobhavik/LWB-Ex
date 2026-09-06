import { describe, it, expect } from 'vitest';
const {
  CLASS_NAMES,
  computeIoU,
  nonMaxSuppression,
  decodeYoloOutput,
  letterboxImage
} = require('../extension/engine/yolo_processor.js');

describe('YOLO Processor Unit Tests', () => {
  it('should verify class name definitions', () => {
    expect(CLASS_NAMES).toEqual(['face', 'input_field', 'text_block']);
  });

  describe('computeIoU', () => {
    it('should return 1.0 for identical boxes', () => {
      const box = [10, 10, 50, 50];
      expect(computeIoU(box, box)).toBe(1.0);
    });

    it('should return 0.0 for disjoint boxes', () => {
      const boxA = [0, 0, 10, 10];
      const boxB = [20, 20, 30, 30];
      expect(computeIoU(boxA, boxB)).toBe(0.0);
    });

    it('should accurately compute partial overlap IoU', () => {
      // boxA: 0..10, 0..10 -> area = 100
      // boxB: 5..15, 0..10 -> area = 100
      // intersection: 5..10, 0..10 -> area = 50
      // union = 100 + 100 - 50 = 150
      // iou = 50 / 150 = 1/3 ~ 0.3333
      const boxA = [0, 0, 10, 10];
      const boxB = [5, 0, 15, 10];
      expect(computeIoU(boxA, boxB)).toBeCloseTo(0.3333, 3);
    });
  });

  describe('nonMaxSuppression', () => {
    it('should suppress overlapping candidate with lower score in same class', () => {
      const candidates = [
        { box: [10, 10, 50, 50], score: 0.95, classId: 0 },
        { box: [12, 12, 52, 52], score: 0.70, classId: 0 } // high overlap
      ];

      const suppressed = nonMaxSuppression(candidates, 0.45);
      expect(suppressed.length).toBe(1);
      expect(suppressed[0].score).toBe(0.95);
    });

    it('should retain overlapping candidates from different classes', () => {
      const candidates = [
        { box: [10, 10, 50, 50], score: 0.95, classId: 0 }, // face
        { box: [12, 12, 52, 52], score: 0.85, classId: 1 }  // input_field
      ];

      const suppressed = nonMaxSuppression(candidates, 0.45);
      expect(suppressed.length).toBe(2);
    });

    it('should retain non-overlapping candidates in the same class', () => {
      const candidates = [
        { box: [10, 10, 50, 50], score: 0.95, classId: 0 },
        { box: [100, 100, 150, 150], score: 0.88, classId: 0 }
      ];

      const suppressed = nonMaxSuppression(candidates, 0.45);
      expect(suppressed.length).toBe(2);
    });
  });

  describe('decodeYoloOutput', () => {
    it('should parse raw output tensor and filter below confidence threshold', () => {
      const numAnchors = 4;
      const numClasses = 3;
      // Tensor layout: [1, 7, 4] -> flat length = 28
      const tensorData = new Float32Array(7 * numAnchors);

      // Anchor 0: low confidence (0.15)
      tensorData[0 * numAnchors + 0] = 100; // cx
      tensorData[1 * numAnchors + 0] = 100; // cy
      tensorData[2 * numAnchors + 0] = 40;  // w
      tensorData[3 * numAnchors + 0] = 40;  // h
      tensorData[4 * numAnchors + 0] = 0.15; // face score

      // Anchor 1: high confidence face (0.90) at [200, 200, 60, 80]
      tensorData[0 * numAnchors + 1] = 200;
      tensorData[1 * numAnchors + 1] = 200;
      tensorData[2 * numAnchors + 1] = 60;
      tensorData[3 * numAnchors + 1] = 80;
      tensorData[4 * numAnchors + 1] = 0.90; // face

      // Anchor 2: high confidence input_field (0.85) at [400, 100, 120, 30]
      tensorData[0 * numAnchors + 2] = 400;
      tensorData[1 * numAnchors + 2] = 100;
      tensorData[2 * numAnchors + 2] = 120;
      tensorData[3 * numAnchors + 2] = 30;
      tensorData[5 * numAnchors + 2] = 0.85; // input_field

      const detections = decodeYoloOutput(tensorData, {
        confidenceThreshold: 0.25,
        iouThreshold: 0.45,
        numAnchors: 4,
        numClasses: 3
      });

      expect(detections.length).toBe(2);
      expect(detections[0].className).toBe('face');
      expect(detections[0].score).toBe(0.90);
      expect(detections[0].x).toBe(170); // 200 - 30
      expect(detections[0].y).toBe(160); // 200 - 40
      expect(detections[0].width).toBe(60);
      expect(detections[0].height).toBe(80);

      expect(detections[1].className).toBe('input_field');
      expect(detections[1].score).toBe(0.85);
    });

    it('should un-letterbox coordinates to original viewport dimensions', () => {
      const numAnchors = 1;
      const tensorData = new Float32Array(7 * 1);

      // Box centered at 320, 320 with 100x100 in 640x640 space
      tensorData[0] = 320; // cx
      tensorData[1] = 320; // cy
      tensorData[2] = 100; // w
      tensorData[3] = 100; // h
      tensorData[4] = 0.90; // class 0 (face)

      // Letterbox info for an image of 1280x720 scaled to 640x640:
      // scale = 640 / 1280 = 0.5
      // scaledHeight = 720 * 0.5 = 360
      // padX = 0, padY = (640 - 360) / 2 = 140
      const letterboxInfo = {
        scale: 0.5,
        padX: 0,
        padY: 140,
        srcWidth: 1280,
        srcHeight: 720
      };

      const detections = decodeYoloOutput(tensorData, {
        confidenceThreshold: 0.25,
        numAnchors: 1,
        letterboxInfo
      });

      expect(detections.length).toBe(1);
      // in 640x640: x1 = 270, x2 = 370, y1 = 270, y2 = 370
      // unletterbox x: (270 - 0) / 0.5 = 540
      // unletterbox y: (270 - 140) / 0.5 = 130 / 0.5 = 260
      // width: (370 - 270) / 0.5 = 200
      expect(detections[0].x).toBe(540);
      expect(detections[0].y).toBe(260);
      expect(detections[0].width).toBe(200);
      expect(detections[0].height).toBe(200);
    });
  });

  describe('letterboxImage calculations', () => {
    it('should compute correct scaling and padding for 16:9 aspect ratio', () => {
      const mockImage = { width: 1920, height: 1080 };
      const dummyCanvas = {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          fillRect: () => {},
          drawImage: () => {}
        })
      };

      const res = letterboxImage(mockImage, 640, 640, () => dummyCanvas);
      expect(res.scale).toBeCloseTo(640 / 1920, 4);
      expect(res.padX).toBe(0);
      expect(res.padY).toBeGreaterThan(0);
      expect(res.srcWidth).toBe(1920);
      expect(res.srcHeight).toBe(1080);
    });
  });
});
