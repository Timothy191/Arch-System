#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SCADA Telemetry Stream Inspector
# Inspects recent events from the Redis capped telemetry stream buffer
# (stream:telemetry:scada) layered over @repo/redis.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
STREAM_KEY="${SCADA_STREAM_KEY:-stream:telemetry:scada}"
COUNT="${1:-10}"

echo "📡 [SCADA STREAM] Inspecting last ${COUNT} entries from '${STREAM_KEY}'..."

# Fallback runner using Node and @repo/redis if redis-cli is absent
node --input-type=module <<NODE_SCRIPT
import { getRedisClient, closeRedis } from '${ROOT_DIR}/packages/redis/dist/index.js';

async function main() {
  try {
    const client = await getRedisClient();
    if (!client || !client.isOpen) {
      console.log('⚠️  Redis client could not connect. Ensure REDIS_URL is reachable.');
      return;
    }

    // Attempt XREVRANGE via sendCommand or raw Redis command
    const entries = await client.sendCommand(['XREVRANGE', '${STREAM_KEY}', '+', '-', 'COUNT', '${COUNT}']);
    if (!entries || entries.length === 0) {
      console.log('ℹ️  No telemetry entries currently in stream "${STREAM_KEY}".');
      return;
    }

    console.log(\`✅ Retrieved \${entries.length} stream entries:\`);
    for (const [id, fields] of entries) {
      console.log(\`  ID: \${id}\`);
      for (let i = 0; i < fields.length; i += 2) {
        console.log(\`    \${fields[i]}: \${fields[i + 1]}\`);
      }
    }
  } catch (err) {
    console.error('❌ Error inspecting SCADA stream:', err.message);
  } finally {
    await closeRedis();
  }
}

main().catch(console.error);
NODE_SCRIPT
