"""Shared paths and catalog for the lending library."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
LIBRARY_DIR = Path(__file__).resolve().parents[1]
CATALOG_FILE = LIBRARY_DIR / "catalog.json"
RUN_DIR = REPO_ROOT / "run" / "lending-library"
STAGING_DIR = RUN_DIR / "staging"
ACTIVE_FILE = RUN_DIR / "active.json"

LOCAL_SKILL_ROOTS = [
    Path.home() / ".cursor" / "skills-cursor",
    Path.home() / ".cursor" / "plugins" / "cache",
    REPO_ROOT / ".cursor" / "skills",
]

LOCAL_TOOL_PATHS = [
    REPO_ROOT / "node_modules" / ".bin",
    Path.home() / ".local" / "bin",
]


def load_catalog() -> dict[str, Any]:
    if not CATALOG_FILE.exists():
        return {"skills": {}, "tools": {}}
    return json.loads(CATALOG_FILE.read_text(encoding="utf-8"))


def ensure_run_dirs() -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    STAGING_DIR.mkdir(parents=True, exist_ok=True)


def load_active() -> dict[str, Any]:
    ensure_run_dirs()
    if not ACTIVE_FILE.exists():
        return {"resources": []}
    try:
        return json.loads(ACTIVE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"resources": []}


def save_active(data: dict[str, Any]) -> None:
    ensure_run_dirs()
    ACTIVE_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def find_local_skill(skill_name: str) -> Path | None:
    needle = skill_name.lower().replace("_", "-")
    for root in LOCAL_SKILL_ROOTS:
        if not root.exists():
            continue
        for skill_md in root.rglob("SKILL.md"):
            parent = skill_md.parent.name.lower()
            if needle in parent or needle in str(skill_md).lower():
                return skill_md
    return None
