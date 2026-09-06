/**
 * Guptchara Amazon Demo - Centralized Product Catalog & Cart Controller
 * Persists cart state in localStorage, manages badge counts across pages,
 * and displays Amazon-style Add-to-Cart notifications.
 */

const PRODUCTS = {
  'macbook-pro-16': {
    id: 'macbook-pro-16',
    title: 'Apple MacBook Pro 16" Laptop (M3 Max chip with 16-core CPU and 40-core GPU, 64GB Unified Memory, 2TB SSD Storage) - Space Black',
    shortTitle: 'Apple MacBook Pro 16" M3 Max (64GB RAM, 2TB SSD)',
    brand: 'Apple',
    category: 'computers laptops apple',
    department: 'Computers',
    price: 189900,
    mrp: 249900,
    rating: 4.8,
    ratingsCount: '2,419',
    boughtCount: '100+ bought in past month in India',
    image: 'assets/product_laptop.svg',
    dealTag: 'Limited Time Deal',
    description: '16-core CPU, 40-core GPU, Liquid Retina XDR display, Space Black finish. Prime FREE Delivery in India. No Cost EMI available.',
    specs: [
      { label: 'Processor', value: 'Apple M3 Max (16-core CPU, 40-core GPU)' },
      { label: 'Unified Memory', value: '64GB High-Bandwidth RAM' },
      { label: 'Internal Storage', value: '2TB High-Speed NVMe SSD' },
      { label: 'Display', value: '16.2-inch Liquid Retina XDR (3456 x 2234)' }
    ],
    secrets: {
      sku: 'APPL-MBP16-M3X-994812',
      serial: 'C02GF001M3X0 • C02GF009M3X9',
      webhook: 'whsec_98471abcf89123049182374619284710',
      eccn: 'ECCN 5A002',
      primeId: 'Shreyas V. Sharma (Aadhaar: 5482 1928 3847)'
    }
  },

  'iphone-16-pro': {
    id: 'iphone-16-pro',
    title: 'Apple iPhone 16 Pro 256GB Natural Titanium (A18 Pro Chip, 48MP Fusion Camera, Grade 5 Titanium)',
    shortTitle: 'Apple iPhone 16 Pro 256GB Natural Titanium',
    brand: 'Apple',
    category: 'smartphones apple phones',
    department: 'Smartphones',
    price: 119900,
    mrp: 129900,
    rating: 4.9,
    ratingsCount: '5,120',
    boughtCount: '1,000+ bought in past month in India',
    image: 'assets/product_phone.svg',
    dealTag: 'Save ₹10,000 with Bank Card',
    description: 'Grade 5 titanium design, A18 Pro chip, 48MP Fusion camera system. FREE One-Day Delivery by Amazon.in.',
    specs: [
      { label: 'Display', value: '6.3-inch Super Retina XDR with ProMotion 120Hz' },
      { label: 'Chipset', value: 'Apple A18 Pro Bionic with 6-core Neural Engine' },
      { label: 'Camera System', value: '48MP Main + 48MP Ultra Wide + 12MP 5x Telephoto' },
      { label: 'Battery Life', value: 'Up to 27 hours video playback, MagSafe Wireless' }
    ],
    secrets: {
      sku: 'APPL-IP16P-256G-NT-4412',
      serial: 'IMEI 1: 3598 4210 9823 481 • eSIM: 8991 0021 8492 0184',
      webhook: 'whsec_apple_care_token_99184021',
      eccn: 'ECCN 5A002.a',
      primeId: 'Shreyas V. Sharma (PAN: ABCDE1234F)'
    }
  },

  'sony-wh1000xm5': {
    id: 'sony-wh1000xm5',
    title: 'Sony WH-1000XM5 Wireless Industry Leading Active Noise Canceling Headphones with Auto NC Optimizer - Black',
    shortTitle: 'Sony WH-1000XM5 Noise Canceling Headphones',
    brand: 'Sony',
    category: 'audio headphones sony',
    department: 'Audio',
    price: 29990,
    mrp: 34990,
    rating: 4.7,
    ratingsCount: '8,940',
    boughtCount: '500+ bought in past month in India',
    image: 'assets/product_headphones.svg',
    dealTag: 'Festival Savings 14%',
    description: 'Industry-leading noise cancellation with Auto NC Optimizer, crystal clear hands-free calling, 30-hour battery.',
    specs: [
      { label: 'Noise Canceling', value: 'Integrated Processor V1 & HD Noise Cancelling Processor QN1' },
      { label: 'Battery Life', value: '30 hours with ANC (3-min charge = 3 hours playback)' },
      { label: 'Drivers', value: '30mm precision-engineered carbon fiber composite' },
      { label: 'Microphones', value: '8 microphones with AI Beamforming voice pickup' }
    ],
    secrets: {
      sku: 'SNY-WH1000XM5-BLK-8821',
      serial: 'MAC: A4:C3:F0:89:12:DE • Warranty: SNY-IN-2026-90412',
      webhook: 'whsec_sony_audio_telemetry_5510',
      eccn: 'EAR99 Consumer Audio',
      primeId: 'Shreyas V. Sharma (UPI: shreyas@oksbi)'
    }
  },

  'apple-watch-ultra-2': {
    id: 'apple-watch-ultra-2',
    title: 'Apple Watch Ultra 2 GPS + Cellular 49mm Rugged Titanium Case with Ocean Band',
    shortTitle: 'Apple Watch Ultra 2 GPS + Cellular 49mm',
    brand: 'Apple',
    category: 'audio wearables smartwatch apple',
    department: 'Audio',
    price: 89900,
    mrp: 89900,
    rating: 4.9,
    ratingsCount: '3,410',
    boughtCount: '200+ bought in past month in India',
    image: 'assets/product_watch.svg',
    dealTag: 'Top Rated Flagship',
    description: 'Rugged titanium case, precision dual-frequency GPS, customizable Action button, 36-hour battery life.',
    specs: [
      { label: 'Case Material', value: '49mm Aerospace-grade Titanium' },
      { label: 'Display', value: 'Always-On Retina display up to 3,000 nits' },
      { label: 'Water Resistance', value: '100m water resistant, certified EN13319' },
      { label: 'Sensors', value: 'ECG, Blood Oxygen, Depth Gauge, Water Temp Sensor' }
    ],
    secrets: {
      sku: 'APPL-WTCH-ULTRA2-49TI',
      serial: 'EID: 8904 9032 0041 8294 1029 • MedID: 9184-IN',
      webhook: 'whsec_health_cardiac_stream_77182',
      eccn: 'ECCN 5A002 Medical Telemetry',
      primeId: 'Shreyas V. Sharma (Patient: 9184-IN)'
    }
  },

  'samsung-odyssey-32': {
    id: 'samsung-odyssey-32',
    title: 'Samsung Odyssey Neo G8 32" 4K Curved Gaming Display (165Hz, 1ms, Quantum Mini-LED, HDR2000, 1000R)',
    shortTitle: 'Samsung Odyssey 32" 4K Curved Gaming Display',
    brand: 'Samsung',
    category: 'computers monitors displays samsung',
    department: 'Computers',
    price: 54999,
    mrp: 74999,
    rating: 4.6,
    ratingsCount: '1,820',
    boughtCount: '80+ bought in past month in India',
    image: 'assets/product_monitor.svg',
    dealTag: 'Festival Deal',
    description: '165Hz refresh rate, 1ms response time, Quantum Mini-LED HDR2000, 1000R curvature for immersive viewing.',
    specs: [
      { label: 'Screen Size & Curve', value: '32-inch 4K UHD (3840 x 2160) 1000R Curve' },
      { label: 'Refresh & Response', value: '165Hz Refresh Rate with 1ms GtG response' },
      { label: 'Panel Technology', value: 'Quantum Mini-LED with 1,196 Local Dimming Zones' },
      { label: 'HDR Certification', value: 'Quantum HDR 2000 (2000 nits peak brightness)' }
    ],
    secrets: {
      sku: 'SMSG-ODY-G8-32-4K165',
      serial: 'Panel SN: SMSG-4K-992140 • HDCP: hdcp23_priv_8841a0e9',
      webhook: 'whsec_samsung_display_service_3321',
      eccn: 'EAR99 High-Performance Display',
      primeId: 'Shreyas V. Sharma (Gate Access: #4921)'
    }
  },

  'keychron-q1-pro': {
    id: 'keychron-q1-pro',
    title: 'Keychron Q1 Pro QMK/VIA Wireless Custom Mechanical Keyboard (Full CNC Aluminum, Hot-Swappable, K Pro Red)',
    shortTitle: 'Keychron Q1 Pro Custom Mechanical Keyboard',
    brand: 'Keychron',
    category: 'computers accessories keyboards keychron',
    department: 'Computers',
    price: 17999,
    mrp: 21999,
    rating: 4.9,
    ratingsCount: '4,210',
    boughtCount: '300+ bought in past month in India',
    image: 'assets/product_keyboard.svg',
    dealTag: 'Best Seller in Custom Keyboards',
    description: 'Full CNC aluminum body, QMK/VIA programmable, hot-swappable switches, double-gasket acoustic dampening.',
    specs: [
      { label: 'Chassis Material', value: 'Precision CNC Machined 6063 Aluminum' },
      { label: 'Switches', value: 'Keychron K Pro Red Pre-lubed Hot-swappable' },
      { label: 'Programmability', value: 'Full QMK and VIA Open-Source Re-mapping' },
      { label: 'Acoustics', value: 'Double-Gasket Design with Sound Absorbing Foam' }
    ],
    secrets: {
      sku: 'KCHR-Q1PRO-CNC-RED-99',
      serial: 'VIA Hex: 0x884F • Bluetooth Pairing PIN: 884-192',
      webhook: 'whsec_keychron_eeprom_dump_1120',
      eccn: 'EAR99 Custom Input Device',
      primeId: 'Shreyas V. Sharma (RuPay Card: 4532 8812 9044 1924)'
    }
  }
};

