/**
 * YOLO Preprocessing and Postprocessing Engine
 * Supports Ultralytics YOLOv8/v11/v26 ONNX models with 3 classes:
 *   0: 'face'
 *   1: 'input_field'
 *   2: 'text_block'
 *
 * Designed for both browser extension runtime and Node.js unit testing.
 */

const CLASS_NAMES = ['face', 'input_field', 'text_block'];

/**
 * Letterboxes an image source into 640x640 while maintaining aspect ratio
 * Pads unused areas with neutral gray (114, 114, 114).
 *
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement|Object} imageSource
 * @param {number} targetWidth - Target width (default 640)
 * @param {number} targetHeight - Target height (default 640)
 * @param {Function} [createCanvasFn] - Optional factory for canvas creation (testing/node)
 * @returns {{ canvas: any, scale: number, padX: number, padY: number, srcWidth: number, srcHeight: number }}
 */
function letterboxImage(imageSource, targetWidth = 640, targetHeight = 640, createCanvasFn = null) {
  const srcWidth = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width;
  const srcHeight = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height;

  if (!srcWidth || !srcHeight) {
    throw new Error(`Invalid source image dimensions: ${srcWidth}x${srcHeight}`);
  }

  const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
  const scaledWidth = Math.round(srcWidth * scale);
  const scaledHeight = Math.round(srcHeight * scale);
  const padX = (targetWidth - scaledWidth) / 2;
  const padY = (targetHeight - scaledHeight) / 2;

  let canvas;
  if (createCanvasFn) {
    canvas = createCanvasFn(targetWidth, targetHeight);
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetWidth, targetHeight);
  } else {
    throw new Error('Canvas creation not supported in this environment');
  }

  const ctx = canvas.getContext('2d');
  // Fill background with neutral gray (YOLO standard letterbox color)
  ctx.fillStyle = '#727272'; // rgb(114, 114, 114)
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw scaled source image centered
  ctx.drawImage(imageSource, padX, padY, scaledWidth, scaledHeight);

  return {
    canvas,
    scale,
    padX,
    padY,
    srcWidth,
    srcHeight
  };
}

/**
 * Converts a 640x640 canvas into a normalized NCHW Float32Array [1, 3, 640, 640]
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array}
 */
function canvasToNCHW(canvas, width = 640, height = 640) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, width, height).data;
  const totalPixels = width * height;
  const tensorData = new Float32Array(3 * totalPixels);

  const rOffset = 0;
  const gOffset = totalPixels;
  const bOffset = totalPixels * 2;

  for (let i = 0; i < totalPixels; i++) {
    const srcIndex = i * 4;
    tensorData[rOffset + i] = imgData[srcIndex] / 255.0;
    tensorData[gOffset + i] = imgData[srcIndex + 1] / 255.0;
    tensorData[bOffset + i] = imgData[srcIndex + 2] / 255.0;
  }

  return tensorData;
}

/**
 * Computes Intersection over Union (IoU) between two bounding boxes
 * Box format: [x1, y1, x2, y2]
 */
function computeIoU(boxA, boxB) {
  const x1 = Math.max(boxA[0], boxB[0]);
  const y1 = Math.max(boxA[1], boxB[1]);
  const x2 = Math.min(boxA[2], boxB[2]);
  const y2 = Math.min(boxA[3], boxB[3]);

  const interWidth = Math.max(0, x2 - x1);
  const interHeight = Math.max(0, y2 - y1);
  const interArea = interWidth * interHeight;

  const areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]);
  const areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]);
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Performs Non-Maximum Suppression (NMS) on candidates
 *
 * @param {Array<{box: number[], score: number, classId: number}>} candidates
 * @param {number} iouThreshold
 * @returns {Array<{box: number[], score: number, classId: number}>}
 */
