// Background Service Worker for PS171 Privacy Agent - Cross-Browser Standalone

// Cross-browser API polyfill
const browserAPI = (() => {
  if (typeof globalThis.browser !== "undefined" && globalThis.browser.runtime) {
    return globalThis.browser;
  }
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime) {
    return globalThis.chrome;
  }
  return {};
})();

if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
  globalThis.browser = globalThis.chrome;
}
if (typeof globalThis.chrome === "undefined" && typeof globalThis.browser !== "undefined") {
  globalThis.chrome = globalThis.browser;
}

// Chrome Side Panel Configuration (Gracefully ignored in Firefox)
const sidePanelAPI = (typeof chrome !== "undefined" && chrome.sidePanel)
  ? chrome.sidePanel
  : ((typeof browser !== "undefined" && browser.sidePanel) ? browser.sidePanel : null);

if (sidePanelAPI && typeof sidePanelAPI.setPanelBehavior === "function") {
  try {
    sidePanelAPI
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.warn("Could not set side panel behavior:", error));
  } catch (err) {
    console.warn("Exception calling setPanelBehavior:", err);
  }
}

// Fallback action click listener (In Firefox, action.default_popup opens popup directly)
const actionAPI = (typeof chrome !== "undefined" && chrome.action)
  ? chrome.action
  : ((typeof browser !== "undefined" && browser.action) ? browser.action : null);

if (actionAPI && actionAPI.onClicked) {
  actionAPI.onClicked.addListener(async (tab) => {
    if (sidePanelAPI && typeof sidePanelAPI.open === "function") {
      try {
        await sidePanelAPI.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn("Could not open side panel:", err);
      }
    } else {
      console.info("Side panel API not supported in this browser; popup will handle UI.");
    }
  });
}

// Listen for messages from popup/sidepanel and content scripts
const runtimeAPI = (browserAPI && browserAPI.runtime)
  ? browserAPI.runtime
  : (typeof chrome !== "undefined" ? chrome.runtime : null);

const tabsAPI = (browserAPI && browserAPI.tabs)
  ? browserAPI.tabs
  : (typeof chrome !== "undefined" ? chrome.tabs : null);

if (runtimeAPI && runtimeAPI.onMessage) {
  runtimeAPI.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === "CLEAR_TAB_MASKS") {
      if (tabsAPI && tabsAPI.query) {
        tabsAPI.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0 && tabs[0].id) {
            try {
              const res = tabsAPI.sendMessage(tabs[0].id, { action: "CLEAR_PRIVACY_MASKS" });
              if (res && typeof res.catch === "function") {
                res.catch(() => {});
              }
            } catch (_) {}
          }
        });
      }
      sendResponse({ success: true });
      return true;
    }
  });
}

