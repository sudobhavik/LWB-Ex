import os
import sys
import glob
import json
import random
import shutil
import base64
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset_isro"
TEMPLATES_DIR = BASE_DIR / "templates_cache"
LFW_DIR = Path("/home/shreyas/scikit_learn_data/lfw_home/lfw_funneled")

# Clean & recreate directories
shutil.rmtree(DATASET_DIR, ignore_errors=True)
os.makedirs(DATASET_DIR / "images" / "train", exist_ok=True)
os.makedirs(DATASET_DIR / "images" / "val", exist_ok=True)
os.makedirs(DATASET_DIR / "labels" / "train", exist_ok=True)
os.makedirs(DATASET_DIR / "labels" / "val", exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

# 4 Privacy Classes (ISRO PS SIH26171 schema)
# 0: face (Real human faces & portrait photos)
# 1: password_field (Password inputs & credential fields)
# 2: pii_field (Credit cards, CVV, Phone numbers, Passport, Aadhaar/SSN, Bank Accounts)
# 3: sensitive_text (Confidential balances, Date of Birth, Secret tokens, API keys)

CLASS_MAP = {
    "face": 0,
    "password": 1,
    "password_field": 1,
    "pii": 2,
    "pii_field": 2,
    "sensitive_text": 3,
    "text_sensitive": 3
}

THEMES = [
    {"bg": "#ffffff", "card": "#f8fafc", "text": "#0f172a", "sub": "#64748b", "border": "#e2e8f0", "input": "#ffffff", "primary": "#2563eb", "badge": "#1e3a8a"},
    {"bg": "#0f172a", "card": "#1e293b", "text": "#f8fafc", "sub": "#94a3b8", "border": "#334155", "input": "#0b1120", "primary": "#3b82f6", "badge": "#3b82f6"},
    {"bg": "#f9fafb", "card": "#ffffff", "text": "#111827", "sub": "#6b7280", "border": "#e5e7eb", "input": "#f9fafb", "primary": "#4f46e5", "badge": "#4338ca"},
    {"bg": "#18181b", "card": "#27272a", "text": "#fafafa", "sub": "#a1a1aa", "border": "#3f3f46", "input": "#18181b", "primary": "#10b981", "badge": "#059669"},
    {"bg": "#fefefe", "card": "#f1f5f9", "text": "#334155", "sub": "#64748b", "border": "#cbd5e1", "input": "#ffffff", "primary": "#0284c7", "badge": "#0369a1"}
]

FIRST_NAMES = ["Shreyas", "Sarah", "Alex", "David", "Priya", "Rahul", "Elena", "Marcus", "Aisha", "Vikram", "Jessica", "Ananya", "Daniel"]
LAST_NAMES = ["Namdeo", "Connor", "Smith", "Sharma", "Patel", "Chen", "Johnson", "Verma", "Rodriguez", "Das", "Taylor", "Gupta", "Miller"]

def get_real_face_images():
    faces = glob.glob(f"{LFW_DIR}/**/*.jpg", recursive=True)
    random.shuffle(faces)
    print(f"[OK] Found {len(faces)} real human face photos in LFW directory.")
    return faces

def image_to_base64(img_path):
    with open(img_path, "rb") as f:
        data = f.read()
    ext = os.path.splitext(img_path)[1].lower().replace(".", "")
    if ext == "jpg": ext = "jpeg"
    return f"data:image/{ext};base64,{base64.b64encode(data).decode('utf-8')}"

# ------------------------------------------------------------------------------
# 1. Student / Professional Profile (IIT Madras / University / Job Portal style)
# ------------------------------------------------------------------------------
def template_profile_portal(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    dob = f"{random.randint(1, 28)} {random.choice(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])} {random.randint(1998, 2006)}"
    phone = f"+91{random.randint(7000000000, 9999999999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.topbar {{ display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; margin-bottom: 14px; }}
.logo-box {{ width: 36px; height: 36px; background: #854d0e; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold; font-size: 10px; }}
.profile-section {{ display: flex; gap: 16px; margin-bottom: 14px; }}
.portrait-photo {{ width: 110px; height: 130px; object-fit: cover; border-radius: 6px; border: 1px solid {theme['border']}; }}
.info-col {{ flex: 1; }}
.name {{ font-size: 18px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }}
.prog {{ font-size: 12px; color: {theme['sub']}; margin-bottom: 4px; }}
.dob-box {{ display: inline-block; background: rgba(239,68,68,0.1); padding: 3px 6px; border-radius: 4px; font-size: 11px; color: #ef4444; margin-top: 4px; }}
.section-title {{ font-size: 13px; font-weight: 700; margin: 10px 0 6px; }}
.badges-row {{ display: flex; gap: 10px; margin-bottom: 12px; }}
.badge-circle {{ width: 44px; height: 44px; border-radius: 8px; background: {theme['badge']}; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; }}
.contact-card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; }}
.phone-val {{ font-family: monospace; font-size: 13px; font-weight: 600; color: #d97706; }}
</style></head><body>
  <div class="topbar">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div class="logo-box">IITM</div>
      <div style="font-size: 13px; font-weight: 600;">Academic & Student Portal</div>
    </div>
    <div style="font-size: 11px; color: {theme['sub']};">Verified Profile</div>
  </div>
  <div class="profile-section">
    <img src="{face_b64}" class="portrait-photo" data-privacy="face" alt="Portrait">
    <div class="info-col">
      <div class="name">{user_name}</div>
      <div class="prog">Program: BS in Data Science & Applications</div>
      <div class="prog">Level: DIPLOMA CANDIDATE</div>
      <div style="margin-top: 6px;">
        <span style="font-size: 11px; color: {theme['sub']};">Date of Birth: </span>
        <span class="dob-box" data-privacy="sensitive_text">{dob}</span>
      </div>
    </div>
  </div>
  <div class="section-title">Badges & Certifications</div>
  <div class="badges-row">
    <div class="badge-circle"></div><div class="badge-circle"></div><div class="badge-circle"></div><div class="badge-circle"></div><div class="badge-circle">[RUN]</div><div class="badge-circle"></div>
  </div>
  <div class="section-title">Personal Contact Details</div>
  <div class="contact-card">
    <span style="font-size: 12px; color: {theme['sub']};">Phone number:</span>
    <span class="phone-val" data-privacy="pii">{phone}</span>
  </div>
</body></html>"""

# ------------------------------------------------------------------------------
# 2. Flight / Travel Booking (Passenger Info, Passport, Credit Card)
# ------------------------------------------------------------------------------
def template_flight_booking(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    passport = f"{random.choice(['N', 'A', 'Z', 'K'])}{random.randint(1000000, 9999999)}"
    phone = f"+1 ({random.randint(200, 999)}) {random.randint(200, 999)}-{random.randint(1000, 9999)}"
    fare = f"${random.randint(450, 1850)}.{random.randint(10, 99)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid {theme['primary']}; padding-bottom: 8px; margin-bottom: 12px; }}
.brand {{ font-size: 16px; font-weight: 800; color: {theme['primary']}; }}
.passenger-card {{ display: flex; gap: 14px; background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; margin-bottom: 12px; }}
.pass-photo {{ width: 85px; height: 105px; object-fit: cover; border-radius: 4px; }}
.form-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
.field {{ margin-bottom: 8px; }}
.label {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 3px; }}
.input {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; }}
.total-box {{ background: rgba(16,185,129,0.1); border: 1px dashed #10b981; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }}
.fare-val {{ font-size: 15px; font-weight: 700; color: #10b981; }}
</style></head><body>
  <div class="header">
    <div class="brand"> AeroGlobal Flight Booking — Passenger Confirmation</div>
    <div style="font-size: 11px; color: {theme['sub']};">PNR: #AG-7821</div>
  </div>
  <div class="passenger-card">
    <img src="{face_b64}" class="pass-photo" data-privacy="face" alt="Passenger Photo">
    <div style="flex: 1;">
      <div style="font-size: 14px; font-weight: 700;">{user_name}</div>
      <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 6px;">Seat 14B (Business Economy)</div>
      <div class="field">
        <span class="label">Passport / National ID</span>
        <input type="text" class="input" value="{passport}" data-privacy="pii">
      </div>
      <div class="field">
        <span class="label">Emergency Contact Phone</span>
        <input type="text" class="input" value="{phone}" data-privacy="pii">
      </div>
    </div>
  </div>
  <div class="form-grid">
    <div class="field">
      <span class="label">Credit Card Number</span>
      <input type="text" class="input" value="4111 8920 4491 3821" data-privacy="pii">
    </div>
    <div class="field">
      <span class="label">Security CVV</span>
      <input type="text" class="input" value="924" data-privacy="pii">
    </div>
  </div>
  <div class="total-box">
    <span style="font-size: 12px; font-weight: 600;">Total Flight Booking Cost</span>
    <span class="fare-val" data-privacy="sensitive_text">{fare}</span>
  </div>
</body></html>"""

# ------------------------------------------------------------------------------
# 3. E-Commerce & Checkout (Amazon / Flipkart / Shopify style)
# ------------------------------------------------------------------------------
def template_ecommerce(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    total = f"${random.randint(120, 2400)}.{random.randint(10, 99)}"
    phone = f"+91 {random.randint(7000, 9999)} {random.randint(100000, 999999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.nav {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; margin-bottom: 12px; }}
.nav-logo {{ font-weight: 900; font-size: 16px; color: {theme['primary']}; }}
.layout {{ display: flex; gap: 14px; }}
.cust-col {{ width: 100px; text-align: center; }}
.cust-photo {{ width: 90px; height: 115px; object-fit: cover; border-radius: 6px; margin-bottom: 4px; }}
.main-col {{ flex: 1; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; margin-bottom: 10px; }}
.field {{ margin-bottom: 8px; }}
.label {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 3px; }}
.input {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; }}
.row {{ display: flex; gap: 8px; }}
.total-banner {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }}
</style></head><body>
  <div class="nav">
    <div class="nav-logo"> PrimeStore Express Checkout</div>
    <div style="font-size: 11px; color: {theme['sub']};">Order #8839-EXP</div>
  </div>
  <div class="layout">
    <div class="cust-col">
      <img src="{face_b64}" class="cust-photo" data-privacy="face" alt="Customer Photo">
      <div style="font-size: 11px; font-weight: 600;">{user_name}</div>
    </div>
    <div class="main-col">
      <div class="card">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">Payment Credentials</div>
        <div class="field">
          <span class="label">Credit Card Number</span>
          <input type="text" class="input" value="5399 2810 0943 1892" data-privacy="pii">
        </div>
        <div class="row">
          <div class="field" style="flex: 1;">
            <span class="label">Expiry</span>
            <input type="text" class="input" value="11/28" data-privacy="pii">
          </div>
          <div class="field" style="flex: 1;">
            <span class="label">Security CVV</span>
            <input type="text" class="input" value="482" data-privacy="pii">
          </div>
        </div>
      </div>
      <div class="card">
        <div style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">Delivery Phone Contact</div>
        <input type="text" class="input" value="{phone}" data-privacy="pii">
      </div>
      <div class="total-banner">
        <span style="font-size: 12px; font-weight: 600;">Order Grand Total:</span>
        <span style="font-size: 15px; font-weight: 800; color: #ef4444;" data-privacy="sensitive_text">{total}</span>
      </div>
    </div>
  </div>
</body></html>"""

# ------------------------------------------------------------------------------
# 4. Banking & Financial Dashboard (Account balance, routing, transfer, PIN)
# ------------------------------------------------------------------------------
def template_banking(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    balance = f"${random.randint(14000, 185000):,}.{random.randint(10, 99)}"
    acc_no = f"ACCT-{random.randint(10000000, 99999999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 20px; }}
.top {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }}
.client-info {{ display: flex; align-items: center; gap: 12px; }}
.client-pic {{ width: 75px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid {theme['border']}; }}
.balance-card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 10px; padding: 14px; margin-bottom: 14px; }}
.bal-val {{ font-size: 24px; font-weight: 800; color: #10b981; font-family: monospace; }}
.transfer-form {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 10px; padding: 14px; }}
.field {{ margin-bottom: 10px; }}
.label {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 3px; }}
.input {{ width: 100%; height: 34px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 10px; color: {theme['text']}; font-size: 13px; }}
</style></head><body>
  <div class="top">
    <div class="client-info">
      <img src="{face_b64}" class="client-pic" data-privacy="face" alt="Client Face">
      <div>
        <div style="font-size: 16px; font-weight: 700;">{user_name}</div>
        <div style="font-size: 11px; color: {theme['sub']};">Apex Commercial Wealth Portal</div>
      </div>
    </div>
    <div style="font-size: 11px; color: {theme['sub']};">FDIC Insured</div>
  </div>
  <div class="balance-card">
    <div style="font-size: 11px; color: {theme['sub']};">Total Net Liquidity Balance</div>
    <div class="bal-val" data-privacy="sensitive_text">{balance}</div>
    <div style="font-size: 11px; color: {theme['sub']}; margin-top: 4px;">Primary Checking: <span style="font-family: monospace; font-weight: 600;" data-privacy="pii">{acc_no}</span></div>
  </div>
  <div class="transfer-form">
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Outgoing Wire Transfer</div>
    <div class="field">
      <span class="label">Destination Routing Number (ABA)</span>
      <input type="text" class="input" value="021000021" data-privacy="pii">
    </div>
    <div class="field">
      <span class="label">Security Authorization PIN</span>
      <input type="password" class="input" value="8492" data-privacy="password">
    </div>
  </div>
</body></html>"""

# ------------------------------------------------------------------------------
# 5. Security Credentials & Password Management (Master password, tokens)
# ------------------------------------------------------------------------------
def template_security_creds(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    recovery_phone = f"+91 {random.randint(6000, 9999)} {random.randint(100000, 999999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 22px; display: flex; flex-direction: column; justify-content: center; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 12px; padding: 20px; max-width: 480px; margin: 0 auto; width: 100%; }}
.head {{ display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }}
.admin-pic {{ width: 70px; height: 85px; object-fit: cover; border-radius: 6px; }}
.field {{ margin-bottom: 10px; }}
.label {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 3px; }}
.input {{ width: 100%; height: 34px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 10px; color: {theme['text']}; font-size: 13px; }}
.token-box {{ background: rgba(139,92,246,0.1); border: 1px solid #8b5cf6; border-radius: 4px; padding: 6px 10px; font-family: monospace; font-size: 12px; color: #8b5cf6; }}
</style></head><body>
  <div class="card">
    <div class="head">
      <img src="{face_b64}" class="admin-pic" data-privacy="face" alt="Admin Face">
      <div>
        <div style="font-size: 16px; font-weight: 700;">Account Credentials & Secrets</div>
        <div style="font-size: 11px; color: {theme['sub']};">Authorized for {user_name}</div>
      </div>
    </div>
    <div class="field">
      <span class="label">Current Master Password</span>
      <input type="password" class="input" value="Vault#SecretPassword2026" data-privacy="password">
    </div>
    <div class="field">
      <span class="label">New Master Password</span>
      <input type="password" class="input" value="Super$ecureVault2026!" data-privacy="password">
    </div>
    <div class="field">
      <span class="label">2-Factor Recovery Phone</span>
      <input type="text" class="input" value="{recovery_phone}" data-privacy="pii">
    </div>
    <div class="field">
      <span class="label">Active Session API Secret Key</span>
      <div class="token-box" data-privacy="sensitive_text">sk_live_99a84b029ff1004a8c1e</div>
    </div>
  </div>
</body></html>"""

GENERATORS = [
    template_profile_portal,
    template_flight_booking,
    template_ecommerce,
    template_banking,
    template_security_creds
]

def build_dataset(num_train=500, num_val=100):
    from playwright.sync_api import sync_playwright

    real_faces = get_real_face_images()
    print(f"[RUN] Launching Headless Chromium to generate {num_train} train + {num_val} val webpage screenshots across 5 browser domains...")

    face_idx = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 640, "height": 640})

        for split, count in [("train", num_train), ("val", num_val)]:
            print(f"\n--- Generating {count} {split} samples ---")
            for idx in range(count):
                theme = random.choice(THEMES)
                gen_fn = random.choice(GENERATORS)
                face_img_path = real_faces[face_idx % len(real_faces)]
                face_idx += 1

                try:
                    face_b64 = image_to_base64(face_img_path)
                except Exception:
                    face_b64 = ""

                html_content = gen_fn(theme, face_b64)
                html_path = TEMPLATES_DIR / f"temp_{split}_{idx}.html"
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_content)

                page.goto(f"file://{html_path}")
                page.wait_for_load_state("load")

                elements = page.query_selector_all("[data-privacy]")
                yolo_boxes = []

                for el in elements:
                    privacy_type = el.get_attribute("data-privacy")
                    cls_id = CLASS_MAP.get(privacy_type, -1)
                    if cls_id < 0:
                        continue

                    box = el.bounding_box()
                    if not box:
                        continue

                    bx = max(0, min(640, box["x"]))
                    by = max(0, min(640, box["y"]))
                    bw = max(4, min(640 - bx, box["width"]))
                    bh = max(4, min(640 - by, box["height"]))

                    xc = (bx + bw / 2.0) / 640.0
                    yc = (by + bh / 2.0) / 640.0
                    norm_w = bw / 640.0
                    norm_h = bh / 640.0

                    yolo_boxes.append((cls_id, xc, yc, norm_w, norm_h))

                img_out_path = DATASET_DIR / "images" / split / f"screen_{split}_{idx:04d}.jpg"
                lbl_out_path = DATASET_DIR / "labels" / split / f"screen_{split}_{idx:04d}.txt"

                page.screenshot(path=str(img_out_path), quality=95, type="jpeg")

                with open(lbl_out_path, "w", encoding="utf-8") as lf:
                    for cid, xc, yc, nw, nh in yolo_boxes:
                        lf.write(f"{cid} {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f}\n")

                if (idx + 1) % 50 == 0 or idx == count - 1:
                    print(f"  [{split}] Generated {idx + 1}/{count} screenshots with DOM annotations.")

        browser.close()

    # --------------------------------------------------------------------------
    # Standalone Real Faces from LFW (250 Train + 50 Val)
    # --------------------------------------------------------------------------
    print("\n--- Ingesting standalone real human face photographs ---")
    standalone_train = 250
    standalone_val = 50

    for split, max_s in [("train", standalone_train), ("val", standalone_val)]:
        for s_idx in range(max_s):
            src_face = real_faces[face_idx % len(real_faces)]
            face_idx += 1

            dst_img = DATASET_DIR / "images" / split / f"real_face_{s_idx:04d}.jpg"
            dst_lbl = DATASET_DIR / "labels" / split / f"real_face_{s_idx:04d}.txt"

            im = Image.open(src_face).convert("RGB")
            im_resized = im.resize((640, 640), Image.Resampling.BILINEAR)
            im_resized.save(dst_img, quality=95)

            with open(dst_lbl, "w") as f_out:
                f_out.write("0 0.500000 0.510000 0.480000 0.580000\n")

        print(f"  [{split}] Added {max_s} standalone real human faces.")

    # --------------------------------------------------------------------------
    # Generate data.yaml
    # --------------------------------------------------------------------------
    yaml_content = {
        "path": str(DATASET_DIR),
        "train": "images/train",
        "val": "images/val",
        "names": {
            0: "face",
            1: "password_field",
            2: "pii_field",
            3: "sensitive_text"
        }
    }
    yaml_path = DATASET_DIR / "data.yaml"
    import yaml
    with open(yaml_path, "w") as yf:
        yaml.dump(yaml_content, yf, sort_keys=False)

    print(f"\n Successfully created full dataset at {DATASET_DIR}:")
    print(f"  - Train Images: {len(os.listdir(DATASET_DIR / 'images' / 'train'))}")
    print(f"  - Val Images:   {len(os.listdir(DATASET_DIR / 'images' / 'val'))}")
    print(f"  - data.yaml:    {yaml_path}")

if __name__ == "__main__":
    build_dataset(num_train=500, num_val=100)
