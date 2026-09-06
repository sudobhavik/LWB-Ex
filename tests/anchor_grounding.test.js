import { describe, it, expect, beforeEach } from 'vitest';
const {
  extractInteractiveAnchors,
  executeAgentAction
} = require('../extension/content/content.js');

describe('Anchor Grounding & Action Execution Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header>
        <a href="/store" id="link-store" style="display:inline-block; width:100px; height:30px;">Store Home</a>
        <input type="text" id="search-bar" placeholder="Search products..." style="display:inline-block; width:200px; height:40px;">
      </header>
      <main>
        <button id="btn-buy-now" style="display:inline-block; width:120px; height:40px;">Buy Now</button>
        <input type="password" id="input-pass" value="Secret123" style="display:inline-block; width:150px; height:40px;">
      </main>
    `;

    // Mock getBoundingClientRect in JSDOM for elements
    document.querySelectorAll('a, button, input').forEach((el, i) => {
      el.getBoundingClientRect = () => ({
        left: 50 * i,
        top: 40 * i,
        right: 50 * i + 100,
        bottom: 40 * i + 40,
        width: 100,
        height: 40
      });
    });
  });

  it('should extract visible interactive anchors with sequential indices', () => {
    const anchors = extractInteractiveAnchors();
    expect(anchors.length).toBeGreaterThanOrEqual(4);

    const buyBtn = anchors.find(a => a.label.includes('Buy Now'));
    expect(buyBtn).toBeDefined();
    expect(buyBtn.index).toBeGreaterThan(0);
    expect(typeof buyBtn.normX).toBe('number');
    expect(typeof buyBtn.normY).toBe('number');
  });

  it('should execute click action on target anchor', async () => {
    const anchors = extractInteractiveAnchors();
    const buyBtnAnchor = anchors.find(a => a.label.includes('Buy Now'));

    let clicked = false;
    const realBtn = document.getElementById('btn-buy-now');
    realBtn.addEventListener('click', () => { clicked = true; });

    const result = await executeAgentAction('click', buyBtnAnchor.index, null, '');
    expect(result.success).toBe(true);
    expect(clicked).toBe(true);
  });

  it('should execute type action and dispatch input/change events', async () => {
    const anchors = extractInteractiveAnchors();
    const searchAnchor = anchors.find(a => a.label.includes('Search products'));

    let changedVal = '';
    const searchInput = document.getElementById('search-bar');
    searchInput.addEventListener('input', (e) => { changedVal = e.target.value; });

    const result = await executeAgentAction('type', searchAnchor.index, null, 'MacBook Pro');
    expect(result.success).toBe(true);
    expect(searchInput.value).toBe('MacBook Pro');
    expect(changedVal).toBe('MacBook Pro');
  });
});
