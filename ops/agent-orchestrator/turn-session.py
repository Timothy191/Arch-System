#!/usr/bin/env python3
"""Record per-turn session signals for turn-close footer."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from turn_session_lib import (  # noqa: E402
    begin_turn,
    load_session,
    record_capability,
    record_checkout,
    record_return,
    record_verify,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Turn session recorder")
    sub = parser.add_subparsers(dest="command", required=True)

    begin_p = sub.add_parser("begin", help="Start turn session (hook)")
    begin_p.add_argument("--prompt", default="", help="User prompt text")

    rec_p = sub.add_parser("record", help="Record an event")
    rec_sub = rec_p.add_subparsers(dest="record_kind", required=True)
    checkout_p = rec_sub.add_parser("checkout")
    checkout_p.add_argument("kind", choices=("skill", "tool"))
    checkout_p.add_argument("id")
    ret_p = rec_sub.add_parser("return")
    ret_p.add_argument("kind", choices=("skill", "tool"))
    ret_p.add_argument("id")
    verify_p = rec_sub.add_parser("verify")
    verify_p.add_argument("--passed", action="store_true")
    verify_p.add_argument("--failed", action="store_true")
    cap_p = rec_sub.add_parser("capability")
    cap_p.add_argument("--agent")
    cap_p.add_argument("--mcp")
    cap_p.add_argument("--workflow")

    sub.add_parser("show", help="Print current session JSON")

    args = parser.parse_args()

    if args.command == "begin":
        session = begin_turn(args.prompt)
        print(json.dumps({"ok": True, "turn_id": session["turn_id"], "tier": session["effort_tier"]}))
        return 0

    if args.command == "record":
        if args.record_kind == "checkout":
            record_checkout(args.kind, args.id)
        elif args.record_kind == "return":
            record_return(args.kind, args.id)
        elif args.record_kind == "verify":
            if args.failed:
                record_verify(False)
            else:
                record_verify(True)
        elif args.record_kind == "capability":
            record_capability(agent=args.agent, mcp=args.mcp, workflow=args.workflow)
        print(json.dumps({"ok": True}))
        return 0

    if args.command == "show":
        print(json.dumps(load_session(), indent=2))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
