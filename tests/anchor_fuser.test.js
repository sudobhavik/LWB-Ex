import { describe, it, expect, beforeEach } from 'vitest';
const {
  fuseVisualAndDOMAnchors,
  computeBoxIoU,
  isPointInBox
} = require('../extension/engine/anchor_fuser.js');

describe('Hybrid Visual-DOM Anchor Fuser & Canvas Integration Tests', () => {
  it('should compute bounding box IoU accurately', () => {
    const boxA = { x: 100, y: 100, width: 100, height: 50 }; // area 5000
    const boxB = { x: 150, y: 100, width: 100, height: 50 }; // area 5000, inter 50x50=2500, union 7500 => 0.333
    const boxC = { x: 300, y: 300, width: 50, height: 50 };  // disjoint

    const iouAB = computeBoxIoU(boxA, boxB);
    const iouAC = computeBoxIoU(boxA, boxC);

    expect(parseFloat(iouAB.toFixed(3))).toBe(0.333);
    expect(iouAC).toBe(0);
  });

  it('should detect whether a coordinate is inside a bounding box', () => {
    const box = { x: 200, y: 150, width: 100, height: 60 };

    expect(isPointInBox(250, 180, box)).toBe(true);  // inside center
    expect(isPointInBox(200, 150, box)).toBe(true);  // on top-left edge
    expect(isPointInBox(150, 180, box)).toBe(false); // to the left
    expect(isPointInBox(250, 220, box)).toBe(false); // below
  });

  it('should fuse matching DOM and visual anchors with verifiedByVision flag', () => {
    const domAnchors = [
      { index: 1, label: 'Add to Cart', role: 'button', x: 100, y: 200, width: 120, height: 40 },
      { index: 2, label: 'Search', role: 'button', x: 500, y: 50, width: 80, height: 30 }
    ];

    const visionElements = [
      // Matches DOM anchor 1
      { x: 102, y: 201, width: 118, height: 39, confidence: 0.88 },
      // Matches DOM anchor 2
      { x: 498, y: 49, width: 82, height: 31, confidence: 0.94 }
    ];

    const fused = fuseVisualAndDOMAnchors(domAnchors, visionElements);

    expect(fused.length).toBe(2);
    expect(fused[0].verifiedByVision).toBe(true);
    expect(fused[0].visualConfidence).toBeGreaterThan(0.85);
    expect(fused[0].source).toBe('hybrid_fused');
    expect(fused[1].verifiedByVision).toBe(true);
  });

  it('should detect and integrate canvas-based controls that DOM traversal completely missed', () => {
    // Normal DOM anchors on the page
    const domAnchors = [
      { index: 1, label: 'Navigation Link', role: 'link', x: 50, y: 20, width: 100, height: 30 }
    ];

    // Canvas element located at (200, 100, 600, 400)
    const canvasRects = [
      { x: 200, y: 100, width: 600, height: 400 }
    ];

    // OmniParser vision model detects two buttons inside the canvas area (e.g. Flutter Web / Canvas Vault)
    const visionElements = [
      { x: 250, y: 150, width: 140, height: 45, confidence: 0.82, label: 'Canvas Submit' },
      { x: 450, y: 250, width: 120, height: 40, confidence: 0.79, label: 'Canvas Reset' }
    ];

    const fused = fuseVisualAndDOMAnchors(domAnchors, visionElements, {
      viewportWidth: 1280,
      viewportHeight: 720,
      canvasRects
    });

    // Should contain the 1 DOM anchor + the 2 canvas anchors
    expect(fused.length).toBe(3);

    const canvasControls = fused.filter(a => a.isCanvas);
    expect(canvasControls.length).toBe(2);

    expect(canvasControls[0].tag).toBe('canvas_element');
    expect(canvasControls[0].source).toBe('canvas_vision');
    expect(canvasControls[0].x).toBe(250);
    expect(canvasControls[0].normX).toBeGreaterThan(0);
    expect(canvasControls[0].normY).toBeGreaterThan(0);
  });

  it('should integrate non-canvas visual controls that DOM missed', () => {
    const domAnchors = [];
    const visionElements = [
      { x: 80, y: 60, width: 90, height: 30, confidence: 0.77 }
    ];

    const fused = fuseVisualAndDOMAnchors(domAnchors, visionElements, {
      canvasRects: [] // no canvas here, regular custom SVG or pseudo-element
    });

    expect(fused.length).toBe(1);
    expect(fused[0].isCanvas).toBe(false);
    expect(fused[0].source).toBe('omniparser_vision');
    expect(fused[0].label).toContain('[VISUAL_UI]');
  });

  it('should sort fused anchors in natural top-to-bottom reading order with sequential indices', () => {
    const domAnchors = [
      { index: 1, label: 'Footer Link', x: 100, y: 900, width: 100, height: 30 },
      { index: 2, label: 'Header Logo', x: 50, y: 20, width: 120, height: 40 }
    ];

    const visionElements = [
      { x: 300, y: 400, width: 150, height: 40, confidence: 0.85, label: 'Mid-Page Button' }
    ];

    const fused = fuseVisualAndDOMAnchors(domAnchors, visionElements);

    expect(fused.length).toBe(3);
    // Natural order: Header Logo (y=20) -> Mid-Page Button (y=400) -> Footer Link (y=900)
    expect(fused[0].label).toContain('Header Logo');
    expect(fused[0].index).toBe(1);

    expect(fused[1].label).toContain('Mid-Page Button');
    expect(fused[1].index).toBe(2);

    expect(fused[2].label).toContain('Footer Link');
    expect(fused[2].index).toBe(3);
  });
});
