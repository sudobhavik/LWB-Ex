import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');

describe('Extension Manifest V3 Cross-Browser Compliance Tests', () => {
  const chromeManifestPath = path.resolve(__dirname, '../extension/manifest.json');
  const firefoxManifestPath = path.resolve(__dirname, '../extension/manifest.firefox.json');

  let chromeManifest;
  let firefoxManifest;

  beforeEach(() => {
    chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, 'utf8'));
    firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));
  });

  describe('Chrome Manifest V3 Compliance', () => {
    it('should be Manifest V3', () => {
      expect(chromeManifest.manifest_version).toBe(3);
    });

    it('should configure side_panel for Chromium Side Panel API', () => {
      expect(chromeManifest.side_panel).toBeDefined();
      expect(chromeManifest.side_panel.default_path).toBe('sidepanel/sidepanel.html');
    });

    it('should not include sidebar_action in Chrome manifest to prevent Chrome warnings', () => {
      expect(chromeManifest.sidebar_action).toBeUndefined();
    });

    it('should use background.service_worker and not background.scripts in Chrome MV3', () => {
      expect(chromeManifest.background.service_worker).toBe('background/background.js');
      expect(chromeManifest.background.scripts).toBeUndefined();
    });

    it('should configure Content Security Policy with wasm-unsafe-eval for ONNX Runtime Web', () => {
      expect(chromeManifest.content_security_policy).toBeDefined();
      expect(chromeManifest.content_security_policy.extension_pages).toContain('wasm-unsafe-eval');
    });

    it('should declare all necessary WebGPU / WASM / Engine web accessible resources', () => {
      expect(chromeManifest.web_accessible_resources).toBeDefined();
      const declared = chromeManifest.web_accessible_resources.flatMap(r => r.resources);
      expect(declared).toContain('lib/*');
      expect(declared).toContain('models/*');
      expect(declared).toContain('engine/*');
    });
  });

  describe('Firefox Manifest V3 Compliance', () => {
    it('should be Manifest V3', () => {
      expect(firefoxManifest.manifest_version).toBe(3);
    });

    it('should configure sidebar_action for Firefox Sidebar API', () => {
      expect(firefoxManifest.sidebar_action).toBeDefined();
      expect(firefoxManifest.sidebar_action.default_panel).toBe('sidepanel/sidepanel.html');
    });

    it('should configure background.scripts for Firefox MV3 event pages', () => {
      expect(firefoxManifest.background.scripts).toContain('background/background.js');
    });

    it('should include gecko ID for Firefox packaging', () => {
      expect(firefoxManifest.browser_specific_settings?.gecko?.id).toBe('yolo-privacy-agent@sih.internal');
    });
  });
});
