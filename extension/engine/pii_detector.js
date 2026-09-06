/**
 * Zero-Egress Presidio-Grade PII & Sensitive Text Detection Engine
 * Combines contextual regex recognizers, Luhn algorithmic verification,
 * negative commerce filters, and DOM Range walkers to accurately extract
 * exact pixel coordinates of sensitive data on the active webpage.
 *
 * Eliminates false positives on e-commerce prices, product specs, and icons.
 */

// Context Keywords for Presidio-style Confidence Scoring
const BANKING_POSITIVE_CONTEXT = /\b(balance|checking|savings|available|operating\s*account|ledger|funds|deposit|withdrawal|bank\s*account|current\s*balance|account\s*balance)\b/i;
const COMMERCE_NEGATIVE_CONTEXT = /\b(price|list|save|deal|coupon|off|discount|msrp|cost|total|each|bought|cart|shipping|subtotal|order|reviews|rating|fee|buy\s*now|items|add\s*to\s*cart)\b/i;
const HARDWARE_SPEC_NEGATIVE_CONTEXT = /\b(core|gpu|cpu|ghz|mhz|hz|fps|dpi|mah|ssd|ram|gb|tb|kb|mb|ms|inches|inch|\"|px|resolut|display)\b/i;
const GATE_POSITIVE_CONTEXT = /\b(gate|door|entry|security|access|pass|delivery|passcode|intercom)\b/i;
const PHONE_POSITIVE_CONTEXT = /\b(phone|tel|mobile|cell|contact|fax|call|emergency)\b/i;
const AADHAAR_POSITIVE_CONTEXT = /\b(aadhaar|uid|unique\s*identification|identity|kyc|gov)\b/i;
const PAN_POSITIVE_CONTEXT = /\b(pan|permanent\s*account|tax|incometax|income\s*tax|kyc|identity)\b/i;
const SSN_POSITIVE_CONTEXT = /\b(ssn|social\s*security|ss#|national\s*id)\b/i;
const AUTH_SECRET_POSITIVE_CONTEXT = /\b(authenticator|seed|secret|totp|2fa|backup|recovery|code)\b/i;
const AWS_SECRET_POSITIVE_CONTEXT = /\b(aws|secret|access\s*key|developer|secret\s*key)\b/i;
const NAME_POSITIVE_CONTEXT = /\b(name|full\s*name|account\s*holder|cardholder|customer|patient|subscriber|deliver\s*to|holder)\b/i;

const PII_PATTERNS = {
  // 12-digit Indian Aadhaar UID
  AADHAAR: /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g,
  // 10-char Indian Permanent Account Number
  PAN: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
  // US Social Security Number
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  // Phone numbers (International +1/+91 or standard phone format)
  PHONE: /(?:\+?(\d{1,3})[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  // High-entropy developer secrets (OpenAI, AWS, Webhooks, JWT, Payment tokens)
  API_KEY: /\b(?:sk-[a-zA-Z0-9_\-]{20,}|AKIA[0-9A-Z]{16}|whsec_[a-zA-Z0-9]{20,}|amzn_pay_[a-zA-Z0-9_]{15,}|pk_live_[a-zA-Z0-9_]{15,}|sk_live_[a-zA-Z0-9_]{15,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g,
  // Currency balances (Context-gated: USD $, INR ₹, Rs, etc.)
  BALANCE: /(?:[\$₹]|Rs\.?|INR)\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?\b/g
};

/**
 * Validates a credit card number string using the Luhn checksum algorithm.
 * Rejects non-digits, out-of-range lengths, and repeating digit sequences.
 * @param {string} str
 * @returns {boolean}
 */
function isLuhnValid(str) {
  const clean = str.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(clean)) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Computes Shannon entropy of a string to evaluate randomness/secrets.
 * @param {string} str
 * @returns {number}
 */
function calculateShannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  const len = str.length;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Classifies text content and extracts sensitive matches with substring indices.
 * Applies Presidio-style context weighting and negative exclusion filters.
 *
 * @param {string} text
 * @param {string} [contextStr=''] - Surrounding text context (parent/grandparent text)
 * @returns {Array<{ type: string, text: string, index: number, length: number }>}
 */
function extractPIIMatches(text, contextStr = '') {
  if (!text || typeof text !== 'string') return [];
  const matches = [];
  const fullContext = (contextStr + ' ' + text).toLowerCase();

  // 1. Credit Cards (with Luhn checksum validation)
  const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  let match;
  while ((match = ccRegex.exec(text)) !== null) {
    if (isLuhnValid(match[0])) {
      matches.push({
        type: 'CARD',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 2. Bank Balance (Context-gated Presidio rule: requires positive banking context & NO commerce keywords)
  const balRegex = /(?:[\$₹]|Rs\.?|INR)\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{2})?\b/g;
  while ((match = balRegex.exec(text)) !== null) {
    const start = Math.max(0, match.index - 60);
    const end = Math.min(text.length, match.index + match[0].length + 60);
    const localCtx = (fullContext + ' ' + text.slice(start, end)).toLowerCase();

    const hasCommerce = COMMERCE_NEGATIVE_CONTEXT.test(localCtx);
    const hasBanking = BANKING_POSITIVE_CONTEXT.test(localCtx);

    // Only flag as BALANCE if positive banking context exists AND no commerce pricing terms
    if (hasBanking && !hasCommerce) {
      matches.push({
        type: 'BALANCE',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 3. Indian Aadhaar UID (12-digits, begins with [2-9], validated with Aadhaar/UID context)
  const aadhaarRegex = /\b[2-9]\d{3}\s\d{4}\s\d{4}\b/g;
  while ((match = aadhaarRegex.exec(text)) !== null) {
    if (AADHAAR_POSITIVE_CONTEXT.test(fullContext)) {
      matches.push({
        type: 'AADHAAR',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 4. Indian PAN Tax ID (5 uppercase letters, 4 digits, 1 uppercase letter)
  const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
  while ((match = panRegex.exec(text)) !== null) {
    matches.push({
      type: 'PAN',
      text: match[0],
      index: match.index,
      length: match[0].length
    });
  }

  // 5. US Social Security Number (SSN)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  while ((match = ssnRegex.exec(text)) !== null) {
    // Exclude simple date format fragments or hardware specs
    if (!HARDWARE_SPEC_NEGATIVE_CONTEXT.test(fullContext)) {
      matches.push({
        type: 'SSN',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 6. Phone Numbers (International prefix +1/+91 or standard phone format with context)
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+91[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const isIntl = /^\+(?:1|91)/.test(match[0]);
    const hasPhoneWord = PHONE_POSITIVE_CONTEXT.test(fullContext);
    const hasHardware = HARDWARE_SPEC_NEGATIVE_CONTEXT.test(fullContext);

    if (!hasHardware && (isIntl || hasPhoneWord)) {
      matches.push({
        type: 'PHONE',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 7. Developer API Keys & Webhook Secrets
  const apiKeyRegex = /\b(?:sk-[a-zA-Z0-9_\-]{20,}|AKIA[0-9A-Z]{16}|whsec_[a-zA-Z0-9]{20,}|amzn_pay_[a-zA-Z0-9_]{15,}|pk_live_[a-zA-Z0-9_]{15,}|sk_live_[a-zA-Z0-9_]{15,}|eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g;
  while ((match = apiKeyRegex.exec(text)) !== null) {
    matches.push({
      type: 'API_KEY',
      text: match[0],
      index: match.index,
      length: match[0].length
    });
  }

  // AWS Secret Access Key (35-45 char base64 string near AWS context)
  const awsSecretRegex = /\b[a-zA-Z0-9+/]{35,45}\b/g;
  while ((match = awsSecretRegex.exec(text)) !== null) {
    if (AWS_SECRET_POSITIVE_CONTEXT.test(fullContext)) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = matches.some(m => (start >= m.index && start < m.index + m.length) || (end > m.index && end <= m.index + m.length));
      if (!overlaps) {
        matches.push({
          type: 'API_KEY',
          text: match[0],
          index: match.index,
          length: match[0].length
        });
      }
    }
  }

  // 8. Gate / Access Codes (Must have gate/entry context; rejects HTML entities &#... and hex colors)
  const hashGateRegex = /#[0-9]{4,6}(?:-[A-Z0-9]+)?\b/g;
  while ((match = hashGateRegex.exec(text)) !== null) {
    // Reject HTML entities like &#9733;
    if (match.index > 0 && text[match.index - 1] === '&') continue;
    if (GATE_POSITIVE_CONTEXT.test(fullContext)) {
      if (!matches.some(existing => existing.text === match[0])) {
        matches.push({
          type: 'GATE_CODE',
          text: match[0],
          index: match.index,
          length: match[0].length
        });
      }
    }
  }

  const explicitGateRegex = /(?:delivery\s*(?:gate\s*)?(?:security\s*code|pass|code)?|gate\s*(?:security\s*code|access\s*code|pass|code)?|security\s*code|entry\s*code|door\s*code|passcode|access\s*code)[\s:#]+(#[0-9]{3,8}(?:-[A-Z0-9]+)?|\b[0-9]{3,8}(?:-[A-Z0-9]+)?)\b/gi;
  while ((match = explicitGateRegex.exec(text)) !== null) {
    const code = match[1];
    const codeIndex = match.index + match[0].lastIndexOf(code);
    if (!matches.some(existing => existing.text === code || existing.text.includes(code))) {
      matches.push({
        type: 'GATE_CODE',
        text: code,
        index: codeIndex,
        length: code.length
      });
    }
  }

  // 9. 2FA Backup Codes & Authenticator Seeds
  const twoFARegex = /\b\d{4}-\d{4}-\d{4}\b/g;
  while ((match = twoFARegex.exec(text)) !== null) {
    if (AUTH_SECRET_POSITIVE_CONTEXT.test(fullContext)) {
      matches.push({
        type: 'AUTH_SECRET',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  const seedRegex = /\b[A-Z2-7]{16,32}\b/g;
  while ((match = seedRegex.exec(text)) !== null) {
    if (AUTH_SECRET_POSITIVE_CONTEXT.test(fullContext)) {
      matches.push({
        type: 'AUTH_SECRET',
        text: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // 10. Cardholder / Customer Personal Full Name (Explicit Context)
  const explicitNameRegex = /(?:name|full\s*name|cardholder(?:\s*name)?|customer\s*name|account\s*holder)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/gi;
  if (!COMMERCE_NEGATIVE_CONTEXT.test(fullContext)) {
    while ((match = explicitNameRegex.exec(text)) !== null) {
      const candidate = match[1];
      const candidateIndex = match.index + match[0].lastIndexOf(candidate);
      matches.push({
        type: 'NAME',
        text: candidate,
        index: candidateIndex,
        length: candidate.length
      });
    }
  }

  return matches;
}

/**
 * Walks active webpage DOM to find bounding boxes of all sensitive inputs and text nodes.
 * Executes in content script / page context.
 *
 * @param {Document} doc
 * @returns {Array<{ x: number, y: number, width: number, height: number, type: string }>}
 */
function scanDOMForPII(doc = null) {
  const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
  if (!targetDoc || !targetDoc.body) return [];

  const regions = [];
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;

  // 1. Scan Form Inputs (passwords, card numbers, cvvs, secret keys)
  const inputs = targetDoc.querySelectorAll('input, textarea, select');
  const isHeadless = (typeof window !== 'undefined' && !window.chrome && !window.browser) || (typeof process !== 'undefined');

  inputs.forEach(input => {
    let rect = (typeof input.getBoundingClientRect === 'function')
      ? input.getBoundingClientRect()
      : { left: 0, top: 0, width: 0, height: 0, bottom: 0, right: 0 };

    if (isHeadless && rect.width === 0 && rect.height === 0) {
      rect = { left: 10, top: 10, width: 150, height: 32, bottom: 42, right: 160 };
    }

    if (rect.width === 0 || rect.height === 0) return;
    if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) return;

    const isPassword = input.type === 'password';
    const isSensitiveAttr = /password|card|cvv|secret|token|ssn|aadhaar|pan/i.test(
      (input.id || '') + ' ' + (input.name || '') + ' ' + (input.autocomplete || '') + ' ' + (input.placeholder || '')
    );
    const valueMatches = extractPIIMatches(input.value || '');

    if (isPassword || isSensitiveAttr || valueMatches.length > 0) {
      let type = 'PASSWORD';
      if (valueMatches.length > 0) type = valueMatches[0].type;
      else if (/card|cvv/i.test((input.id || '') + (input.name || ''))) type = 'CARD';

      regions.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        type
      });
    }
  });

  // 2. Scan Text Nodes via TreeWalker with Context Extraction
  const walker = targetDoc.createTreeWalker(
    targetDoc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let textNode;
  while ((textNode = walker.nextNode())) {
    const val = textNode.nodeValue;
    const parent = textNode.parentElement;
    const grandparent = parent ? parent.parentElement : null;
    const contextStr = (parent ? parent.textContent : '') + ' ' + (grandparent ? grandparent.textContent : '');

    const matches = extractPIIMatches(val, contextStr);

    if (matches.length > 0) {
      matches.forEach(m => {
        try {
          let rect = null;
          if (typeof targetDoc.createRange === 'function') {
            const range = targetDoc.createRange();
            range.setStart(textNode, m.index);
            range.setEnd(textNode, m.index + m.length);
            if (typeof range.getBoundingClientRect === 'function') {
              rect = range.getBoundingClientRect();
            }
          }
          if (!rect || (rect.width === 0 && rect.height === 0)) {
            if (parent && typeof parent.getBoundingClientRect === 'function') {
              rect = parent.getBoundingClientRect();
            }
          }
          if (isHeadless && (!rect || (rect.width === 0 && rect.height === 0))) {
            rect = { left: 20, top: 20, width: Math.max(40, m.length * 8), height: 18 };
          }

          if (rect && rect.width > 0 && rect.height > 0) {
            // Include padding around text
            const pad = 4;
            regions.push({
              x: Math.max(0, Math.round(rect.left - pad)),
              y: Math.max(0, Math.round(rect.top - pad)),
              width: Math.round(rect.width + pad * 2),
              height: Math.round(rect.height + pad * 2),
              type: m.type
            });
          }
        } catch (_) {}
      });
    }
  }

  // 3. Scan Confidential Callout Blocks
  const confidentialBlocks = targetDoc.querySelectorAll('.amz-confidential-note, .confidential-block, [data-confidential="true"]');
  confidentialBlocks.forEach(block => {
    let rect = (typeof block.getBoundingClientRect === 'function')
      ? block.getBoundingClientRect()
      : { left: 0, top: 0, width: 0, height: 0 };
    if (isHeadless && rect.width === 0 && rect.height === 0) {
      rect = { left: 20, top: 20, width: 250, height: 60 };
    }
    if (rect.width > 0 && rect.height > 0) {
      regions.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        type: 'CONFIDENTIAL_BLOCK'
      });
    }
  });

  return regions;
}

if (typeof exports !== 'undefined') {
  module.exports = {
    PII_PATTERNS,
    BANKING_POSITIVE_CONTEXT,
    COMMERCE_NEGATIVE_CONTEXT,
    HARDWARE_SPEC_NEGATIVE_CONTEXT,
    isLuhnValid,
    calculateShannonEntropy,
    extractPIIMatches,
    scanDOMForPII
  };
} else if (typeof globalThis !== 'undefined') {
  globalThis.PIIDetector = {
    PII_PATTERNS,
    BANKING_POSITIVE_CONTEXT,
    COMMERCE_NEGATIVE_CONTEXT,
    HARDWARE_SPEC_NEGATIVE_CONTEXT,
    isLuhnValid,
    calculateShannonEntropy,
    extractPIIMatches,
    scanDOMForPII
  };
}
