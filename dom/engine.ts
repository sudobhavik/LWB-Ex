import { scanDOM } from "../dom/scanner";
import { scanVisibleText } from "../dom/textscanner";
import { detectSensitiveData } from "../privacy/piiDetector";
import { detectFinancialData } from "../privacy/financialdetector";
// the Perception module is responsible for analyzing the DOM and visible text on a webpage to identify elements that may contain sensitive information. It scans the DOM for input fields and other relevant elements, checks for visible text that may contain personally identifiable information (PII), and detects financial data. The results are returned as a structured object containing the identified elements and a count of sensitive elements.
export type PerceptionType =
  | "button"
  | "link"
  | "input"
  | "email"
  | "password"
  | "phone"
  | "api_key"
  | "token"
  | "credit_card"
  | "price"
  | "balance"
  | "currency";

export interface PerceptionElement {
  type: PerceptionType;

  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  sensitive: boolean;
}
export interface PerceptionResult {
  elements: PerceptionElement[];
  sensitiveCount: number;
}
export function runPerception(): PerceptionResult {
  const domElements = scanDOM();
  const textBlocks = scanVisibleText();

  const results: PerceptionElement[] = [];

  /*
   * 1. Add relevant DOM elements
   */
  for (const element of domElements) {
  const type = getDOMType(element);

  results.push({
    type,
    bbox: element.bbox,
    sensitive:
      type === "email" ||
      type === "password" ||
      type === "phone",
  });
}

  /*
   * 2. Detect sensitive information from visible text
   */
  for (const block of textBlocks) {
  const sensitiveMatches =
    detectSensitiveData(block.text);

  for (const match of sensitiveMatches) {
    results.push({
      type: match.type,
      bbox: block.bbox,
      sensitive: true,
    });
  }
}

  /*
   * 3. Detect financial information
   */
 const financialMatches =
  detectFinancialData(textBlocks);

for (const match of financialMatches) {
  results.push({
    type: match.type,
    bbox: match.bbox,
    sensitive: true,
  });
}

  return {
  elements: results,
  sensitiveCount: results.filter(
    (element) => element.sensitive,
  ).length,
};
}

function getDOMType(
  element: ReturnType<typeof scanDOM>[number],
): PerceptionType {
  if (
    element.type === "input" &&
    element.inputType === "email"
  ) {
    return "email";
  }

  if (
    element.type === "input" &&
    element.inputType === "password"
  ) {
    return "password";
  }

  if (
    element.type === "input" &&
    element.inputType === "tel"
  ) {
    return "phone";
  }

  return element.type;
}