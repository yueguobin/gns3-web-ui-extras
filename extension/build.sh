#!/usr/bin/env bash
# Build a Firefox package of the GNS3 Management Proxy extension.
#
# Usage:
#   ./build.sh    # output: dist/gns3-proxy-firefox-<version>.zip

set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
DIST="dist"
PKG="${DIST}/gns3-proxy-firefox-${VERSION}"
ZIP="${PKG}.zip"

echo "Building Firefox package, version ${VERSION}…"

rm -rf "$PKG"
mkdir -p "$PKG"

cp -r _locales background.js i18n.js icons popup.html popup.js \
      options.html options.js styles.css manifest.json "$PKG/" 2>/dev/null || true

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
echo "  Unpacked: $PKG (load this folder in about:debugging for testing)"
