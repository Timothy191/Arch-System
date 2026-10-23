module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  // `tests/integration` needs a live server and runs via jest.integration.config.cjs.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
};
