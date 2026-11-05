import { resourceRegistry } from './registry';

describe('ResourceRegistry', () => {
  beforeEach(() => {
    resourceRegistry.reset();
  });

  const imageDescriptor = {
    id: 'logo.svg',
    type: 'image' as const,
    location: '/images/logo.svg',
    sizeBytes: 12_000,
    contentType: 'image/svg+xml',
    cacheable: true,
    ttlSeconds: 86_400,
    metadata: { variant: 'default' },
  };

  describe('resource registration', () => {
    it('registers and retrieves a resource by id', () => {
      resourceRegistry.registerResource(imageDescriptor);

      const resource = resourceRegistry.getResource('logo.svg');
      expect(resource).not.toBeNull();
      expect(resource!.id).toBe('logo.svg');
      expect(resource!.type).toBe('image');
      expect(resource!.registeredAt).toBeGreaterThan(0);
    });

    it('throws when registering a duplicate resource id', () => {
      resourceRegistry.registerResource(imageDescriptor);

      expect(() => resourceRegistry.registerResource(imageDescriptor)).toThrow(
        'RESOURCE_ALREADY_REGISTERED: logo.svg'
      );
    });

    it('returns null for an unknown resource id', () => {
      expect(resourceRegistry.getResource('missing.svg')).toBeNull();
    });
  });

  describe('queries', () => {
    beforeEach(() => {
      resourceRegistry.registerResource(imageDescriptor);
      resourceRegistry.registerResource({
        id: 'inter-font.woff2',
        type: 'font' as const,
        location: '/fonts/inter.woff2',
        sizeBytes: 45_000,
        contentType: 'font/woff2',
        cacheable: true,
        metadata: {},
      });
      resourceRegistry.registerResource({
        id: 'app-config.json',
        type: 'config-asset' as const,
        location: '/config/app.json',
        cacheable: false,
        metadata: {},
      });
      resourceRegistry.registerResource({
        id: 'cdc-feed',
        type: 'external-resource' as const,
        location: 'https://supabase.example/realtime',
        cacheable: false,
        metadata: {},
      });
    });

    it('returns resources filtered by type', () => {
      const images = resourceRegistry.getResourcesByType('image');
      const fonts = resourceRegistry.getResourcesByType('font');

      expect(images).toHaveLength(1);
      expect(images[0]!.id).toBe('logo.svg');
      expect(fonts).toHaveLength(1);
      expect(fonts[0]!.id).toBe('inter-font.woff2');
    });

    it('returns all registered resources', () => {
      expect(resourceRegistry.getAllResources()).toHaveLength(4);
    });

    it('returns only cacheable resources', () => {
      const cacheable = resourceRegistry.getCacheableResources();

      expect(cacheable).toHaveLength(2);
      expect(cacheable.every((resource) => resource.cacheable)).toBe(true);
    });
  });

  describe('usage snapshot', () => {
    it('counts resources by type and cacheable count', () => {
      resourceRegistry.registerResource(imageDescriptor);
      resourceRegistry.registerResource({
        id: 'inter-font.woff2',
        type: 'font' as const,
        location: '/fonts/inter.woff2',
        cacheable: true,
        metadata: {},
      });
      resourceRegistry.registerResource({
        id: 'app-config.json',
        type: 'config-asset' as const,
        location: '/config/app.json',
        cacheable: false,
        metadata: {},
      });

      const snapshot = resourceRegistry.getResourceUsageSnapshot();
      expect(snapshot.total).toBe(3);
      expect(snapshot.byType).toEqual({
        image: 1,
        font: 1,
        'static-file': 0,
        'config-asset': 1,
        'downloadable-resource': 0,
        'cached-response': 0,
        'external-resource': 0,
      });
      expect(snapshot.cacheableCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('clears all resources', () => {
      resourceRegistry.registerResource(imageDescriptor);
      resourceRegistry.reset();

      expect(resourceRegistry.getAllResources()).toHaveLength(0);
      expect(resourceRegistry.getResource('logo.svg')).toBeNull();
    });
  });
});
