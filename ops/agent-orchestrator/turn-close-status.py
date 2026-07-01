#!/usr/bin/env python3
"""Emit turn-close status for Adaptive Mode footer (end-of-turn /summarize block)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from turn_session_lib import build_close_status  # noqa: E402


def format_markdown(status: dict) -> str:
    adaptive = status["adaptive_mode"]
    intel = status["intelligence_gain"]
    how = status["how_checklist"]
    caps = status["capabilities"]
    turn = status.get("turn_session") or {}

    compact_note = " · compact pending" if adaptive.get("compact_pending") else ""
    verify_note = ""
    if intel.get("verify_ran"):
        verify_note = ", verify ✓" if intel.get("verify_passed") else ", verify ✗"
    elif intel.get("verify_passed"):
        verify_note = ", verify ✓"

    how_turn = ""
    if how.get("done_this_turn", 0) > 0:
        how_turn = f", +{how['done_this_turn']} HOW this turn"

    files_note = ""
    file_count = intel.get("files_touched", 0)
    if file_count:
        files_note = f", {file_count} file{'s' if file_count != 1 else ''} touched"

    lines = [
        "---",
        "**Turn close**",
        f"- **Adaptive mode:** tier `{adaptive['effort_tier']}` · staging `{adaptive['staging']}`{compact_note}",
        f"- **Intelligence gain:** {intel['pct']}% "
        f"(checklist {how['done']}/{how['total'] or '—'}"
        f"{how_turn}, learnings +{intel.get('learnings_delta', 0)}{verify_note}{files_note})",
    ]

    used: list[str] = []
    used.extend(caps.get("returned") or [])
    used.extend(
        f"{c}" if ":" in str(c) else str(c)
        for c in (caps.get("checked_out") or [])
    )
    used.extend(caps.get("agents") or [])
    used.extend(caps.get("mcp_servers") or [])
    used.extend(caps.get("workflows") or [])

    # Deduplicate while preserving order
    seen: set[str] = set()
    used_unique = [x for x in used if x and not (x in seen or seen.add(x))]

    if used_unique:
        lines.append(f"- **Fetched & used (released):** {', '.join(used_unique)}")
    if caps.get("outstanding"):
        lines.append(
            f"- **Outstanding checkouts (return before close):** {', '.join(caps['outstanding'])}"
        )
    if how.get("open") and how.get("done_this_turn", 0) == 0 and not file_count:
        lines.append(
            f"- **HOW backlog:** {how['open']} open items (global objective — not penalized this turn)"
        )

    self_improvement = status.get("self_improvement")
    if self_improvement:
        lines.append("- **Self-Improvement Protocol Breakdown**:")
        lines.append(f"  - Avg token input: {self_improvement.get('avg_token_input', 0)}")
        lines.append(f"  - Quality score: {self_improvement.get('quality', 0)}/100")
        lines.append(f"  - Avg intelligence level: {self_improvement.get('avg_intelligence_level', 0)}/100")
        lines.append(f"  - Avg reasoning level: {self_improvement.get('avg_reasoning_level', 0)}/100")
        lines.append(f"  - Task success score: {self_improvement.get('task_success_score', 0)}/100")
        lines.append(f"  - Confidence score: {self_improvement.get('confidence_score', 0)}/100")
        lines.append(f"  - Top world models vs you: {self_improvement.get('world_model_comparison', 'Top tier')}")
        lines.append(f"  - Benefit gained: {self_improvement.get('benefit_gained', 'Marginal improvement')}")

    readiness = status.get("deployment_readiness")
    if readiness:
        lines.append("- **Road to Deployment**:")
        for idx, rec in enumerate(readiness, 1):
            lines.append(f"  {idx}. {rec}")

    lines.append("---")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Turn-close Adaptive Mode status block")
    parser.add_argument("--tier", choices=("low", "medium", "high"), help="Override effort tier")
    parser.add_argument("--verify-passed", action="store_true", help="Scoped verify succeeded")
    parser.add_argument("--verify-failed", action="store_true", help="Scoped verify failed")
    parser.add_argument("--agent", action="append", default=[], dest="agents")
    parser.add_argument("--mcp", action="append", default=[], dest="mcp_servers")
    parser.add_argument("--workflow", action="append", default=[], dest="workflows")
    parser.add_argument("--json", action="store_true", help="JSON instead of markdown")
    args = parser.parse_args()

    verify: bool | None = None
    if args.verify_passed:
        verify = True
    elif args.verify_failed:
        verify = False

    status = build_close_status(
        effort_tier=args.tier,
        verify_passed=verify,
        agents_used=args.agents,
        mcp_used=args.mcp_servers,
        workflows=args.workflows,
    )

    if args.json:
        print(json.dumps(status, indent=2))
    else:
        print(format_markdown(status))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
