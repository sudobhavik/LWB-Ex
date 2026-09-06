import { describe, it, expect } from 'vitest';
const { JSDOM } = require('jsdom');
const { OCRDetector } = require('../extension/engine/ocr_detector.js');

describe('OCR & Image PII Detector Tests', () => {
  it('should initialize OCRDetector successfully', () => {
    const detector = new OCRDetector();
    expect(detector).toBeDefined();
    expect(typeof detector.detectText).toBe('function');
    expect(typeof detector.scanImageForPII).toBe('function');
    expect(typeof detector.scanDOMImagesForPII).toBe('function');
  });

  it('should scan candidate text regions and extract verified PII only', async () => {
    const detector = new OCRDetector();

    const candidateRegions = [
      { x: 10, y: 20, width: 200, height: 40, text: 'Limited Time Deal - MacBook Pro $1,899.00' },
      { x: 50, y: 100, width: 250, height: 50, text: 'Aadhaar UID: 5482 1928 3847' },
      { x: 10, y: 200, width: 180, height: 40, text: '4.8 stars (2,419 reviews)' }
    ];

    const piiResults = await detector.scanImageForPII(null, candidateRegions, 'Aadhaar identity card');
    expect(piiResults).toHaveLength(1);
    expect(piiResults[0].type).toBe('AADHAAR');
    expect(piiResults[0].matchText).toBe('5482 1928 3847');
  });

  it('should detect sensitive images in DOM via scanDOMImagesForPII', () => {
    const detector = new OCRDetector();
    const html = `
      <div>
        <img src="assets/product_laptop.svg" alt="Apple MacBook Pro 16" width="220" height="150">
        <img src="assets/product_watch.svg" alt="Apple Watch Ultra 2" width="150" height="160">
        <img src="assets/real_face.jpg" alt="Devin Vance Real Face Photograph" class="real-face-photo" width="150" height="160">
        <img src="assets/id_card.png" alt="Aadhaar Government Identity Document" width="200" height="120">
      </div>
    `;
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Provide mock getBoundingClientRect for JSDOM
    doc.querySelectorAll('img').forEach(img => {
      img.getBoundingClientRect = () => ({
        left: 50,
        top: 50,
        width: 100,
        height: 100,
        right: 150,
        bottom: 150
      });
    });

    const sensitiveImages = detector.scanDOMImagesForPII(doc);
    expect(sensitiveImages).toHaveLength(2);
    const types = sensitiveImages.map(s => s.type);
    expect(types).toContain('FACE');
    expect(types).toContain('GOV_ID');
  });
});
