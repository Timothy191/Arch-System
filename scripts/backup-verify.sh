#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/opt/arch-system/scripts/backups}"
mkdir -p "$BACKUP_DIR"
LATEST=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
if [[ -z "$LATEST" ]]; then echo "No backup found"; exit 0; fi
if gzip -t "$LATEST"; then echo "Backup OK: $LATEST"; else echo "Backup corrupt: $LATEST"; exit 1; fi