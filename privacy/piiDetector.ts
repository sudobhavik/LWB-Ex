/**
 * PS171 PII Detection Engine
 *
 * Detects sensitive information locally in the browser.
 *
 * Detection:
 * - Email
 * - Phone
 * - Aadhaar
 * - PAN
 * - SSN
 * - Credit card numbers (Luhn validated)
 * - API keys / tokens
 * - High-entropy secrets
 * - Gate / access codes
 * - 2FA backup codes
 * - Authenticator seeds
 * - Explicitly labelled names
 *
 * Also provides exact DOM bounding boxes using Range API.
 * 
 */

export type PIITypes =
  | "EMAIL"
  | "PHONE"
  | "AADHAAR"
  | "PAN"
  | "SSN"
  | "CARD"
  | "API_KEY"
  | "TOKEN"
  | "GATE_CODE"
  | "AUTH_SECRET"
  | "NAME"
  | "PASSWORD";

export interface PIIMatch {
  type: PIITypes;
  text: string;
  index: number;
  length: number;
}

export interface PIIRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PIITypes;
}

/* =========================================================
   CONTEXT
   ========================================================= */

const PHONE_CONTEXT =
  /\b(phone|telephone|tel|mobile|cell|contact|fax|call|emergency)\b/i;

const AADHAAR_CONTEXT =
  /\b(aadhaar|aadhar|uid|unique\s*identification|identity|kyc|gov)\b/i;

const PAN_CONTEXT =
  /\b(pan|permanent\s*account|tax|income\s*tax|kyc|identity)\b/i;

