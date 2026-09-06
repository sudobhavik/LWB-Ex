import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const {
  isLuhnValid,
  extractPIIMatches,
  scanDOMForPII,
  calculateShannonEntropy
} = require('../extension/engine/pii_detector.js');

describe('PII & Sensitive Pattern Detector Tests (Presidio-Grade)', () => {
  describe('Luhn Checksum Validation', () => {
    it('should validate standard Luhn-valid card numbers', () => {
      expect(isLuhnValid('4532 8812 9044 1924')).toBe(true);
      expect(isLuhnValid('4532-8812-9044-1924')).toBe(true);
      expect(isLuhnValid('4532881290441924')).toBe(true);
    });

    it('should reject invalid card numbers and repetitive sequences', () => {
      expect(isLuhnValid('4532 8812 9044 1929')).toBe(false);
      expect(isLuhnValid('1234567890123456')).toBe(false);
      expect(isLuhnValid('0000 0000 0000 0000')).toBe(false);
      expect(isLuhnValid('abc')).toBe(false);
    });
  });

  describe('Shannon Entropy Calculation', () => {
    it('should compute high entropy for random API keys and low for repetitive strings', () => {
      const highEntropy = calculateShannonEntropy('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY002');
      const lowEntropy = calculateShannonEntropy('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(highEntropy).toBeGreaterThan(4.0);
      expect(lowEntropy).toBeLessThan(1.0);
    });
  });

  describe('False Positive Elimination (Negative Commerce & Spec Filtering)', () => {
    it('should NEVER flag product prices or discounts as BALANCE', () => {
      const priceText1 = 'Apple MacBook Pro 16" price: $1,899.00 List: $2,499.00';
      const priceText2 = 'Save $100 with coupon on iPhone 16 Pro';
      const priceText3 = 'Sony Headphones $348.00 each, add to cart now';

      expect(extractPIIMatches(priceText1)).toEqual([]);
      expect(extractPIIMatches(priceText2)).toEqual([]);
      expect(extractPIIMatches(priceText3)).toEqual([]);
    });

    it('should NEVER flag hardware specs as PHONE numbers', () => {
      const specText1 = '16-core CPU, 40-core GPU with 256GB SSD storage';
      const specText2 = '165Hz refresh rate and 1ms response time on 32" display';

      const matches1 = extractPIIMatches(specText1);
      const matches2 = extractPIIMatches(specText2);
      expect(matches1.filter(m => m.type === 'PHONE')).toHaveLength(0);
      expect(matches2.filter(m => m.type === 'PHONE')).toHaveLength(0);
    });

    it('should NEVER flag HTML star ratings or CSS hex colors as GATE_CODE', () => {
      const ratingText = 'Rating: &#9733;&#9733;&#9733;&#9733;&#9734; 4.8 reviews';
      const cssColorText = 'Header background color #131921 with border #FF9900';

      const matches1 = extractPIIMatches(ratingText);
      const matches2 = extractPIIMatches(cssColorText);
      expect(matches1.filter(m => m.type === 'GATE_CODE')).toHaveLength(0);
      expect(matches2.filter(m => m.type === 'GATE_CODE')).toHaveLength(0);
    });
  });

  describe('Verified Secret Extraction', () => {
    it('should detect Aadhaar 12-digit UID numbers with context', () => {
      const text = 'Customer verification Aadhaar: 5482 1928 3847 verified.';
      const matches = extractPIIMatches(text);
      const aadhaarMatch = matches.find(m => m.type === 'AADHAAR');
      expect(aadhaarMatch).toBeDefined();
      expect(aadhaarMatch.text).toBe('5482 1928 3847');
    });

    it('should detect PAN tax numbers', () => {
      const text = 'Permanent account identifier is ABCDE1234F.';
      const matches = extractPIIMatches(text);
      const panMatch = matches.find(m => m.type === 'PAN');
      expect(panMatch).toBeDefined();
      expect(panMatch.text).toBe('ABCDE1234F');
    });

    it('should detect phone numbers with international prefix or phone context', () => {
      const text = 'Contact: +1 (555) 234-5678 or India +91 98765 43210.';
      const matches = extractPIIMatches(text);
      const phones = matches.filter(m => m.type === 'PHONE');
      expect(phones.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect API keys and developer secrets', () => {
      const text = 'Keys: sk-proj-49f81a7b293c4e5f918237461928471029384756 and AWS AKIAIOSFODNN7EXAMPLE.';
      const matches = extractPIIMatches(text);
      const keys = matches.filter(m => m.type === 'API_KEY');
      expect(keys.length).toBe(2);
    });

    it('should detect security gate access codes with context', () => {
      const text = 'Delivery gate security code #4921 please.';
      const matches = extractPIIMatches(text);
      const gateMatch = matches.find(m => m.type === 'GATE_CODE');
      expect(gateMatch).toBeDefined();
      expect(gateMatch.text).toBe('#4921');
    });

    it('should detect currency account balances only when positive banking context exists', () => {
      const text = 'Primary balance: $84,250.00 available in checking.';
      const matches = extractPIIMatches(text);
      const balMatch = matches.find(m => m.type === 'BALANCE');
      expect(balMatch).toBeDefined();
      expect(balMatch.text).toBe('$84,250.00');
    });

    it('should detect 2FA backup codes and authenticator seeds', () => {
      const text = 'Emergency 2FA backup recovery code: 4819-2048-9182. Authenticator secret seed: JBSWY3DPEHPK3PXP';
      const matches = extractPIIMatches(text);
      const authSecrets = matches.filter(m => m.type === 'AUTH_SECRET');
      expect(authSecrets.length).toBe(2);
    });
  });

  describe('Full DOM Scans: Product Showcase vs Profile Vault', () => {
    it('should detect ZERO PII on pure product showcase (demo/index.html)', () => {
      const indexPath = path.join(__dirname, '../demo/index.html');
      const html = fs.readFileSync(indexPath, 'utf8');
      const dom = new JSDOM(html);
      const regions = scanDOMForPII(dom.window.document);

      expect(regions).toHaveLength(0);
    });

    it('should detect all critical secrets on identity vault (demo/profile.html)', () => {
      const profilePath = path.join(__dirname, '../demo/profile.html');
      const html = fs.readFileSync(profilePath, 'utf8');
      const dom = new JSDOM(html);
      const regions = scanDOMForPII(dom.window.document);

      expect(regions.length).toBeGreaterThanOrEqual(10);
      const types = regions.map(r => r.type);
      expect(types).toContain('CARD');
      expect(types).toContain('BALANCE');
      expect(types).toContain('AADHAAR');
      expect(types).toContain('PAN');
      expect(types).toContain('API_KEY');
      expect(types).toContain('PASSWORD');
    });
  });
});
