/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value"],
  ignoreFiles: [
    // Third-party/library CSS with incompatible conventions
    "apps/overview/app/globals.css",
    "apps/portal/public/css/fuxa-light-theme.css",
  ],
  rules: {
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
