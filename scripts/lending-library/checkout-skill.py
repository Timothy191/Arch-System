#!/usr/bin/env python3
"""Checkout a Cursor skill into the active session (lending library)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RUN_DIR = Path(__file__).resolve().parents[2] / "run"
ACTIVE_SKILL_FILE = RUN_DIR / ".active-skill.json"
SEARCH_ROOTS = [
    Path.home() / ".cursor" / "skills-cursor",
    Path.home() / ".cursor" / "plugins" / "cache",
]


def find_skill(skill_name: str) -> Path | None:
    needle = skill_name.lower().replace("_", "-")
    for root in SEARCH_ROOTS:
        if not root.exists():
            continue
        for skill_md in root.rglob("SKILL.md"):
            parent = skill_md.parent.name.lower()
            if needle in parent or needle in str(skill_md).lower():
                return skill_md
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Checkout a skill for the current session")
    parser.add_argument("skill_name", help="Skill folder or keyword (e.g. ce-debug, create-rule)")
    args = parser.parse_args()

    skill_path = find_skill(args.skill_name)
    if skill_path is None:
        print(f"ERROR: skill '{args.skill_name}' not found under {SEARCH_ROOTS}", file=sys.stderr)
        return 1

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    ACTIVE_SKILL_FILE.write_text(
        json.dumps({"skill": args.skill_name, "path": str(skill_path)}, indent=2),
        encoding="utf-8",
    )

    print(f"CHECKED_OUT: {args.skill_name}")
    print(f"PATH: {skill_path}")
    print("ACTION: Read the skill file above before executing the task.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
