import { scanDOM } from "./scanner";
import { scanDOMForPII } from "../privacy/piiDetector";
import {
  detectFinancialData,
} from "../privacy/financialdetector";
import {
  scanVisibleText,
} from "./textscanner";
// this file contains the perception logic for the agent, which includes scanning the DOM for elements, detecting PII and financial data, and returning a structured perception result.
export interface PerceptionElement {
  type: string;

  text?: string;

  label?: string;

  role?: string;

  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  sensitive: boolean;
}

export interface PerceptionResult {
  elements: PerceptionElement[];
  sensitiveCount: number;
}

export function runPerception(): PerceptionResult {

  console.log(
    "Starting DOM perception...",
  );

  /* =====================================================
     1. NORMAL DOM ELEMENTS
     ===================================================== */

  const domElements = scanDOM();

  console.log(
    "DOM elements:",
    domElements,
  );

  const elements: PerceptionElement[] =
    domElements.map((element: any) => ({

      type: element.type,

      text:
        element.text ??
        element.innerText ??
        undefined,

      label:
        element.label ??
        element.ariaLabel ??
        element.placeholder ??
        undefined,

      role:
        element.role ??
        undefined,

      bbox: element.bbox,

      sensitive:
        element.type === "password" ||
        element.type === "email",

    }));


  /* =====================================================
     2. PII DETECTION
     ===================================================== */

  console.log(
    "Scanning page for PII...",
  );

  const piiRegions =
    scanDOMForPII();

  console.log(
    "PII regions:",
    piiRegions,
  );

  for (const region of piiRegions) {

    elements.push({

      type:
        region.type.toLowerCase(),

      text: undefined,

      label: "Sensitive information",

      role: "sensitive",

      bbox: {

        x: region.x,

        y: region.y,

        width: region.width,

        height: region.height,

      },

      sensitive: true,

    });

  }


  /* =====================================================
     3. FINANCIAL DETECTION
     ===================================================== */

  console.log(
    "Scanning page for financial data...",
  );

  const textBlocks =
    scanVisibleText();

  const financialMatches =
    detectFinancialData(
      textBlocks,
    );

  console.log(
    "Financial detections:",
    financialMatches,
  );

  for (
    const financial of financialMatches
  ) {

    elements.push({

      type:
        financial.type,

      /*
       * DO NOT expose the actual
       * financial value to the LLM.
       */
      text:
        "[REDACTED FINANCIAL DATA]",

      label:
        financial.type === "balance"
          ? "Account balance"
          : "Financial data",

      role: "sensitive",

      bbox: {

        x:
          financial.bbox.x,

        y:
          financial.bbox.y,

        width:
          financial.bbox.width,

        height:
          financial.bbox.height,

      },

      sensitive: true,

    });

  }


  /* =====================================================
     4. REMOVE DUPLICATES
     ===================================================== */

  const deduplicated =
    removeDuplicateElements(
      elements,
    );


  /* =====================================================
     5. COUNT SENSITIVE ELEMENTS
     ===================================================== */

  const sensitiveCount =
    deduplicated.filter(
      (element) =>
        element.sensitive,
    ).length;


  console.log(
    "Final DOM perception:",
    deduplicated,
  );

  console.log(
    "Sensitive count:",
    sensitiveCount,
  );


  return {

    elements:
      deduplicated,

    sensitiveCount,

  };

}


/* =======================================================
   DUPLICATE DETECTION
   ======================================================= */

function removeDuplicateElements(
  elements: PerceptionElement[],
): PerceptionElement[] {

  const result: PerceptionElement[] =
    [];

  for (const element of elements) {

    const duplicate =
      result.some(
        (existing) => {

          const sameType =
            existing.type ===
            element.type;


          const samePosition =

            Math.abs(
              existing.bbox.x -
              element.bbox.x,
            ) < 3 &&

            Math.abs(
              existing.bbox.y -
              element.bbox.y,
            ) < 3;


          const sameSize =

            Math.abs(
              existing.bbox.width -
              element.bbox.width,
            ) < 3 &&

            Math.abs(
              existing.bbox.height -
              element.bbox.height,
            ) < 3;


          /*
           * If semantic information
           * is available, compare it too.
           */

          const sameText =
            (existing.text ?? "") ===
            (element.text ?? "");


          return (

            sameType &&

            samePosition &&

            sameSize &&

            sameText

          );

        },
      );


    if (!duplicate) {

      result.push(
        element,
      );

    }

  }


  return result;

}