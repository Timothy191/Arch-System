#!/usr/bin/env python3
"""sessionStart hook: inject Context-Anchor alignment into every new agent session."""

from __future__ import annotations

import sys

from hook_common import ARCH_SYSTEM_DEFAULTS, emit, load_template, parse_bool, read_stdin_json

MARKER = "[CONTEXT-ANCHOR HOOK]"


def main() -> int:
    try:
        if not parse_bool(__import__("os").environ.get("CONTEXT_ANCHOR_HOOK_ENABLED"), default=True):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        template = load_template("context-anchor-prompt.txt")
        additional_context = f"{MARKER}\n\n{template}\n\n{ARCH_SYSTEM_DEFAULTS}"
        emit({"additional_context": additional_context})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[context-anchor-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
