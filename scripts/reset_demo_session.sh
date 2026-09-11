#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Instant Demo Session Reset
# Clears shopping cart, purges cached extension storage, and resets both slots
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================================"
echo "    GUPTCHARA: Resetting Demo Sessions for Evaluators       "
echo "============================================================"

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

echo "==> Stopping both browser slot containers..."
$COMPOSE_CMD -f docker-compose.azure.yml stop guptchara-browser guptchara-browser-2 2>/dev/null || true

echo "==> Purging cached extension storage and session state..."
for DIR in "$ROOT_DIR/chrome-config" "$ROOT_DIR/chrome-config-2"; do
  if [ -d "$DIR" ]; then
    sudo find "$DIR" -name "Singleton*" -delete 2>/dev/null || find "$DIR" -name "Singleton*" -delete 2>/dev/null || true
    sudo find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
    sudo find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*Sync Extension Settings*" -exec rm -rf {} + 2>/dev/null || true
    sudo find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || find "$DIR" -type d -name "*IndexedDB*" -exec rm -rf {} + 2>/dev/null || true
  fi
done

echo "==> Restarting both browser slots..."
$COMPOSE_CMD -f docker-compose.azure.yml up -d --force-recreate guptchara-browser guptchara-browser-2

DOMAIN="${AZURE_DOMAIN:-guptchara-demo.malaysiawest.cloudapp.azure.com}"
if [ -f "$ROOT_DIR/.env" ] && grep -q "AZURE_DOMAIN=" "$ROOT_DIR/.env"; then
  DOMAIN=$(grep "AZURE_DOMAIN=" "$ROOT_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
fi

echo "============================================================"
echo "    [+] Both evaluator slots have been reset to pristine state!"
echo "    Slot 1 (Evaluator 1): https://${DOMAIN}"
echo "    Slot 2 (Evaluator 2): https://${DOMAIN}:8443"
echo "============================================================"
