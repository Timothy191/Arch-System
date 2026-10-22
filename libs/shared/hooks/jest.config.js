module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  forceExit: true,
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
        },
      },
    ],
  },
  moduleNameMapper: {
    '^react$': '<rootDir>/../../../apps/portal/node_modules/react',
    '^react/(.*)$': '<rootDir>/../../../apps/portal/node_modules/react/$1',
  },
};
