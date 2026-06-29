#!/usr/bin/env python3
"""Return a checked-out skill and clear active session context."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RUN_DIR = Path(__file__).resolve().parents[2] / "run"
ACTIVE_SKILL_FILE = RUN_DIR / ".active-skill.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Return a checked-out skill")
    parser.add_argument("skill_name", help="Skill name being returned")
    args = parser.parse_args()

    if ACTIVE_SKILL_FILE.exists():
        try:
            active = json.loads(ACTIVE_SKILL_FILE.read_text(encoding="utf-8"))
            if active.get("skill") != args.skill_name:
                print(
                    f"WARN: returning '{args.skill_name}' but active is '{active.get('skill')}'",
                    file=sys.stderr,
                )
        except json.JSONDecodeError:
            pass
        ACTIVE_SKILL_FILE.unlink(missing_ok=True)

    print(f"RETURNED: {args.skill_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
