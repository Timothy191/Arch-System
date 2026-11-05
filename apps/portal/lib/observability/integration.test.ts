import { integrationRegistry } from './integration';

describe('IntegrationRegistry', () => {
  beforeEach(() => {
    integrationRegistry.reset();
  });

  describe('registration and allowance', () => {
    it('registers and retrieves an integration', () => {
      integrationRegistry.registerIntegration({
        name: 'opentelemetry',
        version: '1.9.1',
        status: 'allowed',
        policy: 'Standard tracing protocol; OTLP HTTP exporter',
        rationale: 'Vendor-neutral observability',
      });

      const integration = integrationRegistry.getIntegration('opentelemetry');
      expect(integration).not.toBeNull();
      expect(integration!.version).toBe('1.9.1');
      expect(integration!.policy).toContain('OTLP');
    });

    it('returns null for an unknown integration', () => {
      expect(integrationRegistry.getIntegration('unknown')).toBeNull();
    });

    it('reports allowed integrations as allowed', () => {
      integrationRegistry.registerIntegration({
        name: 'vercel-otel',
        version: '2.1.3',
        status: 'allowed',
        policy: 'Next.js OpenTelemetry instrumentation',
      });
      integrationRegistry.registerIntegration({
        name: 'blocked-lib',
        version: '1.0.0',
        status: 'blocked',
        policy: 'Not permitted in production',
      });
      integrationRegistry.registerIntegration({
        name: 'review-lib',
        version: '0.1.0',
        status: 'review-required',
        policy: 'Security review pending',
      });

      expect(integrationRegistry.isIntegrationAllowed('vercel-otel')).toBe(true);
      expect(integrationRegistry.isIntegrationAllowed('blocked-lib')).toBe(false);
      expect(integrationRegistry.isIntegrationAllowed('review-lib')).toBe(false);
      expect(integrationRegistry.isIntegrationAllowed('missing')).toBe(false);
    });
  });

  describe('listing', () => {
    beforeEach(() => {
      integrationRegistry.registerIntegration({
        name: 'otel',
        version: '1.0.0',
        status: 'allowed',
        policy: 'tracing',
      });
      integrationRegistry.registerIntegration({
        name: 'blocked-one',
        version: '1.0.0',
        status: 'blocked',
        policy: 'banned',
      });
      integrationRegistry.registerIntegration({
        name: 'blocked-two',
        version: '2.0.0',
        status: 'blocked',
        policy: 'banned',
      });
      integrationRegistry.registerIntegration({
        name: 'pending',
        version: '0.1.0',
        status: 'review-required',
        policy: 'pending',
      });
    });

    it('returns all integrations', () => {
      expect(integrationRegistry.getAllIntegrations()).toHaveLength(4);
    });

    it('returns integrations filtered by status', () => {
      const blocked = integrationRegistry.getBlockedIntegrations();
      const pending = integrationRegistry.getIntegrationsByStatus('review-required');

      expect(blocked).toHaveLength(2);
      expect(blocked.every((integration) => integration.status === 'blocked')).toBe(true);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.name).toBe('pending');
    });
  });

  describe('constraints', () => {
    it('throws when registering a duplicate integration name', () => {
      integrationRegistry.registerIntegration({
        name: 'otel',
        version: '1.0.0',
        status: 'allowed',
        policy: 'tracing',
      });

      expect(() =>
        integrationRegistry.registerIntegration({
          name: 'otel',
          version: '2.0.0',
          status: 'blocked',
          policy: 'banned',
        })
      ).toThrow('INTEGRATION_ALREADY_REGISTERED: otel');
    });

    it('reset clears all integrations', () => {
      integrationRegistry.registerIntegration({
        name: 'otel',
        version: '1.0.0',
        status: 'allowed',
        policy: 'tracing',
      });
      integrationRegistry.reset();

      expect(integrationRegistry.getAllIntegrations()).toHaveLength(0);
    });
  });
});
