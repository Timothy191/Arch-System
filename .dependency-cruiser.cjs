/**
 * dependency-cruiser configuration.
 *
 * Blocks file-level circular dependencies across apps/, packages/, and libs/.
 * The package-level workspace check (tools/audits/circular-dep-detect.cjs) only
 * inspects `workspace:*` edges; this graph also catches cycles inside a package.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Circular dependencies make change impact and test isolation unpredictable. ' +
        'Break the cycle with dependency inversion or by extracting the shared code.',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', '\\.next', '/dist/', '/coverage/', '\\.turbo', 'storybook-static'],
    },
    exclude: {
      path: [
        'node_modules',
        '\\.next',
        '/dist/',
        '/coverage/',
        '\\.turbo',
        'storybook-static',
        '\\.vercel',
      ],
    },
    includeOnly: '^(apps|packages|libs)/',
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    },
  },
};
