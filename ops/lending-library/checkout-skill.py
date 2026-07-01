#!/usr/bin/env python3
"""Checkout a skill: local search first, then catalog fetch (GitHub/npm)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.checkout import checkout  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Checkout a skill for the current session")
    parser.add_argument("skill_name", help="Skill folder or keyword (e.g. ce-debug, fix-ci)")
    args = parser.parse_args()

    try:
        record = checkout("skill", args.skill_name)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        print("HINT: python3 03_operations_automation/lending-library/list-catalog.py skills", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"ERROR: fetch failed — {exc}", file=sys.stderr)
        return 1

    print(f"CHECKED_OUT: {args.skill_name}")
    print(f"PATH: {record['path']}")
    print(f"SOURCE: {record.get('source', 'local')}")
    if record.get("ephemeral"):
        print(f"EPHEMERAL: {record.get('staging_dir')}")
        print("RETURN: python3 03_operations_automation/lending-library/return-skill.py", args.skill_name)
    print("ACTION: Read the skill file above before executing the task.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
