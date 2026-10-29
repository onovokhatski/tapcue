#!/bin/sh
# Rebuilds assets/ from the designer's artwork in docs/design/prototype/src/art (macOS: needs Swift).
set -e
cd "$(dirname "$0")"
ART=../../../docs/design/prototype/src/art
OUT=../assets
TMP=$(mktemp -d)
for page in home product-a product-b about; do
  swift svg2png.swift "$ART/$page.svg" "$TMP/$page.png" 2048 1536
done
for page in home product-a product-b; do
  sips -s format jpeg -s formatOptions 88 "$TMP/$page.png" --out "$OUT/$page.jpg" >/dev/null
done
swift loop.swift "$TMP/about.png" "$OUT/about-loop.mp4"
rm -r "$TMP"
