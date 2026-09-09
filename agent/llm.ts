import { SYSTEM_PROMPT } from "./prompt";

import type {
  AgentDecision,
  ToolName,
} from "./agent_types";


export type LLMProvider =
  | "openai"
  | "openrouter";


export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}


/* ---------------------------------- */
/* ENDPOINT                            */
/* ---------------------------------- */

function getEndpoint(
  provider: LLMProvider,
): string {
  if (provider === "openrouter") {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  return "https://api.openai.com/v1/chat/completions";
}


/* ---------------------------------- */
/* TOOL DEFINITIONS                    */
/* ---------------------------------- */

const TOOLS = [
  {
    type: "function",

    function: {
      name: "click",

      description:
        "Click an element on the webpage using screenshot coordinates.",

      parameters: {
        type: "object",

        properties: {
          x: {
            type: "number",

            description:
              "X coordinate in the screenshot.",
          },

          y: {
            type: "number",

            description:
              "Y coordinate in the screenshot.",
          },
        },

        required: [
          "x",
          "y",
        ],

        additionalProperties: false,
      },
    },
  },


  {
    type: "function",

    function: {
      name: "type",

      description:
        "Type text into an input field using screenshot coordinates.",

      parameters: {
        type: "object",

        properties: {
          x: {
            type: "number",

            description:
              "X coordinate of the input in the screenshot.",
          },

          y: {
            type: "number",

            description:
              "Y coordinate of the input in the screenshot.",
          },

          value: {
            type: "string",

            description:
              "Text to enter into the input.",
          },
        },

        required: [
          "x",
          "y",
          "value",
        ],

        additionalProperties: false,
      },
    },
  },


  {
    type: "function",

    function: {
      name: "scroll",

      description:
        "Scroll the webpage when the required element is not visible.",

      parameters: {
        type: "object",

        properties: {
          direction: {
            type: "string",

            enum: [
              "up",
              "down",
            ],

            description:
              "Direction to scroll.",
          },

          amount: {
            type: "number",

            description:
              "Number of pixels to scroll.",
          },
        },

        required: [
          "direction",
          "amount",
        ],

        additionalProperties: false,
      },
    },
  },


  {
    type: "function",

    function: {
      name: "wait",

      description:
        "Wait for the webpage to finish loading or update.",

      parameters: {
        type: "object",

        properties: {
          milliseconds: {
            type: "number",

            description:
              "Milliseconds to wait.",
          },
        },

        required: [
          "milliseconds",
        ],

        additionalProperties: false,
      },
    },
  },
];


/* ---------------------------------- */
/* LLM RESPONSE TYPES                 */
/* ---------------------------------- */

interface LLMToolCall {
  id: string;

  type: "function";

  function: {
    name: string;

    arguments: string;
  };
}


interface LLMMessage {
  content?: string | null;

  tool_calls?: LLMToolCall[];
}


interface LLMResponse {
  choices?: Array<{
    message?: LLMMessage;
  }>;
}


/* ---------------------------------- */
/* VALIDATE TOOL NAME                 */
/* ---------------------------------- */

function isValidToolName(
  name: string,
): name is ToolName {

  return (
    name === "click" ||
    name === "type" ||
    name === "scroll" ||
    name === "wait"
  );
}


/* ---------------------------------- */
/* CALL LLM                            */
/* ---------------------------------- */

export async function callLLM(
  config: LLMConfig,
  userTask: string,
  screenshot: string,
  /*
   * The exact pixel dimensions of `screenshot` as sent
   * (i.e. preprocessResult.originalWidth/Height from the
   * caller — the same numbers passed into executeTool).
   *
   * OpenAI resizes/tiles images internally before the
   * model ever sees them (for anything above ~512px),
   * so the model has no ground truth for your original
   * capture resolution unless you state it explicitly.
   * Without this, GPT-4o's returned x/y are anchored to
   * whatever resolution OpenAI silently resized the image
   * to — which the executor's coordinate conversion has
   * no visibility into — producing a consistent scale
   * error that grows with distance from the top-left
   * origin. Stating the dimensions in the prompt is the
   * standard fix for pixel-coordinate-based vision agents.
   */
  screenshotDimensions: {
    width: number;
    height: number;
  },
): Promise<AgentDecision> {

  const endpoint =
    getEndpoint(config.provider);


  console.log(
    "[LLM] Provider:",
    config.provider,
  );

  console.log(
    "[LLM] Model:",
    config.model,
  );

  console.log(
    "[LLM] Screenshot dimensions given to model:",
    screenshotDimensions.width,
    "x",
    screenshotDimensions.height,
  );


  /* ---------------------------------- */
  /* API REQUEST                        */
  /* ---------------------------------- */

  const response =
    await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${config.apiKey}`,

          ...(config.provider ===
          "openrouter"
            ? {
                "HTTP-Referer":
                  "http://localhost",

                "X-Title":
                  "PS171 Browser Agent",
              }
            : {}),
        },


        body: JSON.stringify({

          model:
            config.model,


          messages: [

            {
              role: "system",

              content:
                SYSTEM_PROMPT,
            },


            {
              role: "user",

              content: [

                {
                  type: "text",

                  text:
  `USER TASK:\n${userTask}\n\n` +
  `IMPORTANT:\n` +
  `The image is the privacy-sanitized screenshot of the CURRENT webpage state.\n` +
  `This screenshot is EXACTLY ${screenshotDimensions.width}x${screenshotDimensions.height} pixels ` +
  `(width x height), with (0,0) at the top-left corner and (${screenshotDimensions.width},${screenshotDimensions.height}) ` +
  `at the bottom-right corner.\n` +
  `Use screenshot coordinates for all actions. Every x you return MUST be between 0 and ${screenshotDimensions.width}. ` +
  `Every y you return MUST be between 0 and ${screenshotDimensions.height}.\n` +
  `Choose ONLY THE NEXT SINGLE ACTION required to make progress.\n` +
  `Return EXACTLY ONE tool call when an action is required.\n` +
  `After the action executes, a new screenshot will be captured.\n` +
  `NEVER return multiple tool calls.\n` +
  `Do not guess elements that are not visible.\n` +
  `Do not use sensitive information that has been redacted.\n` +
  `Only perform actions required by the user's task.\n` +
  `If the task is complete, return no tool calls and set done=true.`, 

                    
                },


                {
                  type: "image_url",

                  image_url: {
                    url:
                      screenshot,

                    /*
                     * Explicit detail level instead of
                     * relying on "auto". "high" keeps
                     * the model's tiled view sharp enough
                     * to locate small UI controls; the
                     * dimension line above is what keeps
                     * its coordinate answers anchored to
                     * the original resolution regardless
                     * of how OpenAI resamples internally.
                     */
                    detail:
                      "high",
                  },
                },

              ],
            },

          ],


          tools:
            TOOLS,


          tool_choice:
            "auto",


          /*
           * IMPORTANT:
           *
           * We want GPT to return
           * multiple actions in ONE response.
           */
          parallel_tool_calls:
            true,


          temperature:
            0,

        }),
      },
    );


  /* ---------------------------------- */
  /* API ERROR                          */
  /* ---------------------------------- */

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `[LLM] Request failed: ${response.status} ${errorText}`,
    );
  }


  /* ---------------------------------- */
  /* PARSE RESPONSE                     */
  /* ---------------------------------- */

  const data =
    (await response.json()) as LLMResponse;


  const message =
    data.choices?.[0]?.message;


  if (!message) {

    throw new Error(
      "[LLM] Empty model response",
    );
  }


  /* ---------------------------------- */
  /* GET ALL TOOL CALLS                 */
  /* ---------------------------------- */

  const toolCalls =
    message.tool_calls;


  if (
    toolCalls &&
    toolCalls.length > 0
  ) {

    console.log(
      "[LLM] Total tool calls:",
      toolCalls.length,
    );


    const tools = [];


    for (
      const toolCall of toolCalls
    ) {

      const toolName =
        toolCall.function.name;


      console.log(
        "[LLM] Tool:",
        toolName,
      );


      console.log(
        "[LLM] Arguments:",
        toolCall.function.arguments,
      );


      /* ------------------------------ */
      /* VALIDATE TOOL                  */
      /* ------------------------------ */

      if (
        !isValidToolName(
          toolName,
        )
      ) {

        throw new Error(
          `[LLM] Unknown tool: ${toolName}`,
        );
      }


      /* ------------------------------ */
      /* PARSE ARGUMENTS                */
      /* ------------------------------ */

      let args: Record<
        string,
        unknown
      >;


      try {

        args =
          JSON.parse(
            toolCall.function.arguments,
          );

      } catch {

        throw new Error(
          `[LLM] Invalid tool arguments: ${toolCall.function.arguments}`,
        );
      }


      /* ------------------------------ */
      /* ADD TOOL                       */
      /* ------------------------------ */

      tools.push({

        name:
          toolName,

        arguments:
          args as any,

      });
    }


    /* -------------------------------- */
    /* RETURN ALL TOOLS                 */
    /* -------------------------------- */

    return {

      tools,

      done:
        false,

    };
  }


  /* ---------------------------------- */
  /* NO TOOL = TASK COMPLETE            */
  /* ---------------------------------- */

  console.log(
    "[LLM] No tool calls returned.",
  );


  return {

    tools: [],

    done:
      true,

    message:
      message.content ??
      "Task completed",

  };
}