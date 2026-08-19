module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            decorators: true,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // The `cloudflare:workers` specifier only resolves inside the Workers
    // runtime; Jest cannot import it directly. Route it at the local mock
    // that re-declares the WorkflowEntrypoint base class.
    "^cloudflare:workers$": "<rootDir>/src/__mocks__/cloudflare-workers.ts",
  },
};
