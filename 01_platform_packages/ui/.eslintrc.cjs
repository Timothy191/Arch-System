/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-07_toolchain_configuration/react-internal.js"],
  parser: "@typescript-eslint/parser",
  rules: {
    "no-redeclare": "off",
  },
};
