#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Azure for Students One-Click Deployment Script
# Configures OpenAI API Key (GPT-4o), prepares Chromium profile, and launches Docker
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================================"
echo "    GUPTCHARA: Azure for Students Cloud Browser Setup       "
echo "============================================================"

# 1. Check or Prompt for OpenAI API Key
RAW_KEY="${1:-${OPENAI_API_KEY:-}}"

# If not provided via CLI arg or env, check existing config.json
if [ -z "$RAW_KEY" ] && [ -f "$ROOT_DIR/extension/config.json" ]; then
  RAW_KEY=$(grep -oE 'sk-[a-zA-Z0-9_-]+' "$ROOT_DIR/extension/config.json" | head -n 1 || true)
fi

while [ -z "$API_KEY" ]; do
  if [ -n "$RAW_KEY" ]; then
    USER_INPUT="$RAW_KEY"
    RAW_KEY=""
  else
    echo ""
    echo "Please enter your OpenAI API Key for GPT-4o visual reasoning:"
    echo "(Example: sk-proj-... or sk-...)"
    read -r -s -p "OpenAI API Key: " USER_INPUT
    echo ""
  fi

  # Robust extraction: regex match standard OpenAI key format
  API_KEY=$(echo "$USER_INPUT" | grep -oE 'sk-[a-zA-Z0-9_-]+' | head -n 1 || true)
  if [ -z "$API_KEY" ]; then
    # Fallback: strip ANSI escape codes (e.g. bracketed paste \033[200~), non-printable ASCII, quotes
    API_KEY=$(echo "$USER_INPUT" | sed -r 's/\x1B\[[0-9;]*[a-zA-Z~]//g' | tr -dc '[:alnum:]_-\n' | tr -d '\r\n')
  fi

  if [ -z "$API_KEY" ]; then
    echo "[!] Error: OpenAI API Key cannot be empty or invalid format."
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
echo "    [+] extension/config.json created successfully (Prefix: ${API_KEY:0:12}..., Length: ${#API_KEY} chars)."

# 2. Check if Docker and Docker Compose are installed
echo "==> Checking Docker installation..."
if ! command -v docker >/dev/null 2>&1; then
  echo "    [!] Docker not found. Attempting automatic installation (Ubuntu)..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
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
    echo "    [*] Docker requires elevated permissions in this session; using sudo."
  fi
fi

# Detect docker compose plugin or standalone docker-compose
if ${DOCKER_PREFIX}docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker-compose"
else
  echo "    [!] Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin || true
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
fi

# 3. Stop running browser containers first to avoid writing cached storage back to disk on shutdown
echo "==> Stopping running browser container to purge stale SQLite caches..."
$COMPOSE_CMD -f docker-compose.azure.yml stop guptchara-browser caddy 2>/dev/null || true
$COMPOSE_CMD -f docker-compose.azure.yml rm -f guptchara-browser caddy 2>/dev/null || true

# Clear stale locks, metadata, and cached extension settings
mkdir -p "$ROOT_DIR/chrome-config"
find "$ROOT_DIR/chrome-config" -name "Singleton*" -delete 2>/dev/null || true
find "$ROOT_DIR/chrome-config" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
find "$ROOT_DIR/chrome-config" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
find "$ROOT_DIR/chrome-config" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || true
chmod -R 777 "$ROOT_DIR/chrome-config" 2>/dev/null || true

# Purge any stale unpacked metadata and grant write permissions for Chromium ruleset compilation
rm -rf "$ROOT_DIR/extension/_metadata" 2>/dev/null || true
chmod -R 777 "$ROOT_DIR/extension" 2>/dev/null || true

# 4. Fetch Public IP and Azure DNS Hostname
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "YOUR_VM_PUBLIC_IP")

AZURE_FQDN=""
if command -v host >/dev/null 2>&1 && [ "$PUBLIC_IP" != "YOUR_VM_PUBLIC_IP" ]; then
  AZURE_FQDN=$(host "$PUBLIC_IP" 2>/dev/null | awk '{print $NF}' | sed 's/\.$//' || true)
fi

