export interface ScreenshotResult {
  type: "SCREENSHOT_RESULT";
  screenshot: string;
}

export async function captureScreenshot(): Promise<string> {
  const response =
    await browser.runtime.sendMessage({
      type: "CAPTURE_SCREENSHOT",
    }) as ScreenshotResult;

  if (!response?.screenshot) {
    throw new Error("Failed to capture screenshot");
  }

  return response.screenshot;
}