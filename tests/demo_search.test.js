import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Demo E-Commerce Search Bar Tests', () => {
  function setupDOM(initialUrl = 'http://localhost:3000/index.html') {
    const indexPath = path.join(__dirname, '../demo/index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const searchScript = fs.readFileSync(path.join(__dirname, '../demo/search.js'), 'utf8');

    const dom = new JSDOM(html, {
      url: initialUrl,
      runScripts: 'dangerously'
    });
    const window = dom.window;
    const document = window.document;

    // Evaluate search script
    window.eval(searchScript);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));

    return { window, document };
  }

  it('should initialize with all 6 showcase products visible', () => {
    const { document } = setupDOM();
    const cards = document.querySelectorAll('.showcase-card');
    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(6);
  });

  it('should filter to MacBook Pro when searching for "macbook"', () => {
    const { document } = setupDOM();
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-button');
    const cards = document.querySelectorAll('.showcase-card');

    searchInput.value = 'macbook';
    searchBtn.click();

    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0].querySelector('h2').textContent).toContain('Apple MacBook Pro');

    const resultsBar = document.getElementById('search-results-bar');
    expect(resultsBar.style.display).not.toBe('none');
    expect(resultsBar.textContent).toContain('1 of 1 results');
  });

  it('should filter to iPhone when searching for "iphone"', () => {
    const { document } = setupDOM();
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-button');
    const cards = document.querySelectorAll('.showcase-card');

    searchInput.value = 'iphone';
    searchBtn.click();

    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0].querySelector('h2').textContent).toContain('iPhone 16 Pro');
  });

  it('should filter by category when selecting "Computers"', () => {
    const { window, document } = setupDOM();
    const categorySelect = document.querySelector('.search-category-select');
    const cards = document.querySelectorAll('.showcase-card');

    categorySelect.value = 'Computers';
    categorySelect.dispatchEvent(new window.Event('change'));

    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    // MacBook, Samsung Monitor, Keychron Keyboard
    expect(visibleCards).toHaveLength(3);
    const titles = visibleCards.map(c => c.querySelector('h2').textContent);
    expect(titles.some(t => t.includes('MacBook'))).toBe(true);
    expect(titles.some(t => t.includes('Samsung'))).toBe(true);
    expect(titles.some(t => t.includes('Keychron'))).toBe(true);
  });

  it('should show "No results found" with suggestion chips when query has no matches', () => {
    const { document } = setupDOM();
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-button');
    const cards = document.querySelectorAll('.showcase-card');
    const grid = document.querySelector('.product-showcase-grid');
    const noResults = document.getElementById('no-results-box');

    searchInput.value = 'xyzzynonexistentitem999';
    searchBtn.click();

    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(0);
    expect(grid.style.display).toBe('none');
    expect(noResults.style.display).not.toBe('none');
    expect(noResults.textContent).toContain('No results found');
  });

  it('should restore all products when clicking Clear Filter', () => {
    const { document } = setupDOM();
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-button');
    const cards = document.querySelectorAll('.showcase-card');

    searchInput.value = 'sony';
    searchBtn.click();
    expect(Array.from(cards).filter(c => c.style.display !== 'none')).toHaveLength(1);

    const clearBtn = document.getElementById('btn-clear-filter');
    clearBtn.click();

    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(6);
    expect(searchInput.value).toBe('');
  });

  it('should automatically initialize search from URL query parameters (?q=keyboard)', () => {
    const { document } = setupDOM('http://localhost:3000/index.html?q=keyboard');
    const searchInput = document.querySelector('.search-input');
    const cards = document.querySelectorAll('.showcase-card');

    expect(searchInput.value).toBe('keyboard');
    const visibleCards = Array.from(cards).filter(c => c.style.display !== 'none');
    expect(visibleCards).toHaveLength(1);
    expect(visibleCards[0].querySelector('h2').textContent).toContain('Keychron Q1 Pro');
  });
});
