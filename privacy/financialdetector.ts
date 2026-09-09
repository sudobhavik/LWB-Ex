import type { TextBlock } from "../dom/textscanner";

export type FinancialType = "balance";

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

const BALANCE_REGEX =
  /\b(?:available\s+balance|current\s+balance|account\s+balance|savings\s+balance|bank\s+balance)\b/gi;

export function detectFinancialData(
  textBlocks: TextBlock[],
): FinancialMatch[] {
  const results: FinancialMatch[] = [];

  for (const block of textBlocks) {
    const text = block.text;

    const hasBalance = BALANCE_REGEX.test(text);

    BALANCE_REGEX.lastIndex = 0;

    if (hasBalance) {
      results.push({
        type: "balance",
        bbox: block.bbox,
        text,
      });
    }
  }

  return results;
}