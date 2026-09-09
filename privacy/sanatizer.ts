import type { UnifiedDetection } from "../dom/types";

const OVERLAY_CLASS =
  "__ps171_privacy_overlay__";

interface SanitizeOptions {
  screenshotWidth: number;
  screenshotHeight: number;
}

export function sanitizeWebpage(
  detections: UnifiedDetection[],
  options: SanitizeOptions,
): void {
  removeExistingSanitization();

  const protectedDetections =
    detections.filter(
      (detection) => detection.protected,
    );

  console.log(
    "PS171 protected detections:",
    protectedDetections,
  );

  console.log(
    "PS171 screenshot:",
    options.screenshotWidth,
    "x",
    options.screenshotHeight,
  );

  console.log(
    "PS171 viewport:",
    window.innerWidth,
    "x",
    window.innerHeight,
  );

  /*
   * DOM detections are already in CSS viewport
   * coordinates.
   */
  const domDetections =
    protectedDetections.filter(
      (detection) =>
        detection.source === "dom",
    );

  /*
   * YOLO detections are in screenshot pixels.
   * Convert them to CSS viewport coordinates.
   */
  const visionDetections =
    protectedDetections
      .filter(
        (detection) =>
          detection.source === "vision",
      )
      .map((detection) =>
        normalizeVisionDetection(
          detection,
          options.screenshotWidth,
          options.screenshotHeight,
        ),
      );

  console.log(
    "DOM protected detections:",
    domDetections,
  );

  console.log(
    "Normalized vision detections:",
    visionDetections,
  );

  /*
   * DOM gets priority.
   *
   * If YOLO detects a large password field around
   * the same region as the DOM password input,
   * don't create the YOLO mask.
   */
  const filteredVision =
    visionDetections.filter(
      (vision) => {
        const overlapsDOM =
          domDetections.some(
            (dom) =>
              getIoU(
                dom.bbox,
                vision.bbox,
              ) > 0.15,
          );

        if (overlapsDOM) {
          console.log(
            "PS171 dropping overlapping YOLO detection:",
            vision.type,
            vision.bbox,
          );

          return false;
        }

        return true;
      },
    );

  /*
   * DOM masks first.
   */
  for (const detection of domDetections) {
    console.log(
      "PS171 DOM mask:",
      detection.type,
      detection.bbox,
    );

    createOverlay(detection);
  }

  /*
   * YOLO masks only for visual regions that
   * don't overlap a DOM sensitive field.
   */
  for (const detection of filteredVision) {
    console.log(
      "PS171 YOLO mask:",
      detection.type,
      detection.bbox,
    );

    createOverlay(detection);
  }
}

function normalizeVisionDetection(
  detection: UnifiedDetection,
  screenshotWidth: number,
  screenshotHeight: number,
): UnifiedDetection {
  const scaleX =
    window.innerWidth /
    screenshotWidth;

  const scaleY =
    window.innerHeight /
    screenshotHeight;

  return {
    ...detection,

    bbox: {
      x:
        detection.bbox.x *
        scaleX,

      y:
        detection.bbox.y *
        scaleY,

      width:
        detection.bbox.width *
        scaleX,

      height:
        detection.bbox.height *
        scaleY,
    },
  };
}
// this function calculates the Intersection over Union (IoU) of two bounding boxes, which is a measure of how much they overlap. It returns a value between 0 and 1, where 0 means no overlap and 1 means complete overlap. This is used to determine if a YOLO detection overlaps with a DOM detection, in which case the YOLO detection can be ignored to avoid redundant masking.
function getIoU(
  a: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  b: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;

  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;

  const intersectionX1 =
    Math.max(a.x, b.x);

  const intersectionY1 =
    Math.max(a.y, b.y);

  const intersectionX2 =
    Math.min(ax2, bx2);

  const intersectionY2 =
    Math.min(ay2, by2);

  const intersectionWidth =
    Math.max(
      0,
      intersectionX2 -
        intersectionX1,
    );

  const intersectionHeight =
    Math.max(
      0,
      intersectionY2 -
        intersectionY1,
    );

  const intersectionArea =
    intersectionWidth *
    intersectionHeight;

  if (intersectionArea === 0) {
    return 0;
  }

  const areaA =
    a.width * a.height;

  const areaB =
    b.width * b.height;

  const unionArea =
    areaA +
    areaB -
    intersectionArea;

  if (unionArea <= 0) {
    return 0;
  }

  return (
    intersectionArea /
    unionArea
  );
}

