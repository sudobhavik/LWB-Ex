import os
import sys
import glob
import random
import shutil
import base64
from pathlib import Path
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "kaggle_ps171_browser_dataset"
TEMPLATES_DIR = BASE_DIR / "templates_cache_kaggle"
LFW_DIR = Path("/home/shreyas/scikit_learn_data/lfw_home/lfw_funneled")

# Clean and create directory structure
shutil.rmtree(DATASET_DIR, ignore_errors=True)
os.makedirs(DATASET_DIR / "images" / "train", exist_ok=True)
os.makedirs(DATASET_DIR / "images" / "val", exist_ok=True)
os.makedirs(DATASET_DIR / "labels" / "train", exist_ok=True)
os.makedirs(DATASET_DIR / "labels" / "val", exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)

CLASS_MAP = {
    "face": 0,
    "password": 1,
    "password_field": 1,
    "pii": 2,
    "pii_field": 2,
    "sensitive_text": 3,
    "text_sensitive": 3
}

# 100% Fictional Organizations
ORGS = [
    "Nexus Global Technologies",
    "Aegis Cloud Architecture",
    "Horizon Financial Treasury",
    "Apex Institute of Science",
    "Astra Business Analytics",
    "Zenith Enterprise HRMS",
    "Quantum Telehealth Portal",
    "Vanguard Logistics & Trade"
]

FIRST_NAMES = ["Jordan", "Casey", "Taylor", "Morgan", "Samira", "Elena", "Marcus", "Alex", "Devon", "Avery", "Riley", "Logan", "Kai"]
LAST_NAMES = ["Rivera", "Chen", "Brooks", "Vance", "Miller", "Rostova", "Patel", "Kowalski", "Kim", "Nielsen", "Alvarez", "Sinclair"]

THEMES = [
    {"bg": "#0f172a", "card": "#1e293b", "text": "#f8fafc", "sub": "#94a3b8", "border": "#334155", "input": "#0b1120", "primary": "#38bdf8", "accent": "#0284c7"},
    {"bg": "#ffffff", "card": "#f8fafc", "text": "#0f172a", "sub": "#64748b", "border": "#e2e8f0", "input": "#ffffff", "primary": "#2563eb", "accent": "#1d4ed8"},
    {"bg": "#18181b", "card": "#27272a", "text": "#fafafa", "sub": "#a1a1aa", "border": "#3f3f46", "input": "#18181b", "primary": "#10b981", "accent": "#059669"},
    {"bg": "#f9fafb", "card": "#ffffff", "text": "#111827", "sub": "#6b7280", "border": "#e5e7eb", "input": "#f9fafb", "primary": "#6366f1", "accent": "#4f46e5"},
    {"bg": "#0c0a09", "card": "#1c1917", "text": "#fafaf9", "sub": "#a8a29e", "border": "#292524", "input": "#0c0a09", "primary": "#f59e0b", "accent": "#d97706"}
]

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

# ==============================================================================
# 8 DIVERSE FICTIONAL DASHBOARD & WEBPAGE GENERATORS
# ==============================================================================

# 1. SaaS Executive Revenue & Analytics Dashboard
def tmpl_saas_dashboard(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    org = random.choice(ORGS)
    mrr = f"${random.randint(45, 380):,},{random.randint(100, 999)}"
    api_key = f"live_sk_test_{random.randint(100000, 999999)}_sec"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.topbar {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid {theme['border']}; padding-bottom: 10px; margin-bottom: 14px; }}
