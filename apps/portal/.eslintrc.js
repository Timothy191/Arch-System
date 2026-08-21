/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  ignorePatterns: ["public/", "coverage/"],
  extends: ["@repo/eslint-config/next.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
  overrides: [
    {
      files: ["scripts/*.js"],
      env: { node: true },
      parserOptions: {
        project: null,
      },
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/setupTests.ts"],
      env: { jest: true },
    },
    {
      files: ["lib/env.ts", "lib/ai/tools.ts", "lib/api/response.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
    // AGENT-TRACE: Enforce subpath imports for @repo/contract to improve tree-shaking.
    // Barrel imports pull all Zod schemas into every route group's chunk.
    // response.ts exempted — uses ZodSchema type-only import (no runtime cost).
    {
      files: ["**/*.ts", "**/*.tsx"],
      excludedFiles: ["lib/api/response.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["zod", "zod/**"],
                message: "Import schemas from @repo/contract/schemas/* instead",
              },
            ],
            paths: [
              {
                name: "@repo/contract",
                message:
                  "Import from @repo/contract/schemas/* or @repo/contract/types/* for better tree-shaking",
              },
            ],
          },
        ],
      },
    },
  ],
};
