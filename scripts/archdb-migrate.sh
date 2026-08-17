#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATION_DIR="${1:-database/archdb/migrations}"
PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X)
"${PSQL[@]}" -c 'CREATE SCHEMA IF NOT EXISTS archdb; CREATE TABLE IF NOT EXISTS archdb.migration_lock (id boolean PRIMARY KEY DEFAULT true, acquired_at timestamptz NOT NULL DEFAULT now());'
"${PSQL[@]}" -c "SELECT pg_advisory_lock(hashtextextended('archdb:migrations', 0));"
trap '"${PSQL[@]}" -c "SELECT pg_advisory_unlock(hashtextextended('"'"'archdb:migrations'"'"', 0));" >/dev/null' EXIT
while IFS= read -r file; do
  version="$(basename "$file" | cut -d_ -f1)"
  name="$(basename "$file" .sql | cut -d_ -f2- )"
  applied="$("${PSQL[@]}" -Atc "SELECT 1 FROM archdb.migrations WHERE version=${version} LIMIT 1;")"
  if [[ "$applied" == "1" ]]; then continue; fi
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  started="$(date +%s%3N)"
  "${PSQL[@]}" -f "$file"
  elapsed=$(( $(date +%s%3N) - started ))
  "${PSQL[@]}" -c "INSERT INTO archdb.migrations(version,name,checksum,applied_by,execution_ms) VALUES (${version}, '${name//\'/\'\'}', '${checksum}', '${ARCHDB_MIGRATION_ACTOR:-archdb-cli}', ${elapsed});"
done < <(find "$MIGRATION_DIR" -maxdepth 1 -type f -name '*.sql' | sort)
