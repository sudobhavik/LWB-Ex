import os
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="NexusStore Demo Website")

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

COMMON_HEAD = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus — Commerce Portal</title>
  <style>
    :root {
      --bg: #000000;
      --card: #111111;
      --card-alt: #171717;
      --border: #262626;
      --border-focus: #525252;
      --text: #ffffff;
      --text-muted: #888888;
      --btn-bg: #ffffff;
      --btn-text: #000000;
      --btn-sec-bg: #1c1c1c;
      --btn-sec-text: #ffffff;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; -webkit-font-smoothing: antialiased; }
    
    /* Plain Black & White Navigation Bar */
    nav { background: #000000; border-bottom: 1px solid var(--border); padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; }
    .brand { font-size: 15px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: 0.08em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
    .brand-mark { width: 14px; height: 14px; background: #ffffff; display: inline-block; }
    .nav-links { display: flex; gap: 22px; align-items: center; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; transition: color 0.15s; }
    .nav-links a:hover, .nav-links a.active { color: #ffffff; }
    .cart-pill { background: #ffffff; color: #000000; padding: 2px 7px; border-radius: 2px; font-size: 11px; font-weight: 800; margin-left: 4px; }
    
    .container { max-width: 1040px; margin: 36px auto; padding: 0 20px; flex: 1; width: 100%; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 24px; }
    
    /* Monochrome Buttons */
    .btn { background: var(--btn-bg); color: var(--btn-text); border: 1px solid #ffffff; padding: 12px 22px; border-radius: 3px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.15s; text-decoration: none; display: inline-block; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; }
    .btn:hover { background: #e5e5e5; }
    .btn-secondary { background: var(--btn-sec-bg); color: var(--btn-sec-text); border: 1px solid var(--border); }
    .btn-secondary:hover { background: #262626; border-color: #525252; }
    
    .field { margin-bottom: 16px; }
    .lbl { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .inp { width: 100%; height: 42px; background: #080808; border: 1px solid var(--border); border-radius: 3px; padding: 0 12px; color: #ffffff; font-size: 14px; font-family: monospace; }
    .inp:focus { outline: none; border-color: var(--border-focus); background: #0c0c0c; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .page-header { margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .page-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; text-transform: uppercase; }
    .page-sub { color: var(--text-muted); font-size: 13px; margin-top: 4px; }
  </style>
</head>
<body>
  <nav>
    <a href="." class="brand"><span class="brand-mark"></span> Nexus / Hardware</a>
    <div class="nav-links">
      <a href="." id="nav-catalog">Catalog</a>
      <a href="cart" id="nav-cart">Cart <span class="cart-pill" id="nav-cart-count">1</span></a>
      <a href="checkout" id="nav-checkout">Checkout</a>
      <a href="profile" id="nav-profile">Profile</a>
      <a href="dashboard" id="nav-dashboard">Dashboard</a>
    </div>
  </nav>
  <div class="container">
"""

COMMON_FOOT = """
  </div>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
@app.get("", response_class=HTMLResponse)
def page_catalog():
    return HTMLResponse(COMMON_HEAD + """
    <div class="page-header">
      <h1 class="page-title">Hardware Inventory & Systems</h1>
      <p class="page-sub">Select hardware payloads for automated mission execution.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
      <!-- Product 1 -->
      <div class="card" style="display: flex; flex-direction: column;">
        <div style="height: 120px; display: flex; align-items: center; justify-content: center; background: #080808; border: 1px solid var(--border); border-radius: 3px; margin-bottom: 16px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; text-transform: uppercase;">Aegis 4K Vision Drone</h3>
        <p style="color: var(--text-muted); font-size: 12px; margin: 8px 0 16px 0; flex: 1; line-height: 1.4;">Autonomous tracking payload with high resolution visual telemetry module.</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 14px;">
          <span style="font-size: 18px; font-weight: 800; font-family: monospace;">$899.00</span>
          <a href="cart" id="btn-add-drone" class="btn">Add to Cart</a>
        </div>
      </div>

      <!-- Product 2 -->
      <div class="card" style="display: flex; flex-direction: column;">
        <div style="height: 120px; display: flex; align-items: center; justify-content: center; background: #080808; border: 1px solid var(--border); border-radius: 3px; margin-bottom: 16px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 21h12M10 17v4M14 17v4"/>
          </svg>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; text-transform: uppercase;">Quantum CyberDeck</h3>
        <p style="color: var(--text-muted); font-size: 12px; margin: 8px 0 16px 0; flex: 1; line-height: 1.4;">Portable edge computational field node with cryptographic core storage.</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 14px;">
          <span style="font-size: 18px; font-weight: 800; font-family: monospace;">$1,299.00</span>
          <a href="cart" id="btn-add-cyberdeck" class="btn btn-secondary">Add to Cart</a>
        </div>
      </div>

      <!-- Product 3 -->
      <div class="card" style="display: flex; flex-direction: column;">
        <div style="height: 120px; display: flex; align-items: center; justify-content: center; background: #080808; border: 1px solid var(--border); border-radius: 3px; margin-bottom: 16px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
            <path d="M12 2a10 10 0 0 0-10 10c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
          </svg>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; text-transform: uppercase;">Telemetry Receiver V3</h3>
        <p style="color: var(--text-muted); font-size: 12px; margin: 8px 0 16px 0; flex: 1; line-height: 1.4;">Multi-band ground station receiver for streaming spatial telemetry.</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 14px;">
          <span style="font-size: 18px; font-weight: 800; font-family: monospace;">$450.00</span>
          <a href="cart" id="btn-add-transceiver" class="btn btn-secondary">Add to Cart</a>
        </div>
      </div>
    </div>
    """ + COMMON_FOOT)

@app.get("/cart", response_class=HTMLResponse)
def page_cart():
    return HTMLResponse(COMMON_HEAD + """
    <div class="page-header">
      <h1 class="page-title">Cart Review</h1>
      <p class="page-sub">Review payload items prior to authentication and checkout dispatch.</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">Order Manifest (1 item)</h3>
        
        <div style="display: flex; gap: 16px; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
          <div style="width: 48px; height: 48px; background: #080808; border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.5">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 700; text-transform: uppercase;">Aegis 4K Vision Drone</div>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">SKU: NX-DRONE-4K • QTY: 1</div>
          </div>
          <div style="font-size: 16px; font-weight: 700; font-family: monospace;">$899.00</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 12px; color: var(--text-muted); text-transform: uppercase;">
          <span>Secure Ground Delivery:</span>
          <span style="color: #ffffff; font-weight: 700;">INCLUDED</span>
        </div>
      </div>

      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">Cost Summary</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; font-family: monospace;">
            <span style="color: var(--text-muted);">Subtotal:</span>
            <span>$899.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; font-family: monospace;">
            <span style="color: var(--text-muted);">Taxes & Fees:</span>
            <span>$0.00</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--border); font-size: 18px; font-weight: 800; font-family: monospace;">
            <span>TOTAL:</span>
            <span>$899.00</span>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <a href="checkout" id="btn-proceed-checkout" class="btn" style="width: 100%; padding: 14px;">Proceed to Checkout</a>
        </div>
      </div>
    </div>
    """ + COMMON_FOOT)

@app.get("/checkout", response_class=HTMLResponse)
def page_checkout():
    return HTMLResponse(COMMON_HEAD + """
    <div class="page-header">
      <h1 class="page-title">Checkout & Settlement</h1>
      <p class="page-sub">Client-side privacy shield intercepts and conceals credentials before telemetry egress.</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">Billing Identity</h3>
        
        <div class="field">
          <label class="lbl">Authorized Cardholder Name</label>
          <input type="text" class="inp" id="cust-name" value="Jordan Rivera" readonly>
        </div>

        <div class="field">
          <label class="lbl">Mobile Telephone Contact (PII)</label>
          <input type="text" class="inp privacy-target" id="cust-phone" value="+1 (555) 019-4821" data-privacy="pii">
        </div>

        <div class="field">
          <label class="lbl">Deployment Delivery Address</label>
          <input type="text" class="inp" id="cust-address" value="450 Innovation Parkway, Tech City" readonly>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">Payment Instrument</h3>

        <div class="field">
          <label class="lbl">Card Number (PII)</label>
          <input type="text" class="inp privacy-target" id="card-number" value="4242 4242 4242 4242" data-privacy="pii">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="field">
            <label class="lbl">Expiry Date</label>
            <input type="text" class="inp privacy-target" id="card-exp" value="12/28" data-privacy="pii">
          </div>
          <div class="field">
            <label class="lbl">Security CVV (Password / Secret)</label>
            <input type="password" class="inp privacy-target" id="card-cvv" value="842" data-privacy="password">
          </div>
        </div>

        <div style="background: #080808; border: 1px solid var(--border); padding: 12px; margin: 10px 0 20px 0; display: flex; justify-content: space-between; align-items: center; font-family: monospace;">
          <span style="font-size: 12px; color: var(--text-muted);">PAYMENT CHARGE:</span>
          <span style="font-size: 18px; font-weight: 800;">$899.00</span>
        </div>

        <a href="order-success" id="btn-place-order" class="btn" style="width: 100%; padding: 14px;">
          Place Order ($899.00)
        </a>
      </div>
    </div>
    """ + COMMON_FOOT)

@app.get("/order-success", response_class=HTMLResponse)
def page_success():
    return HTMLResponse(COMMON_HEAD + """
    <div class="card" style="text-align: center; max-width: 600px; margin: 40px auto; padding: 40px 24px;">
      <div style="width: 48px; height: 48px; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h1 style="font-size: 20px; font-weight: 800; text-transform: uppercase;">Transaction Confirmed</h1>
      <p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">
        Order for Aegis 4K Vision Drone successfully verified and placed.
      </p>

      <div style="background: #080808; border: 1px solid var(--border); padding: 16px; margin: 24px 0; text-align: left; font-family: monospace;">
        <div style="font-size: 11px; color: var(--text-muted);">CONFIRMATION TOKEN:</div>
        <div style="font-size: 15px; font-weight: 800; margin-top: 4px;">NEXUS-88491-VERIFIED</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 14px;">SETTLEMENT METHOD:</div>
        <div style="font-size: 13px; font-weight: 600;">Visa Ending in 4242 • Total: $899.00</div>
      </div>

      <a href="." id="btn-return-home" class="btn">Return to Storefront</a>
    </div>
    """ + COMMON_FOOT)

@app.get("/profile", response_class=HTMLResponse)
def page_profile():
    return HTMLResponse(COMMON_HEAD + """
    <div class="page-header">
      <h1 class="page-title">User Account & Security Profile</h1>
      <p class="page-sub">Manage identity biometric signatures, contact details, and account credentials.</p>
    </div>

    <div class="grid-2">
      <div class="card">
        <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px;">
          <img src="static/profile_user.jpg" style="width: 80px; height: 95px; object-fit: cover; border: 1px solid var(--border);" class="privacy-target" data-privacy="face" alt="User Portrait">
          <div>
            <h2 style="font-size: 16px; font-weight: 700; text-transform: uppercase;">Jordan Rivera</h2>
            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">ROLE: Systems Engineer</div>
            <div style="font-size: 11px; color: #ffffff; margin-top: 6px; font-weight: 700;">[IDENTITY VERIFIED]</div>
          </div>
        </div>

        <div class="field">
          <label class="lbl">Date of Birth (Sensitive Text)</label>
          <input type="text" class="inp privacy-target" value="14 May 1998" data-privacy="sensitive_text" readonly>
        </div>

        <div class="field">
          <label class="lbl">Primary Account Email</label>
          <input type="text" class="inp" value="jordan.rivera@example.com" readonly>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px;">Security Credentials</h3>

        <div class="field">
          <label class="lbl">Master Account Password</label>
          <input type="password" class="inp privacy-target" value="SuperSecret#Pass2026" data-privacy="password">
        </div>

        <div class="field">
          <label class="lbl">2-Factor Recovery Telephone (PII)</label>
          <input type="text" class="inp privacy-target" value="+1 (555) 014-9988" data-privacy="pii">
        </div>

        <button class="btn btn-secondary" style="margin-top: 10px; width: 100%;">Update Security Records</button>
      </div>
    </div>
    """ + COMMON_FOOT)

@app.get("/dashboard", response_class=HTMLResponse)
def page_dashboard():
    return HTMLResponse(COMMON_HEAD + """
    <div class="page-header">
      <h1 class="page-title">Executive Metrics & Treasury Ledger</h1>
      <p class="page-sub">Confidential enterprise balances, financial reserves, and production API credentials.</p>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
      <div class="card">
        <div class="lbl">Total Monthly Recurring Revenue (MRR)</div>
        <div class="privacy-target" style="font-size: 22px; font-weight: 800; font-family: monospace; margin-top: 8px;" data-privacy="sensitive_text">$124,500.00</div>
      </div>

      <div class="card">
        <div class="lbl">Available Treasury Reserves</div>
        <div class="privacy-target" style="font-size: 22px; font-weight: 800; font-family: monospace; margin-top: 8px;" data-privacy="sensitive_text">$450,290.00</div>
      </div>

      <div class="card">
        <div class="lbl">Active Fleet Drones</div>
        <div style="font-size: 22px; font-weight: 800; font-family: monospace; margin-top: 8px;">48 Nodes</div>
      </div>
    </div>

    <div class="card">
      <div class="lbl" style="margin-bottom: 10px;">Cloud Production API Token (Confidential Key)</div>
      <div class="privacy-target" id="cloud-api-token" style="background: #080808; border: 1px solid var(--border); padding: 14px; font-family: monospace; font-size: 13px; color: #ffffff;" data-privacy="sensitive_text">live_sk_prod_992184_secret_auth_token_xyz</div>
    </div>
    """ + COMMON_FOOT)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=False)
