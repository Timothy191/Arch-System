/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["@swc/jest", {}],
  },
  moduleNameMapper: {
    "^@repo/(.*)$": "<rootDir>/../$1/src",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
