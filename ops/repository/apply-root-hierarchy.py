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
    ("database", "db-ref"),
    ("k6", "perf"),
    ("monitoring", "obs"),
    ("redis", "cache"),
    ("ci", "ci"),
    ("infra", "infra"),
    ("e2e", "e2e"),
    ("tools", "tools"),
    ("config", "toolchain"),
    ("docs", "docs"),
    ("10-src", "src"),
    ("shared", "assets"),
    ("scripts", "ops"),
    ("libs", "libs"),
    ("packages", "pkgs"),
    ("apps", "apps"),
]

# Order matters: longer / more specific tokens first
REPLACEMENTS: list[tuple[str, str]] = [
    ("src/", "src/"),
    ("@src/", "@05-greenfield/"),
    ("apps/", "apps/"),
    ("packages/", "pkgs/"),
    ("libs/", "libs/"),
    ("ops/", "ops/"),
    ("shared/", "shared/"),
    ("docs/", "docs/"),
    ("toolchain/", "toolchain/"),
    ("tools/", "tools/"),
    ("e2e/", "e2e/"),
    ("infra/", "infra/"),
    ("ci/", "ci/"),
    ("cache/", "cache/"),
    ("obs/", "obs/"),
    ("perf/", "perf/"),
    ("db-ref/README", "db-ref/README"),
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
        "CODE_OF_CONDUCT.md": "docs/CODE_OF_CONDUCT.md",
        "DEPLOYMENT.md": "docs/DEPLOYMENT.md",
        "DESIGN.md": "docs/DESIGN.md",
        "PRODUCT.md": "docs/PRODUCT.md",
        "SECURITY.md": "docs/SECURITY.md",
        "SUPPORT.md": "docs/SUPPORT.md",
        "UX_UI_AUDIT.md": "docs/reports/UX_UI_AUDIT.md",
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
    portal_ts = ROOT / "apps" / "portal" / "tsconfig.json"
    if portal_ts.exists():
        text = portal_ts.read_text(encoding="utf-8")
        if "@src/*" not in text and "@05-greenfield/*" in text:
            text = text.replace(
                '"@05-greenfield/*": ["../../src/*"]',
                '"@05-greenfield/*": ["../../src/*"],\n'
                '      "@src/*": ["../../src/*"]',
            )
            portal_ts.write_text(text, encoding="utf-8")
            print("added @10-src shim in portal tsconfig")

    theme_css = (
        ROOT
        / "pkgs"
        / "theme"
        / "src"
        / "css"
        / "index.css"
    )
    if theme_css.exists():
        text = theme_css.read_text(encoding="utf-8")
        if "src" not in text:
            text = text.replace("src/", "src/")
            theme_css.write_text(text, encoding="utf-8")

    return 0


if __name__ == "__main__":
    sys.exit(main())
