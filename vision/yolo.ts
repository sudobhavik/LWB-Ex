import * as ort from "onnxruntime-web";
import type { PreprocessResult } from "./preprocessor";
// this file is responsible for loading the yolo model and running inference on it takes the preprocessed image and returns the detections

let session: ort.InferenceSession | null = null;

const extensionBaseUrl =
  `chrome-extension://${browser.runtime.id}/`;

const MODEL_URL =
  `${extensionBaseUrl}models/isro_ps171_privacy_yolo26n.onnx`;

/* =========================================================
   YOLO CLASSES
   ========================================================= */

export type VisualClass =
  | "face"
  | "password_field"
  | "pii_field";

/*
 * IMPORTANT:
 *
 * The ONNX model has 3 classes:
 *
 * 0 → face
 * 1 → password_field
 * 2 → pii_field


 */
const CLASS_NAMES: Record<
  number,
  VisualClass
> = {
  0: "face",
  1: "password_field",
  2: "pii_field",
};

const CONFIDENCE_THRESHOLD = 0.25;

/* =========================================================
   OUTPUT TYPE
   ========================================================= */

export interface VisualDetection {
  classId: number;

  type: VisualClass;

  confidence: number;

  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
}

/* =========================================================
   LOAD MODEL
   ========================================================= */

export async function loadYOLO(): Promise<ort.InferenceSession> {
  if (session) {
    return session;
  }

  console.log(
    "Loading YOLO model...",
  );

  /*
   * Tell ONNX Runtime where the WASM
   * runtime files are located.
   */
  ort.env.wasm.wasmPaths =
    `${extensionBaseUrl}ort/`;

  console.log(
    "WASM path:",
    `${extensionBaseUrl}ort/`,
  );

  console.log(
    "Model URL:",
    MODEL_URL,
  );

  session =
    await ort.InferenceSession.create(
      MODEL_URL,
      {
        executionProviders: [
          "wasm",
        ],
      },
    );

  console.log(
    "YOLO model loaded",
  );

  console.log(
    "Input names:",
    session.inputNames,
  );

  console.log(
    "Output names:",
    session.outputNames,
  );

  return session;
}

/* =========================================================
   RUN YOLO
   ========================================================= */

export async function runYOLO(
  preprocessResult: PreprocessResult,
): Promise<VisualDetection[]> {
  const {
    tensor,
    scale,
    padX,
    padY,
    originalWidth,
    originalHeight,
  } = preprocessResult;

  const model =
    await loadYOLO();

  /* -------------------------------------------------------
     INPUT
     ------------------------------------------------------- */

  const inputName =
    model.inputNames[0];

  if (!inputName) {
    throw new Error(
      "YOLO model has no input",
    );
  }

  console.log(
    "Using input:",
    inputName,
  );

  const feeds: Record<
    string,
    ort.Tensor
  > = {
    [inputName]: tensor,
  };

  /* -------------------------------------------------------
     INFERENCE
     ------------------------------------------------------- */

  const results =
    await model.run(feeds);

  console.log(
    "YOLO inference completed",
  );

  /* -------------------------------------------------------
     OUTPUT
     ------------------------------------------------------- */

  const outputName =
    model.outputNames[0];

  if (!outputName) {
    throw new Error(
      "YOLO model has no output",
    );
  }

  const output =
    results[outputName];

  if (!output) {
    throw new Error(
      `YOLO output "${outputName}" was not returned`,
    );
  }

  console.log(
    "Output dims:",
    output.dims,
  );

  const data =
    output.data as Float32Array;

  console.log(
    "Output size:",
    data.length,
  );

  /* -------------------------------------------------------
     MODEL OUTPUT
     
     [1, 300, 6]

     Each detection:
     
     [x1, y1, x2, y2, confidence, classId]
     ------------------------------------------------------- */

  const NUM_DETECTIONS = 300;

  const VALUES_PER_DETECTION = 6;

  const detections: VisualDetection[] =
    [];

  for (
    let i = 0;
    i < NUM_DETECTIONS;
    i++
  ) {
    const offset =
      i *
      VALUES_PER_DETECTION;

    const rawX1 =
      data[offset];

    const rawY1 =
      data[offset + 1];

    const rawX2 =
      data[offset + 2];

    const rawY2 =
      data[offset + 3];

    const confidence =
      data[offset + 4];

    const classId =
      Math.round(
        data[offset + 5],
      );

    /* -----------------------------------------------------
       CONFIDENCE FILTER
       ----------------------------------------------------- */

    if (
      confidence <
      CONFIDENCE_THRESHOLD
    ) {
      continue;
    }

    /* -----------------------------------------------------
       CLASS FILTER
       
       This is the critical part.
       
       class 3 = sensitive_text
       → ignored because for that we have pii detector and luhan check the resons was model was hallcuinating thats why we are ignoring it and using the pii detector instead
       
       Any unknown class
       → ignored
       ----------------------------------------------------- */

    const type =
      CLASS_NAMES[classId];

    if (!type) {
      console.log(
        "Ignoring YOLO class:",
        classId,
        "confidence:",
        confidence,
      );

      continue;
    }

    /* -----------------------------------------------------
       CONVERT 640x640 MODEL COORDINATES
       BACK TO ORIGINAL SCREENSHOT COORDINATES
       ----------------------------------------------------- */

    let x1 =
      (rawX1 - padX) /
      scale;

    let y1 =
      (rawY1 - padY) /
      scale;

    let x2 =
      (rawX2 - padX) /
      scale;

    let y2 =
      (rawY2 - padY) /
      scale;

    /* -----------------------------------------------------
       CLAMP
       ----------------------------------------------------- */

    x1 = Math.max(
      0,
      Math.min(
        originalWidth,
        x1,
      ),
    );

    y1 = Math.max(
      0,
      Math.min(
        originalHeight,
        y1,
      ),
    );

    x2 = Math.max(
      0,
      Math.min(
        originalWidth,
        x2,
      ),
    );

    y2 = Math.max(
      0,
      Math.min(
        originalHeight,
        y2,
      ),
    );

    /* -----------------------------------------------------
       SIZE
       ----------------------------------------------------- */

    const width =
      x2 - x1;

    const height =
      y2 - y1;

    if (
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }

    /* -----------------------------------------------------
       DEBUG
       ----------------------------------------------------- */

    console.log(
      "YOLO accepted detection:",
      {
        type,
        classId,
        confidence,

        raw: {
          x1: rawX1,
          y1: rawY1,
          x2: rawX2,
          y2: rawY2,
        },

        converted: {
          x1,
          y1,
          x2,
          y2,
          width,
          height,
        },

        originalImage: {
          width: originalWidth,
          height: originalHeight,
        },

        preprocessing: {
          scale,
          padX,
          padY,
        },
      },
    );

    /* -----------------------------------------------------
       SAVE DETECTION
       ----------------------------------------------------- */

    detections.push({
      classId,

      type,

      confidence,

      bbox: {
        x1,
        y1,
        x2,
        y2,
        width,
        height,
      },
    });
  }

  console.log(
    "Final YOLO detections:",
    detections,
  );

  return detections;
}