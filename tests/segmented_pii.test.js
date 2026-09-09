import { describe, it, expect } from 'vitest';
const { JSDOM } = require('jsdom');
const { detectSegmentedInputs, isLuhnValid } = require('../extension/engine/pii_detector.js');

describe('Segmented Multi-Box PII Input Aggregation Tests', () => {
  it('should detect 4-box segmented credit card inputs and return bounding boxes for all 4 boxes', () => {
    const html = `
      <form id="payment-form">
        <div class="card-number-group">
          <label>Card Number</label>
          <input type="text" name="cc_part_1" maxlength="4" value="4532" style="left:10px;top:20px;width:50px;height:30px;">
          <input type="text" name="cc_part_2" maxlength="4" value="8812" style="left:65px;top:20px;width:50px;height:30px;">
          <input type="text" name="cc_part_3" maxlength="4" value="9044" style="left:120px;top:20px;width:50px;height:30px;">
          <input type="text" name="cc_part_4" maxlength="4" value="1924" style="left:175px;top:20px;width:50px;height:30px;">
        </div>
      </form>
    `;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const inputs = document.querySelectorAll('input');

    // Composite: 4532881290441924 (Luhn valid test card)
    expect(isLuhnValid('4532881290441924')).toBe(true);

    const regions = detectSegmentedInputs(inputs, document);
    expect(regions.length).toBe(4);
    expect(regions[0].type).toBe('CARD');
    expect(regions[0].isSegmented).toBe(true);
    expect(regions[3].type).toBe('CARD');
  });

  it('should reject non-card 4-digit input numbers that fail Luhn validation', () => {
    const html = `
      <form id="dimensions-form">
        <div class="resolution-group">
          <input type="text" name="dim_w" maxlength="4" value="1920">
          <input type="text" name="dim_h" maxlength="4" value="1080">
        </div>
      </form>
    `;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const inputs = document.querySelectorAll('input');

    const regions = detectSegmentedInputs(inputs, document);
    expect(regions.length).toBe(0);
  });

  it('should detect segmented 6-digit OTP verification inputs with security context', () => {
    const html = `
      <div class="verification-wrapper">
        <span class="title">Enter your 6-digit security verification code</span>
        <div class="otp-inputs">
          <input type="text" class="otp-digit" maxlength="1" value="7">
          <input type="text" class="otp-digit" maxlength="1" value="3">
          <input type="text" class="otp-digit" maxlength="1" value="9">
          <input type="text" class="otp-digit" maxlength="1" value="1">
          <input type="text" class="otp-digit" maxlength="1" value="2">
          <input type="text" class="otp-digit" maxlength="1" value="8">
        </div>
      </div>
    `;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    const inputs = document.querySelectorAll('input');

    const regions = detectSegmentedInputs(inputs, document);
    expect(regions.length).toBe(6);
    expect(regions[0].type).toBe('GATE_CODE');
    expect(regions[5].type).toBe('GATE_CODE');
  });
});
