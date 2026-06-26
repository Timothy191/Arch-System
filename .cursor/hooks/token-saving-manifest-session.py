#!/usr/bin/env python3
"""sessionStart hook: inject hyper-dense Token-Saving Agent Manifest for all agents."""

from __future__ import annotations

import sys

from hook_common import (
    MANIFEST_MARKER,
    emit,
    load_manifest,
    parse_bool,
    read_stdin_json,
)


def main() -> int:
    try:
        if not parse_bool(
            __import__("os").environ.get("TOKEN_SAVING_MANIFEST_ENABLED"), default=True
        ):
            emit({})
            return 0

        _hook_input = read_stdin_json()
        manifest = load_manifest().strip()
        if not manifest.startswith(MANIFEST_MARKER):
            manifest = f"{MANIFEST_MARKER}\n\n{manifest}"
        emit({"additional_context": manifest})
        return 0
    except Exception as error:  # noqa: BLE001
        print(f"[token-saving-manifest-session] failed: {error}", file=sys.stderr)
        emit({})
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