.logo-title {{ font-size: 15px; font-weight: 700; color: {theme['primary']}; }}
.profile-pill {{ display: flex; align-items: center; gap: 10px; }}
.avatar {{ width: 55px; height: 65px; object-fit: cover; border-radius: 6px; border: 1px solid {theme['border']}; }}
.stats-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }}
.stat-card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; }}
.stat-lbl {{ font-size: 11px; color: {theme['sub']}; margin-bottom: 4px; }}
.stat-val {{ font-size: 20px; font-weight: 800; color: #10b981; font-family: monospace; }}
.panel {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 14px; }}
.token-display {{ background: rgba(56,189,248,0.1); border: 1px dashed {theme['primary']}; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: {theme['primary']}; margin-top: 6px; }}
</style></head><body>
  <div class="topbar">
    <div class="logo-title">[FAST] {org} — Executive Metrics</div>
    <div class="profile-pill">
      <img src="{face_b64}" class="avatar" data-privacy="face" alt="Executive Portrait">
      <div>
        <div style="font-size: 12px; font-weight: 600;">{user_name}</div>
        <div style="font-size: 10px; color: {theme['sub']};">VP Product</div>
      </div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-lbl">Monthly Recurring Revenue (MRR)</div>
      <div class="stat-val" data-privacy="sensitive_text">{mrr}</div>
    </div>
    <div class="stat-card">
      <div class="stat-lbl">Active Enterprise Accounts</div>
      <div style="font-size: 20px; font-weight: 800;">1,429</div>
    </div>
  </div>
  <div class="panel">
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">Production API Security Credentials</div>
    <div style="font-size: 11px; color: {theme['sub']};">Confidential secret token for backend microservices</div>
    <div class="token-display" data-privacy="sensitive_text">{api_key}</div>
  </div>
</body></html>"""

# 2. FinTech & Corporate Treasury Dashboard
def tmpl_fintech_treasury(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    iban = f"IBAN-TEST-{random.randint(10000000, 99999999)}"
    balance = f"${random.randint(250, 980)},{random.randint(100, 999)}.{random.randint(10, 99)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; }}
.officer {{ display: flex; align-items: center; gap: 10px; }}
.pic {{ width: 60px; height: 75px; object-fit: cover; border-radius: 6px; }}
.vault-card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 14px; margin-bottom: 12px; }}
.bal-num {{ font-size: 24px; font-weight: 800; color: #10b981; font-family: monospace; }}
.form-box {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 14px; }}
.field {{ margin-bottom: 8px; }}
.lbl {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 3px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; }}
</style></head><body>
  <div class="header">
    <div class="officer">
      <img src="{face_b64}" class="pic" data-privacy="face" alt="Treasury Officer">
      <div>
        <div style="font-size: 14px; font-weight: 700;">Horizon Treasury Vault</div>
        <div style="font-size: 11px; color: {theme['sub']};">Account Officer: {user_name}</div>
      </div>
    </div>
    <div style="font-size: 11px; color: {theme['sub']};">Secured Ledger</div>
  </div>
  <div class="vault-card">
    <div style="font-size: 11px; color: {theme['sub']};">Available Treasury Reserves</div>
    <div class="bal-num" data-privacy="sensitive_text">{balance}</div>
    <div style="font-size: 11px; margin-top: 4px; color: {theme['sub']};">Global Routing: <span style="font-family: monospace; font-weight: 600;" data-privacy="pii">{iban}</span></div>
  </div>
  <div class="form-box">
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Wire Transfer Authorization</div>
    <div class="field">
      <span class="lbl">Authorized Security PIN</span>
      <input type="password" class="inp" value="9842" data-privacy="password">
    </div>
  </div>
</body></html>"""

# 3. Cloud DevOps & Cluster Console
def tmpl_devops_console(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    ssh_key = f"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI-test-{random.randint(1000, 9999)}"
    phone = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, monospace; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.top {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid {theme['border']}; padding-bottom: 10px; margin-bottom: 14px; }}
.dev-info {{ display: flex; align-items: center; gap: 12px; }}
.dev-img {{ width: 65px; height: 80px; object-fit: cover; border-radius: 6px; }}
.box {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 6px; padding: 12px; margin-bottom: 12px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; }}
</style></head><body>
  <div class="top">
    <div class="dev-info">
      <img src="{face_b64}" class="dev-img" data-privacy="face" alt="DevOps Admin">
      <div>
        <div style="font-size: 14px; font-weight: bold;">Aegis Kubernetes Cluster Console</div>
        <div style="font-size: 11px; color: {theme['sub']};">Root Admin: {user_name}</div>
      </div>
    </div>
    <div style="font-size: 11px; color: #10b981;">● 64 Nodes Online</div>
  </div>
  <div class="box">
    <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">Root Deployment Private Key</div>
    <div style="font-size: 11px; color: {theme['primary']}; word-break: break-all;" data-privacy="sensitive_text">{ssh_key}</div>
  </div>
  <div class="box">
    <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">2-Factor Incident Alert Mobile</div>
    <input type="text" class="inp" value="{phone}" data-privacy="pii">
  </div>
  <div class="box">
    <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px;">Cluster Root Password</div>
    <input type="password" class="inp" value="K8s#RootMasterPass2026" data-privacy="password">
  </div>
