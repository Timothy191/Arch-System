module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', '<rootDir>/../../../../node_modules/.pnpm/node_modules'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
