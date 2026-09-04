---
license: cc0-1.0
task_categories:
  - object-detection
tags:
  - privacy
  - yolo
  - computer-vision
  - cybersecurity
  - pii
  - browser-automation
size_categories:
  - 1K<n<10K
---

# [SHIELD] ISRO PS171 Web Privacy & Visual Redaction Dataset

A clean, 100% synthetic and privacy-safe computer vision benchmark designed for client-side visual privacy agents and autonomous browser agents (ISRO Problem Statement SIH26171).

## [STATS] Dataset Summary
- **Total Samples**: 1,100 high-resolution 640x640 images
  - **Train Split**: 870 images (720 diverse browser dashboards/portals + 150 real human portraits)
  - **Validation Split**: 230 images (180 diverse browser dashboards/portals + 50 real human portraits)
- **Total Annotations**: 3,353 bounding boxes
- **Format**: Standard YOLO Detection Format (`class_id x_center y_center width height`)
- **Safety Compliance**: 100% Fictional brands, IANA documentation domains (`@example.com`), and officially reserved test card numbers (`4242 4242 4242 4242`) and FCC test phone blocks (`555-XXXX`).

##  Class Schema
| Class ID | Class Name | Description | Color Tag |
| :---: | :--- | :--- | :--- |
| **`0`** | `face` | Real human faces and portrait photographs |  Emerald Green |
| **`1`** | `password_field` | Password inputs, PINs, and credential masks |  Rose Red |
| **`2`** | `pii_field` | Credit cards, CVV, phone numbers, passport, Aadhaar/SSN |  Amber Orange |
| **`3`** | `sensitive_text` | Account balances, secret API tokens, date of birth |  Violet Purple |

##  Directory Layout
```text
kaggle_ps171_browser_dataset/
├── data.yaml
├── README.md
├── dataset-metadata.json
├── images/
│   ├── train/ (870 images)
│   └── val/   (230 images)
└── labels/
    ├── train/ (870 YOLO txt files)
    └── val/   (230 YOLO txt files)
```

## [RUN] Training with Ultralytics YOLO
```python
from ultralytics import YOLO

model = YOLO("yolo26n.pt")
results = model.train(
    data="data.yaml",
    epochs=40,
    imgsz=640,
    batch=16,
    device=0
)
```
