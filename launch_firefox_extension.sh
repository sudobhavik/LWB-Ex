#!/usr/bin/env bash
# ==============================================================================
# PS171 Privacy Agent - One-Click Mozilla Firefox Launcher
# Automatically starts local demo server and launches Firefox with the extension
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
EXT_DIR="$DIR/extension"

export DISPLAY="${DISPLAY:-:0}"
export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-1}"

# 1. Ensure static site server is active on port 8080
if ! curl -s http://127.0.0.1:8080/site/index.html > /dev/null; then
    echo "[INFO] Starting lightweight static file server on port 8080..."
    fuser -k 8080/tcp 2>/dev/null || true
    setsid python3 -m http.server 8080 --directory "$EXT_DIR" > /tmp/ps171_server.log 2>&1 &
    sleep 1
fi

echo "======================================================================"
echo "[PS171 PRIVACY AGENT] Mozilla Firefox Launcher"
echo "======================================================================"
echo "Target Site: http://127.0.0.1:8080/site/"
echo "Extension:   $EXT_DIR"
echo "----------------------------------------------------------------------"
echo "Instructions:"
echo "1. Firefox will launch with the PS171 extension pre-installed."
echo "2. The target e-commerce store opens in the browser window."
echo "3. Click the PS171 Privacy Agent icon in the Firefox toolbar."
echo "   The full controller popup opens immediately."
echo "4. In the controller, pick your VLM provider (Ollama / OpenAI / Gemini)."
echo "5. Type your goal and click RUN AUTONOMOUS LOOP or SCAN & PROTECT TAB."
echo "======================================================================"

exec npx --yes web-ext run \
    --source-dir "$EXT_DIR" \
    --target "firefox-desktop" \
    --start-url "http://127.0.0.1:8080/site/"
