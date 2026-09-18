module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\./.*)\\.js$": "$1",
    "^@repo/contract$": "<rootDir>/../contract/src/index.ts",
    "^@repo/contract/(.*)$": "<rootDir>/../contract/src/$1",
    "^@repo/errors$": "<rootDir>/../errors/src/index.ts",
  },
};
