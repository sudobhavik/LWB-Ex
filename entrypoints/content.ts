import { runPerception } from "../dom/engine";
import {
  sanitizeWebpage,
  removeExistingSanitization,
} from "../privacy/sanatizer";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log(
      "[CONTENT] Browser Agent content script running",
    );

    browser.runtime.onMessage.addListener(
      (message, _sender, sendResponse) => {

        /* ---------------------------------- */
        /* VIEWPORT SIZE                      */
        /* ---------------------------------- */

        if (
          message.type ===
          "GET_VIEWPORT_SIZE"
        ) {
          console.log(
            "[CONTENT] Viewport:",
            window.innerWidth,
            "x",
            window.innerHeight,
          );

          sendResponse({
            width: window.innerWidth,
            height: window.innerHeight,
          });

          return;
        }


        /* ---------------------------------- */
        /* PERCEPTION                         */
        /* ---------------------------------- */

        if (
          message.type ===
          "GET_PERCEPTION"
        ) {
          try {
            const perception =
              runPerception();

            console.log(
              "[CONTENT] Perception results:",
              perception,
            );

            sendResponse(
              perception,
            );

          } catch (error) {
            console.error(
              "[CONTENT] Perception failed:",
              error,
            );

            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* SANITIZE PAGE                      */
        /* ---------------------------------- */

        if (
          message.type ===
          "SANITIZE_PAGE"
        ) {
          try {
            sanitizeWebpage(
              message.detections,
              {
                screenshotWidth:
                  message.screenshotWidth,

                screenshotHeight:
                  message.screenshotHeight,
              },
            );

            console.log(
              "[CONTENT] Actual webpage sanitized",
            );

            sendResponse({
              success: true,
            });

          } catch (error) {
            console.error(
              "[CONTENT] Sanitization failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* REMOVE SANITIZATION                */
        /* ---------------------------------- */

        if (
          message.type ===
          "REMOVE_SANITIZATION"
        ) {
          try {
            removeExistingSanitization();

            sendResponse({
              success: true,
            });

          } catch (error) {
            console.error(
              "[CONTENT] Remove sanitization failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* CLICK                               */
        /* ---------------------------------- */

        if (
          message.type ===
          "EXECUTE_CLICK"
        ) {
          try {
            const x =
              Number(message.x);

            const y =
              Number(message.y);

            if (
              !Number.isFinite(x) ||
              !Number.isFinite(y)
            ) {
              throw new Error(
                "Invalid click coordinates",
              );
            }

            const element =
              document.elementFromPoint(
                x,
                y,
              );

            if (!element) {
              throw new Error(
                `No element found at (${x}, ${y})`,
              );
            }

            console.log(
              "[EXECUTOR] Clicking:",
              element,
            );

            if (
              element instanceof HTMLElement
            ) {
              element.click();
            } else {
              throw new Error(
                "Target is not an HTMLElement",
              );
            }

            sendResponse({
              success: true,
            });

          } catch (error) {
            console.error(
              "[EXECUTOR] Click failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* TYPE                                */
        /* ---------------------------------- */

        if (
          message.type ===
          "EXECUTE_TYPE"
        ) {
          try {
            const x =
              Number(message.x);

            const y =
              Number(message.y);

            const value =
              String(
                message.value ?? "",
              );

            if (
              !Number.isFinite(x) ||
              !Number.isFinite(y)
            ) {
              throw new Error(
                "Invalid typing coordinates",
              );
            }

            const element =
              document.elementFromPoint(
                x,
                y,
              );

            if (!element) {
              throw new Error(
                `No element found at (${x}, ${y})`,
              );
            }

            console.log(
              "[EXECUTOR] Typing into:",
              element,
            );

            /* ------------------------------ */
            /* INPUT                           */
            /* ------------------------------ */

            if (
              element instanceof
              HTMLInputElement
            ) {
              element.focus();

              const setter =
                Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  "value",
                )?.set;

              setter?.call(
                element,
                value,
              );

              element.dispatchEvent(
                new Event(
                  "input",
                  {
                    bubbles: true,
                  },
                ),
              );

              element.dispatchEvent(
                new Event(
                  "change",
                  {
                    bubbles: true,
                  },
                ),
              );
            }


            /* ------------------------------ */
            /* TEXTAREA                        */
            /* ------------------------------ */

            else if (
              element instanceof
              HTMLTextAreaElement
            ) {
              element.focus();

              const setter =
                Object.getOwnPropertyDescriptor(
                  HTMLTextAreaElement.prototype,
                  "value",
                )?.set;

              setter?.call(
                element,
                value,
              );

              element.dispatchEvent(
                new Event(
                  "input",
                  {
                    bubbles: true,
                  },
                ),
              );

              element.dispatchEvent(
                new Event(
                  "change",
                  {
                    bubbles: true,
                  },
                ),
              );
            }


            /* ------------------------------ */
            /* CONTENT EDITABLE                */
            /* ------------------------------ */

            else if (
              element instanceof
                HTMLElement &&
              element.isContentEditable
            ) {
              element.focus();

              element.textContent =
                value;

              element.dispatchEvent(
                new InputEvent(
                  "input",
                  {
                    bubbles: true,

                    inputType:
                      "insertText",

                    data: value,
                  },
                ),
              );
            }


            /* ------------------------------ */
            /* INVALID TARGET                  */
            /* ------------------------------ */

            else {
              throw new Error(
                "Target is not a text input",
              );
            }

            sendResponse({
              success: true,
            });

          } catch (error) {
            console.error(
              "[EXECUTOR] Type failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* SCROLL                              */
        /* ---------------------------------- */

        if (
          message.type ===
          "EXECUTE_SCROLL"
        ) {
          try {
            const direction =
              message.direction ===
              "up"
                ? "up"
                : "down";

            const amount =
              Number(
                message.amount ?? 500,
              );

            if (
              !Number.isFinite(amount)
            ) {
              throw new Error(
                "Invalid scroll amount",
              );
            }

            const distance =
              direction === "down"
                ? Math.abs(amount)
                : -Math.abs(amount);

            console.log(
              "[EXECUTOR] Scrolling:",
              direction,
              Math.abs(amount),
            );

            window.scrollBy({
              top: distance,
              left: 0,
              behavior: "smooth",
            });

            sendResponse({
              success: true,
            });

          } catch (error) {
            console.error(
              "[EXECUTOR] Scroll failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }


        /* ---------------------------------- */
        /* WAIT                                */
        /* ---------------------------------- */

        if (
          message.type ===
          "EXECUTE_WAIT"
        ) {
          try {
            const milliseconds =
              Number(
                message.milliseconds ??
                  1000,
              );

            if (
              !Number.isFinite(
                milliseconds,
              )
            ) {
              throw new Error(
                "Invalid wait duration",
              );
            }

            const duration =
              Math.min(
                Math.max(
                  milliseconds,
                  100,
                ),
                5000,
              );

            console.log(
              "[EXECUTOR] Waiting:",
              duration,
              "ms",
            );

            setTimeout(() => {
              sendResponse({
                success: true,
              });
            }, duration);

            return true;

          } catch (error) {
            console.error(
              "[EXECUTOR] Wait failed:",
              error,
            );

            sendResponse({
              success: false,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            });
          }

          return;
        }
      },
    );
  },
});