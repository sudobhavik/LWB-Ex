/**
 * Cross-Browser Background Service Worker / Script
 * Handles side panel opening across Google Chrome MV3 (chrome.sidePanel)
 * and Mozilla Firefox MV3 (browser.sidebarAction).
 */

const browserAPI = (() => {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime) {
    return globalThis.browser;
  }
  if (typeof globalThis.chrome !== 'undefined' && globalThis.chrome.runtime) {
    return globalThis.chrome;
  }
  return {};
})();

const sidePanelAPI = (typeof chrome !== 'undefined' && chrome.sidePanel)
  ? chrome.sidePanel
  : ((typeof browser !== 'undefined' && browser.sidePanel) ? browser.sidePanel : null);

if (sidePanelAPI && typeof sidePanelAPI.setPanelBehavior === 'function') {
  try {
    sidePanelAPI.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  } catch (_) {}
}

// Automatically open the native side panel interface upon first installation without opening a full tab
browserAPI.runtime?.onInstalled?.addListener(async (details) => {
  if (details.reason === 'install') {
    try {
      if (sidePanelAPI && typeof sidePanelAPI.open === 'function') {
        const windows = await (browserAPI.windows?.getAll ? browserAPI.windows.getAll({ populate: false }) : []);
        if (windows && windows.length > 0) {
          await sidePanelAPI.open({ windowId: windows[0].id });
        }
      }
    } catch (_) {}
  }
});

const actionAPI = (typeof browser !== 'undefined' && browser.action)
  ? browser.action
  : ((typeof chrome !== 'undefined' && chrome.action) ? chrome.action : null);

if (actionAPI && actionAPI.onClicked) {
  actionAPI.onClicked.addListener(async (tab) => {
    // 1. Firefox native sidebarAction
    const sidebarAPI = (typeof browser !== 'undefined' && browser.sidebarAction)
      ? browser.sidebarAction
      : null;

    if (sidebarAPI) {
      try {
        if (typeof sidebarAPI.toggle === 'function') {
          await sidebarAPI.toggle();
          return;
        } else if (typeof sidebarAPI.open === 'function') {
          await sidebarAPI.open();
          return;
        }
      } catch (err) {
        console.warn('Could not toggle Firefox sidebar:', err);
      }
    }

    // 2. Chrome native sidePanel
    if (sidePanelAPI && typeof sidePanelAPI.open === 'function') {
      try {
        await sidePanelAPI.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn('Could not open Chrome side panel:', err);
      }
    }
  });
}

// Background message relay for active tab capture or communication
browserAPI.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (message.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return true;
  }
  if (message.action === 'CAPTURE_VISIBLE_TAB') {
    const targetWindowId = typeof message.windowId === 'number' ? message.windowId : null;
    browserAPI.tabs.captureVisibleTab(targetWindowId, { format: 'png' })
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(err => {
        browserAPI.tabs.captureVisibleTab(null, { format: 'png' })
          .then(dataUrl => sendResponse({ dataUrl }))
          .catch(err2 => sendResponse({ error: err2?.message || err?.message }));
      });
    return true;
  }
  return false;
});
