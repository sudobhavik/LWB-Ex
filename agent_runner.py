import os
import re
import time
import json
import base64
import urllib.request
import urllib.error
import cv2
import numpy as np
from pathlib import Path
from playwright.sync_api import sync_playwright
from privacy_shield import YOLOPrivacyShield

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

def get_env_var(key, default=""):
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return os.environ.get(key, default)

API_KEY = get_env_var("GEMINI_API_KEY", "AQ.Ab8RN6Klgw2tX10HWouzLpd0DtyOnjYBahVHZ93eI1N86xua4w")
PRIMARY_MODEL = get_env_var("GEMINI_MODEL", "gemini-2.5-flash-lite")

FALLBACK_MODELS = [
    PRIMARY_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.7-flash"
]
MODELS_POOL = list(dict.fromkeys(FALLBACK_MODELS))

class AutonomousPrivacyBrowserAgent:
    def __init__(self, target_url="http://127.0.0.1:8080/site/", headless=True):
        self.target_url = target_url
        self.headless = headless
        self.shield = YOLOPrivacyShield()
        self.playwright = None
        self.browser = None
        self.page = None

    def start_browser(self):
        if self.page is not None:
            return
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=self.headless)
        context = self.browser.new_context(viewport={"width": 1024, "height": 720})
        self.page = context.new_page()
        self.page.goto(self.target_url)
        self.page.wait_for_load_state("domcontentloaded")
        print(f"[RUN] Browser launched at: {self.target_url}")

    def stop_browser(self):
        try:
            if self.browser:
                self.browser.close()
            if self.playwright:
                self.playwright.stop()
        except Exception:
            pass
        self.page = None
        self.browser = None
        self.playwright = None

    def capture_and_redact(self):
        """
        Takes raw viewport screenshot and redacts it on-device using YOLO26 + DOM exclusion filters.
        Action buttons are preserved while sensitive PII/passwords/faces are blurred.
        """
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=4000)
        except Exception:
            pass

        # 1. Query interactive buttons and navigation links from page DOM
        interactive_buttons = []
        try:
            interactive_buttons = self.page.evaluate("""() => {
                const els = document.querySelectorAll('button, a.btn, .btn, a, input[type="submit"], input[type="button"], nav a');
                return Array.from(els).map(el => {
                    const r = el.getBoundingClientRect();
                    return {
                        text: el.innerText.trim(),
                        box: [r.left, r.top, r.right, r.bottom]
                    };
                });
            }""")
        except Exception:
            pass

        # 2. Query DOM privacy anchors (e.g. face photo, password input)
        dom_anchors = []
        try:
            dom_anchors = self.page.evaluate("""() => {
                const anchors = [];
                // Face photos
                document.querySelectorAll('img[data-privacy="face"]').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 20 && r.height > 20) {
                        anchors.push({ class_id: 0, class_name: 'face', confidence: 0.99, box: [r.left, r.top, r.right, r.bottom] });
                    }
                });
                // Passwords
                document.querySelectorAll('input[type="password"]').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 10 && r.height > 10) {
                        anchors.push({ class_id: 1, class_name: 'password_field', confidence: 0.99, box: [r.left, r.top, r.right, r.bottom] });
                    }
                });
                return anchors;
            }""")
        except Exception:
            pass

        png_bytes = self.page.screenshot(type="png")
        nparr = np.frombuffer(png_bytes, np.uint8)
        raw_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        redacted_bgr, detections = self.shield.redact(
            raw_bgr,
            interactive_buttons=interactive_buttons,
            dom_anchors=dom_anchors
        )

        stats = {"face": 0, "password_field": 0, "pii_field": 0, "sensitive_text": 0}
        for d in detections:
            c = d["class_name"]
            if c in stats:
                stats[c] += 1

        return raw_bgr, redacted_bgr, detections, stats

    def ask_gemini(self, redacted_bgr, goal, history=None):
        """
        Transmits ONLY the REDACTED screenshot to Gemini Cloud VLM with multi-model automatic failover.
        Zero unredacted visual data ever leaves this device.
        """
        history = history or []
        _, buffer = cv2.imencode(".jpg", redacted_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        b64_img = base64.b64encode(buffer).decode("utf-8")

        prompt = f"""You are an autonomous browser control agent operating under ISRO Problem Statement SIH26171.
The screenshot you see has been processed by an On-Device YOLO Privacy Shield.
Regions with heavy blur and colored tags like [REDACTED_FACE], [REDACTED_PASSWORD], [REDACTED_PII], or [REDACTED_TEXT]
are intentionally concealed user data (credit cards, passwords, phone numbers, faces, balances) to guarantee ZERO PRIVACY EGRESS.

Do NOT attempt to guess or unmask the blurred content.
Observe the visible UI layout, product listings, action buttons, navigation tabs, and inputs to achieve the user goal.

USER GOAL: "{goal}"

Current URL: {self.page.url}
Recent actions taken: {history[-3:] if history else 'None'}

Decide the single next action to advance toward the goal. Prefer "click" on the visual element coordinates.
If the goal is fully achieved (e.g. Order Success screen reached, or target page reached and reviewed), set "is_task_complete": true.

Return STRICT JSON adhering to this schema:
{{
  "thought": "Analysis of the current screen, visible buttons, and reason for next step",
  "action": "click" | "type" | "navigate" | "complete",
  "coordinates": [x_norm, y_norm],
  "text_to_type": "string" (only if action is type),
  "target_description": "short description of the button/input being interacted with",
  "is_task_complete": false
}}
Note: "coordinates" are normalized floats between 0.0 and 1.0 representing [X, Y] center of the element to click.
"""

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": b64_img
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
            ]
        }

        last_error = None
        for model_name in MODELS_POOL:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )

            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    candidates = data.get("candidates", [])
                    if not candidates:
                        continue

                    parts = candidates[0].get("content", {}).get("parts", [])
                    if not parts:
                        continue

                    raw_text = parts[0].get("text", "{}").strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else ""
                    if raw_text.endswith("```"):
                        raw_text = raw_text.rsplit("```", 1)[0]
                    raw_text = raw_text.strip()

                    try:
                        res = json.loads(raw_text)
                        res["active_model"] = model_name
                        return res
                    except Exception:
                        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                        if match:
                            res = json.loads(match.group(0))
                            res["active_model"] = model_name
                            return res

            except urllib.error.HTTPError as http_err:
                last_error = http_err
                if http_err.code in (429, 503, 404):
                    print(f"[WARN] Model [{model_name}] returned HTTP {http_err.code}. Failing over to next model...")
                    continue
            except Exception as e:
                last_error = e
                print(f"[WARN] Model [{model_name}] exception: {e}. Failing over...")
                continue

        # Fallback if all models fail
        print(f"[Gemini VLM All Models Failed]: {last_error}")
        return {
            "thought": f"All VLM models temporarily busy: {str(last_error)}",
            "action": "click",
            "coordinates": [0.5, 0.5],
            "target_description": "Fallback navigation",
            "is_task_complete": False
        }

    def execute_action(self, action_data):
        """
        Executes the VLM action in the real browser with robust coordinate normalization.
        """
        action = action_data.get("action", "complete")
        raw_coords = action_data.get("coordinates", [0.5, 0.5])
        vp = self.page.viewport_size

        # Robust coordinate normalizer
        cx, cy = 0.5, 0.5
        if isinstance(raw_coords, (list, tuple)) and len(raw_coords) >= 2:
            try:
                cx = float(raw_coords[0])
                cy = float(raw_coords[1])
                # Handle 0-1000 scale or direct pixel scale
                if cx > 1.0:
                    cx = (cx / 1000.0) if cx <= 1000 else (cx / vp["width"])
                if cy > 1.0:
                    cy = (cy / 1000.0) if cy <= 1000 else (cy / vp["height"])
                cx = max(0.0, min(1.0, cx))
                cy = max(0.0, min(1.0, cy))
            except Exception:
                cx, cy = 0.5, 0.5

        px = int(cx * vp["width"])
        py = int(cy * vp["height"])

        print(f"  [FAST] Executing [{action}] on target: '{action_data.get('target_description')}' at ({px}, {py})...")

        try:
            if action == "click":
                self.page.mouse.move(px, py)
                self.page.mouse.click(px, py)
                # Ensure clickable links/buttons trigger even if pointer event needs propagation
                self.page.evaluate(f"""() => {{
                    const el = document.elementFromPoint({px}, {py});
                    if (el) {{
                        const clickable = el.closest('a, button, input[type=submit], input[type=button]') || el;
                        clickable.click();
                    }}
                }}""")
                time.sleep(1.0)
                try:
                    self.page.wait_for_load_state("domcontentloaded", timeout=3000)
                except Exception:
                    pass

            elif action == "type":
                self.page.mouse.click(px, py)
                text = action_data.get("text_to_type", "")
                self.page.keyboard.type(text)
                time.sleep(0.5)

            elif action == "navigate":
                target = action_data.get("target_description", "").strip()
                target_lower = target.lower()
                base = self.target_url.rstrip("/")
                if target.startswith("http"):
                    self.page.goto(target)
                elif "cart" in target_lower:
                    self.page.goto(f"{base}/cart")
                elif "checkout" in target_lower:
                    self.page.goto(f"{base}/checkout")
                elif "profile" in target_lower:
                    self.page.goto(f"{base}/profile")
                elif "dash" in target_lower:
                    self.page.goto(f"{base}/dashboard")
                elif "home" in target_lower or "catalog" in target_lower:
                    self.page.goto(f"{base}/")
                else:
                    self.page.mouse.move(px, py)
                    self.page.mouse.click(px, py)
                try:
                    self.page.wait_for_load_state("domcontentloaded", timeout=3000)
                except Exception:
                    pass
        except Exception as exec_err:
            print("  [WARN] Action execution note:", exec_err)

    def run_step(self, goal, history=None):
        """
        Performs one single iteration of the autonomous privacy loop.
        """
        history = history or []
        self.start_browser()

        # Step 1: Capture & On-Device Redact
        raw_bgr, redacted_bgr, detections, stats = self.capture_and_redact()

        # Step 2: Send Redacted Screen to Gemini Cloud VLM
        start_vlm = time.time()
        vlm_decision = self.ask_gemini(redacted_bgr, goal, history)
        vlm_latency_ms = int((time.time() - start_vlm) * 1000)

        # Step 3: Execute Action in Browser
        is_done = vlm_decision.get("is_task_complete", False)
        if not is_done:
            self.execute_action(vlm_decision)

        # Re-check if destination page is reached
        if "/order-success" in self.page.url:
            is_done = True
            vlm_decision["is_task_complete"] = True

        def to_b64_url(img):
            _, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            return f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

        return {
            "current_url": self.page.url,
            "raw_screenshot": to_b64_url(raw_bgr),
            "redacted_screenshot": to_b64_url(redacted_bgr),
            "detections": detections,
            "privacy_stats": stats,
            "vlm_decision": vlm_decision,
            "vlm_latency_ms": vlm_latency_ms,
            "is_complete": is_done
        }
