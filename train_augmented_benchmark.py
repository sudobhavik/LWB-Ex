import os
import sys
import glob
import time
import shutil
import json
import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

BASE_DIR = "/home/shreyas/SIH_brain/PS171"
OUTPUT_DIR = os.path.join(BASE_DIR, "tested_labeled_samples")
RUNS_DIR = os.path.join(BASE_DIR, "runs", "train", "yolo26n_browser_augmented")
MODEL_EXPORT_PATH = os.path.join(BASE_DIR, "extension", "models", "yolo26n.onnx")
USER_IMG_PATH = "/home/shreyas/.gemini/antigravity-cli/brain/65ac6196-a625-43a5-8190-9deb9eee8f78/.user_uploaded/uploaded_media_1788432897420.png"

CLASS_NAMES = {
    0: "face",
    1: "password_field",
    2: "pii_field",
    3: "sensitive_text"
}

CLASS_COLORS = {
    "face": (16, 185, 129),           # Emerald Green
    "password_field": (244, 63, 94),  # Rose Red
    "pii_field": (245, 158, 11),      # Amber / Orange
    "sensitive_text": (139, 92, 246)  # Violet / Purple
}

def train_augmented_model():
    print("=" * 70)
    print("[RUN] STEP 1: Training YOLO26-nano with Advanced Computer Vision Augmentations")
    print("=" * 70)

    if not torch.cuda.is_available():
        print("[FAIL] Error: CUDA GPU not available!")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    vram = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    print(f"[HOT] Hardware: {gpu_name} ({vram:.2f} GB VRAM)")

    base_model_path = "/home/shreyas/Downloads/yolo26n.pt"
    if not os.path.exists(base_model_path):
        base_model_path = "yolo26n.pt"

    model = YOLO(base_model_path)

    # Train with geometric & photometric augmentations
    results = model.train(
        data=os.path.join(BASE_DIR, "dataset_isro", "data.yaml"),
        epochs=40,
        batch=16,
        imgsz=640,
        device=0,
        workers=4,
        amp=True,
        freeze=10,              # Keep COCO pre-trained human face & person features intact
        optimizer="AdamW",
        lr0=0.002,
        cos_lr=True,
        # ML Augmentation Hyperparameters:
        degrees=10.0,           # Image rotation (+/- 10 deg)
        translate=0.10,         # Translation (+/- 10%)
        scale=0.40,             # Scale variation (+/- 40%)
        shear=2.0,              # Shear distortion (+/- 2 deg)
        perspective=0.0001,     # Perspective distortion
        hsv_h=0.015,            # Color jitter: Hue (+/- 0.015)
        hsv_s=0.6,              # Color jitter: Saturation (+/- 0.6)
        hsv_v=0.4,              # Color jitter: Brightness/Value (+/- 0.4)
        fliplr=0.5,             # Horizontal flip (50% probability)
        mosaic=1.0,             # 4-image Mosaic composition
        mixup=0.15,             # Image Mixup blending
        project=os.path.join(BASE_DIR, "runs", "train"),
        name="yolo26n_browser_augmented",
        save=True,
        val=True,
        verbose=True
    )

    best_pt = os.path.join(RUNS_DIR, "weights", "best.pt")
    print(f"\n[OK] Training Complete! Best PyTorch model saved at: {best_pt}")

    # Export to Opset 12 ONNX
    print("\n[PACKAGE] Exporting to Opset 12 ONNX for Browser Extension...")
    trained_model = YOLO(best_pt)
    onnx_file = trained_model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False
    )

    shutil.copy2(onnx_file, MODEL_EXPORT_PATH)
    print(f" Updated Extension ONNX Model at: {MODEL_EXPORT_PATH}")
    return best_pt, MODEL_EXPORT_PATH