const SSN_CONTEXT =
  /\b(ssn|social\s*security|ss#|national\s*id)\b/i;

const AUTH_CONTEXT =
  /\b(authenticator|seed|secret|totp|2fa|two[-\s]?factor|backup|recovery|code)\b/i;

const AWS_CONTEXT =
  /\b(aws|secret|access\s*key|developer|secret\s*key)\b/i;

const GATE_CONTEXT =
  /\b(gate|door|entry|security|access|pass|delivery|passcode|intercom)\b/i;

const NAME_CONTEXT =
  /\b(name|full\s*name|account\s*holder|cardholder|customer|patient|subscriber|deliver\s*to|holder)\b/i;

/* =========================================================
   REGEX PATTERNS
   ========================================================= */

const EMAIL_REGEX =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const PHONE_REGEX =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+91[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b/g;

const AADHAAR_REGEX =
  /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g;

const PAN_REGEX =
  /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

const SSN_REGEX =
  /\b\d{3}-\d{2}-\d{4}\b/g;

const CARD_REGEX =
  /\b(?:\d[ -]*?){13,19}\b/g;

const API_KEY_REGEX =
  /\b(?:sk-or-v1-[A-Za-z0-9_-]{2,}(?:\.{3}[A-Za-z0-9_-]{2,})?|sk-proj-[A-Za-z0-9_-]{2,}(?:\.{3}[A-Za-z0-9_-]{2,})?|sk-[A-Za-z0-9_-]{4,}(?:\.{3}[A-Za-z0-9_-]{2,})?|AKIA[0-9A-Z]{16}|whsec_[A-Za-z0-9]{8,}|amzn_pay_[A-Za-z0-9_]{8,}|pk_live_[A-Za-z0-9_]{8,}|sk_live_[A-Za-z0-9_]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/gi;

const GATE_REGEX =
  /#[0-9]{4,6}(?:-[A-Z0-9]+)?\b/g;

const EXPLICIT_GATE_REGEX =
  /(?:delivery\s*(?:gate\s*)?(?:security\s*code|pass|code)?|gate\s*(?:security\s*code|access\s*code|pass|code)?|security\s*code|entry\s*code|door\s*code|passcode|access\s*code)[\s:#]+(#[0-9]{3,8}(?:-[A-Z0-9]+)?|\b[0-9]{3,8}(?:-[A-Z0-9]+)?)\b/gi;

const TWO_FA_REGEX =
  /\b\d{4}-\d{4}-\d{4}\b/g;

const AUTH_SEED_REGEX =
  /\b[A-Z2-7]{16,32}\b/g;

const NAME_REGEX =
  /(?:name|full\s*name|cardholder(?:\s*name)?|customer\s*name|account\s*holder)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/gi;

/* =========================================================
   LUHN
   ========================================================= */

/**
 * Validates a possible credit/debit card number.
 */
export function isLuhnValid(
  value: string,
): boolean {
  const clean = value.replace(
    /[\s-]/g,
    "",
  );

  // Card lengths
  if (!/^\d{13,19}$/.test(clean)) {
    return false;
  }

  // Reject 000000..., 111111..., etc.
  if (/^(\d)\1+$/.test(clean)) {
    return false;
  }

  let sum = 0;
  let doubleDigit = false;

  for (
    let i = clean.length - 1;
    i >= 0;
    i--
  ) {
    let digit = Number(
      clean.charAt(i),
    );

    if (doubleDigit) {
      digit *= 2;

      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

/* =========================================================
   SHANNON ENTROPY
   ========================================================= */

/**
 * Calculates Shannon entropy.
 *
 * Higher entropy generally means the string contains
 * more randomness.
 */
export function calculateShannonEntropy(
  value: string,
): number {
  if (!value) {
    return 0;
  }

  const frequency: Record<
    string,
    number
  > = {};

  for (const char of value) {
    frequency[char] =
      (frequency[char] ?? 0) + 1;
  }

  let entropy = 0;

  for (const count of Object.values(
    frequency,
  )) {
    const probability =
      count / value.length;

    entropy -=
      probability *
      Math.log2(probability);
  }

  return entropy;
}

/**
 * Detect whether a candidate looks like
 * a high-randomness secret.
 *
 * Entropy alone is NOT enough.
 */
function isHighEntropySecret(
  value: string,
): boolean {
  if (value.length < 20) {
    return false;
  }

  const entropy =
    calculateShannonEntropy(value);

  return entropy >= 3.5;
}

/* =========================================================
   HELPER
   ========================================================= */

function addMatches(
  results: PIIMatch[],
  text: string,
  regex: RegExp,
  type: PIITypes,
): void {
  regex.lastIndex = 0;

  let match: RegExpExecArray | null;

  while (
    (match = regex.exec(text)) !== null
  ) {
    results.push({
      type,
      text: match[0],
      index: match.index,
      length: match[0].length,
    });
  }

  regex.lastIndex = 0;
}

/* =========================================================
   MAIN PII EXTRACTION
   ========================================================= */

/**
 * Detect PII inside a text string.
 *
 * contextStr should contain surrounding DOM text,
 * such as the parent/grandparent text.
 */
export function extractPIIMatches(
  text: string,
  contextStr = "",
): PIIMatch[] {
  if (
    !text ||
    typeof text !== "string"
  ) {
    return [];
  }

  const results: PIIMatch[] = [];

  const context =
    `${contextStr} ${text}`;

  /* -------------------------------------------------------
     1. EMAIL
     ------------------------------------------------------- */

  addMatches(
    results,
    text,
    EMAIL_REGEX,
    "EMAIL",
  );

  /* -------------------------------------------------------
     2. CREDIT CARD + LUHN
     ------------------------------------------------------- */

  CARD_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while (
    (match =
      CARD_REGEX.exec(text)) !== null
  ) {
    if (isLuhnValid(match[0])) {
      results.push({
        type: "CARD",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  CARD_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     3. AADHAAR
     ------------------------------------------------------- */

  AADHAAR_REGEX.lastIndex = 0;

  while (
    (match =
      AADHAAR_REGEX.exec(text)) !== null
  ) {
    if (
      AADHAAR_CONTEXT.test(context)
    ) {
      results.push({
        type: "AADHAAR",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  AADHAAR_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     4. PAN
     ------------------------------------------------------- */

  PAN_REGEX.lastIndex = 0;

  while (
    (match =
      PAN_REGEX.exec(text)) !== null
  ) {
    /*
     * PAN format is distinctive enough for MVP,
     * but context increases confidence.
     *
     * We accept the pattern directly because
     * users may see PAN without a nearby "PAN" label.
     */
    if (
      PAN_CONTEXT.test(context) ||
      /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(
        match[0],
      )
    ) {
      results.push({
        type: "PAN",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  PAN_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     5. SSN
     ------------------------------------------------------- */

  SSN_REGEX.lastIndex = 0;

  while (
    (match =
      SSN_REGEX.exec(text)) !== null
  ) {
    if (
      SSN_CONTEXT.test(context)
    ) {
      results.push({
        type: "SSN",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  SSN_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     6. PHONE
     ------------------------------------------------------- */

  PHONE_REGEX.lastIndex = 0;

  while (
    (match =
      PHONE_REGEX.exec(text)) !== null
  ) {
    const value = match[0];

    const isInternational =
      /^\+(?:1|91)\b/.test(
        value,
      );

    const hasPhoneContext =
      PHONE_CONTEXT.test(context);

    /*
     * International phone numbers can be
     * accepted directly.
     *
     * Local phone numbers require context.
     */
    if (
      isInternational ||
      hasPhoneContext
    ) {
      results.push({
        type: "PHONE",
        text: value,
        index: match.index,
        length: value.length,
      });
    }
  }

  PHONE_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     7. KNOWN API KEYS / TOKENS
     ------------------------------------------------------- */

  addMatches(
    results,
    text,
    API_KEY_REGEX,
    "API_KEY",
  );

  /* -------------------------------------------------------
     8. HIGH ENTROPY SECRET
     ------------------------------------------------------- */

  /*
   * Look at whitespace-separated tokens.
   *
   * We do NOT classify every high entropy string
   * as PII. It also needs secret-like context.
   */

  const secretContext =
    AUTH_CONTEXT.test(context) ||
    AWS_CONTEXT.test(context) ||
    /\b(api|key|token|secret|credential|webhook)\b/i.test(
      context,
    );

  if (secretContext) {
    const tokens =
      text.split(/\s+/);

    let searchIndex = 0;

    for (const token of tokens) {
      const index =
        text.indexOf(
          token,
          searchIndex,
        );

      searchIndex =
        index + token.length;

      const cleanToken =
        token.replace(
          /^[("'`[{]+|[)"'`\]},.;]+$/g,
          "",
        );

      if (
        isHighEntropySecret(
          cleanToken,
        )
      ) {
        const actualIndex =
          index +
          token.indexOf(
            cleanToken,
          );

        const alreadyDetected =
          results.some(
            (item) =>
              actualIndex >=
                item.index &&
              actualIndex <
                item.index +
                  item.length,
          );

        if (!alreadyDetected) {
          results.push({
            type: "TOKEN",
            text: cleanToken,
            index: actualIndex,
            length:
              cleanToken.length,
          });
        }
      }
    }
  }

  /* -------------------------------------------------------
     9. GATE / ACCESS CODES
     ------------------------------------------------------- */

  GATE_REGEX.lastIndex = 0;

  while (
    (match =
      GATE_REGEX.exec(text)) !== null
  ) {
    if (
      !GATE_CONTEXT.test(context)
    ) {
      continue;
    }

    // Avoid HTML entities such as &#9733;
    if (
      match.index > 0 &&
      text[match.index - 1] === "&"
    ) {
      continue;
    }

    results.push({
      type: "GATE_CODE",
      text: match[0],
      index: match.index,
      length: match[0].length,
    });
  }

  GATE_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     10. EXPLICIT GATE CODE
     ------------------------------------------------------- */

  EXPLICIT_GATE_REGEX.lastIndex = 0;

  while (
    (match =
      EXPLICIT_GATE_REGEX.exec(
        text,
      )) !== null
  ) {
    const code = match[1];

    const codeIndex =
      match.index +
      match[0].lastIndexOf(
        code,
      );

    const alreadyDetected =
      results.some(
        (item) =>
          item.index ===
            codeIndex &&
          item.length ===
            code.length,
      );

    if (!alreadyDetected) {
      results.push({
        type: "GATE_CODE",
        text: code,
        index: codeIndex,
        length: code.length,
      });
    }
  }

  EXPLICIT_GATE_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     11. 2FA BACKUP CODES
     ------------------------------------------------------- */

  TWO_FA_REGEX.lastIndex = 0;

  while (
    (match =
      TWO_FA_REGEX.exec(text)) !== null
  ) {
    if (
      AUTH_CONTEXT.test(context)
    ) {
      results.push({
        type: "AUTH_SECRET",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  TWO_FA_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     12. AUTHENTICATOR SEED
     ------------------------------------------------------- */

  AUTH_SEED_REGEX.lastIndex = 0;

  while (
    (match =
      AUTH_SEED_REGEX.exec(text)) !== null
  ) {
    if (
      AUTH_CONTEXT.test(context)
    ) {
      results.push({
        type: "AUTH_SECRET",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  AUTH_SEED_REGEX.lastIndex = 0;

  /* -------------------------------------------------------
     13. EXPLICIT NAME
     ------------------------------------------------------- */

  NAME_REGEX.lastIndex = 0;

  while (
    (match =
      NAME_REGEX.exec(text)) !== null
  ) {
    const candidate =
      match[1];

    const candidateIndex =
      match.index +
      match[0].lastIndexOf(
        candidate,
      );

    results.push({
      type: "NAME",
      text: candidate,
      index: candidateIndex,
      length: candidate.length,
    });
  }

  NAME_REGEX.lastIndex = 0;

  return removeDuplicateMatches(
    results,
  );
}

/* =========================================================
   DUPLICATE REMOVAL
   ========================================================= */

function removeDuplicateMatches(
  matches: PIIMatch[],
): PIIMatch[] {
  const result: PIIMatch[] = [];

  for (const current of matches) {
    const duplicate =
      result.some(
        (existing) => {
          const currentEnd =
            current.index +
            current.length;

          const existingEnd =
            existing.index +
            existing.length;

          return (
            current.index <
              existingEnd &&
            currentEnd >
              existing.index
          );
        },
      );

    if (!duplicate) {
      result.push(current);
    }
  }

  return result.sort(
    (a, b) =>
      a.index - b.index,
  );
}

/* =========================================================
   DOM PII SCANNER
   ========================================================= */

/**
 * Scans the current webpage and returns
 * exact pixel regions for detected PII.
 *
 * Uses:
 *
 * Range.setStart()
 * Range.setEnd()
 * Range.getBoundingClientRect()
 *
 * so text-level PII gets a small exact box
 * instead of the entire paragraph/card.
 */
export function scanDOMForPII(
  doc: Document = document,
): PIIRegion[] {
  if (!doc.body) {
    return [];
  }

  const regions: PIIRegion[] = [];

  /* -------------------------------------------------------
     INPUTS
     ------------------------------------------------------- */

  const inputs =
    doc.querySelectorAll<
      HTMLInputElement |
      HTMLTextAreaElement |
      HTMLSelectElement
    >(
      "input, textarea, select",
    );

  inputs.forEach((input) => {
    const rect =
      input.getBoundingClientRect();

    if (
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      return;
    }

    const fieldInfo =
      [
        input.id,
        input.getAttribute(
          "name",
        ),
        input.getAttribute(
          "autocomplete",
        ),
        input.getAttribute(
          "placeholder",
        ),
        input.getAttribute(
          "aria-label",
        ),
      ]
        .filter(Boolean)
        .join(" ");

    const isPassword =
      input instanceof
        HTMLInputElement &&
      input.type ===
        "password";

    const sensitiveField =
      /password|passwd|secret|token|api[_-]?key|card|credit|cvv|cvc|ssn|aadhaar|pan/i.test(
        fieldInfo,
      );

    const value =
      "value" in input
        ? input.value
        : "";

    const valueMatches =
      extractPIIMatches(
        value,
        fieldInfo,
      );

    /*
     * Password fields are always protected.
     */
    if (isPassword) {
      regions.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        type: "PASSWORD",
      });

      return;
    }

    /*
     * Fields explicitly named as sensitive
     * are protected.
     */
    if (sensitiveField) {
      let type: PIITypes =
        "PASSWORD";

      if (
        /card|credit|cvv|cvc/i.test(
          fieldInfo,
        )
      ) {
        type = "CARD";
      } else if (
        /token|api[_-]?key/i.test(
          fieldInfo,
        )
      ) {
        type = "API_KEY";
      }

      regions.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        type,
      });

      return;
    }

    /*
     * Detect PII inside input value.
     */
    if (valueMatches.length > 0) {
      regions.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        type: valueMatches[0].type,
      });
    }
  });

  /* -------------------------------------------------------
     TEXT NODES
     ------------------------------------------------------- */

  const walker =
    doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (
            !node.nodeValue ||
            !node.nodeValue.trim()
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent =
            node.parentElement;

          if (!parent) {
            return NodeFilter.FILTER_REJECT;
          }

          const tag =
            parent.tagName.toLowerCase();

          if (
            tag === "script" ||
            tag === "style" ||
            tag === "noscript" ||
            tag === "svg"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          const style =
            window.getComputedStyle(
              parent,
            );

          if (
            style.display ===
              "none" ||
            style.visibility ===
              "hidden" ||
            style.opacity === "0"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

  let node:
    Node | null;

  while (
    (node = walker.nextNode()) !==
    null
  ) {
    const textNode =
      node as Text;

    const text =
      textNode.nodeValue ?? "";

    const parent =
      textNode.parentElement;

    const grandparent =
      parent?.parentElement;

    const context =
      [
        parent?.textContent,
        grandparent?.textContent,
        parent?.getAttribute(
          "aria-label",
        ),
        parent?.getAttribute(
          "title",
        ),
      ]
        .filter(Boolean)
        .join(" ");

    const matches =
      extractPIIMatches(
        text,
        context,
      );

    for (const match of matches) {
      try {
        const range =
          doc.createRange();

        range.setStart(
          textNode,
          match.index,
        );

        range.setEnd(
          textNode,
          match.index +
            match.length,
        );

        const rect =
          range.getBoundingClientRect();

        if (
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          continue;
        }

        const padding = 4;

        regions.push({
          x: Math.max(
            0,
            Math.round(
              rect.left -
                padding,
            ),
          ),

          y: Math.max(
            0,
            Math.round(
              rect.top -
                padding,
            ),
          ),

          width: Math.round(
            rect.width +
              padding * 2,
          ),

          height: Math.round(
            rect.height +
              padding * 2,
          ),

          type: match.type,
        });
      } catch {
        // Ignore invalid DOM ranges.
      }
    }
  }

  return removeDuplicateRegions(
    regions,
  );
}

/* =========================================================
   REGION DEDUPLICATION
   ========================================================= */

function removeDuplicateRegions(
  regions: PIIRegion[],
): PIIRegion[] {
  const result: PIIRegion[] = [];

  for (const region of regions) {
    const duplicate =
      result.some(
        (existing) =>
          existing.type ===
            region.type &&
          Math.abs(
            existing.x -
              region.x,
          ) < 3 &&
          Math.abs(
            existing.y -
              region.y,
          ) < 3 &&
          Math.abs(
            existing.width -
              region.width,
          ) < 3 &&
          Math.abs(
            existing.height -
              region.height,
          ) < 3,
      );

    if (!duplicate) {
      result.push(region);
    }
  }

  return result;
}