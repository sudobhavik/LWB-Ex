#!/usr/bin/env bash
set -e

# ==============================================================================
# GUPTCHARA - Cloud Deployment Diagnostic & Status Check
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================"
echo "    GUPTCHARA: Cloud Instance Diagnostic Check              "
echo "============================================================"

# Check sudo need for docker
DOCKER_CMD="docker"
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER_CMD="sudo docker"
  fi
fi

echo "[1] Checking Docker Container Status..."
CONTAINERS=$($DOCKER_CMD ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep guptchara || true)

if [ -n "$CONTAINERS" ]; then
  echo "    [✓] Containers are running:"
  echo "$CONTAINERS" | sed 's/^/        /'
else
  echo "    [✗] GUPTCHARA containers are NOT currently running!"
  echo "        Run: sudo docker compose -f docker-compose.azure.yml up -d"
fi

echo ""
echo "[2] Resolving Domain Configuration..."
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "UNKNOWN")
AZURE_FQDN=""
if command -v host >/dev/null 2>&1 && [ "$PUBLIC_IP" != "UNKNOWN" ]; then
  AZURE_FQDN=$(host "$PUBLIC_IP" 2>/dev/null | awk '{print $NF}' | sed 's/\.$//' || true)
fi

if [ -z "$AZURE_FQDN" ] || [[ "$AZURE_FQDN" != *"cloudapp.azure.com"* ]]; then
  if [ -f "$ROOT_DIR/.env" ] && grep -q "AZURE_DOMAIN=" "$ROOT_DIR/.env"; then
    AZURE_FQDN=$(grep "AZURE_DOMAIN=" "$ROOT_DIR/.env" | cut -d'=' -f2 | tr -d ' "')
  fi
  if [ -z "$AZURE_FQDN" ] || [[ "$AZURE_FQDN" != *"cloudapp.azure.com"* ]]; then
    AZURE_FQDN="guptchara-demo.malaysiawest.cloudapp.azure.com"
  fi
fi
echo "    [✓] Active Azure Domain: $AZURE_FQDN"

echo ""
echo "[3] Checking Service Endpoints & TLS Handshake..."
if curl -s -m 2 http://127.0.0.1:3000 >/dev/null 2>&1; then
  echo "    [✓] Port 3000 (Chromium Desktop Core): ACTIVE"
else
  echo "    [✗] Port 3000: NOT RESPONDING"
fi

if curl -s -m 2 http://127.0.0.1:80 >/dev/null 2>&1; then
  echo "    [✓] Port 80 (HTTP / Caddy Redirect): ACTIVE"
else
  echo "    [!] Port 80: Not responding locally."
fi

if curl -k -s -m 3 --resolve "${AZURE_FQDN}:443:127.0.0.1" "https://${AZURE_FQDN}" >/dev/null 2>&1; then
  echo "    [✓] Port 443 (HTTPS / TLS Handshake): ACTIVE & HEALTHY"
else
  echo "    [!] Port 443: TLS handshake pending or certificate generating."
  echo "        Run: sudo docker compose -f docker-compose.azure.yml logs --tail 20 caddy"
fi

echo ""
echo "============================================================"
echo "    SUBMISSION LINKS FOR YOUR PRESENTATION (PPT)           "
echo "============================================================"

echo " ⭐ RECOMMENDED PPT LINK (Official Microsoft Azure HTTPS):"
echo "    https://${AZURE_FQDN}"
echo ""
echo " Direct HTTP Link (Redirects to HTTPS automatically):"
echo "    http://${AZURE_FQDN}"
echo ""
echo " Note: Port 443 and Port 80 must be allowed in Azure NSG."
echo "============================================================"
