module.exports = {
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  forceExit: true,
  setupFilesAfterEnv: ['<rootDir>/../../jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/../../../../apps/portal/node_modules/react',
    '^react/(.*)$': '<rootDir>/../../../../apps/portal/node_modules/react/$1',
    '^react-dom$': '<rootDir>/../../../../apps/portal/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/../../../../apps/portal/node_modules/react-dom/$1',
    '^@repo/contract$': '<rootDir>/../../../../packages/contract/src/index.ts',
    '^@repo/contract/(.*)$': '<rootDir>/../../../../packages/contract/src/$1',
    // Workspace packages (@repo/*) resolve through pnpm workspace symlinks;
    // their sources live outside node_modules so SWC transforms them.
  },
};
