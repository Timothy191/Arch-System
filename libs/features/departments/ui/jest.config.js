module.exports = {
  rootDir: __dirname,
  testEnvironment: "jsdom",
  forceExit: true,
  setupFilesAfterEnv: ["<rootDir>/../../jest.setup.ts"],
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
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    // The lib tsconfig maps `@/lib/*` → `apps/portal/lib/*`; mirror that so
    // `@/lib/shift-closeout` (imported by CloseShiftModal) and the test's
    // `~/lib/shift-closeout` resolve to the same module — the test's factory
    // mock then applies to both. The real module is never loaded.
    "^@/lib/(.*)$": "<rootDir>/../../../../apps/portal/lib/$1",
    "^@/(.*)$": "<rootDir>/../../../../apps/portal/$1",
    "^~/(.*)$": "<rootDir>/../../../../apps/portal/$1",
    // Workspace packages (@repo/*) resolve through pnpm workspace symlinks;
    // their sources live outside node_modules so SWC transforms them.
  },
};
