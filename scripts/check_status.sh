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
  echo "    [✓] Port 3000 (Slot 1 Web Desktop Core): ACTIVE"
else
  echo "    [✗] Port 3000 (Slot 1): NOT RESPONDING"
fi

if curl -s -m 2 http://127.0.0.1:3002 >/dev/null 2>&1; then
  echo "    [✓] Port 3002 (Slot 2 Web Desktop Core): ACTIVE"
else
  echo "    [!] Port 3002 (Slot 2): Not responding."
fi

if curl -s -m 2 http://127.0.0.1:80 >/dev/null 2>&1; then
  echo "    [✓] Port 80 (HTTP / Caddy Reverse Proxy): ACTIVE"
else
  echo "    [!] Port 80: Not responding locally."
fi

if curl -k -s -m 3 --resolve "${AZURE_FQDN}:443:127.0.0.1" "https://${AZURE_FQDN}" >/dev/null 2>&1; then
  echo "    [✓] Port 443 (Slot 1 HTTPS / TLS Handshake): ACTIVE & HEALTHY"
else
  echo "    [!] Port 443 (Slot 1 HTTPS): Pending certificate or direct IP mode."
fi

if curl -k -s -m 3 --resolve "${AZURE_FQDN}:8443:127.0.0.1" "https://${AZURE_FQDN}:8443" >/dev/null 2>&1; then
  echo "    [✓] Port 8443 (Slot 2 HTTPS / TLS Handshake): ACTIVE & HEALTHY"
else
  echo "    [!] Port 8443 (Slot 2 HTTPS): Pending certificate or direct IP mode."
fi

echo ""
echo "============================================================"
echo "    SUBMISSION & EVALUATOR LINKS                            "
echo "============================================================"
echo " ⭐ OPTION A: DIRECT BROWSER STREAMING (Instant Access):"
echo "    Slot 1 (Evaluator 1): http://${PUBLIC_IP}:3000"
echo "    Slot 2 (Evaluator 2): http://${PUBLIC_IP}:3002"
echo ""
echo " ⭐ OPTION B: SECURE HTTPS DOMAIN (If Domain / DNS Configured):"
echo "    Slot 1 (Evaluator 1): https://${AZURE_FQDN}"
echo "    Slot 2 (Evaluator 2): https://${AZURE_FQDN}:8443"
echo ""
echo " ⭐ OPTION C: FREE CLOUDFLARE HTTPS TUNNEL (Anywhere Access):"
echo "    Run: ./scripts/start_tunnel.sh"
echo "============================================================"
