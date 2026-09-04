#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ ! -d ".venv" ]; then
    echo "Creating Python environment..."
    uv venv .venv
    source .venv/bin/activate
    uv pip install fastapi uvicorn pillow ultralytics opencv-python-headless
else
    source .venv/bin/activate
fi

MODEL_PATH="${1:-/home/shreyas/Downloads/yolo26n.pt}"

echo "=========================================================="
echo "[SHIELD]  PS171 Privacy Agent — YOLO26 Detection Server"
echo "Model: $MODEL_PATH"
echo "URL:   http://localhost:8000"
echo "=========================================================="

python3 server/server.py --model "$MODEL_PATH" --port 8000
