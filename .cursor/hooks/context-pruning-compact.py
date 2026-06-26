#!/usr/bin/env python3
"""preCompact hook: notify on context compaction and prime pruning behavior."""

from __future__ import annotations

import sys
from datetime import UTC, datetime

from hook_common import emit, load_state, parse_bool, read_stdin_json, save_state

MARKER = "[CONTEXT-PRUNING HOOK]"


def main() -> int:
    try:
        if not parse_bool(__import__("os").environ.get("CONTEXT_PRUNING_HOOK_ENABLED"), default=True):
            emit({})
            return 0

        hook_input = read_stdin_json()
        state = load_state()
        state["last_compaction_at"] = datetime.now(UTC).isoformat()
        state["last_compaction_trigger"] = hook_input.get("trigger", "unknown")
        state["last_context_usage_percent"] = hook_input.get("context_usage_percent")
        save_state(state)

        usage = hook_input.get("context_usage_percent", "?")
        trigger = hook_input.get("trigger", "auto")
        user_message = (
            f"{MARKER} Context compaction ({trigger}) at ~{usage}% window usage. "
            "The agent will prune stale context on the next cycle per project rules."
        )
        emit({"user_message": user_message})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[context-pruning-compact] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
