module.exports = {
  rootDir: __dirname,
  // Pure data-access adapters — no DOM required. Node environment is lighter
  // than jsdom and sufficient for the mapping/STAC-helpers in monitoring-api.
  testEnvironment: "node",
  forceExit: true,
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
          },
        },
      },
    ],
  },
};
