#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/privkey.pem" \
  -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=localhost/O=Arch Systems/C=ZA" \
  2>/dev/null && echo "Certificates generated in $CERT_DIR"