#!/usr/bin/env python3
"""Return a checked-out tool and remove ephemeral staging."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.checkout import return_resource  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Return a checked-out tool")
    parser.add_argument("tool_name", help="Tool name being returned")
    args = parser.parse_args()

    removed = return_resource("tool", args.tool_name)
    if not removed:
        print(f"WARN: '{args.tool_name}' was not active", file=sys.stderr)

    print(f"RETURNED: {args.tool_name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