def generate_visual_verification_samples(onnx_path):
    print("\n" + "=" * 70)
    print(" STEP 2: Generating & Saving Visual Verification Labeled Images")
    print(f" Destination Folder: {OUTPUT_DIR}")
    print("=" * 70)

    import onnxruntime as ort

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    test_images = []

    # 1. User's uploaded screenshot
    if os.path.exists(USER_IMG_PATH):
        test_images.append(("user_screenshot_verified.jpg", USER_IMG_PATH))

    # 2. Diverse validation screens (Profile, Flight, Ecommerce, Banking, Security)
    val_screens = sorted(glob.glob(os.path.join(BASE_DIR, "dataset_isro", "images", "val", "screen_*.jpg")))
    for i, p in enumerate(val_screens[:8]):
        test_images.append((f"val_screen_{i+1:02d}.jpg", p))

    # 3. Standalone real human faces from LFW
    val_faces = sorted(glob.glob(os.path.join(BASE_DIR, "dataset_isro", "images", "val", "real_face_*.jpg")))
    for i, p in enumerate(val_faces[:4]):
        test_images.append((f"val_real_face_{i+1:02d}.jpg", p))

    saved_files = []
    print(f"Annotating {len(test_images)} test images with bounding boxes & confidence tags...")

    for save_name, img_path in test_images:
        im = Image.open(img_path).convert("RGB")
        orig_w, orig_h = im.size

        # Standard Letterbox
        scale = min(640 / orig_w, 640 / orig_h)
        nw, nh = int(orig_w * scale), int(orig_h * scale)
        pad_x = (640 - nw) // 2
        pad_y = (640 - nh) // 2

        canvas = Image.new("RGB", (640, 640), (114, 114, 114))
        canvas.paste(im.resize((nw, nh), Image.Resampling.BILINEAR), (pad_x, pad_y))

        tensor = np.transpose(np.array(canvas).astype(np.float32) / 255.0, (2, 0, 1))[np.newaxis, :, :, :]
        out = session.run(None, {"images": tensor})[0]

        draw = ImageDraw.Draw(im)
        detections_found = 0

        for i in range(300):
            b = out[0, i]
            score = b[4]
            if score >= 0.25:
                detections_found += 1
                cls_id = int(round(b[5]))
                cls_name = CLASS_NAMES.get(cls_id, f"cls_{cls_id}")
                color = CLASS_COLORS.get(cls_name, (59, 130, 246))

                # Un-letterbox
                bx1 = max(0, min(orig_w, (b[0] - pad_x) / scale))
                by1 = max(0, min(orig_h, (b[1] - pad_y) / scale))
                bx2 = max(0, min(orig_w, (b[2] - pad_x) / scale))
                by2 = max(0, min(orig_h, (b[3] - pad_y) / scale))

                # Draw bounding box
                for o in range(3):
                    draw.rectangle([bx1 - o, by1 - o, bx2 + o, by2 + o], outline=color)

                # Draw label banner
                label_text = f"{cls_name} {int(score * 100)}%"
                text_w = len(label_text) * 8 + 10
                text_h = 18
                draw.rectangle([bx1, max(0, by1 - text_h), bx1 + text_w, by1], fill=color)
                draw.text((bx1 + 4, max(0, by1 - text_h) + 2), label_text, fill=(255, 255, 255))

        dst_path = os.path.join(OUTPUT_DIR, save_name)
        im.save(dst_path, quality=95)
        saved_files.append((save_name, detections_found, dst_path))
        print(f"   Saved [{save_name}]: {detections_found} detections -> {dst_path}")

    return saved_files

