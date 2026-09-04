import os
import sys
import time
import json
import threading
import urllib.request
import cv2
import numpy as np
import uvicorn


from dashboard_server import app
from privacy_shield import YOLOPrivacyShield
from agent_runner import AutonomousPrivacyBrowserAgent

print("=" * 70)
print(" ISRO PS171 AUTOMATED END-TO-END VERIFICATION TEST SUITE")
print("=" * 70)

class TestServerRunner:
    @classmethod
    def start_server(cls):
        config = uvicorn.Config(app, host="127.0.0.1", port=8080, log_level="error")
        cls.server = uvicorn.Server(config)
        cls.thread = threading.Thread(target=cls.server.run, daemon=True)
        cls.thread.start()
        time.sleep(1.5)
        print("  [OK] Dashboard Server active on http://127.0.0.1:8080")

def test_1_demo_website_routes():
    print("\n[Test 1] Verifying Demo Website Multi-Page Endpoints...")
    urls = [
        "http://127.0.0.1:8080/site/",
        "http://127.0.0.1:8080/site/cart",
        "http://127.0.0.1:8080/site/checkout",
        "http://127.0.0.1:8080/site/profile",
        "http://127.0.0.1:8080/site/dashboard"
    ]
    for u in urls:
        req = urllib.request.Request(u)
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Route {u} returned status {resp.status}"
            content = resp.read().decode("utf-8")
            assert len(content) > 500, f"Route {u} content too short"
            print(f"  • {u} -> HTTP 200 (OK)")
    print("  [OK] All 5 target website pages verified successfully!")

def test_2_yolo_privacy_shield_redaction():
    print("\n[Test 2] Testing YOLO26 On-Device Privacy Shield...")
    shield = YOLOPrivacyShield()

    # Load test sample with face and form
    sample_path = "/home/shreyas/SIH_brain/PS171/extension/assets/sample_login.jpg"
    raw_bgr = cv2.imread(sample_path)
    assert raw_bgr is not None, "Failed to load test sample image"

    redacted_bgr, dets = shield.redact(raw_bgr)
    print(f"  • Total Sensitive Detections: {len(dets)}")
    assert len(dets) > 0, "Expected at least 1 sensitive detection"

    # Verify that pixel content inside detected bounding box has been altered (blurred)
    first_det = dets[0]
    x1, y1, x2, y2 = first_det["bbox"]
    raw_patch = raw_bgr[y1:y2, x1:x2]
    redacted_patch = redacted_bgr[y1:y2, x1:x2]

    # Pixel difference must be significant due to blur
    diff = np.abs(raw_patch.astype(np.int32) - redacted_patch.astype(np.int32))
    mean_diff = np.mean(diff)
    print(f"  • ROI Pixel Modification Level: {mean_diff:.2f} (Gaussian Blur verified)")
    assert mean_diff > 5.0, "ROI was not modified by privacy redaction"
    print("  [OK] On-Device Privacy Shield correctly redacted sensitive fields!")

def test_3_gemini_vlm_cognition():
    print("\n[Test 3] Testing Cloud VLM (Google Gemini 2.5 Flash)...")
    agent = AutonomousPrivacyBrowserAgent(target_url="http://127.0.0.1:8080/site/", headless=True)
    agent.start_browser()

    raw_bgr, redacted_bgr, dets, stats = agent.capture_and_redact()
    print(f"  • Screen captured. Sensitive items shielded: {stats}")

    goal = "Proceed to checkout or payment"
    decision = agent.ask_gemini(redacted_bgr, goal)
    print("  • Gemini 2.5 Flash Response:")
    print("    - Thought:", decision.get("thought"))
    print("    - Action:", decision.get("action"))
    print("    - Target:", decision.get("target_description"))
    print("    - Coords:", decision.get("coordinates"))

    assert "thought" in decision, "VLM response missing 'thought'"
    assert "action" in decision, "VLM response missing 'action'"
    assert "coordinates" in decision, "VLM response missing 'coordinates'"
    assert len(decision["coordinates"]) == 2, "Coordinates must be [x, y]"
    assert 0.0 <= decision["coordinates"][0] <= 1.0, "x coordinate out of bounds"
    assert 0.0 <= decision["coordinates"][1] <= 1.0, "y coordinate out of bounds"
    print("  [OK] Gemini 2.5 Flash structured action validated!")

    agent.stop_browser()

def test_4_full_agent_step():
    print("\n[Test 4] Testing Full Autonomous Loop Step...")
    agent = AutonomousPrivacyBrowserAgent(target_url="http://127.0.0.1:8080/site/", headless=True)
    res = agent.run_step("Click the Aegis 4K Drone Add to Cart button")

    assert res["is_complete"] is not None
    assert "vlm_decision" in res
    assert "raw_screenshot" in res
    assert "redacted_screenshot" in res
    assert len(res["raw_screenshot"]) > 1000
    assert len(res["redacted_screenshot"]) > 1000
    print(f"  • Step successfully executed in {res['vlm_latency_ms']} ms!")
    print("  [OK] Full Autonomous Agent Step executed with complete visual feedback!")
    agent.stop_browser()

if __name__ == "__main__":
    TestServerRunner.start_server()
    test_1_demo_website_routes()
    test_2_yolo_privacy_shield_redaction()
    test_3_gemini_vlm_cognition()
    test_4_full_agent_step()
    print("\n" + "=" * 70)
    print(" ALL 4 TEST SUITES PASSED (100% SUCCESS)!")
    print("=" * 70)
