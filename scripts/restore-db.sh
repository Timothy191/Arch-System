#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# Arch-Systems — Database Restore Script
# Restores schema and data from a backup taken by
# backup-db.sh.  DESTRUCTIVE — overwrites the target DB.
# Usage: ./scripts/restore-db.sh <timestamp>
#   e.g.  ./scripts/restore-db.sh 2026-06-16_143022
# ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$REPO_ROOT/scripts/backups"

# ── Colors ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[0;2m'

PASS="${GREEN}${BOLD}  ✓${NC}"
FAIL="${RED}${BOLD}  ✗${NC}"
INFO="${CYAN}${BOLD}  →${NC}"
WARN="${YELLOW}${BOLD}  ⚠${NC}"

# ── Helpers ──────────────────────────────────────────────
log()    { echo -e "  ${INFO} $*${NC}"; }
ok()     { echo -e "  ${PASS} $*${NC}"; }
fail()   { echo -e "  ${FAIL} $*${NC}" >&2; }
warn()   { echo -e "  ${WARN} $*${NC}"; }
bail()   { fail "$*"; exit 1; }
header() {
  echo
  echo -e "  ${BOLD}${MAGENTA}━━━  $*  ━━━${NC}"
  echo
}

# ── Resolve DATABASE_URL (same logic as backup-db.sh) ───
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
  if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_KEY:-}" ]; then
    local host_port
    host_port=$(echo "$SUPABASE_URL" | sed -E 's|^https?://||; s|/.*$||')
    local db_host="$host_port"
    local db_port="5432"

    if echo "$host_port" | grep -q ':' ; then
      db_port=$(echo "$host_port" | cut -d':' -f2)
      db_host=$(echo "$host_port" | cut -d':' -f1)
    fi

    if echo "$db_host" | grep -qE '\.supabase\.co$'; then
      local project_ref
      project_ref=$(echo "$db_host" | sed -E 's/\.supabase\.co$//')
      db_host="db.$project_ref.supabase.co"
    fi

    echo "postgresql://postgres:${SUPABASE_SERVICE_KEY}@${db_host}:${db_port}/postgres"
    return 0
  fi

  return 1
}

# ── Validate backup files ────────────────────────────────
find_backup_files() {
  local prefix="$1"

  local schema_file data_file manifest_file

  schema_file=$(find "$BACKUP_DIR" -maxdepth 1 -name "backup-schema-${prefix}*.sql.gz" -print -quit 2>/dev/null || true)
  data_file=$(find "$BACKUP_DIR" -maxdepth 1 -name "backup-data-${prefix}*.sql.gz" -print -quit 2>/dev/null || true)
  manifest_file=$(find "$BACKUP_DIR" -maxdepth 1 -name "backup-${prefix}*.manifest.txt" -print -quit 2>/dev/null || true)

  # If prefix is a full timestamp, also check partial matches
  if [ -z "$schema_file" ]; then
    schema_file=$(find "$BACKUP_DIR" -maxdepth 1 -name "backup-schema-${prefix}.sql.gz" -print -quit 2>/dev/null || true)
  fi
  if [ -z "$data_file" ]; then
    data_file=$(find "$BACKUP_DIR" -maxdepth 1 -name "backup-data-${prefix}.sql.gz" -print -quit 2>/dev/null || true)
  fi

  if [ -z "$schema_file" ] || [ -z "$data_file" ]; then
    echo ""
    return 1
  fi

  echo "$schema_file|$data_file|$manifest_file"
}

