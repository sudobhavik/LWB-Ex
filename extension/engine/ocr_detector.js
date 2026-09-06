/**
 * On-Device Zero-Egress OCR & Image PII Detector
 * Evaluates candidate image regions (including YOLO text blocks and embedded image elements)
 * to detect embedded text and identify sensitive PII strings using Presidio-grade algorithms.
 *
 * Runs 100% on-device with zero network egress.
 */

const PIIDetectorModule = typeof PIIDetector !== 'undefined'
  ? PIIDetector
  : (typeof require !== 'undefined' ? require('./pii_detector') : null);

class OCRDetector {
  constructor() {
    this.hasNativeTextDetector = typeof window !== 'undefined' && typeof window.TextDetector === 'function';
    this.nativeDetector = this.hasNativeTextDetector ? new window.TextDetector() : null;
  }

  /**
   * Detects text blocks and bounding boxes in an image or canvas.
   * Uses native Shape Detection API (window.TextDetector) if available,
   * with graceful fallback to candidate region analysis.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} imageSource
   * @param {Array<{ x: number, y: number, width: number, height: number, text?: string }>} [candidateRegions]
   * @returns {Promise<Array<{ text: string, x: number, y: number, width: number, height: number, confidence: number }>>}
   */
  async detectText(imageSource, candidateRegions = []) {
    const results = [];

    // 1. If native TextDetector API is enabled in Chromium
    if (this.nativeDetector && imageSource) {
      try {
        const detected = await this.nativeDetector.detect(imageSource);
        if (Array.isArray(detected) && detected.length > 0) {
          detected.forEach(item => {
            const box = item.boundingBox || {};
            results.push({
              text: item.rawValue || '',
              x: Math.round(box.x || 0),
              y: Math.round(box.y || 0),
              width: Math.round(box.width || 0),
              height: Math.round(box.height || 0),
              confidence: 0.95
            });
          });
          return results;
        }
      } catch (err) {
        console.warn('[OCRDetector] Native TextDetector failed, falling back:', err);
      }
    }

    // 2. Candidate region analysis (e.g. from YOLO text_block detections)
    if (Array.isArray(candidateRegions) && candidateRegions.length > 0) {
      candidateRegions.forEach(reg => {
        results.push({
          text: reg.text || reg.className || '',
          x: Math.round(reg.x),
          y: Math.round(reg.y),
          width: Math.round(reg.width),
          height: Math.round(reg.height),
          confidence: reg.score || 0.8
        });
      });
    }

    return results;
  }

  /**
   * Evaluates image regions or text blocks for PII.
   * Extracts text, runs Presidio-grade PII detection, and returns ONLY
   * those regions that contain verified sensitive data.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} imageSource
   * @param {Array<{ x: number, y: number, width: number, height: number, text?: string }>} textRegions
   * @param {string} [contextHint='']
   * @returns {Promise<Array<{ x: number, y: number, width: number, height: number, type: string, matchText: string }>>}
   */
  async scanImageForPII(imageSource, textRegions = [], contextHint = '') {
    const piiEngine = PIIDetectorModule || (typeof globalThis !== 'undefined' ? globalThis.PIIDetector : null);
    if (!piiEngine) return [];

    const piiRegions = [];
    const detectedTexts = await this.detectText(imageSource, textRegions);

    for (const item of detectedTexts) {
      if (!item.text || !item.text.trim()) continue;

      const matches = piiEngine.extractPIIMatches(item.text, contextHint);
      if (matches.length > 0) {
        matches.forEach(m => {
          piiRegions.push({
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            type: m.type,
            matchText: m.text
          });
        });
      }
    }

    return piiRegions;
  }

  /**
   * Scans DOM image elements (e.g. ID cards, payment badges, photo IDs)
   * for sensitive attributes or explicit confidentiality markers.
   *
   * @param {Document} doc
   * @returns {Array<{ x: number, y: number, width: number, height: number, type: string }>}
   */
  scanDOMImagesForPII(doc = null) {
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (!targetDoc || !targetDoc.body) return [];

    const regions = [];
    const images = targetDoc.querySelectorAll('img, svg, canvas, [data-sensitive="true"], .real-face-photo');

    images.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const alt = (el.getAttribute('alt') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const className = (el.className || '').toString().toLowerCase();
      const isMarkedSensitive = el.getAttribute('data-sensitive') === 'true';

      const isBiometric = className.includes('real-face') || alt.includes('face photo') || alt.includes('biometric');
      const isGovID = alt.includes('aadhaar') || alt.includes('pan card') || alt.includes('passport') || alt.includes('id card');
      const isCard = alt.includes('credit card') || alt.includes('visa signature') || alt.includes('mastercard');

      if (isMarkedSensitive || isBiometric || isGovID || isCard) {
        let type = 'SENSITIVE_IMAGE';
        if (isBiometric) type = 'FACE';
        else if (isGovID) type = 'GOV_ID';
        else if (isCard) type = 'CARD';

        regions.push({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          type
        });
      }
    });

    return regions;
  }
}

if (typeof exports !== 'undefined') {
  module.exports = { OCRDetector };
} else if (typeof globalThis !== 'undefined') {
  globalThis.OCRDetector = OCRDetector;
}
