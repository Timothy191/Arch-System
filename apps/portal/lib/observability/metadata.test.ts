import { metadataRegistry } from './metadata';

describe('MetadataRegistry', () => {
  beforeEach(() => {
    metadataRegistry.reset();
  });

  describe('registration and lookup', () => {
    it('registers and retrieves metadata for an entity', () => {
      metadataRegistry.registerMetadata({
        entityType: 'module',
        id: 'performance-monitor',
        metadata: {
          layer: 'intelligent-execution',
          capabilities: ['startup-time', 'cache-effectiveness'],
        },
      });

      const metadata = metadataRegistry.getMetadata('module', 'performance-monitor');
      expect(metadata).not.toBeNull();
      expect(metadata!.layer).toBe('intelligent-execution');
      expect(metadata!.capabilities).toEqual(['startup-time', 'cache-effectiveness']);
    });

    it('returns null for an unregistered entity', () => {
      expect(metadataRegistry.getMetadata('module', 'unknown')).toBeNull();
    });

    it('allows the same id across different entity types', () => {
      metadataRegistry.registerMetadata({
        entityType: 'module',
        id: 'cache',
        metadata: { kind: 'module' },
      });
      metadataRegistry.registerMetadata({
        entityType: 'resource',
        id: 'cache',
        metadata: { kind: 'resource' },
      });

      expect(metadataRegistry.getMetadata('module', 'cache')!.kind).toBe('module');
      expect(metadataRegistry.getMetadata('resource', 'cache')!.kind).toBe('resource');
    });
  });

  describe('listing', () => {
    beforeEach(() => {
      metadataRegistry.registerMetadata({
        entityType: 'module',
        id: 'performance-monitor',
        metadata: {},
      });
      metadataRegistry.registerMetadata({
        entityType: 'module',
        id: 'telemetry-chart',
        metadata: {},
      });
      metadataRegistry.registerMetadata({
        entityType: 'api-route',
        id: '/api/metrics',
        metadata: {},
      });
    });

    it('returns all metadata entries', () => {
      expect(metadataRegistry.getAllMetadata()).toHaveLength(3);
    });

    it('filters entries by entity type', () => {
      const modules = metadataRegistry.getAllMetadata('module');
      const routes = metadataRegistry.getAllMetadata('api-route');

      expect(modules).toHaveLength(2);
      expect(routes).toHaveLength(1);
      expect(routes[0]!.id).toBe('/api/metrics');
    });
  });

  describe('removal', () => {
    it('removes metadata and reports success', () => {
      metadataRegistry.registerMetadata({
        entityType: 'server-action',
        id: 'submitShiftCloseout',
        metadata: {},
      });

      expect(metadataRegistry.removeMetadata('server-action', 'submitShiftCloseout')).toBe(true);
      expect(metadataRegistry.getMetadata('server-action', 'submitShiftCloseout')).toBeNull();
      expect(metadataRegistry.removeMetadata('server-action', 'submitShiftCloseout')).toBe(false);
    });
  });
});
