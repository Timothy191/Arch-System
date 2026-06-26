#!/usr/bin/env python3
"""sessionStart hook: inject OOPs guardrails into every new agent session."""

from __future__ import annotations

import sys

from hook_common import emit, load_template, parse_bool, read_stdin_json

MARKER = "[OOPS GUARDRAILS]"


def main() -> int:
    try:
        if not parse_bool(__import__("os").environ.get("OOPS_GUARDRAILS_ENABLED"), default=True):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        template = load_template("oops-guardrails-prompt.txt")
        body = template if template.startswith(MARKER) else f"{MARKER}\n\n{template}"
        emit({"additional_context": body})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[oops-guardrails-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
