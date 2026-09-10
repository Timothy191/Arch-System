/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value", "stylelint-high-performance-animation"],
  ignoreFiles: [
    // Third-party/library CSS with incompatible conventions
    "apps/overview/app/globals.css",
    "apps/portal/public/css/fuxa-light-theme.css",
  ],
  rules: {
    // Tailwind's @apply preludes (e.g. `@apply border-border`) are not valid
    // CSS grammar — stylelint cannot validate them. Disable the prelude check.
    "at-rule-prelude-no-invalid": null,

    // Flag un-accelerated CSS properties in animations/transitions
    "plugin/no-low-performance-animation-properties": [
      true,
      {
        severity: "warning",
      },
    ],
    // Disallow raw color values except for exceptions below
    "scale-unlimited/declaration-strict-value": [
      [
        // Properties that define color
        "/color$/",
        "fill",
        "stroke",
        "background-image", // catch gradient without tokens
      ],
      {
        ignoreValues: [
          "currentColor",
          "inherit",
          "transparent",
          "none",
          // Allow CSS custom properties (tokens)
          "/var\\(--.*\\)/",
          // Allow gradient functions
          "/^(linear|radial|conic)-gradient\\(/",
        ],
      },
    ],
  },
};
