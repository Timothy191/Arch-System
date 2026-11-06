import { dirname, join } from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../src/lib/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions', '@storybook/addon-a11y'],
  framework: {
    name: getAbsolutePath('@storybook/react-vite') as '@storybook/react-vite',
    options: {},
  },

  // react-docgen 7.1 resolves @babel/core 8, whose async-only loadPartialConfig crashes the
  // storybook:react-docgen-plugin transform (every story 500s). Disable docgen until pinned.
  typescript: { reactDocgen: false },

  viteFinal: async (config) =>
    mergeConfig(config, {
      plugins: [react(), tsconfigPaths()],
    }),
};

function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

export default config;
