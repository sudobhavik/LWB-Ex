import { describe, it, expect, beforeEach } from 'vitest';
const {
  applyDetections,
  clearOverlay,
  OVERLAY_CONTAINER_ID
} = require('../extension/content/content.js');

describe('Content Script Overlay Unit Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should inject container and render outline boxes with badges', () => {
    const detections = [
      { classId: 0, className: 'face', score: 0.94, x: 50, y: 80, width: 120, height: 140 },
      { classId: 1, className: 'input_field', score: 0.88, x: 200, y: 300, width: 250, height: 40 }
    ];

    const count = applyDetections(detections, 'outline');
    expect(count).toBe(2);

    const container = document.getElementById(OVERLAY_CONTAINER_ID);
    expect(container).not.toBeNull();

    const boxes = container.querySelectorAll('.yolo-box');
    expect(boxes.length).toBe(2);

    const box1 = boxes[0];
    expect(box1.classList.contains('yolo-box-outline')).toBe(true);
    expect(box1.style.left).toBe('50px');
    expect(box1.style.top).toBe('80px');
    expect(box1.style.width).toBe('120px');
    expect(box1.style.height).toBe('140px');

    const badge1 = box1.querySelector('.yolo-badge');
    expect(badge1.textContent).toBe('[FACE] 94%');
  });

  it('should render solid/blur redaction masks and floating live pill in redact mode', () => {
    const detections = [
      { classId: 0, className: 'face', score: 0.92, x: 100, y: 100, width: 80, height: 80 },
      { classId: 2, className: 'text_block', score: 0.79, x: 300, y: 150, width: 400, height: 60 }
    ];

    applyDetections(detections, 'redact');
    const container = document.getElementById(OVERLAY_CONTAINER_ID);
    const boxes = container.querySelectorAll('.yolo-box');

    expect(boxes[0].classList.contains('yolo-box-redact')).toBe(true);
    expect(boxes[0].querySelector('.yolo-badge').textContent).toBe('[BLURRED: FACE]');

    expect(boxes[1].classList.contains('yolo-box-redact')).toBe(true);
    expect(boxes[1].querySelector('.yolo-badge').textContent).toBe('[BLURRED: TEXT_BLOCK]');

    // Verify floating live screen pill
    const pill = document.getElementById('yolo-live-privacy-pill');
    expect(pill).not.toBeNull();
    expect(pill.textContent).toContain('LIVE PRIVACY SHIELD');
    expect(pill.textContent).toContain('2 SENSITIVE AREAS BLURRED');
  });

  it('should cleanly remove overlay when clearOverlay is called', () => {
    const detections = [
      { classId: 0, className: 'face', score: 0.90, x: 20, y: 20, width: 50, height: 50 }
    ];

    applyDetections(detections, 'outline');
    expect(document.getElementById(OVERLAY_CONTAINER_ID)).not.toBeNull();

    clearOverlay();
    expect(document.getElementById(OVERLAY_CONTAINER_ID)).toBeNull();
  });
});
