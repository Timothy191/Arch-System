#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/opt/arch-system/scripts/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
find "$BACKUP_DIR" -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Retention applied: $RETENTION_DAYS days"