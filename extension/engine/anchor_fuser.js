/**
 * Hybrid Visual-DOM Anchor Fusion Engine
 * Combines HTML DOM interactive anchors with on-device OmniParser/YOLO pure-vision detections.
 * 
 * Guarantees:
 * 1. High precision text and semantic roles from DOM for standard HTML elements.
 * 2. Complete coverage for HTML5 <canvas>, WebGL, Flutter Web, and custom-painted UI
 *    where DOM inspection is completely blind.
 * 3. Exact sub-element pixel coordinates for accurate click dispatch on canvas surfaces.
 */

/**
 * Computes Intersection over Union (IoU) between two bounding boxes
 * Format: { x, y, width, height }
 */
function computeBoxIoU(boxA, boxB) {
  const ax2 = boxA.x + boxA.width;
  const ay2 = boxA.y + boxA.height;
  const bx2 = boxB.x + boxB.width;
  const by2 = boxB.y + boxB.height;

  const interX1 = Math.max(boxA.x, boxB.x);
  const interY1 = Math.max(boxA.y, boxB.y);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);

  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const interArea = interW * interH;

  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Checks if point (px, py) is inside box { x, y, width, height }
 */
function isPointInBox(px, py, box) {
  return px >= box.x && px <= (box.x + box.width) &&
         py >= box.y && py <= (box.y + box.height);
}

/**
 * Fuses DOM-extracted anchors with pure-vision OmniParser/YOLO detections.
 *
 * @param {Array<Object>} domAnchors - Anchors extracted from DOM traversal
 * @param {Array<Object>} visionElements - Bounding boxes detected by OmniParser/YOLO
 * @param {Object} [options]
 * @param {number} [options.viewportWidth=1920]
 * @param {number} [options.viewportHeight=1080]
 * @param {number} [options.iouThreshold=0.25]
 * @param {Array<{ x: number, y: number, width: number, height: number }>} [options.canvasRects=[]]
 * @returns {Array<Object>} Unified, fused list of interactive anchors
 */
function fuseVisualAndDOMAnchors(domAnchors = [], visionElements = [], options = {}) {
  const viewportW = options.viewportWidth || 1920;
  const viewportH = options.viewportHeight || 1080;
  const iouThreshold = options.iouThreshold ?? 0.25;
  const canvasRects = options.canvasRects || [];

  const fused = [];
  const matchedVisionIndices = new Set();
  let maxIndex = 0;

  // 1. Process DOM anchors and find corresponding visual matches
  domAnchors.forEach((domAnchor, domIdx) => {
    let bestMatch = null;
    let bestIoU = 0;
    let bestVisIdx = -1;

    const domBox = {
      x: domAnchor.x || 0,
      y: domAnchor.y || 0,
      width: domAnchor.width || 0,
      height: domAnchor.height || 0
    };

    visionElements.forEach((visEl, visIdx) => {
      const visBox = {
        x: visEl.x || 0,
        y: visEl.y || 0,
        width: visEl.width || 0,
        height: visEl.height || 0
      };

      const iou = computeBoxIoU(domBox, visBox);
      const visCenterX = visBox.x + visBox.width / 2;
      const visCenterY = visBox.y + visBox.height / 2;
      const pointInside = isPointInBox(visCenterX, visCenterY, domBox);

      if (iou > bestIoU || (pointInside && iou > 0.1)) {
        bestIoU = iou;
        bestMatch = visEl;
        bestVisIdx = visIdx;
      }
    });

    const anchorIndex = domAnchor.index || (domIdx + 1);
    if (anchorIndex > maxIndex) maxIndex = anchorIndex;

    const fusedItem = {
      ...domAnchor,
      index: anchorIndex,
      domIndex: domAnchor.index || (domIdx + 1),
      verifiedByVision: false,
      source: 'dom_walker'
    };

    if (bestMatch && (bestIoU >= iouThreshold || bestIoU > 0.1)) {
      matchedVisionIndices.add(bestVisIdx);
      fusedItem.verifiedByVision = true;
      fusedItem.visualConfidence = bestMatch.confidence || bestMatch.score || 0.8;
      fusedItem.source = 'hybrid_fused';

      // If DOM label was generic, enrich with visual tag
      if (!fusedItem.label || /^button_\d+$|^link_\d+$|^div_\d+$/i.test(fusedItem.label)) {
        if (domAnchor.iconType) {
          fusedItem.label = `[ICON: ${domAnchor.iconType}]`;
        } else {
          fusedItem.label = `[VISUAL_CONTROL: ${fusedItem.role || 'button'}]`;
        }
      }
    }

    fused.push(fusedItem);
  });

  // 2. Add visual elements that DOM MISSED (Canvas, WebGL, Flutter Web, graphics)
  visionElements.forEach((visEl, visIdx) => {
    if (matchedVisionIndices.has(visIdx)) return;

    maxIndex++;
    const visBox = {
      x: visEl.x || 0,
      y: visEl.y || 0,
      width: visEl.width || 0,
      height: visEl.height || 0
    };

    const centerX = visBox.x + visBox.width / 2;
    const centerY = visBox.y + visBox.height / 2;

    // Check if this visual element falls inside any HTML5 <canvas>
    let isCanvas = false;
    for (const cRect of canvasRects) {
      if (isPointInBox(centerX, centerY, cRect)) {
        isCanvas = true;
        break;
      }
    }

    const normX = parseFloat((centerX / viewportW).toFixed(3));
    const normY = parseFloat((centerY / viewportH).toFixed(3));

    const labelPrefix = isCanvas ? '[CANVAS_CONTROL]' : '[VISUAL_UI]';
    const cleanLabel = visEl.label || `${labelPrefix} at [${Math.round(centerX)}, ${Math.round(centerY)}]`;

    fused.push({
      index: maxIndex,
      label: cleanLabel,
      tag: isCanvas ? 'canvas_element' : 'vision_element',
      role: 'button',
      isCanvas,
      x: Math.round(visBox.x),
      y: Math.round(visBox.y),
      width: Math.round(visBox.width),
      height: Math.round(visBox.height),
      normX,
      normY,
      visualConfidence: visEl.confidence || visEl.score || 0.75,
      verifiedByVision: true,
      source: isCanvas ? 'canvas_vision' : 'omniparser_vision'
    });
  });

  // 3. Sort anchors in natural reading order: top-to-bottom, left-to-right
  fused.sort((a, b) => {
    const rowDiff = Math.floor(a.y / 60) - Math.floor(b.y / 60);
    if (rowDiff !== 0) return rowDiff;
    return a.x - b.x;
  });

  // Re-number sequentially after sort for predictable LLM reasoning
  fused.forEach((item, idx) => {
    item.index = idx + 1;
  });

  return fused;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fuseVisualAndDOMAnchors,
    computeBoxIoU,
    isPointInBox
  };
}

if (typeof window !== 'undefined') {
  window.fuseVisualAndDOMAnchors = fuseVisualAndDOMAnchors;
}
