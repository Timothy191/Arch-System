"""Checkout skills and tools into the active session."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .common import (
    find_local_skill,
    load_active,
    load_catalog,
    save_active,
)
from .fetch import fetch_resource


def _turn_session_record(action: str, kind: str, resource_id: str) -> None:
    import subprocess

    script = Path(__file__).resolve().parents[3] / "scripts" / "agent-orchestrator" / "turn-session.py"
    if not script.exists():
        return
    subprocess.run(
        ["python3", str(script), "record", action, kind, resource_id],
        check=False,
        capture_output=True,
    )


def _catalog_entry(kind: str, resource_id: str) -> dict[str, Any] | None:
    catalog = load_catalog()
    section = catalog.get(f"{kind}s", {})
    needle = resource_id.lower().replace("_", "-")
    if resource_id in section:
        return section[resource_id]
    for key, entry in section.items():
        if needle in key.lower():
            return entry
    return None


def get_catalog_entry(kind: str, resource_id: str) -> dict[str, Any] | None:
    return _catalog_entry(kind, resource_id)


def checkout(kind: str, resource_id: str) -> dict[str, Any]:
    active = load_active()
    for item in active.get("resources", []):
        if item.get("id") == resource_id and item.get("kind") == kind:
            return item

    ephemeral = False
    staging_dir: Path | None = None
    path: Path | None = None
    source = "local"

    if kind == "skill":
        path = find_local_skill(resource_id)
        if path is not None:
            source = "local"

    entry = _catalog_entry(kind, resource_id)
    if path is None and entry is not None:
        fetch_type = entry.get("type", "local")
        if fetch_type == "local" and kind == "skill":
            path = find_local_skill(entry.get("search", resource_id))
            source = "local"
        elif fetch_type != "local":
            path, staging_dir = fetch_resource(kind, resource_id, entry)
            ephemeral = True
            source = fetch_type

    if path is None:
        raise FileNotFoundError(
            f"{kind} '{resource_id}' not found locally or in catalog ({kind}s section)"
        )

    record: dict[str, Any] = {
        "id": resource_id,
        "kind": kind,
        "path": str(path),
        "ephemeral": ephemeral,
        "source": source,
    }
    if staging_dir is not None:
        record["staging_dir"] = str(staging_dir)

    resources = active.setdefault("resources", [])
    resources.append(record)
    save_active(active)
    _turn_session_record("checkout", kind, resource_id)
    return record


def return_resource(kind: str, resource_id: str) -> bool:
    import shutil

    active = load_active()
    resources = active.get("resources", [])
    kept: list[dict[str, Any]] = []
    removed = False

    for item in resources:
        if item.get("id") == resource_id and item.get("kind") == kind:
            removed = True
            if item.get("ephemeral") and item.get("staging_dir"):
                staging = Path(item["staging_dir"])
                if staging.exists():
                    shutil.rmtree(staging, ignore_errors=True)
            continue
        kept.append(item)

    active["resources"] = kept
    save_active(active)
    if removed:
        _turn_session_record("return", kind, resource_id)
    return removed
