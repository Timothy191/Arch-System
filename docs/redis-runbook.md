# Redis Operational Runbook

## 1. Memory Fragmentation Mitigation (`mem_fragmentation_ratio > 1.5`)

- **Trigger criteria**: `mem_fragmentation_ratio > 1.5` sustained for > 15 minutes AND `used_memory_rss > 512MB`.
- **Action**:
  1. Inspect allocator stats via `INFO memory`.
  2. Enable active defrag (`CONFIG SET activedefrag yes`) during low-traffic window, or run `MEMORY PURGE` on Jemalloc builds.
  3. If ratio > 2.0 persists, schedule rolling replica restart.

## 2. Resharding Decision Tree

- **CPU > 75% on single primary OR `used_memory > 75% maxmemory`**:
  - Verify hash-tag slot distribution (`buildClusterSlotKey` / `assertSameSlot`).
  - If single slot hot-key: increase L1 TTL floor (`enforceHotKeyTtlFloor`) and enable XFetch early refresh.
  - If uniform dataset growth: add shard and migrate slots during off-shift window.

## 3. Big-Key Remediation Steps

1. Run `auditBigKeys({ scanCount: 100, sizeThresholdBytes: 65536 })`.
2. For large Strings (>100KB): split into Hash fields (`cacheHashSetFields`) or compress payload.
3. For unbounded Hashes/Sets/ZSets: shard by time bucket or apply bounded range trimming (`XTRIM MAXLEN ~`, `ZREMRANGEBYRANK`).
4. Always delete oversized keys with `UNLINK` (`cacheDelete` / `runPipeline`), never `DEL`.
