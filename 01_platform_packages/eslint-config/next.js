const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended"],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
    browser: true,
    es2020: true,
  },
  plugins: ["only-warn"],
  settings: {
    "import/resolver": {
      typescript: {
        project,
      },
    },
  },
  ignorePatterns: [
    // Ignore dotfiles
    ".*.js",
    "node_modules/",
  ],
  overrides: [{ files: ["*.js?(x)", "*.ts?(x)"] }],
  rules: {
    "no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],
    "no-console": "warn",
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["zod", "zod/**"],
            message: "Import schemas from @repo/contract instead",
          },
        ],
      },
    ],
  },
};
