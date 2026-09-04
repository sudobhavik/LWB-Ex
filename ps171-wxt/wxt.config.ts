import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  extensionApi: 'chrome',
  modules: [],
  manifest: {
    name: 'ISRO PS171 Vision Privacy Shield',
    version: '2.0.0',
    description: 'On-device zero-egress visual privacy agent detecting and redacting faces, passwords, PII, and sensitive text in real-time (ISRO SIH26171).',
    permissions: [
      'activeTab',
      'storage',
      'scripting',
      'tabs',
    ],
    host_permissions: [
      '<all_urls>',
    ],
    web_accessible_resources: [
      {
        resources: [
          'models/*',
          'lib/*',
          'engine/*',
          'assets/*',
          'icons/*',
        ],
        matches: ['<all_urls>'],
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },
});
