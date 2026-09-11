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

echo "==> Checking if local Chromium desktop is listening on port 3000..."
if ! curl -s -m 2 http://localhost:3000 >/dev/null 2>&1; then
  echo "[!] Port 3000 is not responding yet."
  echo "    Checking Docker container status..."
  if command -v docker >/dev/null 2>&1; then
    sudo docker ps --filter "name=guptchara" || docker ps --filter "name=guptchara" || true
  fi
  echo ""
  echo "    Attempting to start or wait for GUPTCHARA containers..."
  if command -v docker >/dev/null 2>&1; then
    sudo docker compose -f docker-compose.azure.yml up -d 2>/dev/null || docker compose -f docker-compose.azure.yml up -d 2>/dev/null || true
  fi
  
  echo "    Waiting for Chromium browser to become ready (up to 30s)..."
  READY=0
  for i in $(seq 1 30); do
    if curl -s -m 1 http://localhost:3000 >/dev/null 2>&1; then
      READY=1
      echo "    [+] Port 3000 is now active and ready!"
      break
    fi
    sleep 1
  done

  if [ $READY -eq 0 ]; then
    echo "[!] Warning: Port 3000 still did not respond. Starting tunnel anyway, but note that the container may still be pulling or starting."
    echo "    Check status with: sudo docker compose -f docker-compose.azure.yml logs -f guptchara-browser"
  fi
fi

echo ""
echo "==> Establishing secure tunnel to local Chromium desktop on :3000..."
echo "==> Look for the 'https://*.trycloudflare.com' URL below:"
echo "------------------------------------------------------------"
"$CLOUDFLARED_BIN" tunnel --url http://localhost:3000
