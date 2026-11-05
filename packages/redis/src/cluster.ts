// packages/redis/src/cluster.ts
// Cluster slot co-location validator. MOVED/ASK redirect following is out of
// scope for the REST transport; callers must co-locate multi-key ops.
export function extractSlotTag(key: string): string {
  const match = key.match(/\{([^}]+)\}/);
  return match ? (match[1] as string) : key;
}

export function assertSameSlot(keys: readonly string[]): boolean {
  if (keys.length === 0) return true;
  const firstTag = extractSlotTag(keys[0] as string);
  for (const key of keys) {
    if (extractSlotTag(key) !== firstTag) {
      throw new Error(
        `Keys do not share a cluster slot: "${keys[0]}" vs "${key}" (use hash tags {tag})`
      );
    }
  }
  return true;
}

// TODO: implement MOVED/ASK redirect following when a cluster-aware client
// factory is available. Until then, callers MUST co-locate multi-key operations
// and assertSameSlot is enforced in tests.
