#!/usr/bin/env bash
# ==============================================================================
# PS171 Privacy Agent - Mozilla Firefox Extension Packager & Syntax Validator
# Compatibility: Google Chrome Manifest V3 and Mozilla Firefox Manifest V3
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="${SCRIPT_DIR}/extension"
DIST_DIR="${SCRIPT_DIR}/dist"
OUTPUT_NAME="ps171-privacy-agent-firefox"
VERIFY_ONLY=0

# Parse command-line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--verify-only)
      VERIFY_ONLY=1
      shift
      ;;
    -o|--output)
      OUTPUT_NAME="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -v, --verify-only    Validate JavaScript syntax and manifest without packaging"
      echo "  -o, --output NAME    Custom base name for the generated package (default: ps171-privacy-agent-firefox)"
      echo "  -h, --help           Display this help message"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1"
      echo "Run '$0 --help' for usage instructions."
      exit 1
      ;;
  esac
done

echo "======================================================================"
echo "[PS171] Firefox Extension Verification and Packaging Utility"
echo "======================================================================"
echo "Source directory: ${EXT_DIR}"
echo ""

# 1. Verify existence of critical extension files
echo "[1/4] Checking required extension assets..."
REQUIRED_FILES=(
  "manifest.json"
  "background/background.js"
  "content/content.js"
  "content/overlay.css"
  "popup/popup.html"
  "popup/popup.js"
  "popup/popup.css"
  "engine/onnx_detector.js"
  "engine/yolo_worker.js"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

for rel_path in "${REQUIRED_FILES[@]}"; do
  full_path="${EXT_DIR}/${rel_path}"
  if [[ ! -f "${full_path}" ]]; then
    echo "[FAIL] Missing required file: ${rel_path}"
    exit 1
  fi
done
echo "[OK] All required files are present."

# 2. Validate manifest.json structure and Firefox-specific entries
echo ""
echo "[2/4] Validating manifest.json for Firefox Manifest V3..."
python3 - <<PYEOF
import json
import sys

manifest_path = "${EXT_DIR}/manifest.json"
try:
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"[FAIL] Invalid JSON in {manifest_path}: {e}")
    sys.exit(1)

# Check Manifest Version
if data.get("manifest_version") != 3:
    print(f"[FAIL] manifest_version must be 3, found: {data.get('manifest_version')}")
    sys.exit(1)

# Check browser_specific_settings for Gecko / Firefox
bss = data.get("browser_specific_settings", {})
gecko = bss.get("gecko", {})
gecko_id = gecko.get("id")
strict_min = gecko.get("strict_min_version")

if not gecko_id:
    print("[FAIL] Missing 'browser_specific_settings.gecko.id' in manifest.json")
    sys.exit(1)

if not strict_min:
    print("[FAIL] Missing 'browser_specific_settings.gecko.strict_min_version' in manifest.json")
    sys.exit(1)

# Check sidebar_action for native Firefox sidebar / side panel
sidebar = data.get("sidebar_action", {})
if not sidebar.get("default_panel"):
    print("[FAIL] Missing 'sidebar_action.default_panel' in manifest.json for Firefox side panel")
    sys.exit(1)

# Check background.scripts for Firefox MV3 compatibility
bg = data.get("background", {})
if not bg.get("scripts"):
    print("[FAIL] Missing 'background.scripts' in manifest.json for Firefox MV3 compatibility")
    sys.exit(1)

print(f"[OK] Manifest validated: ID={gecko_id}, min_version={strict_min}, sidebar_panel={sidebar.get('default_panel')}, bg_scripts={bg.get('scripts')}")
PYEOF

# 3. Validate JavaScript syntax on all extension scripts
echo ""
echo "[3/4] Validating JavaScript syntax with node -c..."
JS_FILES=(
  "background/background.js"
  "content/content.js"
  "popup/popup.js"
  "engine/onnx_detector.js"
  "engine/yolo_worker.js"
  "test_page.js"
)

for js in "${JS_FILES[@]}"; do
  target="${EXT_DIR}/${js}"
  if [[ -f "${target}" ]]; then
    node -c "${target}"
    echo "[OK] Syntax verified: ${js}"
  fi
done

if [[ ${VERIFY_ONLY} -eq 1 ]]; then
  echo ""
  echo "======================================================================"
  echo "[SUCCESS] Verification passed (--verify-only specified, packaging skipped)."
  echo "======================================================================"
  exit 0
fi

# 4. Package extension into distributable .xpi and .zip archives
echo ""
echo "[4/4] Packaging extension for Mozilla Firefox..."
mkdir -p "${DIST_DIR}"

ZIP_OUT="${DIST_DIR}/${OUTPUT_NAME}.zip"
XPI_OUT="${DIST_DIR}/${OUTPUT_NAME}.xpi"

python3 - <<PYEOF
import os
import zipfile

src_dir = "${EXT_DIR}"
zip_path = "${ZIP_OUT}"
xpi_path = "${XPI_OUT}"

exclude_patterns = {".DS_Store", "Thumbs.db", ".git", ".gitignore"}

def build_zip(target_path):
    with zipfile.ZipFile(target_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            for file in sorted(files):
                if file in exclude_patterns or file.endswith("~") or file.endswith(".tmp"):
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, src_dir)
                zf.write(full_path, rel_path)

print("[INFO] Creating Firefox zip package...")
build_zip(zip_path)

print("[INFO] Creating Firefox xpi package...")
build_zip(xpi_path)

zip_size_kb = os.path.getsize(zip_path) / 1024
xpi_size_kb = os.path.getsize(xpi_path) / 1024

print(f"[OK] Generated: {zip_path} ({zip_size_kb:.1f} KB)")
print(f"[OK] Generated: {xpi_path} ({xpi_size_kb:.1f} KB)")
PYEOF

echo ""
echo "======================================================================"
echo "[SUCCESS] Firefox extension packaging complete!"
echo "Archives generated in: ${DIST_DIR}"
echo "1. ${XPI_OUT} (Direct Firefox addon install)"
echo "2. ${ZIP_OUT} (Archive distribution)"
echo ""
echo "To test in Firefox:"
echo "1. Open Firefox and navigate to about:debugging#/runtime/this-firefox"
echo "2. Click 'Load Temporary Add-on...'"
echo "3. Select: ${EXT_DIR}/manifest.json (or ${XPI_OUT})"
echo "======================================================================"
