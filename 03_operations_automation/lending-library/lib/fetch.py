"""Fetch ephemeral skills and tools into run/lending-library/staging/."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .common import STAGING_DIR, ensure_run_dirs


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(cmd)}\n{result.stderr.strip()}"
        )


def fetch_github_raw(entry: dict[str, Any], resource_id: str) -> Path:
    repo = entry["repo"]
    ref = entry.get("ref", "main")
    rel_path = entry["path"]
    owner, name = repo.split("/", 1)
    url = f"https://raw.githubusercontent.com/{owner}/{name}/{ref}/{rel_path}"

    dest_dir = STAGING_DIR / resource_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / Path(rel_path).name

    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            dest_file.write_bytes(resp.read())
    except urllib.error.URLError as exc:
        raise RuntimeError(f"github raw fetch failed: {url} — {exc}") from exc

    meta = dest_dir / ".fetch-meta.json"
    meta.write_text(json.dumps({"type": "github_raw", "url": url, "repo": repo}, indent=2))
    return dest_file


def fetch_github_tree(entry: dict[str, Any], resource_id: str) -> Path:
    repo = entry["repo"]
    ref = entry.get("ref", "main")
    subpath = entry.get("path", "").strip("/")

    dest_dir = STAGING_DIR / resource_id
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True)

    clone_dir = dest_dir / "_repo"
    _run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "--filter=blob:none",
            "--sparse",
            "--branch",
            ref,
            f"https://github.com/{repo}.git",
            str(clone_dir),
        ]
    )
    if subpath:
        _run(["git", "sparse-checkout", "set", subpath], cwd=clone_dir)

    source = clone_dir / subpath if subpath else clone_dir
    skill_md = source / "SKILL.md"
    if not skill_md.exists():
        for candidate in source.rglob("SKILL.md"):
            skill_md = candidate
            source = candidate.parent
            break

    if not skill_md.exists():
        shutil.rmtree(dest_dir)
        raise RuntimeError(f"no SKILL.md under github tree {repo}/{subpath}")

    payload = dest_dir / "payload"
    if source != clone_dir:
        shutil.copytree(source, payload, dirs_exist_ok=True)
    else:
        shutil.copytree(clone_dir, payload, dirs_exist_ok=True)

    shutil.rmtree(clone_dir, ignore_errors=True)
    meta = dest_dir / ".fetch-meta.json"
    meta.write_text(
        json.dumps({"type": "github_tree", "repo": repo, "path": subpath, "ref": ref}, indent=2)
    )
    return payload / "SKILL.md" if (payload / "SKILL.md").exists() else skill_md


def fetch_npm_tool(entry: dict[str, Any], resource_id: str) -> Path:
    package = entry["package"]
    dest_dir = STAGING_DIR / resource_id
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True)

    _run(["npm", "install", "--prefix", str(dest_dir), "--no-save", package])
    bin_name = entry.get("bin", package.split("/")[-1])
    bin_path = dest_dir / "node_modules" / ".bin" / bin_name
    if not bin_path.exists():
        raise RuntimeError(f"npm bin not found after install: {bin_path}")

    meta = dest_dir / ".fetch-meta.json"
    meta.write_text(json.dumps({"type": "npm", "package": package, "bin": str(bin_path)}, indent=2))
    return bin_path


def fetch_pypi_tool(entry: dict[str, Any], resource_id: str) -> Path:
    package = entry.get("package") or entry.get("pypi")
    if not package:
        raise RuntimeError("pypi entry requires package")

    dest_dir = STAGING_DIR / resource_id
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True)

    _run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--target",
            str(dest_dir / "site-packages"),
            "--upgrade",
            package,
        ]
    )
    bin_name = entry.get("bin")
    if bin_name:
        bin_path = dest_dir / "bin" / bin_name
        bin_path.parent.mkdir(parents=True, exist_ok=True)
        # pip --target does not create console_scripts wrappers; record site-packages only
        meta = dest_dir / ".fetch-meta.json"
        meta.write_text(
            json.dumps(
                {
                    "type": "pypi",
                    "package": package,
                    "site_packages": str(dest_dir / "site-packages"),
                    "bin": bin_name,
                },
                indent=2,
            )
        )
        return dest_dir / "site-packages"

    meta = dest_dir / ".fetch-meta.json"
    meta.write_text(json.dumps({"type": "pypi", "package": package}, indent=2))
    return dest_dir / "site-packages"


def fetch_resource(kind: str, resource_id: str, entry: dict[str, Any]) -> tuple[Path, Path]:
    """Return (usable_path, staging_dir). staging_dir is removed on return."""
    ensure_run_dirs()
    fetch_type = entry.get("type", "local")

    if fetch_type == "github_raw":
        path = fetch_github_raw(entry, resource_id)
        return path, path.parent
    if fetch_type == "github_tree":
        path = fetch_github_tree(entry, resource_id)
        return path, STAGING_DIR / resource_id
    if fetch_type == "npm":
        path = fetch_npm_tool(entry, resource_id)
        return path, STAGING_DIR / resource_id
    if fetch_type in ("pypi", "pip"):
        path = fetch_pypi_tool(entry, resource_id)
        return path, STAGING_DIR / resource_id

    raise RuntimeError(f"unsupported fetch type: {fetch_type}")
