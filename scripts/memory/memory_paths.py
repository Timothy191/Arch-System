"""Canonical Cursor agent memory paths (relocated under .ai_content/)."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# Authoritative agent memory root (sessions, state, recall brief, turn session)
CURSOR_MEMORY_ROOT = REPO_ROOT / ".ai_content" / ".memory" / ".cursor-memory"

# Display / doc-relative path from repo root
CURSOR_MEMORY_REL = ".ai_content/.memory/.cursor-memory"

CONFIG_DIR = CURSOR_MEMORY_ROOT / "config"
SESSIONS_DIR = CURSOR_MEMORY_ROOT / "sessions"
STATE_FILE = CURSOR_MEMORY_ROOT / "state.json"
ACTIVE_CONTEXT_FILE = CURSOR_MEMORY_ROOT / "active-context.md"
RECALL_BRIEF_FILE = CURSOR_MEMORY_ROOT / ".recall-brief.md"
TURN_SESSION_FILE = CURSOR_MEMORY_ROOT / ".turn-session.json"
COMPACT_PENDING_FILE = CURSOR_MEMORY_ROOT / ".compact-pending"
COMPACT_STAGING_FILE = CURSOR_MEMORY_ROOT / ".compact-staging.md"
INDEX_FILE = CURSOR_MEMORY_ROOT / "index.jsonl"


def ensure_memory_dirs() -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
