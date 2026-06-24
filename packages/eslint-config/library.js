const { resolve } = require("node:path");

const project = resolve(process.cwd(), "tsconfig.json");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended"],
  plugins: ["only-warn"],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
    es2020: true,
  },
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
    "dist/",
  ],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "no-unused-vars": "off",
        "no-undef": "off",
      },
    },
  ],
  rules: {
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
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
  },
};
