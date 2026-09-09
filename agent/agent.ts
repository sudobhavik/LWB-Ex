import { callLLM } from "./llm";
import type { LLMConfig } from "./llm";
import type { ToolCall } from "./agent_types";

import { captureScreenshot } from "../vision/screenshot";
import { preprocessImage } from "../vision/preprocessor";
import { runYOLO } from "../vision/yolo";
import { fusePerception } from "../dom/fusion";
import { sanitizeScreenshot } from "../privacy/canvasredactor";

export interface AgentCallbacks {
  onPerception?: (data: {
    protectedCount: number;
    safeScreenshot: string;
  }) => void;

  onMessage?: (message: string) => void;

  executeTool: (
    tool: ToolCall,
    screenshot: {
      width: number;
      height: number;
    },
  ) => Promise<void>;
}

const MAX_STEPS = 10;

export async function runAgent(
  config: LLMConfig,
  userTask: string,
  callbacks: AgentCallbacks,
): Promise<void> {
  console.log("[AGENT] ===== STARTING AGENT =====");

  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  console.log("[AGENT] Active tab:", tab.id);

  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(
      `[AGENT] ===== STEP ${step}/${MAX_STEPS} =====`,
    );

    /* ---------------------------------- */
    /* CAPTURE SCREENSHOT                 */
    /* ---------------------------------- */

    console.log("[AGENT] Capturing screenshot...");

    const screenshot =
      await captureScreenshot();

    console.log(
      "[AGENT] Screenshot captured",
    );


    /* ---------------------------------- */
    /* REMOVE OLD SANITIZATION            */
    /* ---------------------------------- */

    try {
      await browser.tabs.sendMessage(
        tab.id,
        {
          type: "REMOVE_SANITIZATION",
        },
      );
    } catch (error) {
      console.warn(
        "[AGENT] Could not remove previous sanitization:",
        error,
      );
    }


    /* ---------------------------------- */
    /* DOM PERCEPTION                     */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Running DOM perception...",
    );

    const perception =
      await browser.tabs.sendMessage(
        tab.id,
        {
          type: "GET_PERCEPTION",
        },
      );

    console.log(
      "[AGENT] DOM perception:",
      perception,
    );


    /* ---------------------------------- */
    /* PREPROCESS IMAGE                   */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Preprocessing screenshot...",
    );

    const preprocessResult =
      await preprocessImage(
        screenshot,
      );

    console.log(
      "[AGENT] Screenshot dimensions:",
      preprocessResult.originalWidth,
      "x",
      preprocessResult.originalHeight,
    );


    /* ---------------------------------- */
    /* YOLO                               */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Running YOLO...",
    );

    const visualDetections =
      await runYOLO(
        preprocessResult,
      );

    console.log(
      "[AGENT] YOLO detections:",
      visualDetections,
    );


    /* ---------------------------------- */
    /* FUSION                             */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Fusing perception...",
    );

    const unified =
      fusePerception(
        perception.elements,
        visualDetections,
      );

    console.log(
      "[AGENT] Unified perception:",
      unified,
    );


    /* ---------------------------------- */
    /* PROTECTED COUNT                    */
    /* ---------------------------------- */

    const protectedCount =
      unified.filter(
        (item) => item.protected,
      ).length;

    console.log(
      "[AGENT] Protected elements:",
      protectedCount,
    );


    /* ---------------------------------- */
    /* SANITIZE ACTUAL PAGE               */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Sanitizing webpage...",
    );

    const sanitizeResult =
      await browser.tabs.sendMessage(
        tab.id,
        {
          type: "SANITIZE_PAGE",

          detections: unified,

          screenshotWidth:
            preprocessResult.originalWidth,

          screenshotHeight:
            preprocessResult.originalHeight,
        },
      );

    console.log(
      "[AGENT] Sanitization result:",
      sanitizeResult,
    );


    /* ---------------------------------- */
    /* CREATE SAFE SCREENSHOT             */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Creating safe screenshot...",
    );

    const safeScreenshot =
      await sanitizeScreenshot(
        screenshot,
        unified,
      );

    console.log(
      "[AGENT] Safe screenshot ready",
    );


    /* ---------------------------------- */
    /* UPDATE UI                          */
    /* ---------------------------------- */

    callbacks.onPerception?.({
      protectedCount,
      safeScreenshot:
        safeScreenshot.dataUrl,
    });


    /* ---------------------------------- */
    /* ASK LLM                            */
    /* ---------------------------------- */

    console.log(
      "[AGENT] Sending task to LLM...",
    );

    const decision =
      await callLLM(
        config,
        userTask,
        safeScreenshot.dataUrl,
        /*
         * Same width/height passed to executeTool below —
         * this is what lets the prompt tell the model
         * exactly what coordinate space to answer in, so
         * its x/y stay anchored to the resolution the
         * executor actually scales against.
         */
        {
          width:
            preprocessResult.originalWidth,

          height:
            preprocessResult.originalHeight,
        },
      );

    console.log(
      "[AGENT] LLM decision:",
      decision,
    );


    /* ---------------------------------- */
    /* MODEL MESSAGE                      */
    /* ---------------------------------- */

    if (decision.message) {
      callbacks.onMessage?.(
        decision.message,
      );
    }


    /* ---------------------------------- */
    /* TASK COMPLETE                      */
    /* ---------------------------------- */

    if (decision.done) {
      console.log(
        "[AGENT] ===== TASK COMPLETE =====",
      );

      return;
    }


    /* ---------------------------------- */
    /* VALIDATE TOOL                      */
    /* ---------------------------------- */

    if (
      !decision.tools ||
      decision.tools.length === 0
    ) {
      throw new Error(
        "Agent returned no tools and task is not done",
      );
    }


    /*
     * IMPORTANT:
     *
     * Execute ONLY ONE action.
     *
     * We deliberately ignore additional
     * tool calls from this LLM response.
     *
     * After this action the page may change,
     * so the next loop iteration captures
     * a completely new screenshot.
     */

    const tool =
      decision.tools[0];

    console.log(
      "[AGENT] Selected action:",
      tool.name,
      tool.arguments,
    );


    /* ---------------------------------- */
    /* EXECUTE ONE ACTION                 */
    /* ---------------------------------- */

    console.log(
      `[AGENT] Executing action at step ${step}...`,
    );

    await callbacks.executeTool(
      tool,
      {
        width:
          preprocessResult.originalWidth,

        height:
          preprocessResult.originalHeight,
      },
    );

    console.log(
      "[AGENT] Action completed:",
      tool.name,
    );


    /* ---------------------------------- */
    /* SMALL WAIT FOR DOM UPDATE           */
    /* ---------------------------------- */

    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          500,
        );
      },
    );

    console.log(
      "[AGENT] Page updated, continuing...",
    );
  }

  throw new Error(
    `Agent exceeded maximum steps (${MAX_STEPS})`,
  );
}