</body></html>"""

# 4. Enterprise HRMS & Employee Directory Portal
def tmpl_hrms_portal(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    emp_id = f"EMP-2026-{random.randint(1000, 9999)}"
    phone = f"+1 (555) {random.randint(200, 899)}-{random.randint(1000, 9999)}"
    salary = f"${random.randint(85, 175):,},000 / yr"
    dob = f"{random.randint(1, 28)} {random.choice(['April', 'June', 'September', 'November'])} {random.randint(1985, 2002)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.header {{ display: flex; justify-content: space-between; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; margin-bottom: 14px; }}
.profile-row {{ display: flex; gap: 14px; background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 14px; margin-bottom: 12px; }}
.emp-photo {{ width: 100px; height: 125px; object-fit: cover; border-radius: 6px; }}
.badge-row {{ display: flex; gap: 8px; margin: 8px 0; }}
.badge {{ width: 36px; height: 36px; border-radius: 6px; background: {theme['border']}; display: flex; align-items: center; justify-content: center; font-size: 14px; }}
.data-card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }}
</style></head><body>
  <div class="header">
    <div style="font-size: 15px; font-weight: 700;">Zenith Enterprise HR Directory</div>
    <div style="font-size: 11px; color: {theme['sub']};">ID: {emp_id}</div>
  </div>
  <div class="profile-row">
    <img src="{face_b64}" class="emp-photo" data-privacy="face" alt="Staff Member">
    <div style="flex: 1;">
      <div style="font-size: 16px; font-weight: 700;">{user_name}</div>
      <div style="font-size: 11px; color: {theme['sub']};">Senior Data Architect</div>
      <div style="font-size: 11px; margin-top: 6px;">Date of Birth: <span style="color: #ef4444; font-weight: 600;" data-privacy="sensitive_text">{dob}</span></div>
      <div class="badge-row">
        <div class="badge"></div><div class="badge"></div><div class="badge"></div>
      </div>
    </div>
  </div>
  <div class="data-card">
    <span style="font-size: 12px; color: {theme['sub']};">Registered Mobile Contact:</span>
    <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #d97706;" data-privacy="pii">{phone}</span>
  </div>
  <div class="data-card">
    <span style="font-size: 12px; color: {theme['sub']};">Confidential Compensation Band:</span>
    <span style="font-size: 13px; font-weight: 800; color: #10b981;" data-privacy="sensitive_text">{salary}</span>
  </div>
</body></html>"""

