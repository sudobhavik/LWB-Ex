import { describe, it, expect } from 'vitest';
const fs = require('fs');
const path = require('path');

describe('Extension Manifest & Standards Compliance', () => {
  const manifestPath = path.resolve(__dirname, '../extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('should conform to Manifest V3 specification', () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it('should support dual background declaration (service_worker & scripts) for Chrome & Firefox', () => {
    expect(manifest.background).toBeDefined();
    expect(manifest.background.service_worker).toBe('background/background.js');
    expect(Array.isArray(manifest.background.scripts)).toBe(true);
    expect(manifest.background.scripts).toContain('background/background.js');
  });

  it('should declare both side_panel and sidebar_action targeting the same panel', () => {
    expect(manifest.side_panel?.default_path).toBe('sidepanel/sidepanel.html');
    expect(manifest.sidebar_action?.default_panel).toBe('sidepanel/sidepanel.html');
  });

  it('should NOT declare action.default_popup to prevent intercepting sidebar toggles', () => {
    expect(manifest.action?.default_popup).toBeUndefined();
  });

  it('should provide Gecko ID for Firefox compatibility', () => {
    expect(manifest.browser_specific_settings?.gecko?.id).toBeDefined();
  });

  it('should include wasm-unsafe-eval in extension_pages CSP for ONNX WebAssembly execution', () => {
    const csp = manifest.content_security_policy?.extension_pages || '';
    expect(csp).toContain("'wasm-unsafe-eval'");
  });

  it('should declare required permissions and web accessible resources', () => {
    expect(manifest.permissions).toContain('sidePanel');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('tabs');

    const war = manifest.web_accessible_resources || [];
    const hasModels = war.some(r => r.resources?.some(res => res.includes('models')));
    expect(hasModels).toBe(true);
  });
});
