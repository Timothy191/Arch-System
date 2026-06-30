#!/usr/bin/env python3
"""Verify numbered root hierarchy — fail if legacy unnumbered dirs remain."""

from __future__ import annotations

import sys
from pathlib import Path

import subprocess

ROOT = Path(__file__).resolve().parents[2]

EXPECTED = [
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
]

LEGACY = ["apps", "packages", "libs", "scripts", "shared", "10-src", "docs", "config", "tools", "e2e", "infra", "redis"]

# Run import-path audit after hierarchy verify
IMPORT_AUDIT = ROOT / "03_operations_automation" / "repository" / "audit-import-paths.py"


def main() -> int:
    errors: list[str] = []
    for name in EXPECTED:
        if not (ROOT / name).is_dir():
            errors.append(f"missing expected directory: {name}")
    for name in LEGACY:
        if (ROOT / name).exists():
            errors.append(f"legacy directory still present: {name}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    audit = ROOT / "03_operations_automation" / "repository" / "audit-import-paths.py"
    if audit.is_file():
        result = subprocess.run([sys.executable, str(audit)], cwd=ROOT)
        if result.returncode != 0:
            return result.returncode
    print("root hierarchy OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
