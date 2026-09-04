import os
import sys
import shutil
import torch
from ultralytics import YOLO

def main():
    print("=" * 70)
    print("[RUN] TRAINING YOLO-SMALL (YOLOv8s) ON 2,000+ DIVERSE WEB DATASET")
    print("=" * 70)

    if not torch.cuda.is_available():
        print("[FAIL] Error: CUDA GPU not detected!")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    print(f"[HOT] Hardware Acceleration: {gpu_name} ({vram_gb:.2f} GB VRAM)")

    dataset_yaml = "/home/shreyas/SIH_brain/PS171/dataset_2000_browser/dataset.yaml"
    base_model_path = "yolov8s.pt"

    print(f"[PACKAGE] Loading base model from: {base_model_path}")
    model = YOLO(base_model_path)

    print("\n[RUN] Starting GPU Training (25 epochs, batch=8, imgsz=640, FP16)...")
    results = model.train(
        data=dataset_yaml,
        epochs=25,
        patience=8,
        batch=8,
        imgsz=640,
        device=0,
        workers=4,
        amp=True,
        optimizer="AdamW",
        lr0=0.0015,
        lrf=0.01,
        cos_lr=True,
        warmup_epochs=1.5,
        degrees=0.0,
        fliplr=0.5,
        flipud=0.0,
        mosaic=0.5,
        mixup=0.0,
        project="/home/shreyas/SIH_brain/PS171/runs/train",
        name="yolov8s_browser_2000",
        save=True,
        val=True,
        verbose=True
    )

    best_pt_path = "/home/shreyas/SIH_brain/PS171/runs/train/yolov8s_browser_2000/weights/best.pt"
    print(f"\n[OK] Training Complete! Best checkpoint saved to: {best_pt_path}")

    # Export to ONNX for In-Browser WebGPU/WASM Runtime
    print("\n[FAST] Exporting trained YOLO-small to ONNX (opset 17, simplified)...")
    best_model = YOLO(best_pt_path)
    onnx_path = best_model.export(format="onnx", imgsz=640, opset=17, simplify=True)
    print(f"[OK] ONNX Exported successfully: {onnx_path}")

    # Copy to extension models directory
    ext_model_dst = "/home/shreyas/SIH_brain/PS171/extension/models/yolo26n.onnx"
    shutil.copy2(onnx_path, ext_model_dst)
    print(f"[OK] Model deployed to extension: {ext_model_dst} ({os.path.getsize(ext_model_dst) / (1024*1024):.2f} MB)")

if __name__ == "__main__":
    main()
