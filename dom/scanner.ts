import type {
  DOMElement,
  InputType,
} from "./types";
// This module provides functionality to scan the DOM of a webpage and extract relevant information about specific elements, such as buttons, links, and input fields. It defines the DOMElement interface to represent the extracted information and includes utility functions for determining element types, retrieving text content, labels, placeholders, and bounding box coordinates. The main function, scanDOM, iterates through the specified elements in the DOM, filters out invisible elements, and collects their properties for further analysis.
const ELEMENT_SELECTOR = [
  "button",
  "a",
  "input",
  '[role="button"]',
  '[role="link"]',
].join(",");
// this function scans the DOM of a webpage and extracts relevant information about specific elements, such as buttons, links, and input fields. It returns an array of DOMElement objects containing the type, text content, input type (if applicable), associated label and placeholder text, bounding box coordinates, and a unique selector for identifying each element within the DOM.
export function scanDOM(): DOMElement[] {
  const elements: DOMElement[] = [];

  const nodes = document.querySelectorAll<HTMLElement>(
    ELEMENT_SELECTOR,
  );

  for (const element of nodes) {
    if (!isVisible(element)) {
      continue;
    }

    const bbox = getBoundingBox(element);

    if (!isInViewport(bbox)) {
      continue;
    }

    elements.push({
      type: getElementType(element),

      text: getText(element),

      inputType: getInputType(element),

      label: getLabel(element),

      placeholder: getPlaceholder(element),

      bbox,

      selector: getSelector(element),
    });
  }

  return elements;
}
//utlity func for determining the type of a given html element based on its tag name and role attribute. It returns a string representing the element type, which can be "button", "link", or "input".
function getElementType(
  element: HTMLElement,
): DOMElement["type"] {
  const tag = element.tagName.toLowerCase();

  if (
    tag === "button" ||
    element.getAttribute("role") === "button"
  ) {
    return "button";
  }

  if (
    tag === "a" ||
    element.getAttribute("role") === "link"
  ) {
    return "link";
  }

  return "input";
}

function getText(element: HTMLElement): string {
  if (
    element instanceof HTMLInputElement
  ) {
    return "";
  }

  return normalizeText(
    element.innerText ||
      element.textContent ||
      "",
  );
}

function getInputType(
  element: HTMLElement,
): InputType | null {
  if (!(element instanceof HTMLInputElement)) {
    return null;
  }

  const type = element.type.toLowerCase();

  const validTypes: InputType[] = [
    "text",
    "email",
    "password",
    "search",
    
    "url",
    "number",
    "checkbox",
    "radio",
    "file",
  ];

  if (validTypes.includes(type as InputType)) {
    return type as InputType;
  }

  return "other";
}

function getLabel(
  element: HTMLElement,
): string | null {
  if (!(element instanceof HTMLInputElement)) {
    return null;
  }

  const ariaLabel =
    element.getAttribute("aria-label");

  if (ariaLabel) {
    return normalizeText(ariaLabel);
  }

  if (element.id) {
    const label = document.querySelector(
      `label[for="${CSS.escape(element.id)}"]`,
    );

    if (label) {
      return normalizeText(
        label.textContent || "",
      );
    }
  }

  const parentLabel =
    element.closest("label");

  if (parentLabel) {
    return normalizeText(
      parentLabel.textContent || "",
    );
  }

  return null;
}

function getPlaceholder(
  element: HTMLElement,
): string | null {
  if (
    element instanceof HTMLInputElement
  ) {
    return element.getAttribute(
      "placeholder",
    );
  }

  return null;
}

function isVisible(
  element: HTMLElement,
): boolean {
  const style =
    window.getComputedStyle(element);

  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0"
  ) {
    return false;
  }

  const rect =
    element.getBoundingClientRect();

  return (
    rect.width > 0 &&
    rect.height > 0
  );
}

function getBoundingBox(
  element: HTMLElement,
) {
  const rect =
    element.getBoundingClientRect();

  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

function isInViewport(
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): boolean {
  return !(
    bbox.x + bbox.width < 0 ||
    bbox.x > window.innerWidth ||
    bbox.y + bbox.height < 0 ||
    bbox.y > window.innerHeight
  );
}

function getSelector(
  element: HTMLElement,
): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const testId =
    element.getAttribute("data-testid");

  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  return element.tagName.toLowerCase();
}

function normalizeText(
  text: string,
): string {
  return text
    .replace(/\s+/g, " ")
    .trim();
}