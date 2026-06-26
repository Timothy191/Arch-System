#!/usr/bin/env python3
"""sessionStart hook: inject continuous-improvement workflows (3-Pass + Librarian)."""

from __future__ import annotations

import sys

from hook_common import emit, load_template, parse_bool, read_stdin_json

THREE_PASS_MARKER = "[3-PASS OPTIMIZATION]"
LIBRARIAN_MARKER = "[LIBRARIAN SKILL WORKFLOW]"


def main() -> int:
    try:
        import os

        if not parse_bool(os.environ.get("CONTINUOUS_IMPROVEMENT_ENABLED"), default=True):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        sections: list[str] = []

        if parse_bool(os.environ.get("THREE_PASS_WORKFLOW_ENABLED"), default=True):
            three_pass = load_template("three-pass-optimization-prompt.txt").strip()
            if not three_pass.startswith(THREE_PASS_MARKER):
                three_pass = f"{THREE_PASS_MARKER}\n\n{three_pass}"
            sections.append(three_pass)

        if parse_bool(os.environ.get("LIBRARIAN_WORKFLOW_ENABLED"), default=True):
            librarian = load_template("librarian-skill-workflow-prompt.txt").strip()
            if not librarian.startswith(LIBRARIAN_MARKER):
                librarian = f"{LIBRARIAN_MARKER}\n\n{librarian}"
            sections.append(librarian)

        if not sections:
            emit({})
            return 0

        emit({"additional_context": "\n\n---\n\n".join(sections)})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[continuous-improvement-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
