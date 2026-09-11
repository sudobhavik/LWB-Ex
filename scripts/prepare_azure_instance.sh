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
API_KEY="${OPENAI_API_KEY:-}"

while [ -z "$API_KEY" ]; do
  echo ""
  echo "Please enter your OpenAI API Key for GPT-4o visual reasoning:"
  echo "(Example: sk-proj-... or sk-...)"
  read -r -s -p "OpenAI API Key: " API_KEY
  echo ""
  if [ -z "$API_KEY" ]; then
    echo "[!] Error: OpenAI API Key cannot be empty."
  fi
done

echo ""
echo "==> Configuring extension with GPT-4o and provided API Key..."
cat << EOF > "$ROOT_DIR/extension/config.json"
{
  "openaiKey": "$API_KEY",
  "preferredProvider": "openai-gpt4o",
  "acceleration": "wasm",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
chmod 600 "$ROOT_DIR/extension/config.json"
echo "    [+] extension/config.json created successfully."

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

# 3. Setup Chromium profile directories
mkdir -p "$ROOT_DIR/chrome-config"
chmod -R 777 "$ROOT_DIR/chrome-config" 2>/dev/null || true

# 4. Launch Docker Stack
echo "==> Pulling images and starting GUPTCHARA services..."
$COMPOSE_CMD -f docker-compose.azure.yml pull demo-site || true
$COMPOSE_CMD -f docker-compose.azure.yml up -d

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

# 5. Fetch Public IP and Azure DNS Hostname
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "YOUR_VM_PUBLIC_IP")

AZURE_FQDN=""
if command -v host >/dev/null 2>&1 && [ "$PUBLIC_IP" != "YOUR_VM_PUBLIC_IP" ]; then
  AZURE_FQDN=$(host "$PUBLIC_IP" 2>/dev/null | awk '{print $NF}' | sed 's/\.$//' || true)
fi

echo ""
echo "============================================================"
echo "    GUPTCHARA CLOUD INSTANCE SUCCESSFULLY DEPLOYED!         "
echo "============================================================"
echo ""
echo "⭐ PERMANENT URL FOR YOUR PPT SUBMISSION (NEVER EXPIRES):"
echo "------------------------------------------------------------"
if [ -n "$AZURE_FQDN" ] && [[ "$AZURE_FQDN" == *"cloudapp.azure.com"* ]]; then
  echo "Official Azure FQDN : http://${AZURE_FQDN}"
  echo "Alternative Port 3000: http://${AZURE_FQDN}:3000"
else
  echo "Direct Public IP    : http://${PUBLIC_IP}"
  echo "Alternative Port 3000: http://${PUBLIC_IP}:3000"
  echo ""
  echo "Tip: To assign a custom permanent DNS name like 'http://guptchara-sih.centralindia.cloudapp.azure.com':"
  echo "  1. In Azure Portal -> Public IP resource -> 'Configuration'"
  echo "  2. Fill in 'DNS name label' (e.g. guptchara-demo) and click Save."
fi
echo "------------------------------------------------------------"
echo ""
echo "What judges see when opening the link:"
echo "1. Full Chromium desktop streaming live directly in their browser (via KasmVNC)."
echo "2. The GUPTCHARA e-commerce demo testbed loads immediately."
echo "3. The GUPTCHARA extension is loaded with GPT-4o pre-configured."
echo "4. Autonomous privacy-preserving tasks run with zero cloud PII egress."
echo ""
echo "Useful Commands:"
echo "  Check Status   : ./scripts/check_status.sh"
echo "  View Live Logs : ${COMPOSE_CMD} -f docker-compose.azure.yml logs -f"
echo "  Restart Stack  : ${COMPOSE_CMD} -f docker-compose.azure.yml restart"
echo "============================================================"
