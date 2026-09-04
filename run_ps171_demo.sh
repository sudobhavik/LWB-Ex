#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "======================================================================"
echo "[RUN] ISRO PS171 — AUTONOMOUS VISUAL PRIVACY AGENT & VLM DEMO LAUNCHER"
echo "======================================================================"

# Activate persistent virtualenv
source /home/shreyas/.venv_torch/bin/activate

# Check API Key
if [ -f .env ]; then
    echo " Loaded Gemini API configuration from .env"
else
    echo "[WARN] .env file missing! Creating with default configuration..."
fi

echo "[WEB] Starting Split-Screen Interactive Live Dashboard on: http://127.0.0.1:8080"
echo "   - Target Demo Website:  http://127.0.0.1:8080/site/"
echo "   - Live Agent Console:   http://127.0.0.1:8080/"
echo "   - On-Device YOLO Shield: Active (Zero-Egress Mode)"
echo "   - Cloud VLM Model:      Google Gemini 2.5 Flash"
echo "======================================================================"
echo "Press Ctrl+C to stop."
echo ""

python3 dashboard_server.py
