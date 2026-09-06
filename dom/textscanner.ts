// This module provides functionality to scan the visible text on a webpage and extract relevant information, such as the text content, bounding box coordinates, and tag names of the elements containing the text. It defines the TextBlock interface to represent the extracted information and includes utility functions for normalizing text, checking element visibility, and retrieving direct text from elements. The main function, scanVisibleText, iterates through all elements in the DOM, filters out invisible elements, and collects unique text blocks for further analysis.


export interface TextBlock {
  text: string;

  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  tagName: string;
}
// This function normalizes the input text by replacing multiple whitespace characters with a single space and trimming leading and trailing whitespace. It ensures that the text is in a consistent format for further processing.
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
// This function checks if a given HTML element is visible on the page by examining its computed styles and bounding box dimensions. It returns true if the element is visible and false otherwise.
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

  return rect.width > 0 && rect.height > 0;
}
// This function retrieves the direct text content of a given HTML element by iterating through its child nodes and concatenating the text from text nodes. It ignores any nested elements and returns the normalized text.
function getDirectText(element: HTMLElement): string {
  let text = "";

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += ` ${node.textContent ?? ""}`;
    }
  }

  return normalizeText(text);
}
// This function scans the visible text on a webpage by iterating through all elements in the DOM, filtering out invisible elements, and collecting unique text blocks. It returns an array of TextBlock objects containing the text content, bounding box coordinates, and tag names of the elements containing the text.
export function scanVisibleText(): TextBlock[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("*"),
  );

  const textBlocks: TextBlock[] = [];

  const seen = new Set<string>();

  for (const element of elements) {
    if (!isVisible(element)) {
      continue;
    }

    const text = getDirectText(element);

    if (!text) {
      continue;
    }

    const rect = element.getBoundingClientRect();

    const key = [
      text,
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.width),
      Math.round(rect.height),
    ].join("-");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    textBlocks.push({
      text,
      bbox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      tagName: element.tagName.toLowerCase(),
    });
  }

  return textBlocks;
}