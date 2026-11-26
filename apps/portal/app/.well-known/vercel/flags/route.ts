import { createFlagsDiscoveryEndpoint } from 'flags/next';

// No flags are currently defined. No capability claims are advertised until a
// real, consumed feature flag is added to apps/portal/flags/flags.ts.
export const GET = createFlagsDiscoveryEndpoint(async () => ({
  definitions: {},
}));
