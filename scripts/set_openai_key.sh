#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Set / Update OpenAI API Key for Azure Cloud Deployment
# Sanitizes input against terminal bracketed paste artifacts & clears SQLite cache
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

RAW_KEY="${1:-${OPENAI_API_KEY:-}}"

if [ -z "$RAW_KEY" ]; then
  echo "============================================================"
  echo "    GUPTCHARA: Configure OpenAI API Key (GPT-4o)            "
  echo "============================================================"
  echo "Please enter your OpenAI API Key:"
  read -r -s -p "OpenAI API Key: " USER_INPUT
  echo ""
  RAW_KEY="$USER_INPUT"
fi

# Clean and extract OpenAI key regex (sk-...)
API_KEY=$(echo "$RAW_KEY" | grep -oE 'sk-[a-zA-Z0-9_-]{20,}' | head -n 1 || true)
if [ -z "$API_KEY" ]; then
  API_KEY=$(echo "$RAW_KEY" | sed -r 's/\x1B\[[0-9;]*[a-zA-Z~]//g' | tr -dc '[:alnum:]_-\n' | tr -d '\r\n')
fi

if [ -n "$API_KEY" ] && [ ${#API_KEY} -lt 40 ]; then
  echo "[!] Error: The provided key '${API_KEY}' is too short (${#API_KEY} chars). Real OpenAI keys must be 50+ characters."
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "[!] Error: No valid OpenAI API Key detected."
  exit 1
fi

echo "==> Configuring extension with sanitized key..."
cat << INNER_EOF > "$ROOT_DIR/extension/config.json"
{
  "openaiKey": "$API_KEY",
  "preferredProvider": "openai-gpt4o",
  "acceleration": "wasm",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
INNER_EOF
chmod 644 "$ROOT_DIR/extension/config.json"
echo "    [+] extension/config.json written (Prefix: ${API_KEY:0:12}..., Length: ${#API_KEY} chars)"

# Detect docker command
DOCKER_PREFIX=""
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_PREFIX="sudo "
  fi
fi

if ${DOCKER_PREFIX}docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="${DOCKER_PREFIX}docker-compose"
else
  COMPOSE_CMD="${DOCKER_PREFIX}docker compose"
fi

# Stop running browsers to release file locks on chrome-config
echo "==> Stopping browsers to release storage locks..."
$COMPOSE_CMD -f docker-compose.azure.yml stop guptchara-browser guptchara-browser-2 2>/dev/null || true

echo "==> Purging stale extension storage caches for both slots..."
for DIR in "$ROOT_DIR/chrome-config" "$ROOT_DIR/chrome-config-2"; do
  mkdir -p "$DIR"
  sudo find "$DIR" -name "Singleton*" -delete 2>/dev/null || find "$DIR" -name "Singleton*" -delete 2>/dev/null || true
  sudo find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
  sudo find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
  sudo find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || true
  chmod -R 777 "$DIR" 2>/dev/null || true
done

echo "==> Restarting both Chromium containers..."
$COMPOSE_CMD -f docker-compose.azure.yml up -d --force-recreate guptchara-browser guptchara-browser-2 caddy

DOMAIN="${AZURE_DOMAIN:-guptchara-demo.malaysiawest.cloudapp.azure.com}"
if [ -f "$ROOT_DIR/.env" ] && grep -q "AZURE_DOMAIN=" "$ROOT_DIR/.env"; then
  DOMAIN=$(grep "AZURE_DOMAIN=" "$ROOT_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
fi

echo "============================================================"
echo "    [+] OpenAI API Key configured and active on both slots! "
echo "    Slot 1 (Evaluator 1): https://${DOMAIN}"
echo "    Slot 2 (Evaluator 2): https://${DOMAIN}:8443"
echo "============================================================"
