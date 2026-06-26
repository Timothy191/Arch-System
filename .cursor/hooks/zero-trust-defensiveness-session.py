#!/usr/bin/env python3
"""sessionStart hook: inject Zero-Trust Defensiveness pre-execution planning."""

from __future__ import annotations

import sys

from hook_common import emit, load_template, parse_bool, read_stdin_json

MARKER = "[ZERO-TRUST DEFENSIVENESS HOOK]"


def main() -> int:
    try:
        if not parse_bool(__import__("os").environ.get("ZERO_TRUST_HOOK_ENABLED"), default=True):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        template = load_template("zero-trust-defensiveness-prompt.txt")
        body = template if template.startswith(MARKER) else f"{MARKER}\n\n{template}"
        emit({"additional_context": body})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[zero-trust-defensiveness-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