def benchmark_int8_vs_fp32(best_pt, fp32_onnx_path):
    print("\n" + "=" * 70)
    print("  STEP 3: Scientific Benchmark — FP32 vs INT8 Quantization Performance")
    print("=" * 70)

    import onnx
    from onnxruntime.quantization import quantize_dynamic, QuantType
    import onnxruntime as ort

    int8_onnx_path = os.path.join(RUNS_DIR, "weights", "best_int8.onnx")

    print(" Quantizing FP32 model to INT8 (Dynamic Quantization)...")
    try:
        quantize_dynamic(
            model_input=fp32_onnx_path,
            model_output=int8_onnx_path,
            weight_type=QuantType.QUInt8
        )
        has_int8 = True
        print(f"[OK] INT8 ONNX generated at: {int8_onnx_path}")
    except Exception as e:
        print(f"[WARN] Error creating INT8 model: {e}")
        has_int8 = False

    fp32_size_mb = os.path.getsize(fp32_onnx_path) / (1024 * 1024)
    int8_size_mb = os.path.getsize(int8_onnx_path) / (1024 * 1024) if has_int8 else 0

    # Benchmark Latency on 50 runs
    sess_fp32 = ort.InferenceSession(fp32_onnx_path, providers=["CPUExecutionProvider"])
    dummy_input = np.random.randn(1, 3, 640, 640).astype(np.float32)

    # Warmup
    for _ in range(5):
        sess_fp32.run(None, {"images": dummy_input})

    t0 = time.perf_counter()
    for _ in range(50):
        sess_fp32.run(None, {"images": dummy_input})
    fp32_latency = (time.perf_counter() - t0) / 50 * 1000

    int8_latency = 0
    if has_int8:
        sess_int8 = ort.InferenceSession(int8_onnx_path, providers=["CPUExecutionProvider"])
        for _ in range(5):
            sess_int8.run(None, {"images": dummy_input})
        t0 = time.perf_counter()
        for _ in range(50):
            sess_int8.run(None, {"images": dummy_input})
        int8_latency = (time.perf_counter() - t0) / 50 * 1000

    # Validation mAP on PyTorch best model
    val_model = YOLO(best_pt)
    val_res = val_model.val(data=os.path.join(BASE_DIR, "dataset_isro", "data.yaml"), imgsz=640, batch=16, device=0)

    stats = {
        "fp32_size_mb": round(fp32_size_mb, 2),
        "int8_size_mb": round(int8_size_mb, 2) if has_int8 else None,
        "fp32_latency_ms": round(fp32_latency, 2),
        "int8_latency_ms": round(int8_latency, 2) if has_int8 else None,
        "mAP50": round(float(val_res.box.map50), 4),
        "mAP50_95": round(float(val_res.box.map), 4),
        "precision": round(float(val_res.box.mp), 4),
        "recall": round(float(val_res.box.mr), 4),
        "per_class": {
            CLASS_NAMES[i]: {
                "mAP50": round(float(val_res.box.maps[i]), 4)
            } for i in range(len(CLASS_NAMES))
        }
    }

    stats_path = os.path.join(OUTPUT_DIR, "benchmark_stats.json")
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)

    print("\n" + "=" * 70)
    print("[STATS] BENCHMARK SUMMARY & VALIDATION STATS")
    print("=" * 70)
    print(f"  • FP32 Model Size:      {stats['fp32_size_mb']} MB")
    if has_int8:
        print(f"  • INT8 Model Size:      {stats['int8_size_mb']} MB ({round((1 - int8_size_mb/fp32_size_mb)*100, 1)}% reduction)")
        print(f"  • FP32 CPU Latency:     {stats['fp32_latency_ms']} ms")
        print(f"  • INT8 CPU Latency:     {stats['int8_latency_ms']} ms")
    print(f"  • Overall Validation mAP50:    {stats['mAP50'] * 100:.2f}%")
    print(f"  • Overall Validation mAP50-95: {stats['mAP50_95'] * 100:.2f}%")
    print(f"  • Precision:                   {stats['precision'] * 100:.2f}%")
    print(f"  • Recall:                      {stats['recall'] * 100:.2f}%")
    print("\n  Per-Class mAP50:")
    for cname, cmetrics in stats["per_class"].items():
        print(f"    - {cname:18s}: {cmetrics['mAP50'] * 100:.2f}%")
    print(f"\nStats saved to: {stats_path}")
    return stats

def main():
    best_pt, fp32_onnx = train_augmented_model()
    generate_visual_verification_samples(fp32_onnx)
    benchmark_int8_vs_fp32(best_pt, fp32_onnx)

if __name__ == "__main__":
    main()
