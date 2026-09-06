#!/usr/bin/env bash
set -e

# Base directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DEMO_URL="http://localhost:3000"

TARGET="${1:-all}"

# Find Chromium binary
find_chromium() {
  for cmd in "$GOOGLE_CHROME_BIN" "$CHROME_BIN" google-chrome-stable google-chrome chromium chromium-browser brave brave-browser /usr/bin/brave; do
    if [ -n "$cmd" ] && command -v "$cmd" >/dev/null 2>&1; then
      echo "$cmd"
      return 0
    fi
  done
  return 1
}

# Find Firefox binary
find_firefox() {
  for cmd in "$FIREFOX_BIN" firefox /usr/bin/firefox; do
    if [ -n "$cmd" ] && command -v "$cmd" >/dev/null 2>&1; then
      echo "$cmd"
      return 0
    fi
  done
  return 1
}

# Start Demo Server in background
start_demo_server() {
  echo "==> Starting local demo benchmark server on :3000..."
  node "$SCRIPT_DIR/serve_demo.js" &
  DEMO_PID=$!
  sleep 1
}

cleanup() {
  echo ""
  echo "==> Shutting down background processes..."
  if [ -n "$DEMO_PID" ]; then
    kill "$DEMO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

start_chromium() {
  CHROME_BIN_PATH=$(find_chromium || true)
  if [ -z "$CHROME_BIN_PATH" ]; then
    echo "[!] Warning: No Chromium-based browser (google-chrome, chromium, brave) found on PATH."
    return 1
  fi
  echo "==> Launching Chromium-compatible browser ($CHROME_BIN_PATH) with YOLO extension..."
  CHROME_TEMP_DIR="/tmp/ps171_chrome_profile_$$"
  mkdir -p "$CHROME_TEMP_DIR"

  "$CHROME_BIN_PATH" \
    --load-extension="$EXT_DIR" \
    --user-data-dir="$CHROME_TEMP_DIR" \
    --no-first-run \
    --no-default-browser-check \
    --enable-features=WebGPU \
    "$DEMO_URL" &
}

start_firefox() {
  FF_BIN_PATH=$(find_firefox || true)
  if [ -z "$FF_BIN_PATH" ]; then
    echo "[!] Warning: Firefox not found on PATH."
    return 1
  fi
  echo "==> Launching Firefox ($FF_BIN_PATH) with web-ext..."
  npx web-ext run \
    --source-dir="$EXT_DIR" \
    --firefox="$FF_BIN_PATH" \
    --start-url="$DEMO_URL" \
    --pref="dom.webgpu.enabled=true" &
}

case "$TARGET" in
  demo)
    start_demo_server
    echo "==> Demo server running at $DEMO_URL. Press Ctrl+C to stop."
    wait "$DEMO_PID"
    ;;
  chrome)
    start_demo_server
    start_chromium
    wait
    ;;
  firefox)
    start_demo_server
    start_firefox
    wait
    ;;
  all)
    start_demo_server
    start_chromium || true
    start_firefox || true
    echo "==> Both browser instances and demo server launched."
    echo "==> Press Ctrl+C to terminate all sessions."
    wait
    ;;
  *)
    echo "Usage: $0 [all|chrome|firefox|demo]"
    exit 1
    ;;
esac
