/**
 * PS171 On-Device Canvas Redaction Engine
 *
 * Takes the original screenshot and UnifiedDetection[]
 * and produces a locally sanitized screenshot.
 *
 * IMPORTANT:
 * - No detection happens here.
 * - No network request happens here.
 * - It only redacts regions supplied by the perception layer.
 */

import type { UnifiedDetection } from "../dom/types";

export interface CanvasRedactionResult {
  dataUrl: string;
  totalRedacted: number;
}

interface RedactionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export async function sanitizeScreenshot(
  screenshot: string,
  detections: UnifiedDetection[],
): Promise<CanvasRedactionResult> {
  const image = await loadImage(screenshot);

  const width =
    image.naturalWidth || image.width;

  const height =
    image.naturalHeight || image.height;

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create canvas context",
    );
  }

  // --------------------------------------------------
  // 1. Draw original screenshot
  // --------------------------------------------------

  ctx.drawImage(
    image,
    0,
    0,
    width,
    height,
  );

  // --------------------------------------------------
  // 2. Convert protected detections into regions
  // --------------------------------------------------

  const regions =
    detections
      .filter(
        (detection) =>
          detection.protected,
      )
      .map((detection) => ({
        x: detection.bbox.x,
        y: detection.bbox.y,
        width: detection.bbox.width,
        height: detection.bbox.height,
        label: getLabel(
          detection.type,
        ),
      }));

  console.log(
    "Canvas redaction regions:",
    regions,
  );

  // --------------------------------------------------
  // 3. Redact every protected region
  // --------------------------------------------------

  for (const region of regions) {
    redactRegion(
      ctx,
      image,
      region,
      width,
      height,
    );
  }

  // --------------------------------------------------
  // 4. Export SAFE screenshot
  // --------------------------------------------------

  const dataUrl =
    canvas.toDataURL("image/png");

  return {
    dataUrl,
    totalRedacted:
      regions.length,
  };
}

// --------------------------------------------------
// Redact one region
// --------------------------------------------------

function redactRegion(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  region: RedactionRegion,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (
    region.width <= 0 ||
    region.height <= 0
  ) {
    return;
  }

  const pad = 4;

  const x = Math.max(
    0,
    region.x - pad,
  );

  const y = Math.max(
    0,
    region.y - pad,
  );

  const right = Math.min(
    canvasWidth,
    region.x +
      region.width +
      pad,
  );

  const bottom = Math.min(
    canvasHeight,
    region.y +
      region.height +
      pad,
  );

  const width =
    right - x;

  const height =
    bottom - y;

  if (
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  // ------------------------------------------------
  // Clip exactly to sensitive region
  // ------------------------------------------------

  ctx.save();

  ctx.beginPath();

  ctx.rect(
    x,
    y,
    width,
    height,
  );

  ctx.clip();

  // ------------------------------------------------
  // Blur original screenshot
  // ------------------------------------------------

  ctx.filter =
    "blur(18px)";

  ctx.drawImage(
    sourceImage,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  ctx.filter = "none";

  ctx.restore();

  // ------------------------------------------------
  // Opaque privacy layer
  // ------------------------------------------------

  ctx.save();

  ctx.fillStyle =
    "rgba(20, 20, 20, 0.92)";

  ctx.fillRect(
    x,
    y,
    width,
    height,
  );

  ctx.restore();

  // ------------------------------------------------
  // Privacy border
  // ------------------------------------------------

  ctx.save();

  ctx.strokeStyle =
    "#1A1A1A";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    x,
    y,
    width,
    height,
  );

  ctx.restore();

  // ------------------------------------------------
  // Semantic badge
  // ------------------------------------------------

  drawBadge(
    ctx,
    x,
    y,
    width,
    region.label,
  );
}

// --------------------------------------------------
// Badge
// --------------------------------------------------

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  regionWidth: number,
  label: string,
): void {
  const text =
    `[${label}]`;

  ctx.save();

  ctx.font =
    "bold 11px monospace";

  const metrics =
    ctx.measureText(text);

  const badgeWidth =
    Math.min(
      Math.max(
        metrics.width + 10,
        70,
      ),
      Math.max(
        regionWidth,
        70,
      ),
    );

  const badgeHeight = 16;

  const badgeX = x;

  const badgeY =
    y >= badgeHeight
      ? y - badgeHeight
      : y;

  ctx.fillStyle =
    "#1A1A1A";

  ctx.fillRect(
    badgeX,
    badgeY,
    badgeWidth,
    badgeHeight,
  );

  ctx.fillStyle =
    "#F7F7F5";

  ctx.fillText(
    text,
    badgeX + 5,
    badgeY + 12,
  );

  ctx.restore();
}

// --------------------------------------------------
// Detection type → badge label
// --------------------------------------------------

function getLabel(
  type: string,
): string {
  switch (type.toLowerCase()) {
    case "face":
      return "REDACTED_FACE";

    case "password":
    case "password_field":
      return "REDACTED_PASSWORD";

    case "email":
      return "REDACTED_EMAIL";

    case "phone":
      return "REDACTED_PHONE";

    case "card":
    case "credit_card":
      return "REDACTED_CARD";

    case "aadhaar":
      return "REDACTED_AADHAAR";

    case "pan":
      return "REDACTED_PAN";

    case "ssn":
      return "REDACTED_SSN";

    case "api_key":
    case "token":
      return "REDACTED_SECRET";

    case "currency":
      return "REDACTED_CURRENCY";

    case "balance":
      return "REDACTED_BALANCE";

    case "pii_field":
      return "REDACTED_PII";

    default:
      return "REDACTED";
  }
}

// --------------------------------------------------
// Load screenshot
// --------------------------------------------------

function loadImage(
  src: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            "Failed to load screenshot",
          ),
        );
      };

      image.src = src;
    },
  );
}