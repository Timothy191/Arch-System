/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-07_toolchain_configuration/library.js"],
  parser: "@typescript-eslint/parser",
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "off", // Let tsc handle type checks
  },
};
