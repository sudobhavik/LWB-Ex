// executor/executor.ts

import type {
  
  ToolCall,
} from "../agent/agent_types";

export interface ScreenshotDimensions {
  width: number;
  height: number;
}

export async function executeTool(
  tool: ToolCall,
  screenshot: {
    width: number;
    height: number;
  },
  /*
   * The tab the agent locked onto at the start of the
   * run (see "[AGENT] Active tab: ..."). Pass this in
   * instead of letting the executor re-derive "whichever
   * tab is active right now" on every call — re-querying
   * races with navigation a click just triggered (a new
   * tab opening, a redirect, a loading transition), which
   * is what produced the "No active tab found" crash.
   */
  knownTabId?: number,
): Promise<void> {
  if (!tool) {
    throw new Error(
      "No tool provided by agent",
    );
  }

  console.log(
    "[EXECUTOR] Executing:",
    tool.name,
    tool.arguments,
  );

  const tabId =
    await resolveTabId(
      knownTabId,
    );

  switch (tool.name) {
    case "click":
      await executeClick(
        tabId,
        tool,
        screenshot,
      );
      break;

    case "type":
      await executeType(
        tabId,
        tool,
        screenshot,
      );
      break;

    case "scroll":
      await executeScroll(
        tabId,
        tool,
      );
      break;

    case "wait":
      await executeWait(
        tabId,
        tool,
      );
      break;

    default:
      throw new Error(
        `Unknown tool: ${tool.name}`,
      );
  }

  console.log(
    "[EXECUTOR] Tool completed:",
    tool.name,
  );
}

/*
 * Prefer the tab id the agent already tracked. Only
 * fall back to an active-tab query if it wasn't passed
 * in, and retry that query briefly before giving up —
 * a click that just triggered navigation can leave the
 * browser with no "active" tab for a moment.
 */
async function resolveTabId(
  knownTabId?: number,
): Promise<number> {
  if (
    typeof knownTabId ===
    "number"
  ) {
    return knownTabId;
  }

  const maxAttempts = 3;
  const retryDelayMs = 250;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    const [tab] =
      await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

    if (tab?.id) {
      return tab.id;
    }

    if (attempt < maxAttempts) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            retryDelayMs,
          ),
      );
    }
  }

  throw new Error(
    "No active tab found",
  );
}


/* ---------------------------------- */
/* COORDINATE CONVERSION               */
/* ---------------------------------- */

async function convertCoordinates(
  tabId: number,
  x: number,
  y: number,
  screenshot: ScreenshotDimensions,
): Promise<{
  x: number;
  y: number;
}> {
  const viewport =
    await browser.tabs.sendMessage(
      tabId,
      {
        type: "GET_VIEWPORT_SIZE",
      },
    );

  if (
    !viewport?.width ||
    !viewport?.height
  ) {
    throw new Error(
      "Failed to get viewport size",
    );
  }

  const scaleX =
    viewport.width /
    screenshot.width;

  const scaleY =
    viewport.height /
    screenshot.height;

  const viewportX =
    x * scaleX;

  const viewportY =
    y * scaleY;

  console.log(
    "[EXECUTOR] Coordinate conversion:",
    {
      screenshot: {
        x,
        y,
      },

      viewport: {
        x: viewportX,
        y: viewportY,
      },

      screenshotSize: screenshot,

      viewportSize: {
        width:
          viewport.width,
        height:
          viewport.height,
      },
    },
  );

  return {
    x: viewportX,
    y: viewportY,
  };
}


/* ---------------------------------- */
/* CLICK                               */
/* ---------------------------------- */

async function executeClick(
  tabId: number,
  tool: ToolCall,
  screenshot: ScreenshotDimensions,
): Promise<void> {
  const { x, y } =
    tool.arguments;

  if (
    typeof x !== "number" ||
    typeof y !== "number"
  ) {
    throw new Error(
      "click requires x and y",
    );
  }

  const coordinates =
    await convertCoordinates(
      tabId,
      x,
      y,
      screenshot,
    );

  const result =
    await browser.tabs.sendMessage(
      tabId,
      {
        type: "EXECUTE_CLICK",

        x: coordinates.x,
        y: coordinates.y,
      },
    );

  if (!result?.success) {
    throw new Error(
      result?.error ??
        "Click execution failed",
    );
  }
}


/* ---------------------------------- */
/* TYPE                                */
/* ---------------------------------- */

async function executeType(
  tabId: number,
  tool: ToolCall,
  screenshot: ScreenshotDimensions,
): Promise<void> {
  const {
    x,
    y,
    value,
  } = tool.arguments;

  if (
    typeof x !== "number" ||
    typeof y !== "number"
  ) {
    throw new Error(
      "type requires x and y",
    );
  }

  if (
    typeof value !== "string"
  ) {
    throw new Error(
      "type requires value",
    );
  }

  const coordinates =
    await convertCoordinates(
      tabId,
      x,
      y,
      screenshot,
    );

  const result =
    await browser.tabs.sendMessage(
      tabId,
      {
        type: "EXECUTE_TYPE",

        x: coordinates.x,
        y: coordinates.y,

        value,
      },
    );

  if (!result?.success) {
    throw new Error(
      result?.error ??
        "Type execution failed",
    );
  }
}


/* ---------------------------------- */
/* SCROLL                              */
/* ---------------------------------- */

async function executeScroll(
  tabId: number,
  tool: ToolCall,
): Promise<void> {
  const {
    direction,
    amount,
  } = tool.arguments;

  if (
    direction !== "up" &&
    direction !== "down"
  ) {
    throw new Error(
      "scroll direction must be up or down",
    );
  }

  const scrollAmount =
    typeof amount === "number"
      ? amount
      : 500;

  const result =
    await browser.tabs.sendMessage(
      tabId,
      {
        type: "EXECUTE_SCROLL",

        direction,

        amount:
          scrollAmount,
      },
    );

  if (!result?.success) {
    throw new Error(
      result?.error ??
        "Scroll execution failed",
    );
  }
}


/* ---------------------------------- */
/* WAIT                                */
/* ---------------------------------- */

async function executeWait(
  tabId: number,
  tool: ToolCall,
): Promise<void> {
  const milliseconds =
    typeof tool.arguments
      .milliseconds === "number"
      ? tool.arguments
          .milliseconds
      : 1000;

  const duration =
    Math.min(
      Math.max(
        milliseconds,
        100,
      ),
      5000,
    );

  const result =
    await browser.tabs.sendMessage(
      tabId,
      {
        type: "EXECUTE_WAIT",

        milliseconds:
          duration,
      },
    );

  if (!result?.success) {
    throw new Error(
      result?.error ??
        "Wait execution failed",
    );
  }
}