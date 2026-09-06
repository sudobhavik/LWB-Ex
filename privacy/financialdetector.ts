import type { TextBlock } from "../dom/textscanner";
// this provide detection of financial data like price balance currency from the visible text we applied regex to detect thr financial data .
export type FinancialType =
  | "price"
  | "balance"
  | "currency";

export interface FinancialMatch {
  type: FinancialType;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text: string;
}

const CURRENCY_REGEX =
  /(?:₹|Rs\.?|INR|\$|USD|€|EUR|£|GBP|¥|JPY)\s*\d+(?:,\d{3})*(?:\.\d{1,2})?/gi;

const BALANCE_REGEX =
  /\b(?:available\s+balance|current\s+balance|account\s+balance|balance)\b/gi;

const PRICE_REGEX =
  /\b(?:price|total|amount|cost|subtotal|grand\s+total)\b/gi;

export function detectFinancialData(
  textBlocks: TextBlock[],
): FinancialMatch[] {
  const results: FinancialMatch[] = [];

  for (const block of textBlocks) {
    const text = block.text;

    // Currency / monetary amount
    if (CURRENCY_REGEX.test(text)) {
      results.push({
        type: "currency",
        bbox: block.bbox,
        text,
      });
    }

    CURRENCY_REGEX.lastIndex = 0;

    // Balance
    if (BALANCE_REGEX.test(text)) {
      results.push({
        type: "balance",
        bbox: block.bbox,
        text,
      });
    }

    BALANCE_REGEX.lastIndex = 0;

    // Price / amount / total
    if (PRICE_REGEX.test(text)) {
      results.push({
        type: "price",
        bbox: block.bbox,
        text,
      });
    }

    PRICE_REGEX.lastIndex = 0;
  }

  return results;
}