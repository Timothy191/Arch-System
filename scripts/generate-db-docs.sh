#!/bin/bash
set -e

# Install tbls if missing:
#   go install github.com/k1LoW/tbls/cmd/tbls@latest
# Or download a release from https://github.com/k1LoW/tbls/releases

# secretlint-disable-next-line
TBLS_DSN="${TBLS_DSN:-postgres://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable}"
OUT_DIR="docs/database"

echo "Generating database documentation with tbls..."
echo "  DSN: $TBLS_DSN"
echo "  Output: $OUT_DIR"

if ! command -v tbls &> /dev/null; then
  echo "tbls not found. Install it with:"
  echo "  go install github.com/k1LoW/tbls/cmd/tbls@latest"
  exit 1
fi

tbls doc "$TBLS_DSN" "$OUT_DIR"

echo "Done. Open $OUT_DIR/README.md to view."
