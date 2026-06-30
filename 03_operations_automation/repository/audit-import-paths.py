#!/usr/bin/env python3
"""Fail CI if legacy root path strings remain in numbered trees."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SCAN_ROOTS = [
    "00_applications",
    "01_platform_packages",
    "02_domain_libraries",
    "03_operations_automation",
    "04_shared_static_assets",
    "05_greenfield_application_source",
    "06_technical_documentation",
    "07_toolchain_configuration",
    "08_developer_tooling",
    "09_end_to_end_verification",
    "10_infrastructure_as_code",
    "11_continuous_integration",
    "12_distributed_cache_runtime",
    "14_observability_configuration",
    "15_load_performance_testing",
    "16_database_reference_artifacts",
]

SKIP_PARTS = {"node_modules", ".next", "dist", ".git", "storybook-static", "archive"}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("legacy apps/", re.compile(r'(?<![0-9_/])apps/')),
    ("legacy packages/", re.compile(r'(?<![0-9_/])packages/')),
    ("legacy libs/", re.compile(r'(?<![0-9_/])libs/')),
    ("legacy 10-src", re.compile(r"@10-src|(?<![0-9_])10-src/")),
    ("tooling packages path", re.compile(r'join\(\s*ROOT\s*,\s*["\']packages["\']')),
    ("tooling apps path", re.compile(r'join\(\s*ROOT\s*,\s*["\']apps["\']')),
    ("root shared assets dir", re.compile(r'join\(\s*REPO_ROOT\s*,\s*["\']shared["\']')),
]

ALLOWLIST_SUBSTRINGS = (
    "audit-import-paths.py",
    "finish-root-hierarchy.py",
    "apply-root-hierarchy.py",
    "verify-root-hierarchy.py",
    "reorganize.mjs",
    "ADR-003",
    "HOW.md",
    "PROGRESSIVE_DISCLOSURE.md",
    "apiVersion: apps/v1",
    "node scripts/",
    "contract/scripts/",
    "/scripts/generate",
    "portal/scripts/",
    "02_domain_libraries/shared",
    '"LEGACY"',
)


def main() -> int:
    errors: list[str] = []
    for root_name in SCAN_ROOTS:
        base = ROOT / root_name
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file():
                continue
            if any(p in SKIP_PARTS for p in path.parts):
                continue
            if path.suffix not in {
                ".ts",
                ".tsx",
                ".js",
                ".mjs",
                ".cjs",
                ".json",
                ".yaml",
                ".yml",
                ".sh",
                ".py",
                ".css",
            }:
                continue
            rel = path.relative_to(ROOT).as_posix()
            if any(token in rel for token in ALLOWLIST_SUBSTRINGS):
                continue
            if "/scripts/" in rel or rel.endswith("/scripts"):
                continue
            if path.name == "package.json" and "node scripts/" in text:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for label, pattern in PATTERNS:
                if pattern.search(text):
                    errors.append(f"{rel}: {label}")
                    break
    if errors:
        for e in sorted(errors)[:50]:
            print(f"ERROR: {e}", file=sys.stderr)
        if len(errors) > 50:
            print(f"ERROR: ... and {len(errors) - 50} more", file=sys.stderr)
        return 1
    print("import path audit OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
