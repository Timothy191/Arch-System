#!/usr/bin/env python3
"""Classify task effort — adaptive thinking pattern (Opus 4.8 / Fable 5).

Outputs JSON with tier and recommended harness path. Agents read stdout and follow tier.
"""

from __future__ import annotations

import argparse
import json
import re
import sys

HIGH_SIGNAL = re.compile(
    r"\b(migrat|rls|auth|payment|security|refactor|multi-?service|e2e|deploy|"
    r"breaking|schema|production|ship|summarize|wrap-?up)\b",
    re.I,
)
MEDIUM_SIGNAL = re.compile(
    r"\b(implement|fix|add|update|integrat|test|lint|ci|api|component|sync)\b",
    re.I,
)


def classify(text: str, explicit: str | None = None) -> dict:
    if explicit in ("low", "medium", "high"):
        tier = explicit
    elif HIGH_SIGNAL.search(text):
        tier = "high"
    elif MEDIUM_SIGNAL.search(text):
        tier = "medium"
    else:
        tier = "low"

    paths = {
        "low": {
            "plan": "Skip HOW.md checklist; rg → slice Read → execute",
            "subagents": False,
            "consensus_review": False,
            "verify_gate": "only if files changed",
            "thinking": "direct — no extended CoT",
        },
        "medium": {
            "plan": "Update HOW.md checklist before production edits",
            "subagents": "only if parallel lanes",
            "consensus_review": False,
            "verify_gate": "scoped lint + type-check on touch",
            "thinking": "standard CoT per cognitive-loops.mdc",
        },
        "high": {
            "plan": "HOW.md full checklist + scripts/agent-orchestrator/dynamic-workflow.md",
            "subagents": "parallel lanes via Task (depth=1); verify subagent before done",
            "consensus_review": "auth/RLS/migrations/payments — spawn adversarial reviewer",
            "verify_gate": "scripts/agent-orchestrator/verify-gate.sh before claiming done",
            "thinking": "extended — plan → execute → verify → synthesize",
        },
    }
    return {"tier": tier, "signals": text[:200], "path": paths[tier]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify agent effort tier")
    parser.add_argument("prompt", nargs="?", default="", help="User task text")
    parser.add_argument("--tier", choices=("low", "medium", "high"), help="Force tier")
    parser.add_argument("--stdin", action="store_true", help="Read prompt from stdin")
    args = parser.parse_args()

    text = args.prompt
    if args.stdin:
        text = sys.stdin.read()

    result = classify(text.strip(), args.tier)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
