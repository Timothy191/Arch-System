/**
 * Centralized resource management layer for Arch-System.
 *
 * Provides a single catalog for images, fonts, static files, configuration
 * assets, downloadable resources, cached responses and external resources,
 * so resources are declared once, reused consistently, and delivery policy
 * (cacheability, TTL) is centralized instead of duplicated.
 */

type ResourceType =
  | 'image'
  | 'font'
  | 'static-file'
  | 'config-asset'
  | 'downloadable-resource'
  | 'cached-response'
  | 'external-resource';

interface ResourceDescriptor {
  readonly id: string;
  readonly type: ResourceType;
  readonly location: string;
  readonly sizeBytes?: number;
  readonly contentType?: string;
  readonly cacheable: boolean;
  readonly ttlSeconds?: number;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface ResourceRecord extends ResourceDescriptor {
  readonly registeredAt: number;
}

const _RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND';
const RESOURCE_ALREADY_REGISTERED = 'RESOURCE_ALREADY_REGISTERED';

/**
 * Central registry of application resources. Each resource is registered once
 * with its delivery policy; consumers look it up by id rather than hardcoding
 * URLs or duplicating assets.
 */
export class ResourceRegistry {
  private readonly resources: Map<string, ResourceRecord> = new Map();

  /**
   * Registers a resource descriptor.
   */
  public registerResource(descriptor: ResourceDescriptor): void {
    if (this.resources.has(descriptor.id)) {
      throw new Error(`${RESOURCE_ALREADY_REGISTERED}: ${descriptor.id}`);
    }
    this.resources.set(descriptor.id, {
      ...descriptor,
      registeredAt: Date.now(),
    });
  }

  /**
   * Returns the resource record for an id, or null when unknown.
   */
  public getResource(resourceId: string): ResourceRecord | null {
    return this.resources.get(resourceId) ?? null;
  }

  /**
   * Returns every resource of the given type.
   */
  public getResourcesByType(resourceType: ResourceType): ReadonlyArray<ResourceRecord> {
    return [...this.resources.values()].filter((resource) => resource.type === resourceType);
  }

  /**
   * Returns every registered resource.
   */
  public getAllResources(): ReadonlyArray<ResourceRecord> {
    return [...this.resources.values()];
  }

  /**
   * Returns every cacheable resource.
   */
  public getCacheableResources(): ReadonlyArray<ResourceRecord> {
    return [...this.resources.values()].filter((resource) => resource.cacheable);
  }

  /**
   * Returns a usage summary: total resources, counts by type, cacheable count.
   */
  public getResourceUsageSnapshot(): {
    readonly total: number;
    readonly byType: Readonly<Record<ResourceType, number>>;
    readonly cacheableCount: number;
  } {
    const byType: Record<ResourceType, number> = {
      image: 0,
      font: 0,
      'static-file': 0,
      'config-asset': 0,
      'downloadable-resource': 0,
      'cached-response': 0,
      'external-resource': 0,
    };
    let cacheableCount = 0;
    for (const resource of this.resources.values()) {
      byType[resource.type] += 1;
      if (resource.cacheable) {
        cacheableCount += 1;
      }
    }
    return {
      total: this.resources.size,
      byType: Object.freeze(byType),
      cacheableCount,
    };
  }

  /**
   * Clears all resources. Intended for testing.
   */
  public reset(): void {
    this.resources.clear();
  }
}

/**
 * Shared resource registry used across the portal.
 */
export const resourceRegistry = new ResourceRegistry();
