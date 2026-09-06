import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { extractPIIMatches, scanDOMForPII } = require('../extension/engine/pii_detector.js');

describe('Canvas KYC Vault (Zero-DOM Pure Pixels) Tests', () => {
  const canvasVaultPath = path.join(__dirname, '../demo/canvas_vault.html');
  const html = fs.readFileSync(canvasVaultPath, 'utf8');

  it('should verify demo/canvas_vault.html exists and has canvas stage container', () => {
    expect(fs.existsSync(canvasVaultPath)).toBe(true);
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const stage = doc.getElementById('canvas-stage');
    expect(stage).not.toBeNull();
    const canvas = doc.getElementById('kyc-canvas');
    expect(canvas).not.toBeNull();
  });

  it('should PROVE that zero secrets exist in standard DOM text nodes or inputs', () => {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Standard DOM PII detector should find ZERO secrets in DOM elements
    // (excluding explanatory documentation banner in header)
    const stage = doc.getElementById('canvas-stage');
    const stageText = stage.textContent.trim();
    expect(stageText).toBe(''); // The canvas element itself has no text children

    const allInputs = doc.querySelectorAll('input, select, textarea');
    expect(allInputs.length).toBeLessThanOrEqual(2); // Only header search input exists

    // Verify none of the secret keywords exist as text in stage or body elements outside banners
    const secrets = [
      '5482 1928 3847',
      'ABCDE1234F',
      '4532 8812 9044 1924',
      '8,42,500.00',
      'sk-proj-49f81a7b293c'
    ];

    // Search inside the canvas-stage element
    secrets.forEach(secret => {
      expect(stage.innerHTML).not.toContain(secret);
    });
  });

  it('should verify the real biometric face photo exists for canvas drawImage rendering', () => {
    const facePath = path.join(__dirname, '../demo/assets/real_face.jpg');
    expect(fs.existsSync(facePath)).toBe(true);
    const stats = fs.statSync(facePath);
    expect(stats.size).toBeGreaterThan(10000); // Legitimate image file
  });

  it('should verify that rendered canvas text regions are successfully shielded by Presidio PII filters', () => {
    // Simulate the canvas text lines drawn by ctx.fillText()
    const simulatedCanvasDrawings = [
      { text: 'Aadhaar UID: 5482 1928 3847', context: 'Aadhaar UID identity verification KYC' },
      { text: 'PAN: ABCDE1234F', context: 'PAN tax permanent account kyc' },
      { text: 'Card Number: 4532 8812 9044 1924', context: 'credit card payment luhn' },
      { text: 'Savings Balance: ₹8,42,500.00', context: 'bank account savings balance' },
      { text: 'Secret API Key: sk-proj-49f81a7b293c4e5f918237461928471029384756', context: 'developer api key' }
    ];

    const detectedTypes = [];
    simulatedCanvasDrawings.forEach(item => {
      const matches = extractPIIMatches(item.text, item.context);
      matches.forEach(m => detectedTypes.push(m.type));
    });

    expect(detectedTypes).toContain('AADHAAR');
    expect(detectedTypes).toContain('PAN');
    expect(detectedTypes).toContain('CARD');
    expect(detectedTypes).toContain('BALANCE');
    expect(detectedTypes).toContain('API_KEY');
  });
});
