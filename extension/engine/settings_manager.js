/**
 * GUPTCHARA Settings & Policy Manager
 * Handles persistent configuration, privacy filters, and guardrails across sidepanel and engine.
 */

const DEFAULT_SETTINGS = {
  // General
  autoScanPages: true,
  showAgentActivity: true,
  showNotifications: false,
  askBeforeConsequential: true,

  // Privacy Detection & Display
  detectFaces: true,
  detectPasswordFields: true,
  detectSensitiveText: true,
  showDetectionRegions: true,
  alwaysRedactBeforeReasoning: true,

  // Local AI & Processing
  acceleration: 'webgpu', // 'webgpu' | 'wasm' | 'cpu'
  preferredProvider: 'auto',
  openaiKey: '',
  geminiKey: '',
  anthropicKey: '',
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'qwen3-vl:2b',

  // Agent Behavior & Limits
  confirmBrowserActions: true,
  autoContinueAfterDetection: false,
  showReasoningSteps: true,
  maxActionsPerSession: 10
};

const CONSEQUENTIAL_KEYWORDS = [
  'buy',
  'place order',
  'place your order',
  'place the order',
  'pay',
  'pay now',
  'purchase',
  'checkout',
  'complete order',
  'confirm order',
  'submit order',
  'submit payment',
  'order now',
  'proceed to payment',
  'delete account',
  'transfer funds'
];

class SettingsManager {
  constructor(storageApi = null) {
    this.storage = storageApi || (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local
      ? chrome.storage.local
      : (typeof browser !== 'undefined' && browser.storage && browser.storage.local
        ? browser.storage.local
        : null));
    this.settings = { ...DEFAULT_SETTINGS };
    this.isLoaded = false;
  }

  /**
   * Load settings from storage, falling back to default values.
   */
  async loadSettings() {
    if (!this.storage) {
      this.isLoaded = true;
      return { ...this.settings };
    }

    try {
      const keys = Object.keys(DEFAULT_SETTINGS);
      const data = await new Promise((resolve) => {
        const res = this.storage.get(keys, (items) => resolve(items || {}));
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(() => resolve({}));
        }
      });

      this.settings = {
        ...DEFAULT_SETTINGS,
        ...(data || {})
      };

      // Check for optional bundled config.json (used for cloud demo instances)
      if (!this.settings.openaiKey && typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function' && typeof fetch === 'function') {
        try {
          const cfgUrl = chrome.runtime.getURL('config.json');
          const cfgRes = await fetch(cfgUrl);
          if (cfgRes && cfgRes.ok) {
            const cfg = await cfgRes.json();
            if (cfg && cfg.openaiKey) {
              this.settings.openaiKey = cfg.openaiKey;
              if (cfg.preferredProvider) {
                this.settings.preferredProvider = cfg.preferredProvider;
              }
              if (this.storage && this.storage.set) {
                this.storage.set({
                  openaiKey: this.settings.openaiKey,
                  preferredProvider: this.settings.preferredProvider
                }, () => {});
              }
            }
          }
        } catch (_) {}
      }

      this.isLoaded = true;
      return { ...this.settings };
    } catch (err) {
      console.warn('[SettingsManager] Failed to load settings, using defaults:', err);
      this.isLoaded = true;
      return { ...this.settings };
    }
  }

  /**
   * Save a single setting key and value.
   */
  async saveSetting(key, val) {
    this.settings[key] = val;
    if (!this.storage) return;

    try {
      const payload = { [key]: val };
      await new Promise((resolve, reject) => {
        const res = this.storage.set(payload, () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve();
        });
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(reject);
        }
      });
    } catch (err) {
      console.warn(`[SettingsManager] Could not save setting ${key}:`, err);
    }
  }

  /**
   * Save all settings at once.
   */
  async saveAll(newSettings = {}) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    if (!this.storage) return;

    try {
      await new Promise((resolve, reject) => {
        const res = this.storage.set(this.settings, () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve();
        });
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(reject);
        }
      });
    } catch (err) {
      console.warn('[SettingsManager] Could not save all settings:', err);
    }
  }

  /**
   * Check if a proposed action is a consequential action (e.g. buying, submitting payment).
   */
  isConsequentialAction(action, targetText = '', targetTag = '') {
    if (!this.settings.askBeforeConsequential) {
      return false;
    }

    const text = (String(targetText) + ' ' + String(action || '') + ' ' + String(targetTag || '')).toLowerCase();
    return CONSEQUENTIAL_KEYWORDS.some((kw) => text.includes(kw));
  }

  /**
   * Filter sensitive PII regions based on current privacy settings.
   */
  filterPIIRegions(piiRegions = []) {
    if (!Array.isArray(piiRegions)) return [];

    return piiRegions.filter((p) => {
      const type = String(p.type || p.className || '').toUpperCase();
      const isPassword = type.includes('PASSWORD') || type.includes('SECRET') || type.includes('CVV');

      if (isPassword) {
        return Boolean(this.settings.detectPasswordFields);
      }
      return Boolean(this.settings.detectSensitiveText);
    });
  }

  /**
   * Clear local activity (session history, agent logs).
   */
  clearActivity() {
    return { success: true, timestamp: Date.now() };
  }

  /**
   * Clear all local data and reset settings to defaults.
   */
  async clearData() {
    this.settings = { ...DEFAULT_SETTINGS };
    if (this.storage) {
      try {
        await new Promise((resolve) => {
          const res = this.storage.clear(resolve);
          if (res && typeof res.then === 'function') {
            res.then(resolve);
          }
        });
        await this.saveAll(DEFAULT_SETTINGS);
      } catch (err) {
        console.warn('[SettingsManager] Could not clear storage:', err);
      }
    }
    return { success: true, settings: { ...this.settings } };
  }
}

// Module and browser universal export
if (typeof window !== 'undefined') {
  window.SettingsManager = SettingsManager;
  window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  window.CONSEQUENTIAL_KEYWORDS = CONSEQUENTIAL_KEYWORDS;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SettingsManager = SettingsManager;
  globalThis.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  globalThis.CONSEQUENTIAL_KEYWORDS = CONSEQUENTIAL_KEYWORDS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SettingsManager, DEFAULT_SETTINGS, CONSEQUENTIAL_KEYWORDS };
}