# ── Main ─────────────────────────────────────────────────
main() {
  # --- Guard clause: require argument (Early Exit) ---
  if [ $# -lt 1 ]; then
    echo
    echo -e "  ${YELLOW}${BOLD}Usage:${NC} $0 <backup-timestamp>"
    echo
    echo -e "  Restore a database backup created by ${BOLD}backup-db.sh${NC}."
    echo
    echo -e "  ${BOLD}Examples:${NC}"
    echo -e "    $0 2026-06-16_143022"
    echo -e "    $0 2026-06-16"          # matches any dump from that day
    echo
    echo -e "  ${BOLD}Available backups:${NC}"
    if [ -d "$BACKUP_DIR" ] && [ -n "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
      find "$BACKUP_DIR" -maxdepth 1 -name 'backup-*.manifest.txt' -exec basename {} \; \
        | sed 's/^backup-//; s/\.manifest\.txt$//' \
        | sort -r \
        | while IFS= read -r ts; do
            echo -e "    ${CYAN}${ts}${NC}"
          done
    else
      echo -e "    ${DIM}No backups found in ${BACKUP_DIR}/${NC}"
    fi
    echo
    exit 1
  fi

  local BACKUP_PREFIX="$1"

  header "Database Restore — $(date '+%Y-%m-%d %H:%M:%S')"

  # --- Resolve connection string ---
  local DB_URL
  DB_URL=$(resolve_db_url) || bail "DATABASE_URL not set and could not be resolved from SUPABASE_URL/SUPABASE_SERVICE_KEY or .env files"

  local DB_URL_LOG
  DB_URL_LOG=$(echo "$DB_URL" | sed -E 's|//[^:]+:[^@]+@|//****:****@|')
  log "Connection: $DB_URL_LOG"

  # --- Verify psql is available ---
  command -v psql > /dev/null 2>&1 || bail "psql not found — install PostgreSQL client tools"
  local PSQL_VERSION
  PSQL_VERSION=$(psql --version 2>/dev/null | head -1 || echo "unknown")
  log "psql: $PSQL_VERSION"

  # --- Find matching backup files ---
  local BACKUP_FILES
  BACKUP_FILES=$(find_backup_files "$BACKUP_PREFIX") || bail "No backup files found for prefix '${BACKUP_PREFIX}' in ${BACKUP_DIR}/"
  IFS='|' read -r SCHEMA_PATH DATA_PATH MANIFEST_PATH <<< "$BACKUP_FILES"

  # Show manifest if available
  if [ -f "$MANIFEST_PATH" ]; then
    header "Backup Manifest"
    cat "$MANIFEST_PATH" | while IFS= read -r line; do
      echo -e "  ${DIM}${line}${NC}"
    done
  fi

  header "Restore Plan"

  local SCHEMA_SIZE DATA_SIZE
  SCHEMA_SIZE=$(du -h "$SCHEMA_PATH" 2>/dev/null | cut -f1)
  DATA_SIZE=$(du -h "$DATA_PATH" 2>/dev/null | cut -f1)

  echo -e "  ${BOLD}Schema file:${NC}  $(basename "$SCHEMA_PATH") (${SCHEMA_SIZE})"
  echo -e "  ${BOLD}Data file:${NC}    $(basename "$DATA_PATH") (${DATA_SIZE})"
  echo

  # --- Verify connectivity before asking for confirmation ---
  log "Verifying database connectivity ..."
  if ! PGPASSWORD="${DB_PASSWORD:-}" psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    bail "Cannot connect to database — check DATABASE_URL and ensure the server is running"
  fi
  ok "Database is reachable"

  # --- Confirm destructive action ---
  echo
  echo -e "  ${YELLOW}${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
  echo -e "  ${YELLOW}${BOLD}│  DESTRUCTIVE OPERATION                                   │${NC}"
  echo -e "  ${YELLOW}${BOLD}│                                                         │${NC}"
  echo -e "  ${YELLOW}${BOLD}│  This will DROP all existing tables and data in the     │${NC}"
  echo -e "  ${YELLOW}${BOLD}│  target database before restoring from backup.           │${NC}"
  echo -e "  ${YELLOW}${BOLD}│                                                         │${NC}"
  echo -e "  ${YELLOW}${BOLD}│  Target: ${DB_URL_LOG}${NC}"
  echo -e "  ${YELLOW}${BOLD}└─────────────────────────────────────────────────────────┘${NC}"
  echo

  if [ -t 0 ]; then
    # Interactive terminal — prompt
    echo -n -e "  ${YELLOW}Type 'yes' to continue: ${NC}"
    read -r confirmation < /dev/tty || { echo; bail "Aborted."; }
    if [ "$confirmation" != "yes" ]; then
      bail "Restore aborted by user"
    fi
  else
    # Non-interactive — refuse unless FORCE is set
    if [ "${FORCE_RESTORE:-}" != "true" ]; then
      bail "Non-interactive restore requires FORCE_RESTORE=true — refusing to proceed"
    fi
    warn "FORCE_RESTORE=true — skipping confirmation prompt"
  fi

  # --- Step 1: Drop all tables (clean slate) ---
  header "Step 1: Dropping Existing Tables"
  log "Dropping all tables, types, enums, and functions ..."
  if PGPASSWORD="${DB_PASSWORD:-}" psql "$DB_URL" <<'DROPSQL' > /dev/null 2>&1; then
    -- Drop everything in the public schema
    DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

    DO $$ DECLARE
      r RECORD;
    BEGIN
      -- Drop all tables (cascading)
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      -- Drop all types (enums, composites)
      FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype IN ('e', 'c')) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
      -- Drop all functions
      FOR r IN (SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || ' CASCADE';
      END LOOP;
    END $$;
DROPSQL
    ok "All existing public schema objects dropped"
  else
    bail "Failed to drop existing objects — check permissions"
  fi

  # --- Step 2: Restore schema ---
  header "Step 2: Restoring Schema"
  log "Restoring schema from $(basename "$SCHEMA_PATH") ..."
  if gunzip -c "$SCHEMA_PATH" | PGPASSWORD="${DB_PASSWORD:-}" psql "$DB_URL" > /dev/null 2>&1; then
    ok "Schema restored successfully"
  else
    bail "Schema restore failed — database may be in inconsistent state"
  fi

  # --- Step 3: Restore data ---
  header "Step 3: Restoring Data"
  log "Restoring data from $(basename "$DATA_PATH") ..."
  if gunzip -c "$DATA_PATH" | PGPASSWORD="${DB_PASSWORD:-}" psql "$DB_URL" > /dev/null 2>&1; then
    ok "Data restored successfully"
  else
    bail "Data restore failed — database may be in inconsistent state"
  fi

  # --- Done ---
  header "Restore Complete"
  echo -e "  ${GREEN}${BOLD}✓ Database successfully restored from backup '${BACKUP_PREFIX}'${NC}"
  echo
  echo -e "  ${DIM}Backup files:${NC}"
  echo -e "    ${DIM}$(basename "$SCHEMA_PATH")${NC}"
  echo -e "    ${DIM}$(basename "$DATA_PATH")${NC}"
  if [ -n "$MANIFEST_PATH" ] && [ -f "$MANIFEST_PATH" ]; then
    echo -e "    ${DIM}$(basename "$MANIFEST_PATH")${NC}"
  fi
  echo
}

main "$@"
