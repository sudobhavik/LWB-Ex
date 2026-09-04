#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXT_DIR="$DIR/extension"
CHROME_BIN="/home/shreyas/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"

export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-1}"

# 1. Ensure static site server is active on port 8080 (zero AI dependencies)
if ! curl -s http://127.0.0.1:8080/site/index.html > /dev/null; then
    echo "[INFO] Starting lightweight static file server on port 8080..."
    fuser -k 8080/tcp 2>/dev/null || true
    setsid python3 -m http.server 8080 --directory "$EXT_DIR" > /tmp/ps171_server.log 2>&1 &
    sleep 1
fi

# 2. Close previous demo browser instances to refresh extension manifest
pkill -f "ps171_chrome_profile" || true
sleep 1

echo "======================================================================"
echo "[PS171 PRIVACY AGENT] Side Panel Mode Initialized"
echo "======================================================================"
echo "• Target Site: http://127.0.0.1:8080/site/"
echo "• Extension:   $EXT_DIR"
echo "----------------------------------------------------------------------"
echo "Instructions:"
echo "1. The browser opens with the target website on the left."
echo "2. Click the Extensions menu icon or PS171 Privacy Agent icon in the toolbar."
echo "   The full controller will open docked as a Side Panel."
echo "3. Type any instruction into the goal input (e.g. Purchase item and checkout)."
echo "4. Click RUN AUTONOMOUS LOOP or SINGLE STEP."
echo "5. Sensitive elements (passwords, cards, API tokens, balances) are blurred"
echo "   on-device prior to cloud transmission."
echo "======================================================================"

setsid "$CHROME_BIN" \
    --load-extension="$EXT_DIR" \
    --disable-extensions-except="$EXT_DIR" \
    --enable-unsafe-webgpu \
    --ignore-gpu-blocklist \
    --disable-features=IPH_ExtensionsMenu \
    --no-first-run \
    --no-default-browser-check \
    --user-data-dir="/tmp/ps171_chrome_profile" \
    "http://127.0.0.1:8080/site/" > /tmp/chrome_launch.log 2>&1 &

sleep 1
echo "[OK] Browser window launched with persistent Side Panel enabled!"
