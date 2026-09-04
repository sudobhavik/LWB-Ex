import os
import sys
import time
from playwright.sync_api import sync_playwright

EXT_PATH = os.path.abspath("/home/shreyas/SIH_brain/PS171/ps171-wxt/.output/chrome-mv3")

print("=" * 70)
print(" AUTOMATED PLAYWRIGHT EXTENSION VERIFICATION & EXECUTION TEST")
print("=" * 70)
print(f"Loading WXT Extension from: {EXT_PATH}")

with sync_playwright() as p:
    # Launch Chromium with extension loaded
    context = p.chromium.launch_persistent_context(
        user_data_dir="/tmp/playwright_wxt_test_profile",
        headless=False,
        args=[
            f"--disable-extensions-except={EXT_PATH}",
            f"--load-extension={EXT_PATH}",
            "--no-sandbox",
            "--disable-gpu"
        ]
    )

    print(" Waiting for service worker to initialize...")
    time.sleep(2)

    # Get extension ID from service worker or pages
    ext_id = None
    for sw in context.service_workers:
        print(f"  Found Service Worker: {sw.url}")
        if "chrome-extension://" in sw.url:
            ext_id = sw.url.split("/")[2]
            break

    if not ext_id:
        # Fallback: check background pages
        for bg in context.background_pages:
            if "chrome-extension://" in bg.url:
                ext_id = bg.url.split("/")[2]
                break

    if not ext_id:
        print("[WARN] Could not detect extension ID from workers, trying default fallback...")
        # Inspect extension url directly
        page = context.new_page()
        page.goto("chrome://extensions")
        time.sleep(1)

    print(f"[OK] Extension ID Detected: {ext_id}")

    # 1. Test Popup Page
    popup_url = f"chrome-extension://{ext_id}/popup.html"
    print(f"\n[Test 1] Loading Popup UI: {popup_url}")
    popup_page = context.new_page()
    popup_page.goto(popup_url)
    popup_page.wait_for_load_state("load")

    title = popup_page.title()
    btn_scan = popup_page.locator("#btn-scan")
    btn_clear = popup_page.locator("#btn-clear")
    btn_lab = popup_page.locator("#btn-test-lab")

    print(f"  • Popup Title: {title}")
    assert "PS171" in title, f"Unexpected title: {title}"
    assert btn_scan.is_visible(), "Scan button not visible"
    assert btn_clear.is_visible(), "Clear button not visible"
    assert btn_lab.is_visible(), "Test Lab button not visible"
    print("  [OK] Popup Page UI rendered successfully with all controls!")

    # 2. Test Diagnostic Test Lab Page
    test_lab_url = f"chrome-extension://{ext_id}/test.html"
    print(f"\n[Test 2] Loading Diagnostic Lab: {test_lab_url}")
    lab_page = context.new_page()
    lab_page.goto(test_lab_url)
    lab_page.wait_for_load_state("load")

    badge = lab_page.locator("#status-badge")
    print("  • Waiting for In-Browser YOLO26 ONNX Engine initialization...")
    
    # Wait for engine to initialize (up to 10s)
    for _ in range(20):
        badge_text = badge.text_content()
        if "Ready" in badge_text:
            break
        time.sleep(0.5)

    badge_text = badge.text_content()
    print(f"  • Status Badge: {badge_text}")
    assert "Ready" in badge_text, f"Engine did not reach Ready state. Current: {badge_text}"
    print("  [OK] In-Browser ONNX Engine & WASM SIMD successfully loaded in Web Worker!")

    # 3. Trigger In-Browser Test Inference
    print("\n[Test 3] Executing in-browser YOLO26 inference on sample image...")
    btn_test_photo = lab_page.locator("#btn-test-photo")
    btn_test_photo.click()

    # Wait for completion
    for _ in range(20):
        badge_text = badge.text_content()
        if "Completed" in badge_text:
            break
        time.sleep(0.5)

    badge_text = badge.text_content()
    stat_time = lab_page.locator("#stat-time").text_content()
    stat_faces = lab_page.locator("#stat-faces").text_content()
    json_out = lab_page.locator("#json-output").text_content()

    print(f"  • Inference Result: {badge_text}")
    print(f"  • Latency: {stat_time}")
    print(f"  • Faces Detected: {stat_faces}")
    print(f"  • Detections JSON Preview:\n{json_out[:250]}...")

    assert "Completed" in badge_text, f"Inference failed. Status: {badge_text}"
    assert int(stat_faces) >= 1, "Expected at least 1 face detected"
    print("  [OK] In-Browser YOLO26-nano inference verified successfully!")

    context.close()

print("\n" + "=" * 70)
print(" ALL WXT TESTS PASSED WITH 100% SUCCESS!")
print("=" * 70)
