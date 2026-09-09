import { describe, it, expect } from 'vitest';
const { calculateAdaptivePadding, sanitizeScreenshot } = require('../extension/engine/canvas_redactor.js');

describe('Adaptive Non-Colliding Redaction Padding Tests', () => {
  it('should provide full default +4px padding on all 4 sides when no interactive anchors are nearby', () => {
    const region = { x: 100, y: 100, width: 200, height: 40 };
    const anchors = [
      { x: 500, y: 500, width: 80, height: 32 } // Far away
    ];

    const padding = calculateAdaptivePadding(region, anchors, 4);
    expect(padding.padLeft).toBe(4);
    expect(padding.padRight).toBe(4);
    expect(padding.padTop).toBe(4);
    expect(padding.padBottom).toBe(4);
  });

  it('should clamp padRight to 1px when an interactive button is only 1px away on the right', () => {
    const region = { x: 100, y: 100, width: 200, height: 40 };
    // Button starts at x = 301 (1px after region.x + region.width = 300)
    const buttonOnRight = { x: 301, y: 100, width: 75, height: 40 };

    const padding = calculateAdaptivePadding(region, [buttonOnRight], 4);
    expect(padding.padRight).toBe(1);
    expect(padding.padLeft).toBe(4); // Left edge still gets full 4px
    expect(padding.padTop).toBe(4);
    expect(padding.padBottom).toBe(4);
  });

  it('should clamp padLeft to 0px when an icon button is directly touching the left edge', () => {
    // Icon button ends at x = 100, region starts at x = 100
    const iconOnLeft = { x: 70, y: 100, width: 30, height: 40 };
    const region = { x: 100, y: 100, width: 200, height: 40 };

    const padding = calculateAdaptivePadding(region, [iconOnLeft], 4);
    expect(padding.padLeft).toBe(0);
    expect(padding.padRight).toBe(4);
  });

  it('should clamp padBottom when a Submit button sits 2px directly below an input', () => {
    const region = { x: 100, y: 100, width: 200, height: 30 }; // Ends at y = 130
    const submitBtn = { x: 100, y: 132, width: 200, height: 45 }; // Starts at y = 132 (2px gap)

    const padding = calculateAdaptivePadding(region, [submitBtn], 4);
    expect(padding.padBottom).toBe(2);
    expect(padding.padTop).toBe(4);
  });

  it('should sanitize screenshot and preserve anchor clearance in returned regions', () => {
    let fillRectCalls = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      filter: '',
      drawImage: () => {},
      fillRect: (x, y, w, h) => { fillRectCalls.push({ x, y, w, h }); },
      strokeRect: () => {},
      measureText: () => ({ width: 60 }),
      fillText: () => {},
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1
    };

    const mockCanvas = {
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/jpeg;base64,MOCK'
    };

    const mockSource = { width: 1000, height: 800 };
    const pii = [{ x: 100, y: 100, width: 200, height: 40, type: 'PASSWORD' }];
    const button = [{ x: 302, y: 100, width: 60, height: 40 }]; // 2px gap on right

    const result = sanitizeScreenshot(
      mockSource,
      [],
      pii,
      () => mockCanvas,
      button
    );

    expect(result.totalRedacted).toBe(1);
    // Blackout fillRect should clamp at x = 100 - 4 = 96, width = 200 + 4 + 2 = 206
    // rx + rw = 96 + 206 = 302 (exactly touching button.x at 302 without overlapping!)
    const blackoutFill = fillRectCalls.find(c => c.x === 96);
    expect(blackoutFill).toBeDefined();
    expect(blackoutFill.x + blackoutFill.w).toBe(302);
  });
});
