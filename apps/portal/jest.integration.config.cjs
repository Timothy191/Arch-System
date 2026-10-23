const base = require('./jest.config.cjs');

// Integration tests talk to a real Redis (no setupTests mocks). They are
// skipped unless REDIS_INTEGRATION=1 and run via `pnpm test:integration`.
module.exports = {
  ...base,
  testEnvironment: 'node',
  setupFilesAfterEnv: [],
  testMatch: ['<rootDir>/test/integration/**/*.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: undefined,
  coverageThreshold: undefined,
};
