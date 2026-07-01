#!/usr/bin/env python3
"""Return a checked-out skill and remove ephemeral staging."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.checkout import return_resource  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Return a checked-out skill")
    parser.add_argument("skill_name", help="Skill name being returned")
    args = parser.parse_args()

    removed = return_resource("skill", args.skill_name)
    if not removed:
        print(f"WARN: '{args.skill_name}' was not active", file=sys.stderr)

    print(f"RETURNED: {args.skill_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
