module.exports = {
  rootDir: __dirname,
  testEnvironment: 'jsdom',
  forceExit: true,
  moduleDirectories: ['node_modules', '<rootDir>/../../../../node_modules/.pnpm/node_modules'],
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
  },
};
