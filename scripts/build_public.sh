#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT="$ROOT_DIR/public"
rm -rf "$OUT"
mkdir -p "$OUT/vendor" "$OUT/3d"
cp -v "$ROOT_DIR"/index.html "$ROOT_DIR"/landingpage_2.html "$ROOT_DIR"/globe.html "$ROOT_DIR"/404.html "$ROOT_DIR"/sitemap.xml "$ROOT_DIR"/robots.txt "$OUT" 2>/dev/null || true
cp -v "$ROOT_DIR"/styles.css "$ROOT_DIR"/no-section-bg.css "$ROOT_DIR"/config.js "$ROOT_DIR"/sphere.js "$ROOT_DIR"/reviews.js "$ROOT_DIR"/editmode.js "$ROOT_DIR"/mock-reviews.json "$OUT"
cp -v "$ROOT_DIR"/logo*.png "$ROOT_DIR"/ofs_free.png "$ROOT_DIR"/fitter.jpg "$ROOT_DIR"/background.png "$OUT" 2>/dev/null || true
cp -v "$ROOT_DIR"/vendor/three.min.js "$OUT/vendor/" 2>/dev/null || true
cp -Rv "$ROOT_DIR"/3d/* "$OUT/3d/" 2>/dev/null || true
mkdir -p "$OUT/aws"
if [ -f "$ROOT_DIR/aws/config.json" ]; then
  cp -v "$ROOT_DIR/aws/config.json" "$OUT/aws/config.json"
else
  cp -v "$ROOT_DIR/aws/config.sample.json" "$OUT/aws/config.json" || true
fi
echo "Built to $OUT" && du -sh "$OUT" || true
