export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    async (message) => {
      if (message.type !== "CAPTURE_SCREENSHOT") {
        return;
      }

      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        throw new Error("No active tab found");
      }

      const screenshot =
        await browser.tabs.captureVisibleTab(
          tab?.windowId,
          {
            format: "png",
          },
        );

      return {
        type: "SCREENSHOT_RESULT",
        screenshot,
      };
    },
  );
});