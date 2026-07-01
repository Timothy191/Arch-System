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
      files: ["ops/*.js"],
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
      files: ["app/**/*.tsx", "components/**/*.tsx", "features/**/*.tsx"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@repo/supabase/server",
                message: "UI components cannot import server database modules directly. Use API routes, Server Actions, or data-access services instead.",
              },
              {
                name: "@repo/redis",
                message: "UI components cannot import redis directly. Use data-access services instead.",
              },
            ],
            patterns: [
              {
                group: ["@repo/*/data-access"],
                message: "UI components should not import directly from data-access layers inside the same file if it mixes UI logic. Extract to a service function. (Warning only if strictly needed)"
              }
            ]
          }
        ]
      }
    },
    {
      files: ["lib/env.ts"],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
};
