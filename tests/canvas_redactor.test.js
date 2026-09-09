import { describe, it, expect } from 'vitest';
const { sanitizeScreenshot } = require('../extension/engine/canvas_redactor.js');

describe('Canvas Redactor Tests', () => {
  it('should calculate sanitized regions and total count for faces and PII', () => {
    const mockImage = { width: 1280, height: 720 };
    let recordedFills = [];
    const mockCtx = {
      set fillStyle(val) { recordedFills.push(val); },
      get fillStyle() { return recordedFills[recordedFills.length - 1] || ''; },
      set strokeStyle(val) {},
      get strokeStyle() { return ''; },
      set filter(val) {},
      get filter() { return ''; },
      set font(val) {},
      get font() { return ''; },
      set lineWidth(val) {},
      get lineWidth() { return 1; },
      drawImage: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      save: () => {},
      restore: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      measureText: () => ({ width: 60 })
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/jpeg;base64,sampleSanitizedData'
    };

    const faceRegions = [{ x: 100, y: 100, width: 80, height: 100, className: 'face' }];
    const piiRegions = [
      { x: 300, y: 200, width: 180, height: 30, type: 'CARD' },
      { x: 500, y: 400, width: 120, height: 25, type: 'PASSWORD' }
    ];

    const result = sanitizeScreenshot(mockImage, faceRegions, piiRegions, () => mockCanvas);
    expect(result.totalRedacted).toBe(3);
    expect(result.regions.some(r => r.label === 'REDACTED_FACE')).toBe(true);
    expect(result.regions.some(r => r.label === 'REDACTED_CARD')).toBe(true);
    expect(result.regions.some(r => r.label === 'REDACTED_PASSWORD')).toBe(true);
    expect(result.dataUrl).toBe('data:image/jpeg;base64,sampleSanitizedData');
    // Confirm solid opaque blackout was applied (no translucent alpha bleed)
    expect(recordedFills).toContain('#131921');
  });
});
