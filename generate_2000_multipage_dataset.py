import os
import sys
import glob
import random
import shutil
import base64
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset_2000_browser"
LFW_DIR = Path("/home/shreyas/scikit_learn_data/lfw_home/lfw_funneled")

CLASS_MAP = {
    "face": 0,
    "input": 1,
    "text": 2
}

ORGS = [
    "Nexus Global Technologies", "Aegis Autonomous Labs", "Horizon Financial Core",
    "Apex Cybernetic Systems", "Astra Space Telemetry", "Zenith Edge Compute",
    "Quantum Field Networks", "Vanguard Defense Logistics", "Krypton Cloud Engine"
]

FIRST_NAMES = ["Jordan", "Casey", "Taylor", "Morgan", "Samira", "Elena", "Marcus", "Alex", "Devon", "Avery", "Riley", "Logan", "Kai"]
LAST_NAMES = ["Rivera", "Chen", "Brooks", "Vance", "Miller", "Rostova", "Patel", "Kowalski", "Kim", "Nielsen", "Alvarez", "Sinclair"]

THEMES = [
    {"bg": "#000000", "card": "#111111", "text": "#ffffff", "sub": "#888888", "border": "#262626", "input": "#080808", "btn": "#ffffff", "btn_txt": "#000000"},
    {"bg": "#0a0a0a", "card": "#141414", "text": "#f5f5f5", "sub": "#737373", "border": "#262626", "input": "#0f0f0f", "btn": "#f5f5f5", "btn_txt": "#000000"},
    {"bg": "#ffffff", "card": "#f8fafc", "text": "#0f172a", "sub": "#64748b", "border": "#e2e8f0", "input": "#ffffff", "btn": "#0f172a", "btn_txt": "#ffffff"},
    {"bg": "#121212", "card": "#1e1e1e", "text": "#e0e0e0", "sub": "#9e9e9e", "border": "#333333", "input": "#181818", "btn": "#e0e0e0", "btn_txt": "#121212"},
    {"bg": "#0f172a", "card": "#1e293b", "text": "#f8fafc", "sub": "#94a3b8", "border": "#334155", "input": "#0b1120", "btn": "#38bdf8", "btn_txt": "#0b1120"}
]

def load_lfw_faces():
    faces = glob.glob(f"{LFW_DIR}/**/*.jpg", recursive=True)
    random.shuffle(faces)
    print(f"[OK] Loaded {len(faces)} LFW face portraits.")
    return faces

def img_to_b64(path):
    with open(path, "rb") as f:
        data = f.read()
    return f"data:image/jpeg;base64,{base64.b64encode(data).decode('utf-8')}"

# ==============================================================================
# 15 DIVERSE REAL-WORLD WEB ARCHETYPES
# ==============================================================================

# 1. E-Commerce Product Catalog
def tmpl_ecommerce_catalog(theme, face_b64):
    price1 = f"${random.randint(120, 1899)}.00"
    price2 = f"${random.randint(45, 450)}.00"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 16px; }}
.nav {{ display: flex; justify-content: space-between; border-bottom: 1px solid {theme['border']}; padding-bottom: 10px; margin-bottom: 12px; }}
.search {{ width: 220px; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 12px; }}
.tag {{ display: inline-block; padding: 2px 6px; background: {theme['input']}; border: 1px solid {theme['border']}; font-size: 10px; margin-bottom: 6px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 8px 12px; font-weight: 700; border: none; font-size: 11px; cursor: pointer; text-transform: uppercase; }}
</style></head><body>
  <div class="nav">
    <div style="font-weight: 800; text-transform: uppercase;">NEXUS // HARDWARE CATALOG</div>
    <input type="text" class="search" placeholder="Search payloads..." value="Payload Sensors" data-yolo="input">
  </div>
  <div class="grid">
    <div class="card">
      <div class="tag">VISION PAYLOAD</div>
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase;" data-yolo="text">Aegis 4K Optical Drone</div>
      <div style="color: {theme['sub']}; font-size: 11px; margin: 6px 0;" data-yolo="text">Autonomous visual tracking node with thermal link.</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span style="font-size: 16px; font-weight: 800;" data-yolo="text">{price1}</span>
        <button class="btn" data-yolo="text">Add to Cart</button>
      </div>
    </div>
    <div class="card">
      <div class="tag">RADIO TELEMETRY</div>
      <div style="font-size: 13px; font-weight: 700; text-transform: uppercase;" data-yolo="text">S-Band Ground Receiver</div>
      <div style="color: {theme['sub']}; font-size: 11px; margin: 6px 0;" data-yolo="text">Sub-orbital spatial link with cryptographic encryption.</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <span style="font-size: 16px; font-weight: 800;" data-yolo="text">{price2}</span>
        <button class="btn" data-yolo="text">Add to Cart</button>
      </div>
    </div>
  </div>
