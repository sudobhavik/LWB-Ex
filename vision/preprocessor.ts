import * as ort from "onnxruntime-web";

const MODEL_SIZE = 640;
// this file is responsible for preprocessing the image for the yolo model and converting the model output back to the original image coordinates
export interface PreprocessResult {
  tensor: ort.Tensor;
  scale: number;
  padX: number;
  padY: number;
  originalWidth: number;
  originalHeight: number;
}
// this function takes an image source and preprocesses it for the yolo model it returns a tensor and the scale and padding used for preprocessing
export async function preprocessImage(
  imageSrc: string,
): Promise<PreprocessResult> {
  const image = await loadImage(imageSrc);

  const originalWidth = image.naturalWidth;
  const originalHeight = image.naturalHeight;

  const scale = Math.min(
    MODEL_SIZE / originalWidth,
    MODEL_SIZE / originalHeight,
  );

  const resizedWidth = Math.round(
    originalWidth * scale,
  );

  const resizedHeight = Math.round(
    originalHeight * scale,
  );

  const padX = Math.floor(
    (MODEL_SIZE - resizedWidth) / 2,
  );

  const padY = Math.floor(
    (MODEL_SIZE - resizedHeight) / 2,
  );

  const canvas = document.createElement("canvas");

  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  // YOLO letterbox background.
  ctx.fillStyle = "#808080";
  ctx.fillRect(
    0,
    0,
    MODEL_SIZE,
    MODEL_SIZE,
  );

  ctx.drawImage(
    image,
    0,
    0,
    originalWidth,
    originalHeight,
    padX,
    padY,
    resizedWidth,
    resizedHeight,
  );

  const imageData = ctx.getImageData(
    0,
    0,
    MODEL_SIZE,
    MODEL_SIZE,
  );

  const tensorData = new Float32Array(
    3 * MODEL_SIZE * MODEL_SIZE,
  );

  const channelSize =
    MODEL_SIZE * MODEL_SIZE;

  for (let y = 0; y < MODEL_SIZE; y++) {
    for (let x = 0; x < MODEL_SIZE; x++) {
      const pixelIndex =
        (y * MODEL_SIZE + x) * 4;

      const r =
        imageData.data[pixelIndex] / 255;

      const g =
        imageData.data[pixelIndex + 1] / 255;

      const b =
        imageData.data[pixelIndex + 2] / 255;

      const index =
        y * MODEL_SIZE + x;

      // HWC → CHW
      tensorData[index] = r;
      tensorData[channelSize + index] = g;
      tensorData[
        channelSize * 2 + index
      ] = b;
    }
  }

  const tensor = new ort.Tensor(
    "float32",
    tensorData,
    [1, 3, MODEL_SIZE, MODEL_SIZE],
  );

  return {
    tensor,
    scale,
    padX,
    padY,
    originalWidth,
    originalHeight,
  };
}

function loadImage(
  src: string,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        resolve(image);
      };

      image.onerror = () => {
        reject(
          new Error(
            "Failed to load screenshot",
          ),
        );
      };

      image.src = src;
    },
  );
}