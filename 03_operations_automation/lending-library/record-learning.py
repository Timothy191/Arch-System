#!/usr/bin/env python3
"""Append a structured learning entry for continuous agent improvement."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

LEARNINGS_FILE = Path(__file__).resolve().parents[2] / "run" / "agent-learnings.jsonl"


def main() -> int:
    parser = argparse.ArgumentParser(description="Record an agent learning entry")
    parser.add_argument("--topic", required=True, help="Area (e.g. portal-auth, sync-queue)")
    parser.add_argument("--summary", required=True, help="One-line lesson learned")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--refs", default="", help="Comma-separated file paths")
    args = parser.parse_args()

    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "topic": args.topic,
        "summary": args.summary,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "refs": [r.strip() for r in args.refs.split(",") if r.strip()],
    }

    LEARNINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LEARNINGS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"RECORDED: {args.topic}")
    print(f"FILE: {LEARNINGS_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
