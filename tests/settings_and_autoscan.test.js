import { describe, it, expect, beforeEach, vi } from 'vitest';
const { SettingsManager, DEFAULT_SETTINGS, CONSEQUENTIAL_KEYWORDS } = require('../extension/engine/settings_manager.js');

describe('GUPTCHARA Settings & Policy Engine Tests', () => {
  let mockStorage;
  let storageStore;
  let manager;

  beforeEach(() => {
    storageStore = {};
    mockStorage = {
      get: vi.fn((keys, callback) => {
        const result = {};
        if (Array.isArray(keys)) {
          keys.forEach((k) => {
            if (storageStore[k] !== undefined) result[k] = storageStore[k];
          });
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: vi.fn((items, callback) => {
        Object.assign(storageStore, items);
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: vi.fn((callback) => {
        storageStore = {};
        if (callback) callback();
        return Promise.resolve();
      })
    };

    manager = new SettingsManager(mockStorage);
  });

  describe('Default Settings Structure & Defaults Verification', () => {
    it('should have all mandatory fields configured to reference design defaults', () => {
      expect(DEFAULT_SETTINGS.autoScanPages).toBe(true);
      expect(DEFAULT_SETTINGS.showAgentActivity).toBe(true);
      expect(DEFAULT_SETTINGS.showNotifications).toBe(false);
      expect(DEFAULT_SETTINGS.askBeforeConsequential).toBe(true);

      expect(DEFAULT_SETTINGS.detectFaces).toBe(true);
      expect(DEFAULT_SETTINGS.detectPasswordFields).toBe(true);
      expect(DEFAULT_SETTINGS.detectSensitiveText).toBe(true);
      expect(DEFAULT_SETTINGS.showDetectionRegions).toBe(true);
      expect(DEFAULT_SETTINGS.alwaysRedactBeforeReasoning).toBe(true);

      expect(DEFAULT_SETTINGS.acceleration).toBe('webgpu');
      expect(DEFAULT_SETTINGS.preferredProvider).toBe('auto');
      expect(DEFAULT_SETTINGS.ollamaEndpoint).toBe('http://localhost:11434');
      expect(DEFAULT_SETTINGS.ollamaModel).toBe('qwen3-vl:2b');

      expect(DEFAULT_SETTINGS.confirmBrowserActions).toBe(true);
      expect(DEFAULT_SETTINGS.autoContinueAfterDetection).toBe(false);
      expect(DEFAULT_SETTINGS.showReasoningSteps).toBe(true);
      expect(DEFAULT_SETTINGS.maxActionsPerSession).toBe(10);
    });

    it('should load default settings when storage is initially empty', async () => {
      const s = await manager.loadSettings();
      expect(s.autoScanPages).toBe(true);
      expect(s.askBeforeConsequential).toBe(true);
      expect(s.maxActionsPerSession).toBe(10);
    });
  });

  describe('Settings Persistence & Modification', () => {
    it('should update in-memory and persisted storage when saveSetting is called', async () => {
      await manager.saveSetting('acceleration', 'wasm');
      expect(manager.settings.acceleration).toBe('wasm');
      expect(mockStorage.set).toHaveBeenCalledWith(
        { acceleration: 'wasm' },
        expect.any(Function)
      );
    });

    it('should update maxActionsPerSession limit', async () => {
      await manager.saveSetting('maxActionsPerSession', 25);
      expect(manager.settings.maxActionsPerSession).toBe(25);
    });

    it('should reset all settings to defaults on clearData', async () => {
      await manager.saveSetting('acceleration', 'cpu');
      await manager.saveSetting('autoScanPages', false);
      expect(manager.settings.acceleration).toBe('cpu');
      expect(manager.settings.autoScanPages).toBe(false);

      await manager.clearData();
      expect(manager.settings.acceleration).toBe('webgpu');
      expect(manager.settings.autoScanPages).toBe(true);
      expect(mockStorage.clear).toHaveBeenCalled();
    });
  });

  describe('Consequential Action Detection (Ask Before Action)', () => {
    it('should detect purchasing, checkout, and order keywords as consequential', () => {
      expect(manager.isConsequentialAction('click', 'Place your order')).toBe(true);
      expect(manager.isConsequentialAction('click', 'Buy Now')).toBe(true);
      expect(manager.isConsequentialAction('click', 'Proceed to Checkout')).toBe(true);
      expect(manager.isConsequentialAction('click', 'Submit Payment')).toBe(true);
      expect(manager.isConsequentialAction('click', 'Complete Order')).toBe(true);
    });

    it('should not flag benign navigation actions as consequential', () => {
      expect(manager.isConsequentialAction('click', 'Read documentation')).toBe(false);
      expect(manager.isConsequentialAction('click', 'Search products')).toBe(false);
      expect(manager.isConsequentialAction('click', 'Next page')).toBe(false);
      expect(manager.isConsequentialAction('scroll', 'view details')).toBe(false);
    });

    it('should bypass consequential checks when askBeforeConsequential is disabled', async () => {
      await manager.saveSetting('askBeforeConsequential', false);
      expect(manager.isConsequentialAction('click', 'Place order')).toBe(false);
      expect(manager.isConsequentialAction('click', 'Pay now')).toBe(false);
    });
  });

  describe('PII Region Filtering by Privacy Toggles', () => {
    const samplePII = [
      { type: 'PASSWORD', x: 10, y: 10, width: 100, height: 20 },
      { type: 'AADHAAR', x: 10, y: 40, width: 120, height: 20 },
      { type: 'PAN_CARD', x: 10, y: 70, width: 110, height: 20 },
      { type: 'PHONE_NUMBER', x: 10, y: 100, width: 90, height: 20 }
    ];

    it('should include all sensitive items when both filters are enabled', () => {
      manager.settings.detectPasswordFields = true;
      manager.settings.detectSensitiveText = true;

      const filtered = manager.filterPIIRegions(samplePII);
      expect(filtered.length).toBe(4);
    });

    it('should filter out password fields when detectPasswordFields is disabled', () => {
      manager.settings.detectPasswordFields = false;
      manager.settings.detectSensitiveText = true;

      const filtered = manager.filterPIIRegions(samplePII);
      expect(filtered.length).toBe(3);
      expect(filtered.some((p) => p.type === 'PASSWORD')).toBe(false);
    });

    it('should filter out sensitive text when detectSensitiveText is disabled', () => {
      manager.settings.detectPasswordFields = true;
      manager.settings.detectSensitiveText = false;

      const filtered = manager.filterPIIRegions(samplePII);
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe('PASSWORD');
    });

    it('should return empty list when both filters are disabled', () => {
      manager.settings.detectPasswordFields = false;
      manager.settings.detectSensitiveText = false;

      const filtered = manager.filterPIIRegions(samplePII);
      expect(filtered.length).toBe(0);
    });
  });

  describe('Auto-Scan Pages Policy Verification', () => {
    it('should enable auto-scan by default on initial launch', () => {
      expect(manager.settings.autoScanPages).toBe(true);
    });

    it('should allow disabling auto-scan for passive manual inspection', async () => {
      await manager.saveSetting('autoScanPages', false);
      expect(manager.settings.autoScanPages).toBe(false);
    });
  });

  describe('Cloud Demo Deployment & config.json Pre-Seeding Verification', () => {
    it('should gracefully handle missing or failing config.json fetch without crashing', async () => {
      const loaded = await manager.loadSettings();
      expect(loaded).toBeDefined();
      expect(loaded.preferredProvider).toBe('auto');
    });

    it('should adopt preseeded openaiKey and preferredProvider when config.json is present', async () => {
      // Mock chrome.runtime.getURL and fetch
      const originalChrome = globalThis.chrome;
      const originalFetch = globalThis.fetch;

      globalThis.chrome = {
        runtime: {
          getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`)
        }
      };

      globalThis.fetch = vi.fn((url) => {
        if (url.includes('config.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              openaiKey: 'sk-proj-test-azure-deployment-key-12345',
              preferredProvider: 'openai-gpt4o'
            })
          });
        }
        return Promise.reject(new Error('404'));
      });

      const freshStorageStore = {};
      const freshMockStorage = {
        get: vi.fn((keys, cb) => cb({})),
        set: vi.fn((items, cb) => {
          Object.assign(freshStorageStore, items);
          if (cb) cb();
        })
      };

      const cloudManager = new SettingsManager(freshMockStorage);
      const settings = await cloudManager.loadSettings();

      expect(settings.openaiKey).toBe('sk-proj-test-azure-deployment-key-12345');
      expect(settings.preferredProvider).toBe('openai-gpt4o');
      expect(freshStorageStore.openaiKey).toBe('sk-proj-test-azure-deployment-key-12345');
      expect(freshStorageStore.preferredProvider).toBe('openai-gpt4o');

      // Cleanup mocks
      globalThis.chrome = originalChrome;
      globalThis.fetch = originalFetch;
    });
  });
});

