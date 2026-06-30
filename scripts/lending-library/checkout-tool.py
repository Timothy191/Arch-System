#!/usr/bin/env python3
"""Checkout a CLI tool: catalog fetch (npm/pypi) or record local command."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.checkout import checkout, get_catalog_entry  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Checkout a tool for the current session")
    parser.add_argument("tool_name", help="Tool id from catalog (e.g. ast-grep)")
    args = parser.parse_args()

    entry = get_catalog_entry("tool", args.tool_name)
    if entry and entry.get("type") == "local":
        cmd = entry.get("command", "")
        print(f"CHECKED_OUT: {args.tool_name}")
        print("SOURCE: local")
        print(f"COMMAND: {cmd}")
        print("ACTION: Use workspace command — no ephemeral install.")
        return 0

    try:
        record = checkout("tool", args.tool_name)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("HINT: python3 scripts/lending-library/list-catalog.py tools", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"ERROR: fetch failed — {exc}", file=sys.stderr)
        return 1

    print(f"CHECKED_OUT: {args.tool_name}")
    print(f"PATH: {record['path']}")
    print(f"SOURCE: {record.get('source')}")
    if record.get("ephemeral"):
        print(f"EPHEMERAL: {record.get('staging_dir')}")
        print("RETURN: python3 scripts/lending-library/return-tool.py", args.tool_name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
