/**
 * Controlled integration management for Arch-System.
 *
 * Maintains a registry of third-party integrations with a governed status
 * (allowed / blocked / review-required) so dependencies are evaluated and
 * managed centrally instead of adopted ad hoc.
 */

type IntegrationStatus = 'allowed' | 'blocked' | 'review-required';

interface IntegrationDescriptor {
  readonly name: string;
  readonly version: string;
  readonly status: IntegrationStatus;
  readonly policy: string;
  readonly rationale?: string;
}

const _INTEGRATION_NOT_FOUND = 'INTEGRATION_NOT_FOUND';
const INTEGRATION_ALREADY_REGISTERED = 'INTEGRATION_ALREADY_REGISTERED';

/**
 * Registry of third-party integrations. Each integration carries a governed
 * status so the system can enforce which dependencies are safe to use.
 */
export class IntegrationRegistry {
  private readonly integrations: Map<string, IntegrationDescriptor> = new Map();

  /**
   * Registers an integration descriptor.
   */
  public registerIntegration(descriptor: IntegrationDescriptor): void {
    if (this.integrations.has(descriptor.name)) {
      throw new Error(`${INTEGRATION_ALREADY_REGISTERED}: ${descriptor.name}`);
    }
    this.integrations.set(descriptor.name, descriptor);
  }

  /**
   * Returns true when the integration is registered with status "allowed".
   */
  public isIntegrationAllowed(name: string): boolean {
    const integration = this.integrations.get(name);
    return integration?.status === 'allowed';
  }

  /**
   * Returns the integration descriptor for a name, or null when unknown.
   */
  public getIntegration(name: string): IntegrationDescriptor | null {
    return this.integrations.get(name) ?? null;
  }

  /**
   * Returns every registered integration.
   */
  public getAllIntegrations(): ReadonlyArray<IntegrationDescriptor> {
    return [...this.integrations.values()];
  }

  /**
   * Returns every integration with the given status.
   */
  public getIntegrationsByStatus(status: IntegrationStatus): ReadonlyArray<IntegrationDescriptor> {
    return [...this.integrations.values()].filter((integration) => integration.status === status);
  }

  /**
   * Returns every blocked integration.
   */
  public getBlockedIntegrations(): ReadonlyArray<IntegrationDescriptor> {
    return this.getIntegrationsByStatus('blocked');
  }

  /**
   * Clears all integrations. Intended for testing.
   */
  public reset(): void {
    this.integrations.clear();
  }
}

/**
 * Shared integration registry used across the portal.
 */
export const integrationRegistry = new IntegrationRegistry();
