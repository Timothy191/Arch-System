// GENERATED FROM tools/repo/policy-compiler.cjs — DO NOT EDIT
// Run 'pnpm policy:gen' to regenerate.

module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      {
            "type": "scope:app",
            "pattern": "apps/*"
      },
      {
            "type": "scope:package:db-internal",
            "pattern": "packages/database/**"
      },
      {
            "type": "scope:package:db",
            "pattern": "packages/database"
      },
      {
            "type": "scope:package:supabase",
            "pattern": "packages/supabase"
      },
      {
            "type": "scope:package:ui",
            "pattern": "packages/ui"
      },
      {
            "type": "scope:package:theme",
            "pattern": "packages/theme"
      },
      {
            "type": "scope:package",
            "pattern": "packages/*"
      },
      {
            "type": "scope:feature",
            "pattern": "libs/features/*/*"
      },
      {
            "type": "scope:package",
            "pattern": "libs/shared/*"
      },
      {
            "type": "scope:tool",
            "pattern": "tools/*"
      }
],
    'boundaries/ignore': [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**'
    ]
  },
  rules: {
    'boundaries/element-types': [
      'error',
      {
        default: 'allow',
        rules: [
        {
                "from": "scope:app",
                "disallow": [
                        "scope:package:db-internal"
                ],
                "message": "apps/* must not import packages/database directly; use packages/supabase client"
        },
        {
                "from": "scope:package:ui",
                "disallow": [
                        "scope:package:db"
                ],
                "message": "UI components must be pure; no data layer access"
        },
        {
                "from": "scope:package:ui",
                "disallow": [
                        "scope:package:db-internal"
                ],
                "message": "UI must not reach database internals"
        },
        {
                "from": "scope:package:ui",
                "disallow": [
                        "scope:package:supabase"
                ],
                "message": "UI is presentational; data fetching belongs in features/"
        },
        {
                "from": "scope:package:theme",
                "disallow": [
                        "scope:package:ui"
                ],
                "message": "Theme must not depend on UI; theme is consumed by UI"
        },
        {
                "from": "scope:tool",
                "disallow": [
                        "scope:app"
                ],
                "message": "tools/* are build-time scripts; cannot import apps/* at runtime"
        },
        {
                "from": "scope:tool",
                "disallow": [
                        "scope:package:supabase"
                ],
                "message": "tools/* must not import runtime server/client code"
        },
        {
                "from": "scope:package",
                "disallow": [
                        "scope:app"
                ],
                "message": "packages/* must not depend on apps/* (inversion of dependency)"
        }
],
      },
    ],
  },
};
