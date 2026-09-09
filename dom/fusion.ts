import type { UnifiedDetection, BoundingBox } from "./types";
import type { VisualDetection } from "../vision/yolo";
// this file is responsible for fusing the dom and vision detections into a unified format 
interface DOMDetection {
  type: string;
  bbox: BoundingBox;
  sensitive: boolean;
}
// this function takes the dom and vision detections and fuses them into a unified format it returns an array of unfied detections with the source type bbox and confidence
export function fusePerception(
  domElements: DOMDetection[],
  visualDetections: VisualDetection[],
): UnifiedDetection[] {
  const unified: UnifiedDetection[] = [];

  for (const element of domElements) {
    unified.push({
      source: "dom",
      type: element.type,
      bbox: element.bbox,
      protected: element.sensitive,
    });
  }

  for (const detection of visualDetections) {
    unified.push({
      source: "vision",
      type: detection.type,
      bbox: {
        x: detection.bbox.x1,
        y: detection.bbox.y1,
        width: detection.bbox.width,
        height: detection.bbox.height,
      },
      confidence: detection.confidence,
      protected: true,
    });
  }

  return unified;
}