export type SensitiveType =
  | "email"
  | "phone"
  | "password"
  | "api_key"
  | "token"
  | "credit_card";
// this module provide functionality to detect sensitive info like email phone pass apikey credit card form thr page we applied regex on the text  regex patterns ai se likhwaye hai i dont know 🥲
export interface SensitiveMatch {
  type: SensitiveType;

  start: number;

  end: number;
}

const EMAIL_REGEX =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const PHONE_REGEX =
  /(?<!\d)(?:\+91[\s-]?)?[6-9]\d{9}(?!\d)/g;

const API_KEY_REGEX =
  /\b(?:sk-proj-|sk-or-v1-|ghp_)[A-Za-z0-9_-]{10,}\b/g;

const JWT_REGEX =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

const CARD_REGEX =
  /\b(?:\d[ -]*?){13,19}\b/g;

export function detectSensitiveData(
  text: string,
): SensitiveMatch[] {
  const results: SensitiveMatch[] = [];

  addMatches(
    results,
    text,
    EMAIL_REGEX,
    "email",
  );

  addMatches(
    results,
    text,
    PHONE_REGEX,
    "phone",
  );

  addMatches(
    results,
    text,
    API_KEY_REGEX,
    "api_key",
  );

  addMatches(
    results,
    text,
    JWT_REGEX,
    "token",
  );

  addMatches(
    results,
    text,
    CARD_REGEX,
    "credit_card",
  );

  return results;
}

function addMatches(
  results: SensitiveMatch[],
  text: string,
  regex: RegExp,
  type: SensitiveType,
) {
  regex.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    results.push({
      type,
      start: match.index,
      end:
        match.index + match[0].length,
    });
  }
}