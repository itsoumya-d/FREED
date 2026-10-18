#!/usr/bin/env bash
# Packages extension/ into a Web Store-ready zip (contents, not the folder).
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="dist"
OUT_ZIP="$OUT_DIR/freed-guard-extension.zip"

if [ ! -f "extension/rules/adult-blocklist.json" ]; then
  echo "extension rules missing — run: npm run build:extension-rules" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

( cd extension && zip -qr "../$OUT_ZIP" . \
  -x "*.DS_Store" )

echo "Packaged $OUT_ZIP"
unzip -l "$OUT_ZIP" | tail -3
