# Cross-Browser Manifest V3 Deep-Dive Reference

## Manifest Compatibility Table

```json
{
  "manifest_version": 3,
  "browser_specific_settings": {
    "gecko": {
      "id": "project-agent@org.internal",
      "strict_min_version": "109.0"
    }
  },
  "action": {
    "default_title": "Project Agent",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "side_panel": {
    "default_path": "popup/popup.html"
  },
  "sidebar_action": {
    "default_title": "Project Agent",
    "default_panel": "popup/popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  },
  "background": {
    "service_worker": "background/background.js",
    "scripts": ["background/background.js"]
  }
}
```

## Essential Rules:
1. Chrome ignores `sidebar_action` without errors.
2. Firefox ignores `side_panel` without errors.
3. Both browsers render the exact same `popup/popup.html` side panel/sidebar.
4. If `action.default_popup` is present, it overrides `action.onClicked` in Firefox, causing the sidebar to never toggle.\n