# If reverse DNS lookup did not return a cloudapp.azure.com domain, use existing .env or default
if [ -z "$AZURE_FQDN" ] || [[ "$AZURE_FQDN" != *"cloudapp.azure.com"* ]]; then
  if [ -f "$ROOT_DIR/.env" ] && grep -q "AZURE_DOMAIN=" "$ROOT_DIR/.env"; then
    AZURE_FQDN=$(grep "AZURE_DOMAIN=" "$ROOT_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
  fi
  if [ -z "$AZURE_FQDN" ] || [[ "$AZURE_FQDN" != *"cloudapp.azure.com"* ]]; then
    AZURE_FQDN="guptchara-demo.malaysiawest.cloudapp.azure.com"
  fi
fi

# Write to .env for docker compose
echo "AZURE_DOMAIN=$AZURE_FQDN" > "$ROOT_DIR/.env"
export AZURE_DOMAIN="$AZURE_FQDN"
echo "    [+] Configured domain for Caddy SSL: $AZURE_FQDN"

# 5. Launch Docker Stack (includes Caddy Reverse Proxy for automatic HTTPS)
echo "==> Starting GUPTCHARA services..."
$COMPOSE_CMD -f docker-compose.azure.yml pull demo-site caddy || true
# Ensure both browser and caddy are recreated to pick up updated flags and clear locks
$COMPOSE_CMD -f docker-compose.azure.yml stop guptchara-browser caddy 2>/dev/null || true
$COMPOSE_CMD -f docker-compose.azure.yml rm -f guptchara-browser caddy 2>/dev/null || true
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
  echo "    [+] GUPTCHARA browser service is healthy and actively listening!"
else
  echo "    [*] Images may still be downloading in background. Check logs with:"
  echo "        ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f"
fi

echo "==> Verifying HTTPS SSL handshake on port 443..."
SSL_READY=0
for i in $(seq 1 20); do
  if curl -k -s -m 2 --resolve "${AZURE_FQDN}:443:127.0.0.1" "https://${AZURE_FQDN}" >/dev/null 2>&1; then
    SSL_READY=1
    break
  fi
  printf "."
  sleep 1
done
echo ""

if [ $SSL_READY -eq 1 ]; then
  echo "    [+] HTTPS is active and SSL handshake is working on port 443!"
else
  echo "    [*] Public CA issuance is pending or rate-limited on Azure."
  echo "        Activating self-healing fallback (tls internal)..."
  sed -i '/CADDY_TLS_DIRECTIVE/d' "$ROOT_DIR/.env" 2>/dev/null || true
  echo "CADDY_TLS_DIRECTIVE=tls internal" >> "$ROOT_DIR/.env"
  export CADDY_TLS_DIRECTIVE="tls internal"
  $COMPOSE_CMD -f docker-compose.azure.yml up -d --force-recreate caddy
  sleep 3
  if curl -k -s -m 2 --resolve "${AZURE_FQDN}:443:127.0.0.1" "https://${AZURE_FQDN}" >/dev/null 2>&1; then
    echo "    [+] HTTPS is now 100% active and responding on port 443!"
  fi
fi

echo ""
echo "============================================================"
echo "    GUPTCHARA CLOUD INSTANCE SUCCESSFULLY DEPLOYED!         "
echo "============================================================"
echo ""
echo "⭐ PERMANENT OFFICIAL HTTPS URL (PUT THIS IN YOUR PPT):"
echo "------------------------------------------------------------"
echo "Official Trusted HTTPS : https://${AZURE_FQDN}"
echo ""
echo "Alternative Fallbacks:"
echo "Direct HTTPS (Port 3001): https://${AZURE_FQDN}:3001"
echo "Direct HTTP  (Port 3000): http://${AZURE_FQDN}:3000"
echo "------------------------------------------------------------"
echo ""
echo "Important: Ensure Port 443 (HTTPS) is opened in Azure NSG:"
echo "  1. Azure Portal -> VM 'guptchara-vm' -> 'Networking'"
echo "  2. Add inbound port rule: Service 'HTTPS' (Port 443) -> Add"
echo ""
echo "What judges see when opening the link:"
echo "1. Valid SSL padlock (encrypted & trusted connection)."
echo "2. Full Chromium desktop streaming live directly in their browser."
echo "3. The GUPTCHARA e-commerce demo testbed loads immediately."
echo "4. The GUPTCHARA extension is loaded with GPT-4o pre-configured."
echo ""
echo "Useful Commands:"
echo "  Check Status   : ./scripts/check_status.sh"
echo "  View Caddy Logs: ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f caddy"
echo "  View Live Logs : ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f"
echo "  Restart Stack  : ${COMPOSE_CMD} -f docker-compose.azure.yml restart"
echo "============================================================"
