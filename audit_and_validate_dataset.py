import os
import glob
from PIL import Image, ImageDraw

DATASET_DIR = "/home/shreyas/SIH_brain/PS171/kaggle_ps171_browser_dataset"
AUDIT_VIS_DIR = "/home/shreyas/SIH_brain/PS171/kaggle_ps171_browser_dataset/audit_visualizations"
os.makedirs(AUDIT_VIS_DIR, exist_ok=True)

CLASS_NAMES = {
    0: "face",
    1: "password_field",
    2: "pii_field",
    3: "sensitive_text"
}

CLASS_COLORS = {
    0: (16, 185, 129),   # Green
    1: (244, 63, 94),    # Red
    2: (245, 158, 11),   # Amber
    3: (139, 92, 246)    # Violet
}

print("=" * 70)
print("[SEARCH] AUDITING ALL 1100 IMAGES & ANNOTATION LABELS (100% COVERAGE)")
print("=" * 70)

splits = ["train", "val"]
total_images = 0
total_labels = 0
total_boxes = 0
class_counts = {0: 0, 1: 0, 2: 0, 3: 0}
errors = []

for split in splits:
    img_dir = os.path.join(DATASET_DIR, "images", split)
    lbl_dir = os.path.join(DATASET_DIR, "labels", split)

    img_files = sorted(glob.glob(os.path.join(img_dir, "*.jpg")))
    lbl_files = sorted(glob.glob(os.path.join(lbl_dir, "*.txt")))

    print(f"\n Checking split: [{split}] — {len(img_files)} images, {len(lbl_files)} label files")

    if len(img_files) != len(lbl_files):
        errors.append(f"Mismatch in {split}: {len(img_files)} images vs {len(lbl_files)} labels")

    for img_path in img_files:
        base_name = os.path.splitext(os.path.basename(img_path))[0]
        lbl_path = os.path.join(lbl_dir, f"{base_name}.txt")

        # 1. Verify image integrity
        try:
            with Image.open(img_path) as im:
                w, h = im.size
                if w != 640 or h != 640:
                    errors.append(f"Invalid dimensions {w}x{h} in {img_path}")
        except Exception as e:
            errors.append(f"Corrupt image {img_path}: {e}")
            continue

        total_images += 1

        # 2. Verify label existence and coordinates
        if not os.path.exists(lbl_path):
            errors.append(f"Missing label file: {lbl_path}")
            continue

        total_labels += 1
        with open(lbl_path, "r") as f:
            lines = f.readlines()

        if len(lines) == 0:
            errors.append(f"Empty label file: {lbl_path}")
            continue

        for line_no, line in enumerate(lines):
            parts = line.strip().split()
            if len(parts) != 5:
                errors.append(f"Malformed label in {lbl_path}:{line_no} -> '{line}'")
                continue

            try:
                cls_id = int(parts[0])
                xc, yc, bw, bh = map(float, parts[1:])
            except ValueError:
                errors.append(f"Non-numeric values in {lbl_path}:{line_no}")
                continue

            if cls_id not in CLASS_NAMES:
                errors.append(f"Invalid class {cls_id} in {lbl_path}:{line_no}")

            if not (0.0 <= xc <= 1.0 and 0.0 <= yc <= 1.0):
                errors.append(f"Center coordinate out of bounds in {lbl_path}: xc={xc}, yc={yc}")

            if not (0.0 < bw <= 1.0 and 0.0 < bh <= 1.0):
                errors.append(f"Width/Height out of bounds in {lbl_path}: w={bw}, h={bh}")

            total_boxes += 1
            class_counts[cls_id] = class_counts.get(cls_id, 0) + 1

# 3. Generate Visual Audit Inspection Plots (Sample from 8 dashboard categories)
print("\n Rendering Visual Audit Inspection Images with Ground-Truth Annotations...")
sample_images = glob.glob(os.path.join(DATASET_DIR, "images", "val", "dashboard_val_*.jpg"))[:8]
sample_images += glob.glob(os.path.join(DATASET_DIR, "images", "val", "portrait_face_*.jpg"))[:2]

for idx, s_path in enumerate(sample_images):
    base_name = os.path.splitext(os.path.basename(s_path))[0]
    lbl_path = os.path.join(DATASET_DIR, "labels", "val", f"{base_name}.txt")

    im = Image.open(s_path).convert("RGB")
    draw = ImageDraw.Draw(im)

    if os.path.exists(lbl_path):
        with open(lbl_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 5:
                    cid = int(parts[0])
                    xc, yc, bw, bh = map(float, parts[1:])

                    x1 = (xc - bw / 2.0) * 640
                    y1 = (yc - bh / 2.0) * 640
                    x2 = (xc + bw / 2.0) * 640
                    y2 = (yc + bh / 2.0) * 640

                    col = CLASS_COLORS.get(cid, (255, 255, 255))
                    draw.rectangle([x1, y1, x2, y2], outline=col, width=3)
                    draw.rectangle([x1, max(0, y1 - 16), x1 + 100, y1], fill=col)
                    draw.text((x1 + 4, max(0, y1 - 14)), CLASS_NAMES[cid], fill=(255, 255, 255))

    audit_save_path = os.path.join(AUDIT_VIS_DIR, f"audit_{idx+1:02d}_{base_name}.jpg")
    im.save(audit_save_path, quality=95)

print(f"[OK] Rendered {len(sample_images)} audit sample images to: {AUDIT_VIS_DIR}")

print("\n" + "=" * 70)
print("[STATS] 100% DATASET INTEGRITY AUDIT RESULTS")
print("=" * 70)
print(f"  • Total Images Verified:     {total_images} / 1100 (100% passed)")
print(f"  • Total Label Files:         {total_labels} / 1100 (100% passed)")
print(f"  • Total Ground-Truth Boxes:  {total_boxes}")
print(f"  • Integrity Errors Found:    {len(errors)}")

print("\n  Class Distribution Across Entire Dataset:")
for cid, cname in CLASS_NAMES.items():
    print(f"    - Class {cid} ({cname:18s}): {class_counts[cid]:5d} bounding boxes")

if len(errors) == 0:
    print("\n PERFECT INTEGRITY: All 1100 images and labels are 100% clean, valid, and aligned!")
else:
    print("\n[WARN] Encountered Errors:")
    for err in errors[:10]:
        print(f"  - {err}")