</body></html>"""

# 2. Product Detail Page (PDP)
def tmpl_product_detail(theme, face_b64):
    sku = f"NX-HDW-{random.randint(1000, 9999)}"
    price = f"${random.randint(850, 2400)}.00"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.box {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; margin-bottom: 12px; }}
.tbl {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }}
.tbl td {{ border: 1px solid {theme['border']}; padding: 6px 10px; }}
.qty {{ width: 60px; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; text-align: center; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px 18px; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 6px;">CATALOG // SENSORS // {sku}</div>
  <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;" data-yolo="text">Quantum Edge CyberDeck Station</div>
  <div class="box">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 22px; font-weight: 800;" data-yolo="text">{price}</span>
      <div style="display: flex; gap: 8px;">
        <input type="number" class="qty" value="1" data-yolo="input">
        <button class="btn" data-yolo="text">Add to Cart</button>
      </div>
    </div>
  </div>
  <div class="box">
    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Technical Specification</div>
    <table class="tbl">
      <tr><td>Architecture</td><td data-yolo="text">RISC-V Cryptographic Core</td></tr>
      <tr><td>Telemetry Range</td><td data-yolo="text">120 km High-Bandwidth Line-of-Sight</td></tr>
      <tr><td>Power Envelope</td><td data-yolo="text">18W Continuous Field Operation</td></tr>
    </table>
  </div>
</body></html>"""

# 3. Shopping Cart Manifest
def tmpl_cart_manifest(theme, face_b64):
    subtotal = f"${random.randint(450, 1950)}.00"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 16px; }}
