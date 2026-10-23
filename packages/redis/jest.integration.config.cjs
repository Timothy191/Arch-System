// Integration tests talk to a real Redis instead of the fakes the unit suites
// install. They are skipped unless REDIS_INTEGRATION=1 and run separately
// (`pnpm test:integration`, CI job `redis-integration`) so the unit run never
// needs a server.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
};
