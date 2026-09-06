import { describe, it, expect } from 'vitest';
const {
  isHumanFace,
  filterFaces,
  filterDetections
} = require('../extension/engine/yolo_processor.js');

describe('YOLO Face Validation & False Positive Elimination Tests', () => {
  it('should reject wide banners with unnatural aspect ratio (e.g. 2.79)', () => {
    const bannerCandidate = {
      className: 'face',
      score: 0.45,
      x: 10,
      y: 10,
      width: 81,
      height: 29 // Aspect ratio 2.79
    };
    expect(isHumanFace(bannerCandidate)).toBe(false);
  });

  it('should reject tall thin artifacts with aspect ratio < 0.55', () => {
    const thinCandidate = {
      className: 'face',
      score: 0.50,
      x: 10,
      y: 10,
      width: 20,
      height: 60 // Aspect ratio 0.33
    };
    expect(isHumanFace(thinCandidate)).toBe(false);
  });

  it('should reject low confidence predictions (< 0.35)', () => {
    const lowConfCandidate = {
      className: 'face',
      score: 0.2043,
      x: 50,
      y: 50,
      width: 60,
      height: 60
    };
    expect(isHumanFace(lowConfCandidate)).toBe(false);
  });

  it('should reject tiny noise boxes (< 35px)', () => {
    const tinyNoise = {
      className: 'face',
      score: 0.65,
      x: 50,
      y: 50,
      width: 25,
      height: 25
    };
    expect(isHumanFace(tinyNoise)).toBe(false);
  });

  it('should accept valid human face bounding boxes', () => {
    const validFace = {
      className: 'face',
      score: 0.85,
      x: 100,
      y: 120,
      width: 140,
      height: 160 // Aspect ratio ~0.875
    };
    expect(isHumanFace(validFace)).toBe(true);
  });

  it('should filter an array containing banner noise and real face', () => {
    const candidates = [
      { className: 'face', score: 0.20, width: 81, height: 29 }, // banner
      { className: 'face', score: 0.55, width: 22, height: 22 }, // tiny icon
      { className: 'face', score: 0.82, width: 120, height: 130 } // real face
    ];
    const filtered = filterFaces(candidates);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].score).toBe(0.82);
  });

  it('should validate YCbCr skin chrominance on mock canvas context', () => {
    // Mock canvas with non-skin color (dark blue banner: R=35, G=47, B=62)
    const mockBannerCanvas = {
      width: 200,
      height: 200,
      getContext: () => ({
        getImageData: (x, y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 35;     // R
            data[i + 1] = 47; // G
            data[i + 2] = 62; // B
            data[i + 3] = 255;
          }
          return { data };
        }
      })
    };

    const candidate = {
      className: 'face',
      score: 0.60,
      x: 10,
      y: 10,
      width: 60,
      height: 60
    };

    expect(isHumanFace(candidate, mockBannerCanvas)).toBe(false);

    // Mock canvas with human skin color (Caucasian / Medium: R=210, G=160, B=125)
    const mockSkinCanvas = {
      width: 200,
      height: 200,
      getContext: () => ({
        getImageData: (x, y, w, h) => {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 210;    // R
            data[i + 1] = 160; // G
            data[i + 2] = 125; // B
            data[i + 3] = 255;
          }
          return { data };
        }
      })
    };

    expect(isHumanFace(candidate, mockSkinCanvas)).toBe(true);
  });
});
