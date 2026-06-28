#!/usr/bin/env bash
# Build a browser-specific package of the GNS3 Management Proxy extension.
#
# Usage:
#   ./build.sh chrome    # output: dist/gns3-proxy-chrome-<version>.zip
#   ./build.sh firefox   # output: dist/gns3-proxy-firefox-<version>.zip
#
# The source tree always uses `manifest.json` (Chrome) for live unpacked
# loading. For Firefox we swap in `manifest.firefox.json` at build time.

set -euo pipefail

cd "$(dirname "$0")"

TARGET="${1:-}"
if [[ "$TARGET" != "chrome" && "$TARGET" != "firefox" ]]; then
  echo "Usage: $0 {chrome|firefox}"
  exit 1
fi

# Read version from the Chrome manifest (source of truth)
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
DIST="dist"
PKG="${DIST}/gns3-proxy-${TARGET}-${VERSION}"
ZIP="${PKG}.zip"

echo "Building ${TARGET} package, version ${VERSION}…"

rm -rf "$PKG"
mkdir -p "$PKG"

# Copy extension files
cp -r _locales background.js i18n.js icons popup.html popup.js \
      options.html options.js styles.css "$PKG/" 2>/dev/null || true

# Select manifest
if [[ "$TARGET" == "firefox" ]]; then
  cp manifest.firefox.json "$PKG/manifest.json"
else
  cp manifest.json "$PKG/manifest.json"
fi

# Zip it (use Python since `zip` may not be installed)
rm -f "$ZIP"
python3 - "$PKG" "$ZIP" <<'PYEOF'
import os, sys, zipfile
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, src))
PYEOF

echo "✓ Built: $ZIP"
echo "✓ Unpacked: $PKG  (load this folder for temporary install)"
