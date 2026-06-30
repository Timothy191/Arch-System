import type { Preview } from "@storybook/react";
import "../src/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "macOS",
      values: [
        {
          name: "macOS",
          value: "#f5f5f7",
        },
        {
          name: "White",
          value: "#ffffff",
        },
      ],
    },
  },
};

export default preview;
