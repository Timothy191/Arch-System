#!/bin/bash
set -euo pipefail

N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_EMAIL="${N8N_EMAIL:-timothyoniel558@gmail.com}"
N8N_PASSWORD="${N8N_PASSWORD:-Yugioh@123#}"
WORKFLOW_DIR="$(dirname "$0")/workflows"
COOKIE_JAR=$(mktemp)

echo "Logging in to n8n at $N8N_URL..."
curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$N8N_URL/rest/login" \
  -H "Content-Type: application/json" \
  -d "{\"emailOrLdapLoginId\":\"$N8N_EMAIL\",\"password\":\"$N8N_PASSWORD\"}" > /dev/null

echo "Importing n8n workflows from $WORKFLOW_DIR..."

for f in "$WORKFLOW_DIR"/*.json; do
  name=$(basename "$f" .json)
  echo -n "  $name... "
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -b "$COOKIE_JAR" \
    -X POST "$N8N_URL/rest/workflows" \
    -H "Content-Type: application/json" \
    -d @"$f")
  if [ "$response" = "200" ] || [ "$response" = "201" ]; then
    echo "✓"
  else
    echo "✗ (HTTP $response)"
    curl -s -b "$COOKIE_JAR" "$N8N_URL/rest/workflows" -H "Content-Type: application/json" | python3 -c "import json,sys; [print(f'  [{w[\"id\"]}] {w[\"name\"]}') for w in json.load(sys.stdin).get('data', []) if '$name' in w['id']]" 2>/dev/null
  fi
done

echo ""
echo "Activating workflows..."
for wid in $(curl -s -b "$COOKIE_JAR" "$N8N_URL/rest/workflows" -H "Content-Type: application/json" | python3 -c "import json,sys; [print(w['id']) for w in json.load(sys.stdin).get('data',[]) if not w.get('active')]" 2>/dev/null); do
  vid=$(curl -s -b "$COOKIE_JAR" "$N8N_URL/rest/workflows/$wid" -H "Content-Type: application/json" | python3 -c "import json,sys; d=json.load(sys.stdin).get('data',{}); print(d.get('versionId',''))" 2>/dev/null)
  echo -n "  $wid... "
  code=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -X POST "$N8N_URL/rest/workflows/$wid/activate" -H "Content-Type: application/json" -d "{\"versionId\":\"$vid\"}" 2>/dev/null)
  echo "$code"
done

rm -f "$COOKIE_JAR"
echo "Done."
