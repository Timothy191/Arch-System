#!/usr/bin/env python3
"""Auto-recall — deterministic memory brief for agent turn start.

Reads active-context, MEMORY.md, learnings, session index, HOW.md, and optional
user prompt; writes `.memory/.recall-brief.md` for agents to load before acting.
No vector DB — keyword overlap only (workspace search policy).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
MEMORY_DIR = REPO_ROOT / ".memory"
BRIEF_FILE = MEMORY_DIR / ".recall-brief.md"
ACTIVE_CONTEXT = MEMORY_DIR / "active-context.md"
STATE_FILE = MEMORY_DIR / "state.json"
INDEX_FILE = MEMORY_DIR / "index.jsonl"
LEARNINGS = REPO_ROOT / "run" / "agent-learnings.jsonl"
MEMORY_MD = REPO_ROOT / "MEMORY.md"
HOW_MD = REPO_ROOT / "HOW.md"
PROGRESSIVE = REPO_ROOT / "PROGRESSIVE_DISCLOSURE.md"
SESSIONS_DIR = MEMORY_DIR / "sessions"

STOP_WORDS = frozenset(
    {
        "the",
        "and",
        "for",
        "are",
        "but",
        "not",
        "you",
        "all",
        "can",
        "had",
        "her",
        "was",
        "one",
        "our",
        "out",
        "day",
        "get",
        "has",
        "him",
        "his",
        "how",
        "its",
        "may",
        "new",
        "now",
        "old",
        "see",
        "two",
        "way",
        "who",
        "boy",
        "did",
        "let",
        "put",
        "say",
        "she",
        "too",
        "use",
        "add",
        "create",
        "make",
        "please",
        "this",
        "that",
        "with",
        "from",
        "your",
        "will",
        "have",
        "been",
        "into",
        "when",
        "what",
        "them",
        "then",
        "than",
        "also",
        "just",
        "like",
        "need",
        "want",
        "each",
        "about",
    }
)


def _tokens(text: str) -> list[str]:
    raw = re.findall(r"[a-z0-9][a-z0-9_-]{2,}", text.lower())
    return [t for t in raw if t not in STOP_WORDS]


def _run_git(*args: str) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


def _read_text(path: Path, limit: int | None = None) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if limit is not None:
        return "\n".join(text.splitlines()[:limit])
    return text


def _extract_section(md: str, heading: str) -> str:
    pattern = re.compile(
        rf"^##\s+{re.escape(heading)}\s*$",
        re.MULTILINE | re.IGNORECASE,
    )
    match = pattern.search(md)
    if not match:
        return ""
    start = match.end()
    next_heading = re.search(r"\n##\s+", md[start:])
    end = start + next_heading.start() if next_heading else len(md)
    return md[start:end].strip()


def _score_text(text: str, query_tokens: list[str]) -> int:
    if not query_tokens:
        return 0
    lower = text.lower()
    return sum(1 for token in query_tokens if token in lower)


def _git_context() -> dict[str, str]:
    status = _run_git("status", "-sb")
    status_line = status.splitlines()[0] if status else ""
    return {
        "branch": _run_git("branch", "--show-current"),
        "commit": _run_git("log", "-1", "--pretty=%h %s"),
        "status": status_line,
    }


def _how_snapshot() -> dict[str, Any]:
    text = _read_text(HOW_MD)
    if not text:
        return {"task": "", "open": 0, "done": 0}
    task_match = re.search(r"\*\*Task\*\*\s*\|\s*(.+?)\s*\|", text)
    open_count = len(re.findall(r"^- \[ \]", text, re.MULTILINE))
    done_count = len(re.findall(r"^- \[[xX]\]", text, re.MULTILINE))
    return {
        "task": task_match.group(1).strip() if task_match else "",
        "open": open_count,
        "done": done_count,
    }


def _search_memory_md(query_tokens: list[str], limit: int = 5) -> list[str]:
    lines: list[tuple[int, str]] = []
    for line in _read_text(MEMORY_MD).splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") and not stripped.startswith("-"):
            if stripped.startswith("#"):
                continue
        if len(stripped) < 8:
            continue
        score = _score_text(stripped, query_tokens)
        if score > 0 or (not query_tokens and stripped.startswith("|") and "Fact learned" not in stripped):
            lines.append((score, stripped))
    lines.sort(key=lambda item: item[0], reverse=True)
    if query_tokens:
        return [line for score, line in lines if score > 0][:limit]
    return [line for _, line in lines if line.startswith("|") or line.startswith("-")][:limit]


def _search_learnings(query_tokens: list[str], limit: int = 3) -> list[str]:
    if not LEARNINGS.exists():
        return []
    hits: list[tuple[int, str]] = []
    for line in LEARNINGS.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        score = _score_text(line, query_tokens)
        if score > 0:
            try:
                row = json.loads(line)
                summary = row.get("summary") or line
                hits.append((score, f"- {summary}"))
            except json.JSONDecodeError:
                hits.append((score, f"- {line[:120]}"))
    hits.sort(key=lambda item: item[0], reverse=True)
    return [text for _, text in hits[:limit]]


def _search_sessions(query_tokens: list[str], limit: int = 3) -> list[dict[str, str]]:
    if not INDEX_FILE.exists():
        return []
    entries: list[tuple[int, dict[str, Any]]] = []
    for line in INDEX_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        blob = " ".join(
            str(entry.get(key, ""))
            for key in ("id", "topic", "tags")
        )
        score = _score_text(blob, query_tokens)
        if score > 0 or not query_tokens:
            entries.append((score if query_tokens else 1, entry))
    entries.sort(key=lambda item: item[0], reverse=True)

    results: list[dict[str, str]] = []
    for score, entry in entries[: limit * 2]:
        session_id = str(entry.get("id", ""))
        if not session_id:
            continue
        session_path = SESSIONS_DIR / f"{session_id}.md"
        snippet = ""
        if session_path.exists():
            body = _read_text(session_path, limit=35)
            intent = _extract_section(body, "Intent") or _extract_section(body, "Decisions")
            snippet = intent.splitlines()[0][:140] if intent else body.splitlines()[0][:140]
        results.append(
            {
                "id": session_id,
                "topic": str(entry.get("topic", session_id)),
                "path": f".memory/sessions/{session_id}.md",
                "snippet": snippet,
                "score": str(score),
            }
        )
        if len(results) >= limit:
            break
    return results


def _progressive_slices(query_tokens: list[str], limit: int = 2) -> list[str]:
    text = _read_text(PROGRESSIVE)
    if not text:
        return []
    slices: list[tuple[int, str]] = []
    for match in re.finditer(r"^## Slice: (.+)$", text, re.MULTILINE):
        title = match.group(1).strip()
        score = _score_text(title, query_tokens)
        if score > 0:
            slices.append((score, title))
    slices.sort(key=lambda item: item[0], reverse=True)
    return [title for _, title in slices[:limit]]


def build_brief(*, trigger: str, prompt: str = "") -> dict[str, Any]:
    git = _git_context()
    how = _how_snapshot()
    active = _read_text(ACTIVE_CONTEXT)

    query_parts = [prompt, git.get("branch", ""), git.get("commit", ""), how.get("task", "")]
    objective = _extract_section(active, "Current objective")
    if objective:
        query_parts.append(objective)
    query_tokens = _tokens(" ".join(query_parts))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "trigger": trigger,
        "query_tokens": query_tokens[:12],
        "git": git,
        "how": how,
        "active_objective": objective.splitlines()[0][:200] if objective else "",
        "active_next": _extract_section(active, "Next action").splitlines()[:3],
        "active_blockers": _extract_section(active, "Sync (last `/summarize` wrap-up)"),
        "memory_lines": _search_memory_md(query_tokens),
        "learnings": _search_learnings(query_tokens),
        "sessions": _search_sessions(query_tokens),
        "progressive_slices": _progressive_slices(query_tokens),
        "state": _read_json(STATE_FILE),
    }


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def format_markdown(brief: dict[str, Any]) -> str:
    lines = [
        "# Auto-recall brief",
        "",
        f"> Generated: `{brief['generated_at']}` · trigger: `{brief['trigger']}`",
        f"> Query tokens: {', '.join(brief['query_tokens']) or '_(git + active task)_'}",
        "",
        "**Agents:** read this file at turn start (after `active-context.md`). Do not replay full chat.",
        "",
        "## Continuation",
        "",
    ]

    if brief["active_objective"]:
        lines.append(f"- **Objective:** {brief['active_objective']}")
    for step in brief.get("active_next") or []:
        step = step.strip()
        if step and not step.startswith("|"):
            lines.append(f"- **Next:** {step.lstrip('0123456789. ')}")
    if brief["how"].get("task"):
        lines.append(
            f"- **HOW task:** {brief['how']['task']} "
            f"({brief['how']['done']} done / {brief['how']['open']} open)"
        )

    git = brief.get("git") or {}
    if git.get("branch"):
        lines.extend(["", "## Git", "", f"- `{git.get('status', git['branch'])}`"])
        if git.get("commit"):
            lines.append(f"- Last commit: {git['commit']}")

    memory_lines = brief.get("memory_lines") or []
    if memory_lines:
        lines.extend(["", "## MEMORY.md hits", ""])
        lines.extend(memory_lines[:5])

    sessions = brief.get("sessions") or []
    if sessions:
        lines.extend(["", "## Prior sessions", ""])
        for session in sessions:
            lines.append(
                f"- [{session['topic']}]({session['path']}) — {session.get('snippet', '').strip()}"
            )

    learnings = brief.get("learnings") or []
    if learnings:
        lines.extend(["", "## Learnings", ""])
        lines.extend(learnings)

    slices = brief.get("progressive_slices") or []
    if slices:
        lines.extend(["", "## Progressive disclosure slices", ""])
        for title in slices:
            lines.append(f"- `PROGRESSIVE_DISCLOSURE.md` → Slice: {title}")

    lines.extend(
        [
            "",
            "## Suggested reads (in order)",
            "",
            "1. `.memory/active-context.md`",
            "2. `HOW.md` (active checklist)",
            "3. `MEMORY.md` (only if fact missing above)",
        ]
    )
    if sessions:
        lines.append(f"4. `{sessions[0]['path']}`")

    state = brief.get("state") or {}
    if state.get("compact_pending"):
        lines.extend(
            [
                "",
                "## Compact pending",
                "",
                "- Run auto-compact protocol before deep re-exploration (`summarize-memory.mdc`).",
            ]
        )

    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build agent auto-recall brief")
    parser.add_argument(
        "--trigger",
        default="manual",
        choices=("sessionStart", "beforeSubmitPrompt", "manual"),
    )
    parser.add_argument("--prompt", default="", help="Latest user prompt text")
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout")
    args = parser.parse_args()

    MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    brief = build_brief(trigger=args.trigger, prompt=args.prompt)
    markdown = format_markdown(brief)
    BRIEF_FILE.write_text(markdown, encoding="utf-8")

    if args.json:
        print(json.dumps(brief, indent=2))
    else:
        print(markdown)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