function createOverlay(
  detection: UnifiedDetection,
): void {
  const {
    x,
    y,
    width,
    height,
  } = detection.bbox;

  if (
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  const overlay =
    document.createElement("div");

  overlay.className =
    OVERLAY_CLASS;

  overlay.style.position =
    "fixed";

  overlay.style.left =
    `${x}px`;

  overlay.style.top =
    `${y}px`;

  overlay.style.width =
    `${width}px`;

  overlay.style.height =
    `${height}px`;

  overlay.style.zIndex =
    "2147483647";

  overlay.style.pointerEvents =
    "none";

  overlay.style.boxSizing =
    "border-box";

  /*
   * Production redaction styling.
   *
   * Deliberately visually inert: a flat neutral
   * fill with no border and no all-caps label. The
   * earlier near-black fill + red border + bold
   * "PROTECTED" caption read as a call-to-action to
   * the vision model (gpt-4o), which was clicking the
   * overlays themselves instead of the real page
   * controls. Since pointerEvents is "none", clicks on
   * this overlay pass through to whatever's underneath,
   * so a click aimed at a decoy overlay silently does
   * nothing on the page — which is exactly the stuck,
   * same-coordinates-repeated pattern seen in the
   * agent logs.
   *
   * No border, no caps-lock label, no red/black high
   * contrast.
   */
  overlay.style.background =
    "#c9c9c9";

  /*
   * Dot-masked placeholder text, styled like classic
   * redacted text (low-contrast dots on a flat panel)
   * rather than a labeled banner. This keeps the box
   * legible as "there was text here, it's hidden"
   * without reintroducing anything button-shaped:
   * no border, no bold weight, no high-contrast
   * color pairing, no single centered caption.
   */
  overlay.style.display =
    "block";

  overlay.style.padding =
    "2px 4px";

  overlay.style.color =
    "#9a9a9a";

  overlay.style.fontFamily =
    "monospace";

  overlay.style.fontWeight =
    "400";

  overlay.style.textAlign =
    "left";

  overlay.style.whiteSpace =
    "pre-line";

  overlay.style.overflow =
    "hidden";

  overlay.style.userSelect =
    "none";

  const fontSize =
    getPlaceholderFontSize(
      height,
    );

  overlay.style.fontSize =
    `${fontSize}px`;

  overlay.style.lineHeight =
    "1.4";

  overlay.style.letterSpacing =
    "2px";

  overlay.textContent =
    getPlaceholderText(
      width,
      height,
      fontSize,
    );

  document.body.appendChild(
    overlay,
  );
}

const PLACEHOLDER_CHAR = "•";

/*
 * Scales the placeholder glyph size to the box height
 * so a tall address block gets several masked lines
 * and a short phone-number field gets one thin line,
 * instead of one font size for every box shape.
 */
function getPlaceholderFontSize(
  height: number,
): number {
  return Math.min(
    18,
    Math.max(
      10,
      height * 0.4,
    ),
  );
}

/*
 * Fills the box with repeated dot characters sized to
 * its width/height, wrapped onto as many lines as fit.
 * This is intentionally generic (no per-field-type
 * copy) — if you later want type-aware placeholders
 * (e.g. "+91 ••••••••" for phone, "•••• •••• •••• 1234"
 * for card-like fields), branch on detection.type here
 * and fall back to this dot fill for anything else.
 */
function getPlaceholderText(
  width: number,
  height: number,
  fontSize: number,
): string {
  const approxCharWidth =
    fontSize * 0.6;

  const charsPerLine =
    Math.max(
      3,
      Math.floor(
        width / approxCharWidth,
      ),
    );

  const lineHeight =
    fontSize * 1.4;

  const linesPerBox =
    Math.max(
      1,
      Math.floor(
        height / lineHeight,
      ),
    );

  const line =
    PLACEHOLDER_CHAR.repeat(
      charsPerLine,
    );

  return Array(linesPerBox)
    .fill(line)
    .join("\n");
}

export function removeExistingSanitization(): void {
  const overlays =
    document.querySelectorAll(
      `.${OVERLAY_CLASS}`,
    );

  overlays.forEach(
    (overlay) =>
      overlay.remove(),
  );
}