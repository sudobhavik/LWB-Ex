#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"

echo "==> Validating JavaScript syntax across extension..."
node -c "$EXT_DIR/background/background.js"
node -c "$EXT_DIR/content/content.js"
node -c "$EXT_DIR/sidepanel/sidepanel.js"
node -c "$EXT_DIR/engine/yolo_processor.js"
node -c "$EXT_DIR/engine/yolo_runner.js"
node -c "$EXT_DIR/engine/pii_detector.js"
node -c "$EXT_DIR/engine/ocr_detector.js"
node -c "$EXT_DIR/engine/canvas_redactor.js"
node -c "$EXT_DIR/engine/vlm_router.js"
echo "    [OK] All JavaScript files passed syntax verification."

echo "==> Verifying extension manifest..."
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('$EXT_DIR/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3) throw new Error('Must be Manifest V3');
if (!manifest.side_panel || !manifest.sidebar_action) throw new Error('Missing side_panel or sidebar_action');
if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko) throw new Error('Missing gecko ID');
if (!manifest.content_security_policy || !manifest.content_security_policy.extension_pages.includes('wasm-unsafe-eval')) throw new Error('Missing wasm-unsafe-eval in CSP');
console.log('    [OK] manifest.json passed all MV3 cross-browser checks.');
"

echo "==> Verifying required model & library assets..."
test -f "$EXT_DIR/models/yolo26n.onnx" || (echo "[!] Missing yolo26n.onnx in extension/models!" && exit 1)
test -f "$EXT_DIR/lib/ort.all.min.js" || (echo "[!] Missing ort.all.min.js in extension/lib!" && exit 1)
test -f "$EXT_DIR/lib/ort-wasm-simd-threaded.jsep.wasm" || (echo "[!] Missing JSEP wasm binary in extension/lib!" && exit 1)
echo "    [OK] ONNX model and WASM libraries verified."

echo "==> Creating distribution packages..."
mkdir -p "$DIST_DIR"

ZIP_NAME="$DIST_DIR/yolo_webgpu_extension_chrome.zip"
XPI_NAME="$DIST_DIR/yolo_webgpu_extension_firefox.xpi"

python3 -c "
import os, zipfile
ext_dir = '$EXT_DIR'
zip_name = '$ZIP_NAME'
with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(ext_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, ext_dir)
            z.write(full_path, rel_path)
print('    [OK] Chrome package created:', zip_name)
"
cp "$ZIP_NAME" "$XPI_NAME"
echo "    [OK] Firefox package created: $XPI_NAME"
echo "==> Extension packaging and verification completed successfully!"
