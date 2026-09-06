import { runPerception } from "../dom/engine";

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    console.log(
      "Browser Agent content script running",
    );
   // this is content script entry point for the browser agent extension it listens for messages from the popup script and it responds with perception data which is how many sensitive elements are detected on the page.
    browser.runtime.onMessage.addListener(
      (message, _sender, sendResponse) => {
        if (message.type === "GET_PERCEPTION") {
          const perception = runPerception();

          console.log(
            "Perception results:",
            perception,
          );

          console.log(
            "Detected elements:",
            perception.sensitiveCount,
          );

          sendResponse(perception);
        }
      },
    );
  },
});