function nonMaxSuppression(candidates, iouThreshold = 0.45) {
  // Group candidates by classId to perform independent per-class NMS
  const classGroups = {};
  for (const item of candidates) {
    if (!classGroups[item.classId]) {
      classGroups[item.classId] = [];
    }
    classGroups[item.classId].push(item);
  }

  const results = [];

  for (const classId in classGroups) {
    const items = classGroups[classId];
    items.sort((a, b) => b.score - a.score);

    const active = items.slice();
    while (active.length > 0) {
      const best = active.shift();
      results.push(best);

      for (let i = active.length - 1; i >= 0; i--) {
        const iou = computeIoU(best.box, active[i].box);
        if (iou >= iouThreshold) {
          active.splice(i, 1);
        }
      }
    }
  }

  // Sort final results descending by score
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Decodes YOLOv8/v11/v26 raw tensor output: shape [1, 7, 8400]
 *
 * @param {Float32Array} tensorData - Flat output tensor data
 * @param {Object} options
 * @param {number} [options.confidenceThreshold=0.25]
 * @param {number} [options.iouThreshold=0.45]
 * @param {Object} [options.letterboxInfo] - Optional scale and pad offsets for coordinate mapping
 * @param {number} [options.numAnchors=8400]
 * @param {number} [options.numClasses=3]
 * @returns {Array<{ classId: number, className: string, score: number, x: number, y: number, width: number, height: number }>}
 */
function decodeYoloOutput(tensorData, options = {}) {
  const confidenceThreshold = options.confidenceThreshold ?? 0.25;
  const iouThreshold = options.iouThreshold ?? 0.45;
  const letterbox = options.letterboxInfo || null;
  const numAnchors = options.numAnchors ?? 8400;
  const numClasses = options.numClasses ?? 3;

  const candidates = [];

  for (let i = 0; i < numAnchors; i++) {
    // Find class with maximum score
    let bestClassId = 0;
    let maxScore = 0;

    for (let c = 0; c < numClasses; c++) {
      const score = tensorData[(4 + c) * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        bestClassId = c;
      }
    }

    if (maxScore >= confidenceThreshold) {
      const cx = tensorData[0 * numAnchors + i];
      const cy = tensorData[1 * numAnchors + i];
      const w = tensorData[2 * numAnchors + i];
      const h = tensorData[3 * numAnchors + i];

      const x1 = cx - w / 2;
      const y1 = cy - h / 2;
      const x2 = cx + w / 2;
      const y2 = cy + h / 2;

      candidates.push({
        box: [x1, y1, x2, y2],
        score: maxScore,
        classId: bestClassId
      });
    }
  }

  // Apply Non-Maximum Suppression
  const suppressed = nonMaxSuppression(candidates, iouThreshold);

  // Map coordinates back to original image or keep letterboxed
  return suppressed.map(item => {
    let [lx1, ly1, lx2, ly2] = item.box;
    let x1 = lx1, y1 = ly1, x2 = lx2, y2 = ly2;

    if (letterbox) {
      const { scale, padX, padY, srcWidth, srcHeight } = letterbox;
      x1 = Math.max(0, Math.min(srcWidth, (x1 - padX) / scale));
      y1 = Math.max(0, Math.min(srcHeight, (y1 - padY) / scale));
      x2 = Math.max(0, Math.min(srcWidth, (x2 - padX) / scale));
      y2 = Math.max(0, Math.min(srcHeight, (y2 - padY) / scale));
    }

    const width = Math.max(0, x2 - x1);
    const height = Math.max(0, y2 - y1);

    return {
      classId: item.classId,
      className: CLASS_NAMES[item.classId] || `class_${item.classId}`,
      score: parseFloat(item.score.toFixed(4)),
      x: Math.round(x1),
      y: Math.round(y1),
      width: Math.round(width),
      height: Math.round(height),
      letterboxBox: [
        Math.round(lx1),
        Math.round(ly1),
        Math.round(Math.max(0, lx2 - lx1)),
        Math.round(Math.max(0, ly2 - ly1))
      ]
    };
  });
}

/**
 * Evaluates whether a candidate face detection is an actual human face
 * by checking aspect ratio, minimum dimensions, confidence threshold,
 * and YCbCr skin chrominance.
 *
 * @param {Object} detection - { x, y, width, height, score, className }
 * @param {HTMLCanvasElement|ImageData|Object} [sourceCanvasOrImage]
 * @returns {boolean}
 */
function isHumanFace(detection, sourceCanvasOrImage = null) {
  if (!detection) return false;

  // 1. Confidence threshold >= 0.35
  if ((detection.score ?? 1) < 0.35) return false;

  // 2. Minimum dimension >= 30x30 px
  if (detection.width < 30 || detection.height < 30) return false;

  // 3. Aspect ratio between 0.50 and 1.50 (human faces are roughly oval/circular)
  const ar = detection.width / detection.height;
  if (ar < 0.50 || ar > 1.50) return false;

  // 4. Skin chrominance test if canvas or image context is available
  if (sourceCanvasOrImage && typeof sourceCanvasOrImage.getContext === 'function') {
    try {
      const ctx = sourceCanvasOrImage.getContext('2d');
      let sx, sy, sw, sh;

      // If sourceCanvasOrImage is the 640x640 letterbox canvas, use letterboxBox coordinates
      if (sourceCanvasOrImage.width === 640 && sourceCanvasOrImage.height === 640 && Array.isArray(detection.letterboxBox)) {
        [sx, sy, sw, sh] = detection.letterboxBox;
      } else {
        sx = Math.max(0, Math.round(detection.x));
        sy = Math.max(0, Math.round(detection.y));
        sw = Math.min((sourceCanvasOrImage.width || 640) - sx, Math.round(detection.width));
        sh = Math.min((sourceCanvasOrImage.height || 640) - sy, Math.round(detection.height));
      }

      if (sw > 0 && sh > 0) {
        const imgData = ctx.getImageData(sx, sy, sw, sh);
        const data = imgData.data;
        let skinPixels = 0;
        let sampledPixels = 0;

        // Sample every 4th pixel for speed (step by 16 in RGBA array)
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sampledPixels++;

          const y  =  0.299 * r + 0.587 * g + 0.114 * b;
          const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
          const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128;

          if (y >= 40 && cb >= 80 && cb <= 135 && cr >= 133 && cr <= 180) {
            skinPixels++;
          }
        }

        const skinRatio = sampledPixels > 0 ? (skinPixels / sampledPixels) : 0;
        if (skinRatio < 0.15) {
          return false;
        }
      }
    } catch (_) {
      // Pass if canvas read is blocked
    }
  }

  return true;
}

