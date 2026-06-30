/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-07_toolchain_configuration/library.js"],
  parser: "@typescript-eslint/parser",
  env: { browser: true, node: true },
  globals: { RequestInit: "readonly", Response: "readonly", fetch: "readonly" },
};
