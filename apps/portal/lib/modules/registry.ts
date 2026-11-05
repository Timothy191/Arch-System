/**
 * Intelligent module loading layer for Arch-System.
 *
 * Implements the module lifecycle from the performance architecture:
 * Core functionality loads first, required modules load when needed,
 * optional modules remain inactive until requested, and shared services
 * are reused rather than duplicated. Module load times are reported to
 * the performance monitor for observability.
 */

type ModuleKind = 'core' | 'active' | 'on-demand' | 'shared-service';
type ModuleStatus = 'registered' | 'loading' | 'loaded' | 'failed' | 'inactive';

interface ModuleDescriptor {
  readonly id: string;
  readonly kind: ModuleKind;
  readonly version: string;
  readonly dependencies: ReadonlyArray<string>;
  readonly loader?: () => Promise<unknown>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

interface ModuleRecord {
  readonly id: string;
  readonly kind: ModuleKind;
  readonly version: string;
  status: ModuleStatus;
  loadedAt: number | null;
  loadDurationMs: number | null;
  error: Error | null;
  exports: unknown | null;
}

const MODULE_NOT_FOUND = 'MODULE_NOT_FOUND';
const MODULE_ALREADY_REGISTERED = 'MODULE_ALREADY_REGISTERED';
const MODULE_LOAD_FAILED = 'MODULE_LOAD_FAILED';
const SHARED_SERVICE_ALREADY_REGISTERED = 'SHARED_SERVICE_ALREADY_REGISTERED';

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function createModuleRecord(descriptor: ModuleDescriptor): ModuleRecord {
  const isCore = descriptor.kind === 'core';
  return {
    id: descriptor.id,
    kind: descriptor.kind,
    version: descriptor.version,
    status: isCore ? 'loaded' : 'registered',
    loadedAt: isCore ? Date.now() : null,
    loadDurationMs: null,
    error: null,
    exports: null,
  };
}

/**
 * Registry of application modules with Core / Active / On-Demand lifecycle
 * and shared-service management.
 */
export class ModuleRegistry {
  private readonly descriptors: Map<string, ModuleDescriptor> = new Map();
  private readonly modules: Map<string, ModuleRecord> = new Map();
  private readonly sharedServiceFactories: Map<string, () => unknown> = new Map();
  private readonly sharedServiceInstances: Map<string, unknown> = new Map();

  /**
   * Registers a module descriptor. Core modules are marked loaded immediately.
   */
  public registerModule(descriptor: ModuleDescriptor): void {
    if (this.descriptors.has(descriptor.id)) {
      throw new Error(`${MODULE_ALREADY_REGISTERED}: ${descriptor.id}`);
    }
    this.descriptors.set(descriptor.id, descriptor);
    this.modules.set(descriptor.id, createModuleRecord(descriptor));
  }

  /**
   * Returns whether a module is loaded. Core modules are loaded by virtue of
   * being imported; loaded modules have completed their loader successfully.
   */
  public isLoaded(moduleId: string): boolean {
    const record = this.modules.get(moduleId);
    return record?.status === 'loaded';
  }

  /**
   * Loads a module, executing its loader once and caching the result. Core and
   * already-loaded modules return their cached exports immediately.
   */
  public async loadModule(moduleId: string): Promise<unknown> {
    const record = this.modules.get(moduleId);
    if (record === undefined) {
      throw new Error(`${MODULE_NOT_FOUND}: ${moduleId}`);
    }
    if (record.status === 'loaded') {
      return record.exports;
    }
    const descriptor = this.descriptors.get(moduleId);
    if (descriptor === undefined || descriptor.loader === undefined) {
      throw new Error(`${MODULE_LOAD_FAILED}: ${moduleId} has no loader`);
    }
    record.status = 'loading';
    const startTime = nowMs();
    try {
      const exportsValue = await descriptor.loader();
      record.status = 'loaded';
      record.exports = exportsValue;
      record.loadedAt = Date.now();
      record.loadDurationMs = nowMs() - startTime;
      record.error = null;
      return exportsValue;
    } catch (caughtError) {
      record.status = 'failed';
      record.error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
      record.loadDurationMs = nowMs() - startTime;
      throw record.error;
    }
  }

  /**
   * Loads every module whose kind is "active".
   */
  public async loadActiveModules(): Promise<ReadonlyArray<unknown>> {
    const activeIds = [...this.descriptors.entries()]
      .filter(([, descriptor]) => descriptor.kind === 'active')
      .map(([id]) => id);
    return Promise.all(activeIds.map((id) => this.loadModule(id)));
  }

  /**
   * Returns the module record for an id, or null when unknown.
   */
  public getModule(moduleId: string): ModuleRecord | null {
    return this.modules.get(moduleId) ?? null;
  }

  /**
   * Returns every loaded module record.
   */
  public getLoadedModules(): ReadonlyArray<ModuleRecord> {
    return [...this.modules.values()].filter((record) => record.status === 'loaded');
  }

  /**
   * Registers a shared-service factory. The factory runs once and the instance
   * is reused on every subsequent call.
   */
  public registerSharedService<T>(id: string, factory: () => T): void {
    if (this.sharedServiceFactories.has(id)) {
      throw new Error(`${SHARED_SERVICE_ALREADY_REGISTERED}: ${id}`);
    }
    this.sharedServiceFactories.set(id, factory);
  }

  /**
   * Returns the shared-service instance for an id, creating it on first use.
   * Returns null when no service is registered for the id.
   */
  public getSharedService<T>(id: string): T | null {
    if (this.sharedServiceInstances.has(id)) {
      return this.sharedServiceInstances.get(id) as T;
    }
    const factory = this.sharedServiceFactories.get(id);
    if (factory === undefined) {
      return null;
    }
    const instance = factory();
    this.sharedServiceInstances.set(id, instance);
    return instance as T;
  }

  /**
   * Returns a lifecycle summary: total modules, counts by kind and by status.
   */
  public getLifecycleSnapshot(): {
    readonly total: number;
    readonly byKind: Readonly<Record<ModuleKind, number>>;
    readonly byStatus: Readonly<Record<ModuleStatus, number>>;
  } {
    const byKind: Record<ModuleKind, number> = {
      core: 0,
      active: 0,
      'on-demand': 0,
      'shared-service': 0,
    };
    const byStatus: Record<ModuleStatus, number> = {
      registered: 0,
      loading: 0,
      loaded: 0,
      failed: 0,
      inactive: 0,
    };
    for (const record of this.modules.values()) {
      byKind[record.kind] += 1;
      byStatus[record.status] += 1;
    }
    return {
      total: this.modules.size,
      byKind: Object.freeze(byKind),
      byStatus: Object.freeze(byStatus),
    };
  }

  /**
   * Clears all modules and shared services. Intended for testing.
   */
  public reset(): void {
    this.descriptors.clear();
    this.modules.clear();
    this.sharedServiceFactories.clear();
    this.sharedServiceInstances.clear();
  }
}

/**
 * Shared module registry used across the portal.
 */
export const moduleRegistry = new ModuleRegistry();
