#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Universal Cloud VM One-Click Deployment Script
# Supports: Azure, AWS EC2, GCP Compute Engine, DigitalOcean, Hetzner, Ubuntu VPS
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================================"
echo "    GUPTCHARA: Universal Cloud VM Browser Streaming Setup   "
echo "============================================================"

# 1. Check or Prompt for OpenAI API Key
RAW_KEY="${1:-${OPENAI_API_KEY:-}}"

# If not provided via CLI arg or env, check existing config.json
if [ -z "$RAW_KEY" ] && [ -f "$ROOT_DIR/extension/config.json" ]; then
  CANDIDATE=$(grep -oE 'sk-[a-zA-Z0-9_-]{20,}' "$ROOT_DIR/extension/config.json" | head -n 1 || true)
  if [ -n "$CANDIDATE" ] && [ ${#CANDIDATE} -ge 40 ]; then
    RAW_KEY="$CANDIDATE"
  fi
fi

while [ -z "$API_KEY" ]; do
  if [ -n "$RAW_KEY" ]; then
    USER_INPUT="$RAW_KEY"
    RAW_KEY=""
  else
    echo ""
    echo "Please enter your OpenAI API Key for GPT-4o visual reasoning:"
    echo "(Example: sk-proj-... - minimum 40 characters, press Enter if already set)"
    read -r -s -p "OpenAI API Key: " USER_INPUT
    echo ""
  fi

  # Robust extraction: regex match standard OpenAI key format
  API_KEY=$(echo "$USER_INPUT" | grep -oE 'sk-[a-zA-Z0-9_-]{20,}' | head -n 1 || true)
  if [ -z "$API_KEY" ]; then
    # Fallback: strip ANSI escape codes (e.g. bracketed paste \033[200~), non-printable ASCII, quotes
    API_KEY=$(echo "$USER_INPUT" | sed -r 's/\x1B\[[0-9;]*[a-zA-Z~]//g' | tr -dc '[:alnum:]_-\n' | tr -d '\r\n')
  fi

  if [ -n "$API_KEY" ] && [ ${#API_KEY} -lt 40 ]; then
    echo "[!] Error: Detected invalid or stub key '${API_KEY}' (${#API_KEY} chars). Real OpenAI keys must be 50+ characters."
    API_KEY=""
  fi

  if [ -z "$API_KEY" ]; then
    echo "[!] Error: OpenAI API Key cannot be empty, truncated, or shorter than 40 characters."
  fi
done

echo ""
echo "==> Configuring extension with GPT-4o and sanitized API Key..."
cat << EOF > "$ROOT_DIR/extension/config.json"
{
  "openaiKey": "$API_KEY",
  "preferredProvider": "openai-gpt4o",
  "acceleration": "wasm",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
chmod 644 "$ROOT_DIR/extension/config.json"
echo "    [+] extension/config.json configured (Prefix: ${API_KEY:0:12}..., Length: ${#API_KEY} chars)."

# 2. Check if Docker and Docker Compose are installed
echo "==> Checking Docker installation..."
if ! command -v docker >/dev/null 2>&1; then
  echo "    [!] Docker not found. Attempting automatic installation (Ubuntu)..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    echo "    [+] Docker installed successfully."
  else
    echo "    [!] Error: Please install Docker manually on this system."
    exit 1
  fi
fi

# Detect docker command and permission needs
DOCKER_PREFIX=""
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_PREFIX="sudo "
    echo "    [*] Docker requires elevated permissions; using sudo."
  fi
fi

# Detect docker compose plugin or standalone docker-compose
if ${DOCKER_PREFIX}docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker-compose"
else
  echo "    [!] Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin 2>/dev/null || true
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
fi

# 3. Stop running browser containers to release locks
echo "==> Stopping running containers to purge stale caches..."
$COMPOSE_CMD -f docker-compose.azure.yml stop guptchara-browser guptchara-browser-2 caddy 2>/dev/null || true
$COMPOSE_CMD -f docker-compose.azure.yml rm -f guptchara-browser guptchara-browser-2 caddy 2>/dev/null || true

# Clear stale locks and cached extension settings for both isolated slots
for DIR in "$ROOT_DIR/chrome-config" "$ROOT_DIR/chrome-config-2"; do
  mkdir -p "$DIR"
  sudo find "$DIR" -name "Singleton*" -delete 2>/dev/null || find "$DIR" -name "Singleton*" -delete 2>/dev/null || true
  sudo find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
  sudo find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
  sudo find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || true
  chmod -R 777 "$DIR" 2>/dev/null || true
done

# Purge stale metadata
rm -rf "$ROOT_DIR/extension/_metadata" 2>/dev/null || true
chmod -R 777 "$ROOT_DIR/extension" 2>/dev/null || true

# 4. Fetch Public IP and Detect Cloud Host
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "YOUR_VM_PUBLIC_IP")

CLOUD_DOMAIN=""
if [ -n "$CUSTOM_DOMAIN" ]; then
  CLOUD_DOMAIN="$CUSTOM_DOMAIN"
elif [ -f "$ROOT_DIR/.env" ] && grep -q "AZURE_DOMAIN=" "$ROOT_DIR/.env"; then
  CLOUD_DOMAIN=$(grep "AZURE_DOMAIN=" "$ROOT_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
fi

# Check reverse DNS lookup for Azure FQDN
if [ -z "$CLOUD_DOMAIN" ] && command -v host >/dev/null 2>&1 && [ "$PUBLIC_IP" != "YOUR_VM_PUBLIC_IP" ]; then
  DETECTED_HOST=$(host "$PUBLIC_IP" 2>/dev/null | awk '{print $NF}' | sed 's/\.$//' || true)
  if [[ "$DETECTED_HOST" == *"cloudapp.azure.com"* ]] || [[ "$DETECTED_HOST" == *"compute.amazonaws.com"* ]]; then
    CLOUD_DOMAIN="$DETECTED_HOST"
  fi
fi

if [ -n "$CLOUD_DOMAIN" ]; then
  echo "AZURE_DOMAIN=$CLOUD_DOMAIN" > "$ROOT_DIR/.env"
  export AZURE_DOMAIN="$CLOUD_DOMAIN"
  echo "    [+] Detected Cloud Domain: $CLOUD_DOMAIN"
else
  # Default fallback domain with internal TLS
  CLOUD_DOMAIN="guptchara.local"
  echo "AZURE_DOMAIN=$CLOUD_DOMAIN" > "$ROOT_DIR/.env"
  echo "CADDY_TLS_DIRECTIVE=tls internal" >> "$ROOT_DIR/.env"
  export AZURE_DOMAIN="$CLOUD_DOMAIN"
  export CADDY_TLS_DIRECTIVE="tls internal"
fi

# 5. Launch Docker Stack
echo "==> Starting GUPTCHARA multi-container streaming stack..."
$COMPOSE_CMD -f docker-compose.azure.yml pull demo-site caddy 2>/dev/null || true
$COMPOSE_CMD -f docker-compose.azure.yml up -d --force-recreate

echo "==> Waiting for Chromium Desktop & Web UI to become ready on port 3000..."
READY=0
for i in $(seq 1 30); do
  if curl -s -m 1 http://127.0.0.1:3000 >/dev/null 2>&1; then
    READY=1
    break
  fi
  printf "."
  sleep 2
done
echo ""

if [ $READY -eq 1 ]; then
  echo "    [+] GUPTCHARA browser streaming service is active and listening!"
else
  echo "    [*] Services are still spinning up. Check logs with:"
  echo "        ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f"
fi

echo ""
echo "============================================================"
echo "    GUPTCHARA CLOUD VM DEPLOYMENT SUCCESSFUL!               "
echo "============================================================"
echo ""
echo "⭐ ACCESS METHOD 1: DIRECT BROWSER STREAMING (Instant):"
echo "------------------------------------------------------------"
echo "Slot 1 (Evaluator 1): http://${PUBLIC_IP}:3000"
echo "Slot 2 (Evaluator 2): http://${PUBLIC_IP}:3002"
echo "------------------------------------------------------------"
echo ""
if [ "$CLOUD_DOMAIN" != "guptchara.local" ]; then
  echo "⭐ ACCESS METHOD 2: DOMAIN HTTPS (With SSL Padlock):"
  echo "------------------------------------------------------------"
  echo "Slot 1 (Evaluator 1): https://${CLOUD_DOMAIN}"
  echo "Slot 2 (Evaluator 2): https://${CLOUD_DOMAIN}:8443"
  echo "------------------------------------------------------------"
  echo ""
fi
echo "⭐ ACCESS METHOD 3: FREE CLOUDFLARE HTTPS TUNNEL (Best for Presentations):"
echo "------------------------------------------------------------"
echo "Run this command right now in your VM terminal:"
echo "  ./scripts/start_tunnel.sh"
echo "It provides a 100% free secure 'https://*.trycloudflare.com' URL!"
echo "------------------------------------------------------------"
echo ""
echo "Useful Commands:"
echo "  Reset Demo Sessions: ./scripts/reset_demo_session.sh"
echo "  Check Status       : ./scripts/check_status.sh"
echo "  Update OpenAI Key  : ./scripts/set_openai_key.sh"
echo "  View Live Logs     : ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f"
echo "============================================================"