const CART_STORAGE_KEY = 'guptchara_amz_cart';
const DEFAULT_INITIAL_CART = [
  { id: 'macbook-pro-16', qty: 1 },
  { id: 'sony-wh1000xm5', qty: 1 },
  { id: 'keychron-q1-pro', qty: 1 }
];

/**
 * Cart Manager API
 */
const CartManager = {
  getProducts() {
    return PRODUCTS;
  },

  getProduct(id) {
    return PRODUCTS[id] || null;
  },

  formatCurrency(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  getRawCart() {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    // First time setup with realistic default items
    this.saveRawCart(DEFAULT_INITIAL_CART);
    return [...DEFAULT_INITIAL_CART];
  },

  saveRawCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (_) {}
    this.updateHeaderBadge();
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart } }));
  },

  getDetailedCart() {
    const raw = this.getRawCart();
    return raw.map(item => {
      const prod = PRODUCTS[item.id] || {
        id: item.id,
        shortTitle: 'Unknown Product',
        title: 'Unknown Product',
        price: 0,
        image: 'assets/logo.svg'
      };
      return {
        ...prod,
        qty: item.qty,
        lineTotal: prod.price * item.qty
      };
    });
  },

  getItemCount() {
    const raw = this.getRawCart();
    return raw.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  },

  getSubtotal() {
    const detailed = this.getDetailedCart();
    return detailed.reduce((sum, item) => sum + item.lineTotal, 0);
  },

  addToCart(productId, qty = 1) {
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty < 1) qty = 1;

    const raw = this.getRawCart();
    const existing = raw.find(i => i.id === productId);

    if (existing) {
      existing.qty += qty;
    } else {
      raw.push({ id: productId, qty });
    }

    this.saveRawCart(raw);
    this.showAddToCartToast(productId, qty);
    return true;
  },

  updateQty(productId, newQty) {
    newQty = parseInt(newQty, 10);
    let raw = this.getRawCart();

    if (newQty <= 0) {
      raw = raw.filter(i => i.id !== productId);
    } else {
      const item = raw.find(i => i.id === productId);
      if (item) {
        item.qty = newQty;
      }
    }

    this.saveRawCart(raw);
  },

  removeFromCart(productId) {
    const raw = this.getRawCart().filter(i => i.id !== productId);
    this.saveRawCart(raw);
  },

  clearCart() {
    this.saveRawCart([]);
  },

  updateHeaderBadge() {
    const count = this.getItemCount();
    document.querySelectorAll('.cart-badge').forEach(badge => {
      badge.textContent = count;
    });

    // Ensure all nav cart links point to cart.html
    document.querySelectorAll('a.nav-cart').forEach(link => {
      link.setAttribute('href', 'cart.html');
    });
  },

  showAddToCartToast(productId, qty) {
    const prod = PRODUCTS[productId];
    if (!prod) return;

    let toast = document.getElementById('amz-cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'amz-cart-toast';
      toast.className = 'amz-cart-toast-card';
      document.body.appendChild(toast);
    }

    const currentCount = this.getItemCount();
    const subtotalFormatted = this.formatCurrency(this.getSubtotal());

    toast.innerHTML = `
      <div class="toast-inner">
        <div class="toast-success-row">
          <div class="toast-check-icon">&#10003;</div>
          <div class="toast-title">Added to Cart (${qty} item${qty > 1 ? 's' : ''})</div>
          <button type="button" class="toast-close-btn" onclick="document.getElementById('amz-cart-toast').classList.remove('active')">&times;</button>
        </div>
        <div class="toast-product-preview">
          <img src="${prod.image}" alt="${prod.shortTitle}" class="toast-img">
          <div class="toast-prod-info">
            <div class="toast-prod-name">${prod.shortTitle}</div>
            <div class="toast-prod-price">${this.formatCurrency(prod.price)}</div>
          </div>
        </div>
        <div class="toast-subtotal-row">
          Cart Subtotal (<span>${currentCount} item${currentCount === 1 ? '' : 's'}</span>): <strong>${subtotalFormatted}</strong>
        </div>
        <div class="toast-action-btns">
          <a href="cart.html" class="btn btn-cart toast-btn">Go to Cart</a>
          <a href="checkout.html" class="btn btn-buy toast-btn">Proceed to Checkout</a>
        </div>
      </div>
    `;

    // Force reflow and show
    toast.offsetHeight;
    toast.classList.add('active');

    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
      toast.classList.remove('active');
    }, 6000);
  }
};

// Auto-initialize on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    CartManager.updateHeaderBadge();
  } else {
    document.addEventListener('DOMContentLoaded', () => CartManager.updateHeaderBadge());
  }
}

// Global hook for inline handlers
window.handleAddToCart = function(productId, qty = 1, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  CartManager.addToCart(productId, qty);
  return false;
};

window.handleBuyNow = function(productId, qty = 1, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  CartManager.addToCart(productId, qty);
  window.location.href = 'checkout.html';
  return false;
};

// Export for module/test or global browser use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRODUCTS, CartManager, CART_STORAGE_KEY };
} else {
  window.PRODUCTS = PRODUCTS;
  window.CartManager = CartManager;
}
