// ============================================================
// TEXT SCANNER
// Extracts visible, meaningful text from webpage elements.
//
// Used for:
// 1. Privacy / PII detection
// 2. Giving semantic information about the page to the agent
// ============================================================

export interface TextBlock {
  text: string;

  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  tagName: string;

  // Useful for agent navigation
  role?: string;

  // Whether this is an interactive element
  interactive?: boolean;
}


// ============================================================
// NORMALIZE TEXT
// ============================================================

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// CHECK VISIBILITY
// ============================================================

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);

  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return false;
  }

  // Ignore elements completely outside viewport
  if (
    rect.bottom < 0 ||
    rect.right < 0 ||
    rect.top > window.innerHeight ||
    rect.left > window.innerWidth
  ) {
    return false;
  }

  return true;
}


// ============================================================
// GET MEANINGFUL TEXT
// ============================================================

function getElementText(
  element: HTMLElement,
): string {

  // ----------------------------------------------------------
  // Priority 1: aria-label
  // ----------------------------------------------------------

  const ariaLabel =
    element.getAttribute("aria-label");

  if (ariaLabel) {
    return normalizeText(ariaLabel);
  }


  // ----------------------------------------------------------
  // Priority 2: input placeholder
  // ----------------------------------------------------------

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    const placeholder =
      element.getAttribute("placeholder");

    if (placeholder) {
      return normalizeText(placeholder);
    }

    const value = element.value;

    if (value) {
      return normalizeText(value);
    }
  }


  // ----------------------------------------------------------
  // Priority 3: visible text content
  // ----------------------------------------------------------

  const text =
    element.innerText ||
    element.textContent ||
    "";

  return normalizeText(text);
}


// ============================================================
// DETECT INTERACTIVE ELEMENTS
// ============================================================

function isInteractive(
  element: HTMLElement,
): boolean {

  const tag =
    element.tagName.toLowerCase();

  if (
    tag === "button" ||
    tag === "a" ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select"
  ) {
    return true;
  }


  const role =
    element.getAttribute("role");

  if (
    role === "button" ||
    role === "link" ||
    role === "textbox" ||
    role === "menuitem"
  ) {
    return true;
  }


  if (
    element.hasAttribute("onclick")
  ) {
    return true;
  }


  return false;
}


// ============================================================
// GET ELEMENT ROLE
// ============================================================

function getElementRole(
  element: HTMLElement,
): string {

  const explicitRole =
    element.getAttribute("role");

  if (explicitRole) {
    return explicitRole;
  }

  const tag =
    element.tagName.toLowerCase();

  switch (tag) {
    case "button":
      return "button";

    case "a":
      return "link";

    case "input":
      return "input";

    case "textarea":
      return "textarea";

    case "select":
      return "select";

    default:
      return tag;
  }
}


// ============================================================
// IMPORTANT:
// CHECK IF ELEMENT IS A MEANINGFUL TEXT CONTAINER
// ============================================================

function isMeaningfulElement(
  element: HTMLElement,
): boolean {

  const tag =
    element.tagName.toLowerCase();

  const meaningfulTags = new Set([
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "label",
    "p",
    "span",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
  ]);

  return (
    meaningfulTags.has(tag) ||
    isInteractive(element)
  );
}


// ============================================================
// MAIN SCANNER
// ============================================================

export function scanVisibleText(): TextBlock[] {

  const elements =
    Array.from(
      document.querySelectorAll<HTMLElement>("*"),
    );

  const textBlocks: TextBlock[] = [];

  const seen = new Set<string>();


  for (const element of elements) {

    // --------------------------------------------------------
    // 1. Skip invisible elements
    // --------------------------------------------------------

    if (!isVisible(element)) {
      continue;
    }


    // --------------------------------------------------------
    // 2. Skip meaningless containers
    // --------------------------------------------------------

    if (!isMeaningfulElement(element)) {
      continue;
    }


    // --------------------------------------------------------
    // 3. Extract text
    // --------------------------------------------------------

    const text =
      getElementText(element);

    if (!text) {
      continue;
    }


    // Avoid giant text containers
    if (text.length > 300) {
      continue;
    }


    // --------------------------------------------------------
    // 4. Bounding box
    // --------------------------------------------------------

    const rect =
      element.getBoundingClientRect();

    const bbox = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };


    // --------------------------------------------------------
    // 5. Create duplicate key
    // --------------------------------------------------------

    const key = [
      text,
      Math.round(bbox.x),
      Math.round(bbox.y),
      Math.round(bbox.width),
      Math.round(bbox.height),
    ].join("|");


    if (seen.has(key)) {
      continue;
    }

    seen.add(key);


    // --------------------------------------------------------
    // 6. Store text block
    // --------------------------------------------------------

    textBlocks.push({
      text,
      bbox,
      tagName:
        element.tagName.toLowerCase(),

      role:
        getElementRole(element),

      interactive:
        isInteractive(element),
    });
  }


  console.log(
    "[TEXT SCANNER] Visible text blocks:",
    textBlocks,
  );

  return textBlocks;
}