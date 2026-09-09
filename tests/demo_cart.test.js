import { describe, it, expect, beforeEach } from 'vitest';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let memoryStore = {};
const mockStorage = {
  getItem: (k) => (k in memoryStore ? memoryStore[k] : null),
  setItem: (k, v) => { memoryStore[k] = String(v); },
  removeItem: (k) => { delete memoryStore[k]; },
  clear: () => { memoryStore = {}; }
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
  configurable: true
});

const { PRODUCTS, CartManager, CART_STORAGE_KEY } = require('../demo/cart.js');

describe('E-Commerce Product Catalog & Cart Tests', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('Product Catalog Integrity', () => {
    it('should contain all 6 required flagship products', () => {
      const ids = Object.keys(PRODUCTS);
      expect(ids).toContain('macbook-pro-16');
      expect(ids).toContain('iphone-16-pro');
      expect(ids).toContain('sony-wh1000xm5');
      expect(ids).toContain('apple-watch-ultra-2');
      expect(ids).toContain('samsung-odyssey-32');
      expect(ids).toContain('keychron-q1-pro');
      expect(ids).toHaveLength(6);
    });

    it('each product should have price, image, specs, and secrets for privacy agent testing', () => {
      Object.values(PRODUCTS).forEach(prod => {
        expect(prod.id).toBeDefined();
        expect(prod.title.length).toBeGreaterThan(10);
        expect(prod.price).toBeGreaterThan(1000);
        expect(prod.image).toContain('assets/product_');
        expect(Array.isArray(prod.specs)).toBe(true);
        expect(prod.specs.length).toBeGreaterThanOrEqual(3);
        expect(prod.secrets).toBeDefined();
        expect(prod.secrets.sku).toBeDefined();
        expect(prod.secrets.primeId).toBeDefined();
      });
    });
  });

  describe('CartManager Core Logic', () => {
    it('should initialize with default items when storage is empty', () => {
      localStorage.clear();
      const cart = CartManager.getRawCart();
      expect(cart.length).toBeGreaterThan(0);
      expect(CartManager.getItemCount()).toBe(3);
    });

    it('should add new product to cart and update counts', () => {
      CartManager.clearCart();
      expect(CartManager.getItemCount()).toBe(0);

      CartManager.addToCart('iphone-16-pro', 2);
      expect(CartManager.getItemCount()).toBe(2);
      expect(CartManager.getSubtotal()).toBe(PRODUCTS['iphone-16-pro'].price * 2);

      // Increment existing
      CartManager.addToCart('iphone-16-pro', 1);
      expect(CartManager.getItemCount()).toBe(3);
      expect(CartManager.getSubtotal()).toBe(PRODUCTS['iphone-16-pro'].price * 3);
    });

    it('should update quantity and remove item when qty is 0', () => {
      CartManager.clearCart();
      CartManager.addToCart('sony-wh1000xm5', 3);
      expect(CartManager.getItemCount()).toBe(3);

      CartManager.updateQty('sony-wh1000xm5', 5);
      expect(CartManager.getItemCount()).toBe(5);

      CartManager.updateQty('sony-wh1000xm5', 0);
      expect(CartManager.getItemCount()).toBe(0);
    });

    it('should remove item by ID', () => {
      CartManager.clearCart();
      CartManager.addToCart('macbook-pro-16', 1);
      CartManager.addToCart('keychron-q1-pro', 1);
      expect(CartManager.getItemCount()).toBe(2);

      CartManager.removeFromCart('macbook-pro-16');
      expect(CartManager.getItemCount()).toBe(1);
      const remaining = CartManager.getDetailedCart();
      expect(remaining[0].id).toBe('keychron-q1-pro');
    });

    it('should format currency correctly with Indian numbering system', () => {
      expect(CartManager.formatCurrency(189900)).toBe('₹1,89,900.00');
      expect(CartManager.formatCurrency(29990)).toBe('₹29,990.00');
    });
  });

  describe('Dynamic Product Page (product.html)', () => {
    function setupProductDOM(productId = 'iphone-16-pro') {
      const htmlPath = path.join(__dirname, '../demo/product.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      const cartScript = fs.readFileSync(path.join(__dirname, '../demo/cart.js'), 'utf8');

      const dom = new JSDOM(html, {
        url: `http://localhost:3000/product.html?id=${productId}`,
        runScripts: 'dangerously'
      });
      const { window } = dom;

      window.eval(cartScript);
      dom.window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

      return dom;
    }

    it('should render iPhone 16 Pro details when URL query is ?id=iphone-16-pro', () => {
      const dom = setupProductDOM('iphone-16-pro');
      const doc = dom.window.document;

      const titleEl = doc.getElementById('product-title');
      expect(titleEl.textContent).toContain('iPhone 16 Pro');

      const priceVal = doc.getElementById('product-price-val');
      expect(priceVal.textContent).toContain('1,19,900');

      const heroImg = doc.getElementById('product-image');
      expect(heroImg.src).toContain('assets/product_phone.svg');
    });

    it('should render Sony Headphones when URL query is ?id=sony-wh1000xm5', () => {
      const dom = setupProductDOM('sony-wh1000xm5');
      const doc = dom.window.document;

      const titleEl = doc.getElementById('product-title');
      expect(titleEl.textContent).toContain('Sony WH-1000XM5');

      const priceVal = doc.getElementById('product-price-val');
      expect(priceVal.textContent).toContain('29,990');
    });
  });

  describe('Shopping Cart Page (cart.html)', () => {
    function setupCartDOM(initialCart = null) {
      const htmlPath = path.join(__dirname, '../demo/cart.html');
      const html = fs.readFileSync(htmlPath, 'utf8');
      const cartScript = fs.readFileSync(path.join(__dirname, '../demo/cart.js'), 'utf8');

      const dom = new JSDOM(html, {
        url: 'http://localhost:3000/cart.html',
        runScripts: 'dangerously'
      });
      const { window } = dom;

      if (initialCart) {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(initialCart));
      }

      window.eval(cartScript);
      dom.window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

      return dom;
    }

    it('should render items list and subtotal from cart storage', () => {
      const testCart = [
        { id: 'iphone-16-pro', qty: 2 },
        { id: 'sony-wh1000xm5', qty: 1 }
      ];
      const dom = setupCartDOM(testCart);
      const doc = dom.window.document;

      const itemRows = doc.querySelectorAll('.cart-item-row');
      expect(itemRows).toHaveLength(2);

      const subtotalEls = doc.querySelectorAll('.cart-subtotal-footer');
      expect(subtotalEls.length).toBeGreaterThan(0);
      expect(subtotalEls[0].textContent).toContain('3 items');
    });

    it('should display empty cart message when cart is empty', () => {
      const dom = setupCartDOM([]);
      const doc = dom.window.document;

      const emptyCard = doc.querySelector('.empty-cart-card');
      expect(emptyCard).toBeDefined();
      expect(emptyCard.textContent).toContain('Your Amazon Basket is empty');
    });
  });

  describe('Home Page Product Links (index.html)', () => {
    it('should have product links and data-product-id on all 6 cards', () => {
      const indexPath = path.join(__dirname, '../demo/index.html');
      const html = fs.readFileSync(indexPath, 'utf8');
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      const cards = doc.querySelectorAll('.showcase-card');
      expect(cards).toHaveLength(6);

      cards.forEach(card => {
        const prodId = card.getAttribute('data-product-id');
        expect(prodId).toBeDefined();
        expect(PRODUCTS[prodId]).toBeDefined();

        const link = card.querySelector(`a[href="product.html?id=${prodId}"]`);
        expect(link).toBeDefined();
      });
    });
  });
});
