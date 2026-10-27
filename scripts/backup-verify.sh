#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/opt/arch-system/scripts/backups}"
LATEST=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
[[ -n "$LATEST" ]] || { echo "No backup found"; exit 1; }
gzip -t "$LATEST" && echo "Backup OK: $LATEST"