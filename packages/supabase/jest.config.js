/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['@swc/jest', {}],
  },
  moduleNameMapper: {
    '^@repo/(.*)$': '<rootDir>/../$1/src',
  },
};
