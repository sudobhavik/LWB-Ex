export default defineBackground(() => {
  const DEFAULT_SERVER_URL = "http://localhost:8000";

  console.log("[PS171 WXT] Service worker initialized. ID:", chrome.runtime.id);

  // Message listener for popup, content script, and test pages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "CAPTURE_AND_DETECT") {
      handleCaptureAndDetect(message.settings || {})
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // Keep message channel open for async response
    }

    if (message.action === "CHECK_BACKEND_HEALTH") {
      const serverUrl = message.serverUrl || DEFAULT_SERVER_URL;
      fetch(`${serverUrl}/health`)
        .then((res) => res.json())
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === "CLEAR_TAB_MASKS") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR_PRIVACY_MASKS" }).catch(() => {});
        }
      });
      sendResponse({ success: true });
      return true;
    }

    if (message.action === "OPEN_TEST_LAB") {
      const testPageUrl = chrome.runtime.getURL("test.html");
      chrome.tabs.create({ url: testPageUrl });
      sendResponse({ success: true, url: testPageUrl });
      return true;
    }
  });

  async function handleCaptureAndDetect(settings: any = {}) {
    const serverUrl = settings.serverUrl || DEFAULT_SERVER_URL;
    const confThreshold = settings.confThreshold || 0.25;

    // 1. Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error("No active browser tab found.");
    }

    // 2. Capture visible tab screenshot (JPEG 90% quality)
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null as any, {
      format: "jpeg",
      quality: 90,
    });

    if (!screenshotDataUrl) {
      throw new Error("Failed to capture screenshot. Make sure you are not on a restricted chrome:// internal page.");
    }

    // 3. Send screenshot to YOLO26-nano Privacy Agent Backend (Server or In-Browser)
    const startTime = performance.now();
    let result: any = null;

    try {
      const response = await fetch(`${serverUrl}/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: screenshotDataUrl,
          conf_threshold: confThreshold,
          iou_threshold: 0.45,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      result = await response.json();
    } catch (serverErr) {
      // Fallback: If local server isn't running, return screenshot and instruct DOM hybrid scan
      result = {
        success: true,
        mode: "dom_hybrid_client",
        detections: [],
        annotated_image: screenshotDataUrl,
        image_dimensions: { width: 1280, height: 720 },
      };
    }

    const inferenceDuration = Math.round(performance.now() - startTime);

    // 4. Send detections to content script in active tab to render privacy overlays
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: "APPLY_PRIVACY_MASKS",
        detections: result.detections || [],
        settings: settings,
        imageDimensions: result.image_dimensions,
      });
    } catch (e) {
      console.warn("[PS171 WXT] Could not inject masks into tab:", e);
    }

    return {
      ...result,
      client_duration_ms: inferenceDuration,
      screenshot_preview: result.annotated_image || screenshotDataUrl,
    };
  }
});
