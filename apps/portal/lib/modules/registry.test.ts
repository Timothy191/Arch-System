import { moduleRegistry } from './registry';

describe('ModuleRegistry', () => {
  beforeEach(() => {
    moduleRegistry.reset();
  });

  const coreDescriptor = {
    id: 'performance-monitor',
    kind: 'core' as const,
    version: '1.0.0',
    dependencies: [],
    metadata: { purpose: 'performance measurement' },
  };

  describe('module registration', () => {
    it('marks core modules as loaded immediately', () => {
      moduleRegistry.registerModule(coreDescriptor);

      expect(moduleRegistry.isLoaded('performance-monitor')).toBe(true);
      const record = moduleRegistry.getModule('performance-monitor')!;
      expect(record.status).toBe('loaded');
      expect(record.loadedAt).not.toBeNull();
    });

    it('marks non-core modules as registered, not loaded', () => {
      moduleRegistry.registerModule({
        id: 'telemetry-chart',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        metadata: {},
      });

      expect(moduleRegistry.isLoaded('telemetry-chart')).toBe(false);
      expect(moduleRegistry.getModule('telemetry-chart')!.status).toBe('registered');
    });

    it('throws when registering a duplicate module id', () => {
      moduleRegistry.registerModule(coreDescriptor);

      expect(() => moduleRegistry.registerModule(coreDescriptor)).toThrow(
        'MODULE_ALREADY_REGISTERED: performance-monitor'
      );
    });
  });

  describe('module loading', () => {
    it('executes the loader once and caches the result', async () => {
      let loadCount = 0;
      moduleRegistry.registerModule({
        id: 'telemetry-chart',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => {
          loadCount += 1;
          return { chart: 'telemetry', loadCount };
        },
        metadata: {},
      });

      const first = await moduleRegistry.loadModule('telemetry-chart');
      const second = await moduleRegistry.loadModule('telemetry-chart');

      expect(first).toEqual({ chart: 'telemetry', loadCount: 1 });
      expect(second).toEqual({ chart: 'telemetry', loadCount: 1 });
      expect(loadCount).toBe(1);
      expect(moduleRegistry.isLoaded('telemetry-chart')).toBe(true);
    });

    it('tracks load duration on the module record', async () => {
      moduleRegistry.registerModule({
        id: 'workflow-builder',
        kind: 'active' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => 'built',
        metadata: {},
      });

      await moduleRegistry.loadModule('workflow-builder');

      const record = moduleRegistry.getModule('workflow-builder')!;
      expect(record.loadDurationMs).toBeGreaterThanOrEqual(0);
      expect(record.error).toBeNull();
    });

    it('throws when loading an unknown module', async () => {
      await expect(moduleRegistry.loadModule('does-not-exist')).rejects.toThrow(
        'MODULE_NOT_FOUND: does-not-exist'
      );
    });

    it('throws when a module has no loader', async () => {
      moduleRegistry.registerModule({
        id: 'no-loader',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        metadata: {},
      });

      await expect(moduleRegistry.loadModule('no-loader')).rejects.toThrow(
        'MODULE_LOAD_FAILED: no-loader has no loader'
      );
    });

    it('marks a module as failed when its loader throws', async () => {
      moduleRegistry.registerModule({
        id: 'failing',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => {
          throw new Error('boom');
        },
        metadata: {},
      });

      await expect(moduleRegistry.loadModule('failing')).rejects.toThrow('boom');
      const record = moduleRegistry.getModule('failing')!;
      expect(record.status).toBe('failed');
      expect(record.error).not.toBeNull();
    });

    it('loads every active module', async () => {
      const loaded: Array<string> = [];
      moduleRegistry.registerModule({
        id: 'active-a',
        kind: 'active' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => {
          loaded.push('active-a');
          return 'a';
        },
        metadata: {},
      });
      moduleRegistry.registerModule({
        id: 'active-b',
        kind: 'active' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => {
          loaded.push('active-b');
          return 'b';
        },
        metadata: {},
      });
      moduleRegistry.registerModule({
        id: 'lazy-c',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => {
          loaded.push('lazy-c');
          return 'c';
        },
        metadata: {},
      });

      await moduleRegistry.loadActiveModules();

      expect(loaded).toEqual(['active-a', 'active-b']);
      expect(moduleRegistry.isLoaded('lazy-c')).toBe(false);
    });
  });

  describe('shared services', () => {
    it('creates a shared service once and reuses the instance', () => {
      let factoryCalls = 0;
      moduleRegistry.registerSharedService('cache', () => {
        factoryCalls += 1;
        return { get: () => 'hit' };
      });

      const first = moduleRegistry.getSharedService<{ get: () => string }>('cache');
      const second = moduleRegistry.getSharedService<{ get: () => string }>('cache');

      expect(first).toBe(second);
      expect(first!.get()).toBe('hit');
      expect(factoryCalls).toBe(1);
    });

    it('returns null for an unknown shared service', () => {
      expect(moduleRegistry.getSharedService('missing')).toBeNull();
    });

    it('throws when registering a duplicate shared service', () => {
      moduleRegistry.registerSharedService('cache', () => ({}));

      expect(() => moduleRegistry.registerSharedService('cache', () => ({}))).toThrow(
        'SHARED_SERVICE_ALREADY_REGISTERED: cache'
      );
    });
  });

  describe('lifecycle snapshot', () => {
    it('counts modules by kind and by status', () => {
      moduleRegistry.registerModule(coreDescriptor);
      moduleRegistry.registerModule({
        id: 'active-a',
        kind: 'active' as const,
        version: '1.0.0',
        dependencies: [],
        loader: async () => 'a',
        metadata: {},
      });
      moduleRegistry.registerModule({
        id: 'lazy-b',
        kind: 'on-demand' as const,
        version: '1.0.0',
        dependencies: [],
        metadata: {},
      });

      const snapshot = moduleRegistry.getLifecycleSnapshot();
      expect(snapshot.total).toBe(3);
      expect(snapshot.byKind).toEqual({ core: 1, active: 1, 'on-demand': 1, 'shared-service': 0 });
      expect(snapshot.byStatus.loaded).toBe(1);
      expect(snapshot.byStatus.registered).toBe(2);
    });
  });
});