/**
 * Filters a list of face candidate detections.
 *
 * @param {Array<Object>} faces
 * @param {HTMLCanvasElement|Object} [sourceCanvas]
 * @returns {Array<Object>}
 */
function filterFaces(faces = [], sourceCanvas = null) {
  return faces.filter(f => isHumanFace(f, sourceCanvas));
}

/**
 * Evaluates full detection set and filters out non-human faces
 * and malformed boxes.
 *
 * @param {Array<Object>} detections
 * @param {HTMLCanvasElement|Object} [sourceCanvas]
 * @returns {Array<Object>}
 */
function filterDetections(detections = [], sourceCanvas = null) {
  return detections.filter(d => {
    if (d.className === 'face') {
      return isHumanFace(d, sourceCanvas);
    }
    return d.width >= 10 && d.height >= 8;
  });
}

// Export for ES modules, CommonJS, and browser globals
if (typeof exports !== 'undefined') {
  module.exports = {
    CLASS_NAMES,
    letterboxImage,
    canvasToNCHW,
    computeIoU,
    nonMaxSuppression,
    decodeYoloOutput,
    isHumanFace,
    filterFaces,
    filterDetections
  };
} else if (typeof globalThis !== 'undefined') {
  globalThis.YoloProcessor = {
    CLASS_NAMES,
    letterboxImage,
    canvasToNCHW,
    computeIoU,
    nonMaxSuppression,
    decodeYoloOutput,
    isHumanFace,
    filterFaces,
    filterDetections
  };
}

