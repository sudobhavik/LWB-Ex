import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO

MODEL_PATH = "/home/shreyas/SIH_brain/PS171/runs/train/yolo26n_browser_augmented/weights/best.pt"

CLASS_MAP = {
    0: "face",
    1: "password_field",
    2: "pii_field",
    3: "sensitive_text"
}

CLASS_CONFIG = {
    "face": {"name": "REDACTED_FACE", "color": (16, 185, 129)},
    "password_field": {"name": "REDACTED_PASSWORD", "color": (244, 63, 94)},
    "pii_field": {"name": "REDACTED_PII", "color": (245, 158, 11)},
    "sensitive_text": {"name": "REDACTED_TEXT", "color": (139, 92, 246)}
}

class YOLOPrivacyShield:
    def __init__(self, model_path=MODEL_PATH, conf_threshold=0.30):
        print(f"[SHIELD] Loading On-Device YOLO26 Privacy Shield from: {model_path}")
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        print("[OK] Privacy Shield Ready (Zero-Egress Mode Active).")

    def redact(self, image_bgr: np.ndarray, blur_intensity=51, interactive_buttons=None, dom_anchors=None):
        """
        Detects sensitive areas and applies heavy on-device Gaussian blur + colored badges.
        Excludes interactive navigation and action buttons from blurring.
        """
        h, w = image_bgr.shape[:2]
        redacted = image_bgr.copy()
        interactive_buttons = interactive_buttons or []
        dom_anchors = dom_anchors or []

        # Run inference on native screenshot
        results = self.model.predict(source=image_bgr, conf=self.conf_threshold, verbose=False)[0]

        detections = []
        raw_boxes = []

        for box in results.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            cls_name = CLASS_MAP.get(cls_id, f"class_{cls_id}")

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            raw_boxes.append((cls_id, cls_name, conf, x1, y1, x2, y2, False))

        # Add DOM anchors (API keys, confidential balances, passwords, credit cards, faces)
        for anchor in dom_anchors:
            ax1, ay1, ax2, ay2 = map(int, anchor["box"])
            raw_boxes.append((anchor.get("class_id", 3), anchor.get("class_name", "sensitive_text"), 0.999, ax1, ay1, ax2, ay2, True))

        applied_boxes = []

        for cls_id, cls_name, conf, x1, y1, x2, y2, is_dom_anchor in raw_boxes:
            # Boundary clamp
            x1 = max(0, min(w - 1, x1))
            y1 = max(0, min(h - 1, y1))
            x2 = max(x1 + 4, min(w, x2))
            y2 = max(y1 + 4, min(h, y2))

            det_area = max(1, (x2 - x1) * (y2 - y1))

            if not is_dom_anchor:
                # 1. EXCLUSION: Never blur interactive action buttons, navigation tabs, or links
                is_button = False
                for btn in interactive_buttons:
                    bx1, by1, bx2, by2 = btn.get("box", [0, 0, 0, 0])
                    inter_x1 = max(x1, bx1)
                    inter_y1 = max(y1, by1)
                    inter_x2 = min(x2, bx2)
                    inter_y2 = min(y2, by2)
                    if inter_x2 > inter_x1 and inter_y2 > inter_y1:
                        inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
                        if (inter_area / det_area > 0.25) and (cls_name != "password_field" and cls_name != "pii_field"):
                            is_button = True
                            break

                if is_button:
                    continue

                # 2. EXCLUSION: On catalog/storefront pages, do not blur public product prices
                if cls_name == "sensitive_text" and conf < 0.80:
                    continue

            # Check duplicate overlaps
            is_dup = False
            for prev_box in applied_boxes:
                px1, py1, px2, py2 = prev_box
                ix1, iy1 = max(x1, px1), max(y1, py1)
                ix2, iy2 = min(x2, px2), min(y2, py2)
                if ix2 > ix1 and iy2 > iy1:
                    ia = (ix2 - ix1) * (iy2 - iy1)
                    if ia / det_area > 0.6:
                        is_dup = True
                        break
            if is_dup:
                continue

            applied_boxes.append((x1, y1, x2, y2))

            roi_w = x2 - x1
            roi_h = y2 - y1

            if roi_w > 2 and roi_h > 2:
                # Apply Heavy Gaussian Blur on ROI
                ksize = blur_intensity if blur_intensity % 2 != 0 else blur_intensity + 1
                roi = redacted[y1:y2, x1:x2]
                blurred_roi = cv2.GaussianBlur(roi, (ksize, ksize), 30)
                redacted[y1:y2, x1:x2] = blurred_roi

                # Draw border and badge
                cfg = CLASS_CONFIG.get(cls_name, {"name": "REDACTED", "color": (255, 255, 255)})
                color = cfg["color"]

                cv2.rectangle(redacted, (x1, y1), (x2, y2), color, 2)

                label_text = f"[{cfg['name']}]"
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.45
                thickness = 1
                (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, thickness)

                badge_y1 = max(0, y1 - th - 6)
                badge_y2 = y1
                cv2.rectangle(redacted, (x1, badge_y1), (x1 + tw + 8, badge_y2), color, -1)
                cv2.putText(redacted, label_text, (x1 + 4, badge_y2 - 4), font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

            detections.append({
                "class_id": cls_id,
                "class_name": cls_name,
                "confidence": round(conf, 4),
                "bbox": [x1, y1, x2, y2],
                "norm_bbox": [round(x1 / w, 4), round(y1 / h, 4), round(x2 / w, 4), round(y2 / h, 4)]
            })

        return redacted, detections
