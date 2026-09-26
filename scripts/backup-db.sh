#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Arch-Systems — Database Backup Script
# Dumps schema and data from Supabase/PostgreSQL to gzip'd
# SQL files in scripts/backups/ with a metadata manifest.
# ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/scripts/backups"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"

# ── Colors ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

PASS="${GREEN}${BOLD}  ✓${NC}"
FAIL="${RED}${BOLD}  ✗${NC}"
INFO="${CYAN}${BOLD}  →${NC}"

# ── Helpers ──────────────────────────────────────────────
log()  { echo -e "  ${INFO} $*${NC}"; }
ok()   { echo -e "  ${PASS} $*${NC}"; }
fail() { echo -e "  ${FAIL} $*${NC}" >&2; }
bail() { fail "$*"; exit 1; }
header() {
  echo
  echo -e "  ${BOLD}${MAGENTA}━━━  $*  ━━━${NC}"
  echo
}

# ── Resolve DATABASE_URL ────────────────────────────────
resolve_db_url() {
  # Direct env var wins
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "$DATABASE_URL"
    return 0
  fi

  # Try to source common env files
  for env_file in "$REPO_ROOT/.env" "$REPO_ROOT/apps/portal/.env" "$REPO_ROOT/apps/portal/env/.env"; do
    if [ -f "$env_file" ]; then
      local candidate
      candidate=$(grep -E '^DATABASE_URL=' "$env_file" | head -1 | cut -d'=' -f2-)
      if [ -n "$candidate" ]; then
        echo "$candidate"
        return 0
      fi
    fi
  done

  # Fallback: construct from SUPABASE_URL + SUPABASE_SERVICE_KEY
  # This builds a connection URI for the Supabase project's Postgres.
  if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
    # SUPABASE_URL format: http://<host>:<port> or https://<ref>.supabase.co
    # Strip scheme and path to extract host:port
    local host_port
    host_port=$(echo "$SUPABASE_URL" | sed -E 's|^https?://||; s|/.*$||')
    local db_host="$host_port"
    local db_port="5432"

    # If SUPABASE_URL has an explicit port override, extract it
    if echo "$host_port" | grep -q ':' ; then
      db_port=$(echo "$host_port" | cut -d':' -f2)
      db_host=$(echo "$host_port" | cut -d':' -f1)
    fi

    # For Supabase cloud projects the DB host differs from API host
    # e.g., https://<ref>.supabase.co → db.<ref>.supabase.co
    if echo "$db_host" | grep -qE '\.supabase\.co$'; then
      local project_ref
      project_ref=$(echo "$db_host" | sed -E 's/\.supabase\.co$//')
      db_host="db.$project_ref.supabase.co"
    fi

    echo "postgresql://postgres:${SUPABASE_SERVICE_KEY}@${db_host}:${db_port}/postgres"
    return 0
  fi

  # Nothing worked
  return 1
}

# ── Main ─────────────────────────────────────────────────
main() {
  header "Database Backup — $(date '+%Y-%m-%d %H:%M:%S')"

  # --- Resolve connection string (Parse at boundary) ---
  local DB_URL
  DB_URL=$(resolve_db_url) || bail "DATABASE_URL not set and could not be resolved from SUPABASE_URL/SUPABASE_SERVICE_KEY or .env files"

  # Mask password for logging
  local DB_URL_LOG
  DB_URL_LOG=$(echo "$DB_URL" | sed -E 's|//[^:]+:[^@]+@|//****:****@|')
  log "Connection: $DB_URL_LOG"

  # --- Verify pg_dump is available ---
  command -v pg_dump > /dev/null 2>&1 || bail "pg_dump not found — install PostgreSQL client tools"
  local PG_DUMP_VERSION
  PG_DUMP_VERSION=$(pg_dump --version 2>/dev/null | head -1 || echo "unknown")
  log "pg_dump: $PG_DUMP_VERSION"

  # --- Create backup directory ---
  mkdir -p "$BACKUP_DIR"
  local SCHEMA_FILE="backup-schema-${TIMESTAMP}.sql.gz"
  local DATA_FILE="backup-data-${TIMESTAMP}.sql.gz"
  local MANIFEST_FILE="backup-${TIMESTAMP}.manifest.txt"
  local SCHEMA_PATH="$BACKUP_DIR/$SCHEMA_FILE"
  local DATA_PATH="$BACKUP_DIR/$DATA_FILE"
  local MANIFEST_PATH="$BACKUP_DIR/$MANIFEST_FILE"

  # --- Dump schema only (no data, no ownership/acl) ---
  header "Schema Dump"
  log "Running pg_dump --schema-only ..."
  if PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    --dbname="$DB_URL" \
    --schema-only \
    --no-owner \
    --no-acl \
    --no-comments \
    --format=plain \
    2>/dev/null \
    | gzip > "$SCHEMA_PATH"; then
    local SCHEMA_SIZE
    SCHEMA_SIZE=$(du -h "$SCHEMA_PATH" | cut -f1)
    ok "Schema dumped: $SCHEMA_FILE ($SCHEMA_SIZE)"
  else
    rm -f "$SCHEMA_PATH"
    bail "Schema dump failed — check DATABASE_URL and connectivity"
  fi

  # --- Dump data only (exclude migration tracking tables) ---
  header "Data Dump"
  log "Running pg_dump --data-only (excluding migration tables) ..."
  if PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
    --dbname="$DB_URL" \
    --data-only \
    --exclude-table='schema_migrations' \
    --exclude-table='supabase_migrations' \
    --exclude-table='_prisma_migrations' \
    --format=plain \
    2>/dev/null \
    | gzip > "$DATA_PATH"; then
    local DATA_SIZE
    DATA_SIZE=$(du -h "$DATA_PATH" | cut -f1)
    ok "Data dumped: $DATA_FILE ($DATA_SIZE)"
  else
    rm -f "$DATA_PATH"
    bail "Data dump failed — check DATABASE_URL and connectivity"
  fi

  # --- Write manifest ---
  header "Manifest"
  cat > "$MANIFEST_PATH" <<MANIFEST
Backup Timestamp: ${TIMESTAMP}
Created At:       $(date '+%Y-%m-%d %H:%M:%S %Z')
pg_dump Version:  ${PG_DUMP_VERSION}
Schema File:      ${SCHEMA_FILE}
Schema Size:      ${SCHEMA_SIZE}
Data File:        ${DATA_FILE}
Data Size:        ${DATA_SIZE}
Connection:       ${DB_URL_LOG}
Excluded Tables:  schema_migrations, supabase_migrations, _prisma_migrations
MANIFEST
  ok "Manifest: $MANIFEST_FILE"

  # --- Summary ---
  header "Backup Complete"
  echo -e "  ${BOLD}Directory:${NC}  ${BACKUP_DIR}/"
  echo -e "  ${BOLD}Schema:${NC}     ${SCHEMA_FILE} (${SCHEMA_SIZE})"
  echo -e "  ${BOLD}Data:${NC}       ${DATA_FILE} (${DATA_SIZE})"
  echo -e "  ${BOLD}Manifest:${NC}   ${MANIFEST_FILE}"
  echo
  
  # --- Retention Policy ---
  header "Retention Policy (7 Days)"
  log "Cleaning up backups older than 7 days..."
  find "$BACKUP_DIR" -type f -name 'backup-*' -mtime +7 -delete
  ok "Cleanup complete"

  echo
  echo -e "  ${GREEN}${BOLD}✓ Backup completed successfully${NC}"
  echo
}

main "$@"
