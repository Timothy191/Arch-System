// Jest 30 defaults NODE_ENV to 'production' in workers, which makes React load
// the production build where React.act is stripped. That breaks
// @testing-library/react's act-compat shim (react-dom/test-utils act delegates
// to React.act). Setting NODE_ENV=test here selects the React development build
// that exports act. Must run via setupFiles (before setupFilesAfterEnv and any
// test module requires react).
if (process.env.NODE_ENV !== 'test') {
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
}
