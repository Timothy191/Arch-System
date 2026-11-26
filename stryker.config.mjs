// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  reporters: ['html', 'clear-text', 'progress', 'json'],
  testRunner: 'jest',
  jest: {
    projectType: 'custom',
    configFile: 'apps/portal/jest.config.cjs',
    enableFindRelatedTests: false,
  },
  mutate: [
    'apps/portal/lib/api/**/*.ts',
    'apps/portal/lib/auth/**/*.ts',
    'apps/portal/app/(departments)/access-control/actions/**/*.ts',
    'packages/supabase/src/**/*.ts',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
  ],
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  coverageAnalysis: 'perTest',
  concurrency: 4,
  timeoutMS: 60000,
  maxConcurrentTestRunners: 2,
};

export default config;
