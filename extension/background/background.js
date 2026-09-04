// Background Service Worker for PS171 Privacy Agent — 100% In-Browser Standalone

// Enable Side Panel to open immediately when the user clicks the extension toolbar icon
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn("Could not set side panel behavior:", error));
}

// Fallback action click listener for Chrome
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    } catch (err) {
      console.warn("Could not open side panel:", err);
    }
  }
});

// Listen for messages from popup/sidepanel and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CLEAR_TAB_MASKS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR_PRIVACY_MASKS" }).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return true;
  }
});
