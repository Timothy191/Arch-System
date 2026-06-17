import { join, dirname } from "node:path";
import type { StorybookConfig } from "@storybook/react-vite";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";
import { mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

const config: StorybookConfig = {
  stories: [
    "../src/components/**/*.@(mdx|stories.@(js|jsx|ts|tsx))",
    "../src/lib/**/*.@(mdx|stories.@(js|jsx|ts|tsx))",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [react(), nxViteTsPaths()],
    }),
};

function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}

export default config;
