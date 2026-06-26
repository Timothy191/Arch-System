#!/usr/bin/env python3
"""stop hook: orchestrate Context-Pruning (periodic) and QA review (default)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow importing sibling hook modules when executed as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from hook_common import emit, load_state, load_template, parse_bool, read_stdin_json, save_state

PRUNE_TURN_INTERVAL = int(os.environ.get("CONTEXT_PRUNE_TURN_INTERVAL", "6"))
PRUNING_MARKER = "[CONTEXT-PRUNING HOOK]"
QA_MARKER = "[QA_RESPONSE_REVIEW]"


def should_count_turn(status: str, loop_count: int) -> bool:
    return status == "completed" and loop_count == 0


def build_pruning_followup() -> str:
    template = load_template("context-pruning-prompt.txt")
    return template if template.startswith(PRUNING_MARKER) else f"{PRUNING_MARKER}\n\n{template}"


def run_structural_audit_followup(hook_input: dict) -> dict:
    import structural_audit_review as audit

    return audit.run_stop_hook(hook_input)


def run_qa_followup(hook_input: dict) -> dict:
    import qa_response_review as qa

    return qa.run_stop_hook(hook_input)


def main() -> int:
    try:
        hook_input = read_stdin_json()
        status = str(hook_input.get("status", ""))
        loop_count = int(hook_input.get("loop_count", 0) or 0)
        state = load_state()

        if should_count_turn(status, loop_count):
            state["completed_turn_count"] = int(state.get("completed_turn_count", 0)) + 1
            state["last_stop_was_pruning"] = False

        turn_count = int(state.get("completed_turn_count", 0))
        pruning_due = (
            parse_bool(os.environ.get("CONTEXT_PRUNING_HOOK_ENABLED"), default=True)
            and should_count_turn(status, loop_count)
            and turn_count > 0
            and turn_count % PRUNE_TURN_INTERVAL == 0
        )

        if pruning_due:
            state["last_stop_was_pruning"] = True
            save_state(state)
            emit({"followup_message": build_pruning_followup()})
            return 0

        save_state(state)

        loop_count = int(hook_input.get("loop_count", 0) or 0)
        structural_enabled = parse_bool(
            os.environ.get("STRUCTURAL_AUDIT_HOOK_ENABLED"), default=True
        )

        if (
            structural_enabled
            and loop_count == 0
            and should_count_turn(status, loop_count)
        ):
            audit_payload = run_structural_audit_followup(hook_input)
            if audit_payload:
                emit(audit_payload)
                return 0

        if parse_bool(os.environ.get("QA_REVIEW_HOOK_ENABLED"), default=True):
            qa_payload = run_qa_followup(hook_input)
            if qa_payload:
                emit(qa_payload)
                return 0

        emit({})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[agent-stop-orchestrator] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
