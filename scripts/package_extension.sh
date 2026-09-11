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
node -c "$EXT_DIR/engine/settings_manager.js"
node -c "$EXT_DIR/engine/yolo_processor.js"
node -c "$EXT_DIR/engine/yolo_runner.js"
node -c "$EXT_DIR/engine/pii_detector.js"
node -c "$EXT_DIR/engine/ocr_detector.js"
node -c "$EXT_DIR/engine/canvas_redactor.js"
node -c "$EXT_DIR/engine/omniparser_detector.js"
node -c "$EXT_DIR/engine/anchor_fuser.js"
node -c "$EXT_DIR/engine/vlm_router.js"
echo "    [OK] All JavaScript files passed syntax verification."

echo "==> Verifying extension manifests..."
node -e "
const fs = require('fs');
// 1. Chrome Manifest Verification
const chromeManifest = JSON.parse(fs.readFileSync('$EXT_DIR/manifest.json', 'utf8'));
if (chromeManifest.manifest_version !== 3) throw new Error('Chrome manifest must be Manifest V3');
if (!chromeManifest.side_panel) throw new Error('Chrome manifest missing side_panel');
if (chromeManifest.sidebar_action) throw new Error('Chrome manifest must NOT include sidebar_action');
if (chromeManifest.background?.scripts) throw new Error('Chrome manifest must NOT include background.scripts');
if (!chromeManifest.content_security_policy?.extension_pages?.includes('wasm-unsafe-eval')) {
  throw new Error('Chrome manifest missing wasm-unsafe-eval in CSP');
}
console.log('    [OK] Chrome manifest.json passed all MV3 checks.');

// 2. Firefox Manifest Verification
if (fs.existsSync('$EXT_DIR/manifest.firefox.json')) {
  const ffManifest = JSON.parse(fs.readFileSync('$EXT_DIR/manifest.firefox.json', 'utf8'));
  if (ffManifest.manifest_version !== 3) throw new Error('Firefox manifest must be Manifest V3');
  if (!ffManifest.sidebar_action) throw new Error('Firefox manifest missing sidebar_action');
  if (!ffManifest.browser_specific_settings?.gecko?.id) throw new Error('Firefox manifest missing gecko ID');
  console.log('    [OK] Firefox manifest.firefox.json passed all MV3 checks.');
}
"

echo "==> Verifying required model & library assets..."
test -f "$EXT_DIR/models/yolo26n.onnx" || (echo "[!] Missing yolo26n.onnx in extension/models!" && exit 1)
test -f "$EXT_DIR/models/omniparser_icon_detect.onnx" || (echo "[!] Missing omniparser_icon_detect.onnx in extension/models!" && exit 1)
test -f "$EXT_DIR/lib/ort.all.min.js" || (echo "[!] Missing ort.all.min.js in extension/lib!" && exit 1)
test -f "$EXT_DIR/lib/ort-wasm-simd-threaded.jsep.wasm" || (echo "[!] Missing JSEP wasm binary in extension/lib!" && exit 1)
echo "    [OK] ONNX model and WASM libraries verified."

echo "==> Creating distribution packages..."
mkdir -p "$DIST_DIR"

ZIP_NAME="$DIST_DIR/yolo_webgpu_extension_chrome.zip"
XPI_NAME="$DIST_DIR/yolo_webgpu_extension_firefox.xpi"

python3 -c "
import os, zipfile, shutil

ext_dir = '$EXT_DIR'
zip_name = '$ZIP_NAME'
xpi_name = '$XPI_NAME'

# 1. Package Chrome Extension (default manifest.json)
with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(ext_dir):
        for f in files:
            if f.endswith('.firefox.json') or f == 'config.json':
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, ext_dir)
            z.write(full_path, rel_path)
print('    [OK] Chrome package created:', zip_name)

# 2. Package Firefox Extension (uses manifest.firefox.json as manifest.json)
with zipfile.ZipFile(xpi_name, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(ext_dir):
        for f in files:
            if f == 'manifest.json' or f.endswith('.firefox.json') or f == 'config.json':
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, ext_dir)
            z.write(full_path, rel_path)
    # Add firefox manifest as manifest.json
    ff_manifest_path = os.path.join(ext_dir, 'manifest.firefox.json')
    if os.path.exists(ff_manifest_path):
        z.write(ff_manifest_path, 'manifest.json')
print('    [OK] Firefox package created:', xpi_name)
"
echo "==> Extension packaging and verification completed successfully!"
