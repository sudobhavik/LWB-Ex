import argparse
import base64
import io
import os
import time
import cv2
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO

app = FastAPI(
    title="PS171 Privacy Agent — YOLO26 Detection Server",
    description="Real-time screenshot inference backend for Chrome Extension using YOLO26",
    version="1.0.0"
)

# Enable CORS for Chrome Extension / Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state
MODEL = None
DEVICE = "cpu"
MODEL_PATH = "/home/shreyas/Downloads/yolo26n.pt"
CUSTOM_CLASSES = {0: "face", 1: "password_field", 2: "text_block"}

class DetectRequest(BaseModel):
    image: str  # Base64 data URL (data:image/jpeg;base64,...)
    conf_threshold: float = 0.25
    iou_threshold: float = 0.45
    return_annotated: bool = True

def load_model(path: str):
    global MODEL, DEVICE, MODEL_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model checkpoint not found at: {path}")
    
    DEVICE = "cuda:0" if torch.cuda.is_available() else "cpu"
    print(f"[RUN] Loading YOLO model from {path} on device [{DEVICE}]...")
    MODEL = YOLO(path)
    MODEL_PATH = path
    print(f"[OK] Model loaded successfully! Class count: {len(MODEL.names)}")
    if torch.cuda.is_available():
        print(f"[HOT] GPU Acceleration: {torch.cuda.get_device_name(0)}")

def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decodes a base64 or DataURL string into an OpenCV BGR numpy array."""
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    
    image_bytes = base64.b64decode(base64_str)
    image_pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_np = np.array(image_pil)
    # Convert RGB to BGR for OpenCV
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    return image_bgr

def encode_bgr_to_base64(image_bgr: np.ndarray) -> str:
    """Encodes an OpenCV BGR image to a JPEG base64 DataURL."""
    _, buffer = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_path": MODEL_PATH,
        "device": f"{torch.cuda.get_device_name(0)} (CUDA)" if torch.cuda.is_available() else "CPU",
        "cuda_available": torch.cuda.is_available(),
        "model_classes": MODEL.names if MODEL else CUSTOM_CLASSES
    }

@app.post("/detect")
def detect_screenshot(req: DetectRequest):
    if MODEL is None:
        raise HTTPException(status_code=500, detail="Model is not initialized.")

    start_time = time.time()

    try:
        image_bgr = decode_base64_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {str(e)}")

    orig_h, orig_w = image_bgr.shape[:2]

    # Run YOLO26 inference
    results = MODEL.predict(
        source=image_bgr,
        conf=req.conf_threshold,
        iou=req.iou_threshold,
        imgsz=640,
        device=DEVICE,
        verbose=False
    )

    detections = []
    annotated_bgr = image_bgr.copy() if req.return_annotated else None

    # Colors for drawing annotations (BGR)
    CLASS_COLORS = {
        0: (129, 185, 16),   # Emerald (face)
        1: (94, 63, 244),    # Rose/Red (password_field)
        2: (241, 102, 99)    # Indigo/Blue (text_block)
    }

    if results and len(results) > 0:
        result = results[0]
        boxes = result.boxes

        for i in range(len(boxes)):
            xyxy = boxes.xyxy[i].cpu().numpy().tolist()
            conf = float(boxes.conf[i].cpu().numpy())
            cls_id = int(boxes.cls[i].cpu().numpy())

            # Determine class name
            if cls_id in MODEL.names:
                cls_name = MODEL.names[cls_id]
            elif cls_id in CUSTOM_CLASSES:
                cls_name = CUSTOM_CLASSES[cls_id]
            else:
                cls_name = f"class_{cls_id}"

            # If model is 80-class COCO, map 'person' to 'face' for demonstration
            if len(MODEL.names) > 10 and cls_name == "person":
                cls_name = "face"
                cls_id = 0

            x1, y1, x2, y2 = xyxy

            # Normalized bounding box [0.0 - 1.0] for browser viewport mapping
            norm_bbox = [
                max(0.0, min(1.0, x1 / orig_w)),
                max(0.0, min(1.0, y1 / orig_h)),
                max(0.0, min(1.0, x2 / orig_w)),
                max(0.0, min(1.0, y2 / orig_h))
            ]

            detections.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                "norm_bbox": [round(n, 6) for n in norm_bbox]
            })

            # Draw visual bounding box for preview
            if req.return_annotated and annotated_bgr is not None:
                color = CLASS_COLORS.get(cls_id, (0, 255, 0))
                ix1, iy1, ix2, iy2 = int(x1), int(y1), int(x2), int(y2)
                cv2.rectangle(annotated_bgr, (ix1, iy1), (ix2, iy2), color, 2)
                
                label = f"{cls_name} {int(conf*100)}%"
                (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(annotated_bgr, (ix1, max(0, iy1 - 20)), (ix1 + lw + 6, max(20, iy1)), color, -1)
                cv2.putText(annotated_bgr, label, (ix1 + 3, max(15, iy1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    response = {
        "success": True,
        "total_detections": len(detections),
        "inference_ms": elapsed_ms,
        "image_dimensions": {"width": orig_w, "height": orig_h},
        "detections": detections,
        "annotated_image": encode_bgr_to_base64(annotated_bgr) if req.return_annotated else None
    }

    return response

def main():
    parser = argparse.ArgumentParser(description="PS171 Privacy Agent Backend Server")
    parser.add_argument("--model", type=str, default="/home/shreyas/Downloads/yolo26n.pt", help="Path to .pt model weights")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address")
    parser.add_argument("--port", type=int, default=8000, help="Port number")
    args = parser.parse_args()

    load_model(args.model)
    print(f"\n* Starting Privacy Agent Server on http://{args.host}:{args.port}")
    print(f" Chrome Extension can connect to: http://localhost:{args.port}\n")
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
