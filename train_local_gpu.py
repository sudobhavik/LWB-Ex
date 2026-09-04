import os
import sys
import shutil
import torch
from ultralytics import YOLO

def main():
    print("=" * 65)
    print("[SHIELD]  ISRO PS171 Privacy Agent — Local GPU Fine-Tuning (YOLO26-nano)")
    print("=" * 65)

    if not torch.cuda.is_available():
        print("[FAIL] Error: CUDA GPU not detected!")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
    print(f"[HOT] Hardware Acceleration: {gpu_name} ({vram_gb:.2f} GB VRAM)")

    dataset_yaml = "/home/shreyas/SIH_brain/PS171/dataset_isro/data.yaml"
    base_model_path = "/home/shreyas/Downloads/yolo26n.pt"
    if not os.path.exists(base_model_path):
        base_model_path = "yolo26n.pt"

    print(f"[PACKAGE] Loading base model from: {base_model_path}")
    model = YOLO(base_model_path)

    # Train with freeze=10:
    # Freezing the first 10 layers ensures the pre-trained real-world face/person
    # detection visual filters are 100% preserved and will not overfit on web icons!
    print("\n[RUN] Starting Training on RTX 3050 with frozen visual backbone (freeze=10)...")
    results = model.train(
        data=dataset_yaml,
        epochs=40,
        patience=12,
        batch=16,
        imgsz=640,
        device=0,
        workers=4,
        amp=True,
        freeze=10,              # Preserve pre-trained visual backbone
        optimizer="AdamW",
        lr0=0.002,
        lrf=0.01,
        cos_lr=True,
        warmup_epochs=2.0,
        degrees=0.0,
        fliplr=0.5,
        flipud=0.0,
        mosaic=0.5,
        mixup=0.0,
        project="/home/shreyas/SIH_brain/PS171/runs/train",
        name="yolo26n_isro_privacy_v2",
        save=True,
        val=True,
        verbose=True
    )

    best_pt_path = "/home/shreyas/SIH_brain/PS171/runs/train/yolo26n_isro_privacy_v2/weights/best.pt"
    print(f"\n[OK] Training Complete! Best checkpoint: {best_pt_path}")

    # Export to Opset 12 ONNX
    print("\n[PACKAGE] Exporting fine-tuned model to Opset 12 ONNX for in-browser deployment...")
    trained_model = YOLO(best_pt_path)
    onnx_path = trained_model.export(
        format="onnx",
        imgsz=640,
        opset=12,
        simplify=True,
        dynamic=False
    )

    target_onnx = "/home/shreyas/SIH_brain/PS171/extension/models/yolo26n.onnx"
    shutil.copy2(onnx_path, target_onnx)
    print(f" Updated Extension ONNX Model at: {target_onnx}")

if __name__ == "__main__":
    main()
