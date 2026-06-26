"""Structural audit helpers (post-execution pass before QA review)."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from qa_response_review import (
    MIN_DRAFT_CHARS,
    extract_turn_pair,
    is_hook_user_message,
    parse_bool,
)

TEMPLATE_PATH = Path(__file__).with_name("structural-audit-prompt.txt")
AUDIT_MARKER = "[STRUCTURAL_AUDIT HOOK]"


def load_template() -> str:
    return TEMPLATE_PATH.read_text(encoding="utf-8")


def build_followup_message(user_request: str, draft_output: str) -> str:
    template = load_template()
    body = template if template.startswith(AUDIT_MARKER) else f"{AUDIT_MARKER}\n\n{template}"
    return (
        f"{body}\n\n"
        f"### Original User Request\n{user_request}\n\n"
        f"### Draft To Audit\n{draft_output}"
    )


def should_skip(user_request: str, draft_output: str, loop_count: int, status: str) -> bool:
    if not parse_bool(os.environ.get("STRUCTURAL_AUDIT_HOOK_ENABLED"), default=True):
        return True

    if status != "completed":
        return True

    if loop_count > 0:
        return True

    if is_hook_user_message(user_request):
        return True

    if not draft_output or len(draft_output) < MIN_DRAFT_CHARS:
        return True

    return False


def run_stop_hook(hook_input: dict) -> dict:
    status = str(hook_input.get("status", ""))
    loop_count = int(hook_input.get("loop_count", 0) or 0)
    transcript_path = hook_input.get("transcript_path")

    if not isinstance(transcript_path, str) or not transcript_path:
        return {}

    user_request, draft_output = extract_turn_pair(transcript_path)
    if should_skip(user_request, draft_output, loop_count, status):
        return {}

    return {"followup_message": build_followup_message(user_request, draft_output)}


def main() -> int:
    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw) if raw.strip() else {}
        payload = run_stop_hook(hook_input)
        print(json.dumps(payload))
        return 0
    except Exception as error:  # noqa: BLE001
        print(json.dumps({}), file=sys.stdout)
        print(f"[structural-audit-review] failed: {error}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
