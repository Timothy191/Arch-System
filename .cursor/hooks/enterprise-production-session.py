#!/usr/bin/env python3
"""sessionStart hook: inject enterprise production workflows (performance + cascade)."""

from __future__ import annotations

import sys

from hook_common import emit, load_template, parse_bool, read_stdin_json


def main() -> int:
    try:
        import os

        if not parse_bool(os.environ.get("ENTERPRISE_PRODUCTION_ENABLED"), default=True):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        sections: list[str] = []

        if parse_bool(os.environ.get("DETERMINISTIC_PERFORMANCE_ENABLED"), default=True):
            performance = load_template("deterministic-performance-prompt.txt").strip()
            sections.append(performance)

        if parse_bool(os.environ.get("UNIFIED_CASCADE_ENABLED"), default=True):
            cascade = load_template("unified-cascade-verification-prompt.txt").strip()
            sections.append(cascade)

        if not sections:
            emit({})
            return 0

        emit({"additional_context": "\n\n---\n\n".join(sections)})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[enterprise-production-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
