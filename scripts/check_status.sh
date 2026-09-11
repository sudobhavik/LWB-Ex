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
echo "[2] Checking Local Service Ports..."
if curl -s -m 2 http://127.0.0.1:3000 >/dev/null 2>&1; then
  echo "    [✓] Port 3000 (Chromium KasmVNC Desktop): ACTIVE"
else
  echo "    [✗] Port 3000: NOT RESPONDING"
  echo "        Check container logs with: $DOCKER_CMD logs guptchara-streamed-browser --tail 50"
fi

if curl -s -m 2 http://127.0.0.1:80 >/dev/null 2>&1; then
  echo "    [✓] Port 80 (Standard Web Port for PPT): ACTIVE"
else
  echo "    [!] Port 80: Not responding locally or needs sudo permission."
fi

echo ""
echo "[3] Resolving Public Address & Azure Hostname..."
PUBLIC_IP=$(curl -s -m 3 ifconfig.me || curl -s -m 3 icanhazip.com || echo "UNKNOWN")
AZURE_FQDN=""
if command -v host >/dev/null 2>&1 && [ "$PUBLIC_IP" != "UNKNOWN" ]; then
  AZURE_FQDN=$(host "$PUBLIC_IP" 2>/dev/null | awk '{print $NF}' | sed 's/\.$//' || true)
fi

echo "============================================================"
echo "    SUBMISSION LINKS FOR YOUR PRESENTATION (PPT)           "
echo "============================================================"

if [ -n "$AZURE_FQDN" ] && [[ "$AZURE_FQDN" == *"cloudapp.azure.com"* ]]; then
  echo " ⭐ RECOMMENDED PPT LINK (Official Microsoft Azure FQDN):"
  echo "    http://${AZURE_FQDN}"
  echo ""
  echo " Alternative Link with Port 3000:"
  echo "    http://${AZURE_FQDN}:3000"
else
  echo " Direct IP Link (Port 80):"
  echo "    http://${PUBLIC_IP}"
  echo ""
  echo " Direct IP Link (Port 3000):"
  echo "    http://${PUBLIC_IP}:3000"
  echo ""
  echo " Tip to get your permanent *.cloudapp.azure.com link:"
  echo "  1. Azure Portal -> VM 'guptchara-vm' -> Public IP -> Configuration"
  echo "  2. Enter 'guptchara-demo' into 'DNS name label' and click Save"
fi
echo "============================================================"
