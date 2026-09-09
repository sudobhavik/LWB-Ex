/**
 * On-Device Canvas Redaction Engine
 * Sanitizes screenshots by applying multi-pass Gaussian box blurs
 * and semantic badges over detected faces and PII regions.
 * Guarantees zero sensitive bytes leave the local client.
 */

/**
 * Computes adaptive padding for a redaction region to prevent overlapping
 * immediately adjacent interactive buttons/links while keeping full interior coverage.
 *
 * @param {{ x: number, y: number, width: number, height: number }} region
 * @param {Array<{ x: number, y: number, width: number, height: number }>} [interactiveAnchors=[]]
 * @param {number} [defaultPad=4]
 * @returns {{ padLeft: number, padRight: number, padTop: number, padBottom: number }}
 */
function calculateAdaptivePadding(region, interactiveAnchors = [], defaultPad = 4) {
  let padLeft = defaultPad;
  let padRight = defaultPad;
  let padTop = defaultPad;
  let padBottom = defaultPad;

  if (!interactiveAnchors || interactiveAnchors.length === 0) {
    return { padLeft, padRight, padTop, padBottom };
  }

  for (const anchor of interactiveAnchors) {
    if (!anchor || anchor.width <= 0 || anchor.height <= 0) continue;

    // Check vertical overlap (shares horizontal band)
    const vOverlap = (region.y < anchor.y + anchor.height) && (region.y + region.height > anchor.y);
    // Check horizontal overlap (shares vertical band)
    const hOverlap = (region.x < anchor.x + anchor.width) && (region.x + region.width > anchor.x);

    // Anchor is directly to the RIGHT
    if (vOverlap && anchor.x >= region.x + region.width && anchor.x < region.x + region.width + padRight) {
      padRight = Math.max(0, anchor.x - (region.x + region.width));
    }
    // Anchor is directly to the LEFT
    if (vOverlap && anchor.x + anchor.width <= region.x && anchor.x + anchor.width > region.x - padLeft) {
      padLeft = Math.max(0, region.x - (anchor.x + anchor.width));
    }
    // Anchor is directly BELOW
    if (hOverlap && anchor.y >= region.y + region.height && anchor.y < region.y + region.height + padBottom) {
      padBottom = Math.max(0, anchor.y - (region.y + region.height));
    }
    // Anchor is directly ABOVE
    if (hOverlap && anchor.y + anchor.height <= region.y && anchor.y + anchor.height > region.y - padTop) {
      padTop = Math.max(0, region.y - (anchor.y + anchor.height));
    }
  }

  return { padLeft, padRight, padTop, padBottom };
}

/**
 * Sanitizes an image canvas by blurring sensitive regions and applying badges.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} sourceImage
 * @param {Array<{ x: number, y: number, width: number, height: number, className?: string }>} faceRegions
 * @param {Array<{ x: number, y: number, width: number, height: number, type?: string }>} piiRegions
 * @param {Function} [createCanvasFn]
 * @param {Array<{ x: number, y: number, width: number, height: number }>} [interactiveAnchors=[]]
 * @returns {{ canvas: HTMLCanvasElement, dataUrl: string, totalRedacted: number, regions: Array<Object> }}
 */
function sanitizeScreenshot(sourceImage, faceRegions = [], piiRegions = [], createCanvasFn = null, interactiveAnchors = []) {
  const width = sourceImage.naturalWidth || sourceImage.width;
  const height = sourceImage.naturalHeight || sourceImage.height;

  let canvas;
  if (createCanvasFn) {
    canvas = createCanvasFn(width, height);
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  } else if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    throw new Error('No canvas context available for screenshot sanitization');
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true }) || canvas.getContext('2d');
  // 1. Draw base screenshot
  ctx.drawImage(sourceImage, 0, 0, width, height);

  const allRegions = [];

  // Add face detections
  faceRegions.forEach(f => {
    allRegions.push({
      x: Math.max(0, f.x),
      y: Math.max(0, f.y),
      width: Math.min(width - f.x, f.width),
      height: Math.min(height - f.y, f.height),
      label: 'REDACTED_FACE'
    });
  });

  // Add PII text detections
  piiRegions.forEach(p => {
    allRegions.push({
      x: Math.max(0, p.x),
      y: Math.max(0, p.y),
      width: Math.min(width - p.x, p.width),
      height: Math.min(height - p.y, p.height),
      label: `REDACTED_${p.type || 'PII'}`
    });
  });

  // 2. Apply multi-pass heavy box blur and badges with adaptive padding
  allRegions.forEach(region => {
    if (region.width <= 0 || region.height <= 0) return;

    // Adaptive padding: clamp cushion to prevent overlapping neighboring clickable buttons
    const { padLeft, padRight, padTop, padBottom } = calculateAdaptivePadding(region, interactiveAnchors, 4);
    const rx = Math.max(0, region.x - padLeft);
    const ry = Math.max(0, region.y - padTop);
    const rw = Math.min(width - rx, region.width + padLeft + padRight);
    const rh = Math.min(height - ry, region.height + padTop + padBottom);

    // Multi-pass blur and total entropy destruction
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    // Pass 1: Heavy blur
    ctx.filter = 'blur(16px)';
    ctx.drawImage(sourceImage, 0, 0, width, height);
    // Pass 2: Secondary blur pass for total entropy destruction
    ctx.drawImage(canvas, 0, 0);

    // Total Entropy Destruction: 100% OPAQUE Solid Fill (Zero Sensitive Pixels Egress)
    ctx.fillStyle = '#131921';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

    // 3. Render High-Contrast Semantic Security Badge
    ctx.save();
    ctx.strokeStyle = '#FF9900';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    const badgeText = `[${region.label}]`;
    ctx.font = 'bold 11px monospace';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = textMetrics.width + 10;
    const badgeH = 16;

    // Center badge cleanly within or above the redacted box
    const bx = rx + Math.max(0, (rw - badgeW) / 2);
    const by = rh >= badgeH + 6 ? (ry + (rh - badgeH) / 2) : (ry >= badgeH ? ry - badgeH : ry);

    ctx.fillStyle = '#131921';
    ctx.fillRect(bx, by, badgeW, badgeH);
    ctx.strokeStyle = '#FF9900';
    ctx.strokeRect(bx, by, badgeW, badgeH);

    ctx.fillStyle = '#FFD814';
    ctx.fillText(badgeText, bx + 5, by + 12);
    ctx.restore();
  });

  const dataUrl = canvas.toDataURL ? canvas.toDataURL('image/jpeg', 0.85) : '';

  return {
    canvas,
    dataUrl,
    totalRedacted: allRegions.length,
    regions: allRegions
  };
}

if (typeof exports !== 'undefined') {
  module.exports = { sanitizeScreenshot, calculateAdaptivePadding };
} else if (typeof globalThis !== 'undefined') {
  globalThis.CanvasRedactor = { sanitizeScreenshot, calculateAdaptivePadding };
}
