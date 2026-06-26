"""Shared helpers for Arch-System Cursor hooks."""

from __future__ import annotations

import json
import os
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
STATE_DIR = HOOKS_DIR / "state"
STATE_PATH = STATE_DIR / "agent-lifecycle.json"

ARCH_SYSTEM_DEFAULTS = """\
### Arch-System defaults (apply unless the user overrides)

1. **TARGET ENVIRONMENT:** Local-first Nx + pnpm monorepo; Portal on :3000; Supabase local Docker; Node >= 22.
2. **ARCHITECTURAL PATTERN:** Numbered-Functional (`10-src/`); feature libs (`libs/features/{domain}/{ui,data-access,utils}`); Nx boundary tags.
3. **HARD CONSTRAINTS:** Use `10-src/` for modular functional roots (never bare `src/`); control-room data is human-input first (no invented PLC/SCADA APIs); run `pnpm quality` before done; update `AGENT_TRACER.md` on code changes.
4. **OOPs GUARDRAILS:** No metaphors for architecture; verify paths (no stale `src/`); no assumed sensor/cloud telemetry without documented adapters; no volatile-only critical state; no magic-number timeouts; no side effects outside module scope — abort and refactor on trigger.
5. **CONTINUOUS IMPROVEMENT:** Run 3-Pass Optimization before completing tasks; use Librarian checkout/return for modular skills (`.agents/skills/`, `10-src/checkout-skill.py`, `10-src/return-skill.py`).
6. **ENTERPRISE PRODUCTION:** Plan with Zero-Trust (detect/isolate/recover); run Deterministic Performance sanity check; perform Unified System Cascade verification on multi-file changes.
"""


def parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"0", "false", "no", "off"}:
        return False
    if normalized in {"1", "true", "yes", "on"}:
        return True
    return default


def load_template(filename: str) -> str:
    return (HOOKS_DIR / filename).read_text(encoding="utf-8")


def load_state() -> dict:
    default = {
        "version": 1,
        "completed_turn_count": 0,
        "last_stop_was_pruning": False,
    }
    if not STATE_PATH.is_file():
        return default
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return default
        return {**default, **data}
    except (json.JSONDecodeError, OSError):
        return default


def save_state(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(f"{json.dumps(state, indent=2)}\n", encoding="utf-8")


def read_stdin_json() -> dict:
    import sys

    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def emit(payload: dict) -> None:
    import sys

    sys.stdout.write(json.dumps(payload))
