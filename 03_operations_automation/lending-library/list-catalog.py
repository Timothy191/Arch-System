#!/usr/bin/env python3
"""List allowlisted skills and tools from catalog.json."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from lib.common import load_catalog  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="List lending library catalog entries")
    parser.add_argument(
        "section",
        nargs="?",
        choices=("skills", "tools", "all"),
        default="all",
        help="Catalog section to print",
    )
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    catalog = load_catalog()
    if args.section == "all":
        payload = catalog
    else:
        payload = {args.section: catalog.get(args.section, {})}

    if args.json:
        print(json.dumps(payload, indent=2))
        return 0

    for section, entries in payload.items():
        print(f"[{section}]")
        for name, meta in entries.items():
            desc = meta.get("description", "")
            typ = meta.get("type", "?")
            print(f"  {name} ({typ}) — {desc}")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
