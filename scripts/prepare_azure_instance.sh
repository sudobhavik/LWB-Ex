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

# Detect docker compose plugin or standalone docker-compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "    [!] Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin || true
  COMPOSE_CMD="docker compose"
fi

# 3. Setup Chromium profile directories
mkdir -p "$ROOT_DIR/chrome-config"

# 4. Launch Docker Stack
echo "==> Pulling images and starting GUPTCHARA services..."
$COMPOSE_CMD -f docker-compose.azure.yml pull demo-site || true
$COMPOSE_CMD -f docker-compose.azure.yml up -d

echo ""
echo "============================================================"
echo "    GUPTCHARA CLOUD INSTANCE SUCCESSFULLY DEPLOYED!         "
echo "============================================================"

# Try to get public IP
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "YOUR_VM_PUBLIC_IP")

echo ""
echo "Access your live browser instance here:"
echo "------------------------------------------------------------"
echo "Direct HTTP URL: http://${PUBLIC_IP}:3000"
echo "Secure HTTPS URL: https://${PUBLIC_IP}:3001"
echo "------------------------------------------------------------"
echo ""
echo "What happens when you open the URL:"
echo "1. The full Chromium desktop appears directly inside your web browser."
echo "2. The GUPTCHARA e-commerce demo testbed loads automatically."
echo "3. The GUPTCHARA extension is loaded with GPT-4o set as default."
echo "4. Your OpenAI API Key is pre-configured and ready for autonomous agent runs."
echo ""
echo "To share a public HTTPS link with judges without opening ports, run:"
echo "  ./scripts/start_tunnel.sh"
echo "============================================================"
