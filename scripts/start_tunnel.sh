#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Instant Free Public HTTPS Tunnel via Cloudflare
# Allows sharing the Azure instance with judges over SSL without opening firewall ports
# ==============================================================================

echo "============================================================"
echo "    GUPTCHARA: Starting Free Public HTTPS Tunnel            "
echo "============================================================"

# Check if cloudflared is installed
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "==> Downloading cloudflared binary..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    CF_ARCH="amd64"
  elif [ "$ARCH" = "aarch64" ]; then
    CF_ARCH="arm64"
  else
    CF_ARCH="amd64"
  fi

  curl -L --output /tmp/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CF_ARCH"
  chmod +x /tmp/cloudflared
  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared || mv /tmp/cloudflared "$HOME/.local/bin/cloudflared" || true
fi

CLOUDFLARED_BIN=$(command -v cloudflared || echo "/usr/local/bin/cloudflared")

if [ ! -x "$CLOUDFLARED_BIN" ]; then
  echo "[!] Could not find or install cloudflared executable."
  exit 1
fi

echo "==> Establishing secure tunnel to local Chromium desktop on :3000..."
echo "==> Look for the 'https://*.trycloudflare.com' URL below:"
echo "------------------------------------------------------------"
"$CLOUDFLARED_BIN" tunnel --url http://localhost:3000
