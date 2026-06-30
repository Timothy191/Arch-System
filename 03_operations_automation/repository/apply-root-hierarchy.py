#!/usr/bin/env python3
"""Mechanically rename root directories to NN_industry_standard hierarchy."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Lowest number = highest usage (descending importance)
RENAMES: list[tuple[str, str]] = [
    ("database", "16_database_reference_artifacts"),
    ("k6", "15_load_performance_testing"),
    ("monitoring", "14_observability_configuration"),
    ("redis", "12_distributed_cache_runtime"),
    ("ci", "11_continuous_integration"),
    ("infra", "10_infrastructure_as_code"),
    ("e2e", "09_end_to_end_verification"),
    ("tools", "08_developer_tooling"),
    ("config", "07_toolchain_configuration"),
    ("docs", "06_technical_documentation"),
    ("10-src", "05_greenfield_application_source"),
    ("shared", "04_shared_static_assets"),
    ("scripts", "03_operations_automation"),
    ("libs", "02_domain_libraries"),
    ("packages", "01_platform_packages"),
    ("apps", "00_applications"),
]

# Order matters: longer / more specific tokens first
REPLACEMENTS: list[tuple[str, str]] = [
    ("05_greenfield_application_source/", "05_greenfield_application_source/"),
    ("@05_greenfield_application_source/", "@05-greenfield/"),
    ("00_applications/", "00_applications/"),
    ("packages/", "01_platform_packages/"),
    ("02_domain_libraries/", "02_domain_libraries/"),
    ("03_operations_automation/", "03_operations_automation/"),
    ("shared/", "shared/"),
    ("06_technical_documentation/", "06_technical_documentation/"),
    ("07_toolchain_configuration/", "07_toolchain_configuration/"),
    ("08_developer_tooling/", "08_developer_tooling/"),
    ("09_end_to_end_verification/", "09_end_to_end_verification/"),
    ("10_infrastructure_as_code/", "10_infrastructure_as_code/"),
    ("11_continuous_integration/", "11_continuous_integration/"),
    ("12_distributed_cache_runtime/", "12_distributed_cache_runtime/"),
    ("14_observability_configuration/", "14_observability_configuration/"),
    ("15_load_performance_testing/", "15_load_performance_testing/"),
    ("16_database_reference_artifacts/README", "16_database_reference_artifacts/README"),
]

SKIP_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    ".pnpm-store",
    ".nx",
    "run",
}

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
    ".sql",
    ".env.example",
}


def git_mv(src: Path, dest: Path) -> None:
    if not src.exists():
        print(f"skip missing: {src.name}")
        return
    if dest.exists():
        print(f"skip exists: {dest.name}")
        return
    subprocess.run(["git", "mv", str(src), str(dest)], cwd=ROOT, check=True)
    print(f"git mv {src.name} -> {dest.name}")


def rewrite_paths() -> int:
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
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            changed += 1
    return changed


def fix_root_symlinks() -> None:
    links = {
        "CODE_OF_CONDUCT.md": "06_technical_documentation/CODE_OF_CONDUCT.md",
        "DEPLOYMENT.md": "06_technical_documentation/DEPLOYMENT.md",
        "DESIGN.md": "06_technical_documentation/DESIGN.md",
        "PRODUCT.md": "06_technical_documentation/PRODUCT.md",
        "SECURITY.md": "06_technical_documentation/SECURITY.md",
        "SUPPORT.md": "06_technical_documentation/SUPPORT.md",
        "UX_UI_AUDIT.md": "06_technical_documentation/reports/UX_UI_AUDIT.md",
    }
    for name, target in links.items():
        link = ROOT / name
        if link.is_symlink() or link.exists():
            link.unlink(missing_ok=True)
        link.symlink_to(target)
        print(f"symlink {name} -> {target}")


def main() -> int:
    os.chdir(ROOT)
    for old, new in RENAMES:
        git_mv(ROOT / old, ROOT / new)

    count = rewrite_paths()
    print(f"rewrote {count} files")

    fix_root_symlinks()

    # tsconfig shim: keep @10-src alias after @05-greenfield replace
    portal_ts = ROOT / "00_applications" / "portal" / "tsconfig.json"
    if portal_ts.exists():
        text = portal_ts.read_text(encoding="utf-8")
        if "@05_greenfield_application_source/*" not in text and "@05-greenfield/*" in text:
            text = text.replace(
                '"@05-greenfield/*": ["../../05_greenfield_application_source/*"]',
                '"@05-greenfield/*": ["../../05_greenfield_application_source/*"],\n'
                '      "@05_greenfield_application_source/*": ["../../05_greenfield_application_source/*"]',
            )
            portal_ts.write_text(text, encoding="utf-8")
            print("added @10-src shim in portal tsconfig")

    theme_css = (
        ROOT
        / "01_platform_packages"
        / "theme"
        / "src"
        / "css"
        / "index.css"
    )
    if theme_css.exists():
        text = theme_css.read_text(encoding="utf-8")
        if "05_greenfield_application_source" not in text:
            text = text.replace("05_greenfield_application_source/", "05_greenfield_application_source/")
            theme_css.write_text(text, encoding="utf-8")

    return 0


if __name__ == "__main__":
    sys.exit(main())