.item {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }}
.sum {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; margin-top: 14px; }}
.promo {{ width: 140px; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px 16px; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px;">Order Manifest (Cart Review)</div>
  <div class="item">
    <div>
      <div style="font-weight: 700;" data-yolo="text">Aegis 4K Vision Drone</div>
      <div style="font-size: 11px; color: {theme['sub']};">SKU: NX-4K-DRONE • Qty: 1</div>
    </div>
    <div style="font-size: 16px; font-weight: 800;" data-yolo="text">{subtotal}</div>
  </div>
  <div class="sum">
    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
      <span>Voucher Code:</span>
      <input type="text" class="promo" value="DEFENSE10" data-yolo="input">
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 1px solid {theme['border']}; padding-top: 10px;">
      <span>TOTAL DUE:</span>
      <span data-yolo="text">{subtotal}</span>
    </div>
    <button class="btn" style="width: 100%; margin-top: 12px;" data-yolo="text">Proceed to Checkout</button>
  </div>
</body></html>"""

# 4. Multi-Step Checkout
def tmpl_checkout_payment(theme, face_b64):
    name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 16px; }}
.box {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 12px; margin-bottom: 10px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; margin-bottom: 8px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px; width: 100%; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div style="font-size: 16px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">Checkout // Dispatch Details</div>
  <div class="box">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">RECIPIENT NAME</div>
    <input type="text" class="inp" value="{name}" data-yolo="input">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">SHIPPING DESTINATION</div>
    <input type="text" class="inp" value="450 Innovation Parkway, Suite 800" data-yolo="input">
  </div>
  <div class="box">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">CONTACT TELEPHONE</div>
    <input type="text" class="inp" value="+1 (555) 234-8901" data-yolo="input">
  </div>
  <button class="btn" data-yolo="text">Continue to Payment</button>
</body></html>"""

# 5. Stripe / Razorpay Payment Modal
def tmpl_stripe_modal(theme, face_b64):
    card_num = f"4242 {random.randint(1000, 9999)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}"
    cvv = f"{random.randint(100, 999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 20px; }}
.modal {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 18px; }}
.inp {{ width: 100%; height: 36px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 10px; margin-bottom: 10px; font-size: 13px; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 12px; width: 100%; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div class="modal">
    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid {theme['border']}; padding-bottom: 6px;">Stripe Encrypted Terminal</div>
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">CREDIT CARD NUMBER</div>
    <input type="text" class="inp" value="{card_num}" data-yolo="input">
    <div class="grid">
      <div>
        <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">EXPIRATION</div>
        <input type="text" class="inp" value="12/28" data-yolo="input">
      </div>
      <div>
        <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">SECURITY CVC</div>
        <input type="password" class="inp" value="{cvv}" data-yolo="input">
      </div>
    </div>
    <button class="btn" data-yolo="text">Confirm Card Charge</button>
  </div>
</body></html>"""

# 6. Bank Wire & Routing Gateway
def tmpl_bank_wire_gateway(theme, face_b64):
    iban = f"US89BANK{random.randint(1000000000, 9999999999)}"
    swift = f"SWIFT{random.randint(100, 999)}XX"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.box {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; margin-bottom: 12px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; margin-bottom: 8px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px; width: 100%; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Interbank Settlement Gateway</div>
  <div class="box">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">BENEFICIARY IBAN / ACCOUNT</div>
    <input type="text" class="inp" value="{iban}" data-yolo="input">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">ROUTING / SWIFT CODE</div>
    <input type="text" class="inp" value="{swift}" data-yolo="input">
  </div>
  <button class="btn" data-yolo="text">Initiate Wire Protocol</button>
</body></html>"""

# 7. Authentication (Login / Register)
def tmpl_auth_login_signup(theme, face_b64):
    uname = f"user_{random.randint(100, 999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 24px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 18px; max-width: 440px; margin: 40px auto; }}
.inp {{ width: 100%; height: 34px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; margin-bottom: 10px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px; width: 100%; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div class="card">
    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; border-bottom: 1px solid {theme['border']}; padding-bottom: 6px;">Nexus Identity Portal</div>
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">ACCOUNT IDENTIFIER</div>
    <input type="text" class="inp" value="{uname}" data-yolo="input">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">AUTHENTICATION KEY (PASSWORD)</div>
    <input type="password" class="inp" value="Secr3tP@ssw0rd!" data-yolo="input">
    <button class="btn" data-yolo="text">Authenticate Session</button>
  </div>
</body></html>"""

# 8. Two-Factor Authentication (2FA)
def tmpl_two_factor_auth(theme, face_b64):
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 24px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 18px; max-width: 440px; margin: 40px auto; }}
.otp-box {{ display: flex; gap: 8px; justify-content: center; margin: 16px 0; }}
.digit {{ width: 38px; height: 44px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; text-align: center; font-size: 18px; font-weight: 800; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 10px; width: 100%; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div class="card">
    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">Two-Factor Verification (2FA)</div>
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 12px;" data-yolo="text">Enter the 6-digit cryptographic TOTP token from your authenticator.</div>
    <div class="otp-box">
      <input type="text" class="digit" value="8" data-yolo="input">
      <input type="text" class="digit" value="4" data-yolo="input">
      <input type="text" class="digit" value="2" data-yolo="input">
      <input type="text" class="digit" value="9" data-yolo="input">
      <input type="text" class="digit" value="0" data-yolo="input">
      <input type="text" class="digit" value="1" data-yolo="input">
    </div>
    <button class="btn" data-yolo="text">Verify Token</button>
  </div>
</body></html>"""

# 9. User Profile & Account Settings
def tmpl_user_profile(theme, face_b64):
    name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    email = f"{name.lower().replace(' ', '.')}@enterprise.gov"
    phone = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; margin-bottom: 12px; }}
.top {{ display: flex; gap: 14px; align-items: center; }}
.avatar {{ width: 70px; height: 85px; object-fit: cover; border: 1px solid {theme['border']}; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 8px; margin-bottom: 8px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 8px 14px; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div class="card">
    <div class="top">
      <img src="{face_b64}" class="avatar" data-yolo="face" alt="User Avatar">
      <div>
        <div style="font-size: 15px; font-weight: 800;" data-yolo="text">{name}</div>
        <div style="font-size: 11px; color: {theme['sub']};">Primary Security Clearance</div>
      </div>
    </div>
  </div>
  <div class="card">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">OFFICIAL EMAIL</div>
    <input type="text" class="inp" value="{email}" data-yolo="input">
    <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 4px;">CELLULAR NUMBER</div>
    <input type="text" class="inp" value="{phone}" data-yolo="input">
    <button class="btn" data-yolo="text">Save Profile</button>
  </div>
</body></html>"""

# 10. Enterprise Treasury Ledger
def tmpl_treasury_dashboard(theme, face_b64):
    mrr = f"${random.randint(120, 580):,},{random.randint(100, 999)}.00"
    reserves = f"${random.randint(450, 980):,},{random.randint(100, 999)}.00"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; }}
.num {{ font-size: 22px; font-weight: 800; margin-top: 6px; }}
.tbl {{ width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }}
.tbl td {{ border: 1px solid {theme['border']}; padding: 6px; }}
</style></head><body>
  <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Executive Treasury & Ledger Analytics</div>
  <div class="grid">
    <div class="card">
      <div style="font-size: 11px; color: {theme['sub']};">MONTHLY RECURRING REVENUE (MRR)</div>
      <div class="num" data-yolo="text">{mrr}</div>
    </div>
    <div class="card">
      <div style="font-size: 11px; color: {theme['sub']};">TREASURY CASH RESERVES</div>
      <div class="num" data-yolo="text">{reserves}</div>
    </div>
  </div>
  <div class="card">
    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase;">Recent Transaction Ledger</div>
    <table class="tbl">
      <tr><td>TX-9921</td><td data-yolo="text">Satellite Payload Grant</td><td data-yolo="text">$45,000.00</td></tr>
      <tr><td>TX-9922</td><td data-yolo="text">Defense Sub-System Lease</td><td data-yolo="text">$18,200.00</td></tr>
    </table>
  </div>
</body></html>"""

# 11. Developer API Key Portal
def tmpl_api_key_portal(theme, face_b64):
    token = f"live_sk_sec_{random.randint(100000, 999999)}_token_xyz"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; margin-bottom: 12px; }}
.token {{ background: {theme['input']}; border: 1px solid {theme['border']}; padding: 10px; font-size: 12px; margin: 8px 0; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 8px 14px; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Developer API Credentials</div>
  <div class="card">
    <div style="font-size: 11px; color: {theme['sub']};">PRODUCTION SECRET AUTH TOKEN</div>
    <div class="token" data-yolo="text">{token}</div>
    <button class="btn" data-yolo="text">Regenerate Token</button>
  </div>
</body></html>"""

# 12. Cloud SaaS Server Fleet
def tmpl_saas_server_fleet(theme, face_b64):
    ip1 = f"192.168.1.{random.randint(10, 254)}"
    ip2 = f"10.0.4.{random.randint(10, 254)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; }}
.tbl {{ width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }}
.tbl td {{ border: 1px solid {theme['border']}; padding: 8px; }}
</style></head><body>
  <div style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px;">Active Node Cluster Fleet</div>
  <div class="card">
    <table class="tbl">
      <tr><td>CLUSTER-ALPHA</td><td data-yolo="text">{ip1}</td><td data-yolo="text">ONLINE (99.98%)</td></tr>
      <tr><td>CLUSTER-BETA</td><td data-yolo="text">{ip2}</td><td data-yolo="text">RUNNING (42 Nodes)</td></tr>
    </table>
  </div>
</body></html>"""

# 13. Search Engine Results Page (SERP)
def tmpl_search_engine_results(theme, face_b64):
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.inp {{ width: 100%; height: 36px; background: {theme['input']}; border: 1px solid {theme['border']}; color: {theme['text']}; padding: 0 10px; margin-bottom: 14px; }}
.res {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 12px; margin-bottom: 10px; }}
</style></head><body>
  <input type="text" class="inp" value="autonomous privacy preserving agent webgpu onnx" data-yolo="input">
  <div class="res">
    <div style="font-size: 13px; font-weight: 800; text-decoration: underline;" data-yolo="text">On-Device Visual Perception for Light-weight Browser Agents</div>
    <div style="font-size: 11px; color: {theme['sub']}; margin-top: 4px;" data-yolo="text">Client-side architecture where a local vision model reads screen states and sanitizes PII before cloud transit.</div>
  </div>
</body></html>"""

# 14. Tech Blog / Developer Documentation
def tmpl_tech_documentation(theme, face_b64):
    author = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 14px; }}
.code {{ background: {theme['input']}; border: 1px solid {theme['border']}; padding: 10px; font-size: 11px; margin: 10px 0; }}
.auth {{ display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }}
.pic {{ width: 45px; height: 55px; object-fit: cover; border: 1px solid {theme['border']}; }}
</style></head><body>
  <div class="card">
    <div class="auth">
      <img src="{face_b64}" class="pic" data-yolo="face" alt="Author">
      <div>
        <div style="font-size: 13px; font-weight: 800;" data-yolo="text">{author}</div>
        <div style="font-size: 10px; color: {theme['sub']};">Core Systems Engineer</div>
      </div>
    </div>
    <div style="font-size: 14px; font-weight: 800; text-transform: uppercase;" data-yolo="text">Deploying ONNX Runtime Web with WebGPU in MV3 Extensions</div>
    <div class="code" data-yolo="text">const session = await ort.InferenceSession.create('model.onnx', {{ executionProviders: ['webgpu'] }});</div>
  </div>
</body></html>"""

# 15. B2B Invoice / Order Confirmation Receipt
def tmpl_invoice_order_receipt(theme, face_b64):
    inv = f"INV-2026-{random.randint(10000, 99999)}"
    total = f"${random.randint(1200, 8900)}.00"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; padding: 16px; }}
.tbl {{ width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0; }}
.tbl td {{ border: 1px solid {theme['border']}; padding: 8px; }}
.btn {{ background: {theme['btn']}; color: {theme['btn_txt']}; padding: 8px 14px; font-weight: 800; border: none; text-transform: uppercase; cursor: pointer; }}
</style></head><body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px;">
      <span style="font-weight: 800; text-transform: uppercase;">TAX INVOICE RECEIPT</span>
      <span style="font-size: 11px; color: {theme['sub']};">{inv}</span>
    </div>
    <table class="tbl">
      <tr><td>Aegis 4K Optical Drone Fleet Kit</td><td data-yolo="text">{total}</td></tr>
    </table>
    <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 16px;">
      <span>TOTAL PAID:</span>
      <span data-yolo="text">{total}</span>
    </div>
    <button class="btn" style="margin-top: 12px;" data-yolo="text">Download Cryptographic Receipt</button>
  </div>
</body></html>"""

TEMPLATES = [
    tmpl_ecommerce_catalog,
    tmpl_product_detail,
    tmpl_cart_manifest,
    tmpl_checkout_payment,
    tmpl_stripe_modal,
    tmpl_bank_wire_gateway,
    tmpl_auth_login_signup,
    tmpl_two_factor_auth,
    tmpl_user_profile,
    tmpl_treasury_dashboard,
    tmpl_api_key_portal,
    tmpl_saas_server_fleet,
    tmpl_search_engine_results,
    tmpl_tech_documentation,
    tmpl_invoice_order_receipt
]

def generate_dataset(num_samples=2000, train_ratio=0.9):
    shutil.rmtree(DATASET_DIR, ignore_errors=True)
    os.makedirs(DATASET_DIR / "images" / "train", exist_ok=True)
    os.makedirs(DATASET_DIR / "images" / "val", exist_ok=True)
    os.makedirs(DATASET_DIR / "labels" / "train", exist_ok=True)
    os.makedirs(DATASET_DIR / "labels" / "val", exist_ok=True)

    faces = load_lfw_faces()
    print(f"[RUN] Generating {num_samples} diverse unique web screenshots across 15 archetypes...")

    num_train = int(num_samples * train_ratio)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        )
        page = browser.new_page(viewport={"width": 640, "height": 640})

        for i in range(num_samples):
            split = "train" if i < num_train else "val"
            theme = random.choice(THEMES)
            face_img = faces[i % len(faces)]
            face_b64 = img_to_b64(face_img)

            tmpl_fn = TEMPLATES[i % len(TEMPLATES)]
            html_content = tmpl_fn(theme, face_b64)

            page.set_content(html_content)

            # Extract bounding boxes from DOM
            boxes = page.evaluate("""() => {
                const vWidth = window.innerWidth;
                const vHeight = window.innerHeight;
                const items = [];
                document.querySelectorAll('[data-yolo]').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 8 && r.height > 8 && el.offsetParent !== null) {
                        const type = el.getAttribute('data-yolo');
                        let cid = 2;
                        if (type === 'face') cid = 0;
                        else if (type === 'input') cid = 1;
                        else if (type === 'text') cid = 2;

                        const cx = Math.max(0, Math.min(1, (r.left + r.width / 2) / vWidth));
                        const cy = Math.max(0, Math.min(1, (r.top + r.height / 2) / vHeight));
                        const w = Math.max(0, Math.min(1, r.width / vWidth));
                        const h = Math.max(0, Math.min(1, r.height / vHeight));
                        items.push(`${cid} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`);
                    }
                });
                return items;
            }""")

            img_name = f"web_{split}_{i:05d}.jpg"
            lbl_name = f"web_{split}_{i:05d}.txt"

            img_path = str(DATASET_DIR / "images" / split / img_name)
            lbl_path = str(DATASET_DIR / "labels" / split / lbl_name)

            page.screenshot(path=img_path, quality=90, type="jpeg")

            with open(lbl_path, "w") as f:
                f.write("\n".join(boxes) + "\n")

            if (i + 1) % 100 == 0 or i == num_samples - 1:
                print(f"  [{i+1}/{num_samples}] Processed {img_name} ({len(boxes)} bounding boxes)")

        browser.close()

    # Create dataset.yaml
    yaml_content = f"""path: {DATASET_DIR}
train: images/train
val: images/val

names:
  0: face
  1: input_field
  2: text_block
"""
    yaml_path = DATASET_DIR / "dataset.yaml"
    with open(yaml_path, "w") as f:
        f.write(yaml_content)

    print("\n" + "=" * 70)
    print(f" DATASET COMPLETE: {num_samples} images written to {DATASET_DIR}")
    print(f"• Train images: {num_train} | Val images: {num_samples - num_train}")
    print(f"• Dataset YAML: {yaml_path}")
    print("=" * 70)

if __name__ == "__main__":
    count = 2000
    if len(sys.argv) > 1:
        count = int(sys.argv[1])
    generate_dataset(num_samples=count, train_ratio=0.9)
