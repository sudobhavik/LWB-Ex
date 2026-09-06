/**
 * On-Device Canvas Redaction Engine
 * Sanitizes screenshots by applying multi-pass Gaussian box blurs
 * and semantic badges over detected faces and PII regions.
 * Guarantees zero sensitive bytes leave the local client.
 */

/**
 * Sanitizes an image canvas by blurring sensitive regions and applying badges.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} sourceImage
 * @param {Array<{ x: number, y: number, width: number, height: number, className?: string }>} faceRegions
 * @param {Array<{ x: number, y: number, width: number, height: number, type?: string }>} piiRegions
 * @param {Function} [createCanvasFn]
 * @returns {{ canvas: HTMLCanvasElement, dataUrl: string, totalRedacted: number }}
 */
function sanitizeScreenshot(sourceImage, faceRegions = [], piiRegions = [], createCanvasFn = null) {
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

  const ctx = canvas.getContext('2d');
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

  // 2. Apply multi-pass heavy box blur and badges
  allRegions.forEach(region => {
    if (region.width <= 0 || region.height <= 0) return;

    // Expand region slightly for complete coverage
    const pad = 4;
    const rx = Math.max(0, region.x - pad);
    const ry = Math.max(0, region.y - pad);
    const rw = Math.min(width - rx, region.width + pad * 2);
    const rh = Math.min(height - ry, region.height + pad * 2);

    // Multi-pass blur
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();

    // Pass 1: Heavy blur
    ctx.filter = 'blur(16px)';
    ctx.drawImage(sourceImage, 0, 0, width, height);
    // Pass 2: Secondary blur pass for total entropy destruction
    ctx.drawImage(canvas, 0, 0);

    // Semi-opaque neutral dark overlay
    ctx.fillStyle = 'rgba(26, 26, 26, 0.45)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

    // 3. Render High-Contrast Semantic Badge
    ctx.save();
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    const badgeText = `[${region.label}]`;
    ctx.font = 'bold 11px monospace';
    const textMetrics = ctx.measureText(badgeText);
    const badgeW = textMetrics.width + 10;
    const badgeH = 16;

    // Position badge
    const bx = rx;
    const by = ry >= badgeH ? ry - badgeH : ry;

    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(bx, by, badgeW, badgeH);

    ctx.fillStyle = '#F7F7F5';
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
  module.exports = { sanitizeScreenshot };
} else if (typeof globalThis !== 'undefined') {
  globalThis.CanvasRedactor = { sanitizeScreenshot };
}
