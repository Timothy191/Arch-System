#!/usr/bin/env python3
"""Complete root hierarchy migration: fix rename corruption, remove legacy dirs."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_DIRS = {".git", "node_modules", ".next", "dist", ".pnpm-store", ".nx", "run"}

TEXT_SUFFIXES = {
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".yaml",
    ".yml",
    ".md",
    ".mdc",
    ".sh",
    ".py",
    ".css",
    ".html",
    ".toml",
}

# Accidental substring replacements from naive config/ docs/ rewrites
FIXUPS: list[tuple[str, str]] = [
    ("typescript-config", "typescript-config"),
    ("01_platform_packages", "01_platform_packages"),
    ("@repo/shared/", "@repo/shared/"),
    ("@repo/shared", "@repo/shared"),
    ('"shared/', '"shared/'),
    ("02_domain_libraries/shared/", "02_domain_libraries/shared/"),
    ("playwright.dev/docs/", "playwright.dev/docs/"),
    ('testDir: "./09_end_to_end_verification"', 'testDir: "./09_end_to_end_verification"'),
    ("@05_greenfield_application_source/", "@05_greenfield_application_source/"),
    ("@05_greenfield_application_source/*", "@05_greenfield_application_source/*"),
    ("../../05_greenfield_application_source/", "../../05_greenfield_application_source/"),
    ("05_greenfield_application_source/", "05_greenfield_application_source/"),
]

LEGACY_ROOT_DIRS = [
    "apps",
    "packages",
    "libs",
    "scripts",
    "shared",
    "10-src",
    "docs",
    "config",
    "e2e",
    "infra",
    "redis",
    "tools",
    "database",
    "k6",
    "monitoring",
    "ci",
]


def rewrite_text_files() -> int:
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix not in TEXT_SUFFIXES and path.name not in {
            "pnpm-workspace.yaml",
            "Makefile",
            "vercel.json",
            ".gitignore",
        }:
            continue
        if path.name == "pnpm-lock.yaml":
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        original = text
        for old, new in FIXUPS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed


def fix_pnpm_workspace() -> None:
    path = ROOT / "pnpm-workspace.yaml"
    content = """packages:
  - "00_applications/*"
  - "01_platform_packages/*"
  - "02_domain_libraries/features/*/*"
  - "02_domain_libraries/shared/*"
catalog:
  lucide-react: "^1.18.0"
  tailwindcss: "^3.4.17"
  eslint: "^8.57.0"
  prettier: "~3.6.2"
  typescript: "^5.7.0"
  "@types/node": "^22"
  "@types/eslint": "^8"
  "@supabase/supabase-js": "^2.108.2"
  supabase: "^2.106.0"
  "@modelcontextprotocol/sdk": "1.29.0"
  sonner: "^2.0.1"
  animejs: "^4.4.1"
  framer-motion: "^12.40.0"
  lenis: "^1.2.0"
  recharts: "^3.8.1"
  zod: "^4.4.3"
  zustand: "^5.0.14"
  xstate: "^5.19.2"
  "@tremor/react": "^3.18.7"
  "@sentry/nextjs": "^10.57.0"
  react-hook-form: "^7.79.0"
catalogs:
  react19:
    react: "^19.2.7"
    react-dom: "^19.2.7"
    "@types/react": "^19.2.17"
    "@types/react-dom": "^19.2.3"
"""
    path.write_text(content, encoding="utf-8")


def fix_tsconfig_base() -> None:
    path = ROOT / "tsconfig.base.json"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '"@repo/shared/data-access": ["02_domain_libraries/shared/data-access/src/index.ts"],\n'
        '      "@repo/shared/utils": ["02_domain_libraries/shared/utils/src/index.ts"],\n'
        '      "@repo/shared/hooks": ["02_domain_libraries/shared/hooks/src/index.ts"],',
        '"@repo/shared/data-access": ["02_domain_libraries/shared/data-access/src/index.ts"],\n'
        '      "@repo/shared/utils": ["02_domain_libraries/shared/utils/src/index.ts"],\n'
        '      "@repo/shared/hooks": ["02_domain_libraries/shared/hooks/src/index.ts"],',
    )
    # After fixups, paths may already be shared/
    if "@repo/shared/data-access" not in text:
        for old_pkg, new_pkg in [
            ("@repo/shared", "@repo/shared"),
            ("04_shared_static_assets", "shared"),
        ]:
            text = text.replace(old_pkg, new_pkg)
    path.write_text(text, encoding="utf-8")


def fix_package_json_scripts() -> None:
    path = ROOT / "package.json"
    text = path.read_text(encoding="utf-8")
    replacements = [
        ('"./config/tools/commitlint.config.mjs"', '"./07_toolchain_configuration/tools/commitlint.config.mjs"'),
        ('"config/tools/.syncpackrc.js"', '"07_toolchain_configuration/tools/.syncpackrc.js"'),
        ('"config/.markdownlint.json"', '"07_toolchain_configuration/.markdownlint.json"'),
        ('"config/tools/knip.json"', '"07_toolchain_configuration/tools/knip.json"'),
        ("node scripts/", "node 03_operations_automation/"),
        ("bash scripts/", "bash 03_operations_automation/"),
        ("python3 scripts/", "python3 03_operations_automation/"),
        ("bash redis/", "bash 12_distributed_cache_runtime/"),
        ("node tools/", "node 08_developer_tooling/"),
        ('--ignore-pattern apps --ignore-pattern packages', '--ignore-pattern 00_applications --ignore-pattern 01_platform_packages'),
        ('python3 .kilo-memory/', 'python3 .ai_content/.memory/.kilo-memory/'),
        ('"docker/docker-compose.monitoring.yml"', '"10_infrastructure_as_code/docker/docker-compose.monitoring.yml"'),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def remove_legacy_dirs() -> None:
    for name in LEGACY_ROOT_DIRS:
        target = ROOT / name
        if target.exists():
            shutil.rmtree(target)
            print(f"removed legacy: {name}")


def fix_apply_script() -> None:
    path = ROOT / "03_operations_automation/repository/apply-root-hierarchy.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '("01_platform_packages/", "01_platform_packages/"),',
        '("packages/", "01_platform_packages/"),',
    )
    path.write_text(text, encoding="utf-8")


def main() -> int:
    remove_legacy_dirs()
    fix_pnpm_workspace()
    fix_tsconfig_base()
    fix_package_json_scripts()
    fix_apply_script()
    count = rewrite_text_files()
    print(f"rewrote {count} text files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