# 5. Healthcare / Telehealth Patient Record
def tmpl_telehealth_record(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    patient_id = f"HLTH-{random.randint(100000, 999999)}"
    phone = f"+1 (555) {random.randint(200, 899)}-{random.randint(1000, 9999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.nav {{ display: flex; justify-content: space-between; border-bottom: 2px solid #059669; padding-bottom: 8px; margin-bottom: 12px; }}
.patient-card {{ display: flex; gap: 14px; background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; margin-bottom: 12px; }}
.patient-pic {{ width: 85px; height: 105px; object-fit: cover; border-radius: 6px; }}
.field {{ margin-bottom: 8px; }}
.lbl {{ font-size: 11px; color: {theme['sub']}; display: block; margin-bottom: 2px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; }}
</style></head><body>
  <div class="nav">
    <div style="font-size: 15px; font-weight: 700; color: #059669;"> Quantum Health Systems — Patient EMR</div>
    <div style="font-size: 11px; color: {theme['sub']};">Record #{patient_id}</div>
  </div>
  <div class="patient-card">
    <img src="{face_b64}" class="patient-pic" data-privacy="face" alt="Patient Face">
    <div style="flex: 1;">
      <div style="font-size: 15px; font-weight: 700;">{user_name}</div>
      <div style="font-size: 11px; color: {theme['sub']}; margin-bottom: 6px;">Blood Group: O+ Positive</div>
      <div class="field">
        <span class="lbl">Primary Insurance Policy ID</span>
        <input type="text" class="inp" value="POL-9942-A1" data-privacy="pii">
      </div>
      <div class="field">
        <span class="lbl">Emergency Next-of-Kin Phone</span>
        <input type="text" class="inp" value="{phone}" data-privacy="pii">
      </div>
    </div>
  </div>
</body></html>"""

# 6. E-Commerce Order & Payment Management
def tmpl_ecommerce_orders(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    order_id = f"ORD-{random.randint(100000, 999999)}"
    card_no = "4242 4242 4242 4242"
    cvv = f"{random.randint(100, 999)}"
    total = f"${random.randint(150, 2400)}.{random.randint(10, 99)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.top {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; margin-bottom: 12px; }}
.cust-card {{ display: flex; gap: 12px; background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; margin-bottom: 12px; }}
.cust-pic {{ width: 80px; height: 100px; object-fit: cover; border-radius: 6px; }}
.form-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
.inp {{ width: 100%; height: 32px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 8px; color: {theme['text']}; font-size: 12px; margin-top: 3px; }}
.total-box {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }}
</style></head><body>
  <div class="top">
    <div style="font-size: 15px; font-weight: 700;">Vanguard Express Commerce</div>
    <div style="font-size: 11px; color: {theme['sub']};">Order #{order_id}</div>
  </div>
  <div class="cust-card">
    <img src="{face_b64}" class="cust-pic" data-privacy="face" alt="Buyer Portrait">
    <div>
      <div style="font-size: 14px; font-weight: 700;">{user_name}</div>
      <div style="font-size: 11px; color: {theme['sub']};">Verified Buyer</div>
    </div>
  </div>
  <div class="form-grid">
    <div>
      <span style="font-size: 11px; color: {theme['sub']};">Visa Payment Card</span>
      <input type="text" class="inp" value="{card_no}" data-privacy="pii">
    </div>
    <div>
      <span style="font-size: 11px; color: {theme['sub']};">Card Security Code</span>
      <input type="text" class="inp" value="{cvv}" data-privacy="pii">
    </div>
  </div>
  <div class="total-box">
    <span style="font-size: 12px; font-weight: 600;">Transaction Grand Total:</span>
    <span style="font-size: 15px; font-weight: 800; color: #ef4444;" data-privacy="sensitive_text">{total}</span>
  </div>
</body></html>"""

# 7. Cybersecurity / Identity & Access Management (IAM)
def tmpl_iam_vault(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    phone = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 22px; display: flex; flex-direction: column; justify-content: center; }}
.card {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 10px; padding: 20px; max-width: 460px; margin: 0 auto; width: 100%; }}
.head {{ display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }}
.admin-pic {{ width: 65px; height: 80px; object-fit: cover; border-radius: 6px; }}
.field {{ margin-bottom: 10px; }}
.inp {{ width: 100%; height: 34px; background: {theme['input']}; border: 1px solid {theme['border']}; border-radius: 4px; padding: 0 10px; color: {theme['text']}; font-size: 13px; margin-top: 3px; }}
</style></head><body>
  <div class="card">
    <div class="head">
      <img src="{face_b64}" class="admin-pic" data-privacy="face" alt="Security Admin">
      <div>
        <div style="font-size: 15px; font-weight: 700;">IAM Security Credential Vault</div>
        <div style="font-size: 11px; color: {theme['sub']};">Privileged User: {user_name}</div>
      </div>
    </div>
    <div class="field">
      <span style="font-size: 11px; color: {theme['sub']};">Master Encryption Key / Password</span>
      <input type="password" class="inp" value="RootVault#2026MasterKey!" data-privacy="password">
    </div>
    <div class="field">
      <span style="font-size: 11px; color: {theme['sub']};">2FA Fallback Mobile</span>
      <input type="text" class="inp" value="{phone}" data-privacy="pii">
    </div>
  </div>
</body></html>"""

# 8. Fictional Academic & Research Portal
def tmpl_academic_research(theme, face_b64):
    user_name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
    stipend = f"${random.randint(42, 85):,},000 / yr"
    dob = f"{random.randint(1, 28)} {random.choice(['March', 'May', 'July', 'October'])} {random.randint(1996, 2004)}"
    return f"""<!DOCTYPE html><html><head><style>
* {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }}
body {{ background: {theme['bg']}; color: {theme['text']}; width: 640px; height: 640px; overflow: hidden; padding: 18px; }}
.bar {{ display: flex; justify-content: space-between; border-bottom: 1px solid {theme['border']}; padding-bottom: 8px; margin-bottom: 12px; }}
.profile {{ display: flex; gap: 14px; background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 14px; margin-bottom: 12px; }}
.fellow-pic {{ width: 95px; height: 120px; object-fit: cover; border-radius: 6px; }}
.box {{ background: {theme['card']}; border: 1px solid {theme['border']}; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }}
</style></head><body>
  <div class="bar">
    <div style="font-size: 14px; font-weight: 700;">Apex Institute of Technology — Scholar Portal</div>
    <div style="font-size: 11px; color: {theme['sub']};">Fellowship #9910</div>
  </div>
  <div class="profile">
    <img src="{face_b64}" class="fellow-pic" data-privacy="face" alt="Fellow Portrait">
    <div>
      <div style="font-size: 16px; font-weight: 700;">{user_name}</div>
      <div style="font-size: 11px; color: {theme['sub']};">Department of Computer Science</div>
      <div style="font-size: 11px; margin-top: 6px;">Date of Birth: <span style="color: #ef4444; font-weight: 600;" data-privacy="sensitive_text">{dob}</span></div>
    </div>
  </div>
  <div class="box">
    <span style="font-size: 12px; color: {theme['sub']};">Annual Research Fellowship Stipend:</span>
    <span style="font-size: 13px; font-weight: 800; color: #10b981;" data-privacy="sensitive_text">{stipend}</span>
  </div>
