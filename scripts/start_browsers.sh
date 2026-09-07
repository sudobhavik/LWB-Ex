#!/usr/bin/env bash
set -e

# Base directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DEMO_URL="http://localhost:3000"

TARGET="${1:-all}"
GPU_MODE="${GPU_MODE:-auto}"

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

  echo "==> Launching Chromium browser ($CHROME_BIN_PATH) with GUPTCHARA extension..."
  CHROME_TEMP_DIR="/tmp/ps171_chrome_profile_$$"
  mkdir -p "$CHROME_TEMP_DIR"

  # Base WebGPU & Hardware Acceleration flags (bypasses Linux GPU blocklist)
  GPU_FLAGS=(
    "--load-extension=$EXT_DIR"
    "--user-data-dir=$CHROME_TEMP_DIR"
    "--no-first-run"
    "--no-default-browser-check"
    "--enable-features=WebGPU"
    "--enable-unsafe-webgpu"
    "--ignore-gpu-blocklist"
    "--enable-gpu-rasterization"
    "--enable-zero-copy"
  )

  # Linux Wayland / Hyprland / NVIDIA green-screen & black-screen stabilization
  if [ "$GPU_MODE" = "software" ]; then
    echo "    [GPU Mode] Forcing software rendering fallback (SwiftShader)..."
    GPU_FLAGS+=(
      "--use-gl=angle"
      "--use-angle=swiftshader"
    )
  elif [ "$GPU_MODE" = "x11" ]; then
    echo "    [GPU Mode] Forcing XWayland presentation (--ozone-platform=x11)..."
    GPU_FLAGS+=(
      "--ozone-platform=x11"
      "--use-gl=angle"
      "--use-angle=gl"
    )
  elif [ "$GPU_MODE" = "vulkan" ]; then
    echo "    [GPU Mode] Enabling experimental Vulkan swapchain..."
    GPU_FLAGS+=(
      "--enable-features=WebGPU,Vulkan,DefaultANGLEVulkan"
    )
    if [ -n "$WAYLAND_DISPLAY" ]; then
      GPU_FLAGS+=("--ozone-platform-hint=auto" "--ozone-platform=wayland")
    fi
  else
    # Default 'auto': Rock-solid Wayland native presentation with ANGLE OpenGL backend.
    # Disabling Vulkan for the browser UI swapchain completely eliminates the famous
    # NVIDIA Wayland green-screen / black-window bug, while Dawn internally utilizes the GPU for WebGPU compute!
    echo "    [GPU Mode] Auto: Native Wayland + ANGLE GL (Fixes NVIDIA Wayland green/black screen)..."
    if [ -n "$WAYLAND_DISPLAY" ]; then
      GPU_FLAGS+=(
        "--ozone-platform-hint=auto"
        "--ozone-platform=wayland"
      )
    fi
    GPU_FLAGS+=(
      "--use-gl=angle"
      "--use-angle=gl"
      "--disable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan"
    )
  fi

  "$CHROME_BIN_PATH" "${GPU_FLAGS[@]}" "$DEMO_URL" &
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
    --pref="dom.webgpu.enabled=true" \
    --pref="gfx.webrender.all=true" \
    --pref="dom.webgpu.workers.enabled=true" &
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
    echo "Environment overrides:"
    echo "  GPU_MODE=auto      (Default: Native Wayland + ANGLE GL, prevents green/black screen)"
    echo "  GPU_MODE=x11       (Force XWayland presentation)"
    echo "  GPU_MODE=vulkan    (Enable experimental Vulkan UI swapchain)"
    echo "  GPU_MODE=software  (Force SwiftShader software fallback)"
    exit 1
    ;;
esac
