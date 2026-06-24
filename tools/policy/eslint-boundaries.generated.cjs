// GENERATED FROM tools/policy-compiler.cjs — DO NOT EDIT
// Run 'pnpm policy:gen' to regenerate.

module.exports = {
  plugins: ['@nx'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allowCircularSelfDependency: false,
        banTransitiveDependencies: true,
        checkDynamicDependenciesExceptions: ['^@repo/.*$'],
        depConstraints: [
  {
    "sourceTag": "scope:app",
    "notDependOnLibsWithTags": [
      "scope:package:db-internal"
    ]
  },
  {
    "sourceTag": "scope:package:ui",
    "notDependOnLibsWithTags": [
      "scope:package:db"
    ]
  },
  {
    "sourceTag": "scope:package:ui",
    "notDependOnLibsWithTags": [
      "scope:package:db-internal"
    ]
  },
  {
    "sourceTag": "scope:package:ui",
    "notDependOnLibsWithTags": [
      "scope:package:supabase"
    ]
  },
  {
    "sourceTag": "scope:package:theme",
    "notDependOnLibsWithTags": [
      "scope:package:ui"
    ]
  },
  {
    "sourceTag": "scope:tool",
    "notDependOnLibsWithTags": [
      "scope:app"
    ]
  },
  {
    "sourceTag": "scope:tool",
    "notDependOnLibsWithTags": [
      "scope:package:supabase"
    ]
  },
  {
    "sourceTag": "scope:package",
    "notDependOnLibsWithTags": [
      "scope:app"
    ]
  }
],
      },
    ],
  },
};
