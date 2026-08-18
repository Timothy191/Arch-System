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
  },
};
