/**
 * Central metadata registry for Arch-System.
 *
 * Holds canonical metadata for modules, resources, integrations, API routes
 * and server actions so governance, tooling and observability share one source
 * of truth instead of scattered metadata.
 */

type EntityType = 'module' | 'resource' | 'integration' | 'api-route' | 'server-action';

interface MetadataEntry {
  readonly entityType: EntityType;
  readonly id: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly registeredAt: number;
}

const _METADATA_NOT_FOUND = 'METADATA_NOT_FOUND';

/**
 * Registry of canonical entity metadata. Entries are keyed by
 * `${entityType}:${id}` so the same id can coexist across entity types.
 */
export class MetadataRegistry {
  private readonly metadata: Map<string, MetadataEntry> = new Map();

  private entityKey(entityType: EntityType, id: string): string {
    return `${entityType}:${id}`;
  }

  /**
   * Registers or updates metadata for an entity.
   */
  public registerMetadata(options: {
    readonly entityType: EntityType;
    readonly id: string;
    readonly metadata: Readonly<Record<string, unknown>>;
  }): void {
    const key = this.entityKey(options.entityType, options.id);
    this.metadata.set(key, {
      entityType: options.entityType,
      id: options.id,
      metadata: options.metadata,
      registeredAt: Date.now(),
    });
  }

  /**
   * Returns the metadata for an entity, or null when not registered.
   */
  public getMetadata(entityType: EntityType, id: string): Readonly<Record<string, unknown>> | null {
    const entry = this.metadata.get(this.entityKey(entityType, id));
    return entry ? entry.metadata : null;
  }

  /**
   * Returns the full metadata entry for an entity, or null when not registered.
   */
  public getEntry(entityType: EntityType, id: string): MetadataEntry | null {
    return this.metadata.get(this.entityKey(entityType, id)) ?? null;
  }

  /**
   * Returns every metadata entry, optionally filtered by entity type.
   */
  public getAllMetadata(entityType?: EntityType): ReadonlyArray<MetadataEntry> {
    const entries = [...this.metadata.values()];
    if (entityType === undefined) {
      return entries;
    }
    return entries.filter((entry) => entry.entityType === entityType);
  }

  /**
   * Removes metadata for an entity. Returns true when an entry was removed.
   */
  public removeMetadata(entityType: EntityType, id: string): boolean {
    return this.metadata.delete(this.entityKey(entityType, id));
  }

  /**
   * Clears all metadata. Intended for testing.
   */
  public reset(): void {
    this.metadata.clear();
  }
}

/**
 * Shared metadata registry used across the portal.
 */
export const metadataRegistry = new MetadataRegistry();