</body></html>"""

GENERATORS = [
    tmpl_saas_dashboard,
    tmpl_fintech_treasury,
    tmpl_devops_console,
    tmpl_hrms_portal,
    tmpl_telehealth_record,
    tmpl_ecommerce_orders,
    tmpl_iam_vault,
    tmpl_academic_research
]

def generate_1000_dataset(num_train_screens=700, num_val_screens=180, num_train_faces=150, num_val_faces=40):
    from playwright.sync_api import sync_playwright

    real_faces = get_real_face_images()
    total_samples = num_train_screens + num_val_screens + num_train_faces + num_val_faces
    print(f"\n[RUN] Generating {total_samples} 100% Kaggle-Safe Images (Train: {num_train_screens + num_train_faces}, Val: {num_val_screens + num_val_faces})...")

    face_idx = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 640, "height": 640})

        for split, count in [("train", num_train_screens), ("val", num_val_screens)]:
            print(f"\n--- Generating {count} {split} dashboard screenshots ---")
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

                    # Quality check: strictly between 0 and 1
                    xc = max(0.001, min(0.999, xc))
                    yc = max(0.001, min(0.999, yc))
                    norm_w = max(0.002, min(0.999, norm_w))
                    norm_h = max(0.002, min(0.999, norm_h))

                    yolo_boxes.append((cls_id, xc, yc, norm_w, norm_h))

                img_out_path = DATASET_DIR / "images" / split / f"dashboard_{split}_{idx:04d}.jpg"
                lbl_out_path = DATASET_DIR / "labels" / split / f"dashboard_{split}_{idx:04d}.txt"

                page.screenshot(path=str(img_out_path), quality=95, type="jpeg")

                with open(lbl_out_path, "w", encoding="utf-8") as lf:
                    for cid, xc, yc, nw, nh in yolo_boxes:
                        lf.write(f"{cid} {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f}\n")

                if (idx + 1) % 100 == 0 or idx == count - 1:
                    print(f"  [{split}] Created {idx + 1}/{count} screenshots with verified bounding boxes.")

        browser.close()

    # Standalone Real Human Faces
    print("\n--- Ingesting standalone real human face photographs ---")
    for split, max_s in [("train", num_train_faces), ("val", num_val_faces)]:
        for s_idx in range(max_s):
            src_face = real_faces[face_idx % len(real_faces)]
            face_idx += 1

            dst_img = DATASET_DIR / "images" / split / f"portrait_face_{s_idx:04d}.jpg"
            dst_lbl = DATASET_DIR / "labels" / split / f"portrait_face_{s_idx:04d}.txt"

            im = Image.open(src_face).convert("RGB")
            im_resized = im.resize((640, 640), Image.Resampling.BILINEAR)
            im_resized.save(dst_img, quality=95)

            with open(dst_lbl, "w") as f_out:
                f_out.write("0 0.500000 0.510000 0.480000 0.580000\n")

        print(f"  [{split}] Ingested {max_s} standalone real human faces.")

    # Create data.yaml
    yaml_content = f"""path: {DATASET_DIR}
train: images/train
val: images/val
names:
  0: face
  1: password_field
  2: pii_field
  3: sensitive_text
"""
    with open(DATASET_DIR / "data.yaml", "w") as f:
        f.write(yaml_content)

    print(f"\n 1000+ Kaggle-Safe Dataset Generation Complete at: {DATASET_DIR}")
    print(f"  - Train Images: {len(os.listdir(DATASET_DIR / 'images' / 'train'))}")
    print(f"  - Val Images:   {len(os.listdir(DATASET_DIR / 'images' / 'val'))}")
    print(f"  - data.yaml:    {DATASET_DIR / 'data.yaml'}")

if __name__ == "__main__":
    generate_1000_dataset(
        num_train_screens=720,
        num_val_screens=180,
        num_train_faces=150,
        num_val_faces=50
    )
