"""QA response review helpers (importable module + stop/subagentStop hook)."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

TEMPLATE_PATH = Path(__file__).with_name("qa-token-saving-wrapper.txt")
QA_MARKER = "[QA_RESPONSE_REVIEW]"
PRUNING_MARKER = "[CONTEXT-PRUNING HOOK]"
AUDIT_MARKER = "[STRUCTURAL_AUDIT HOOK]"
MANIFEST_MARKER = "[TOKEN-SAVING AGENT MANIFEST]"
HOOK_USER_MARKERS = (
    QA_MARKER,
    PRUNING_MARKER,
    AUDIT_MARKER,
    MANIFEST_MARKER,
    "[CONTEXT-ANCHOR HOOK]",
    "[OOPS GUARDRAILS]",
    "[ZERO-TRUST DEFENSIVENESS HOOK]",
)
MIN_DRAFT_CHARS = 40


def is_hook_user_message(text: str) -> bool:
    return any(marker in text for marker in HOOK_USER_MARKERS)


def parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"0", "false", "no", "off"}:
        return False
    if normalized in {"1", "true", "yes", "on"}:
        return True
    return default


def normalize_user_request(text: str) -> str:
    """Prefer the explicit user query over wrapped skill/context envelopes."""
    match = re.search(
        r"<user_query>\s*(.*?)\s*</user_query>",
        text,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return text.strip()


def extract_text_from_message(message: dict) -> str:
    content = message.get("content")
    if not isinstance(content, list):
        return ""

    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return "\n\n".join(parts)


def extract_turn_pair(transcript_path: str) -> tuple[str, str]:
    """Return the latest user request and assembled assistant draft for the final turn."""
    path = Path(transcript_path)
    if not path.is_file():
        return "", ""

    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    events: list[dict] = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    latest_user = ""
    draft_parts: list[str] = []

    for event in reversed(events):
        if event.get("type") == "turn_ended":
            continue

        role = event.get("role")
        message = event.get("message")
        if not isinstance(message, dict):
            continue

        text = extract_text_from_message(message)
        if not text:
            continue

        if role == "assistant":
            draft_parts.insert(0, text)
            continue

        if role == "user":
            if is_hook_user_message(text):
                continue
            latest_user = text
            break

    return normalize_user_request(latest_user), "\n\n".join(draft_parts).strip()


def load_template() -> str:
    return TEMPLATE_PATH.read_text(encoding="utf-8")


def build_followup_message(user_request: str, draft_output: str) -> str:
    wrapper = load_template()
    body = (
        wrapper.replace("{{ORIGINAL_USER_REQUEST}}", user_request).replace(
            "{{DRAFT_OUTPUT}}", draft_output
        )
    )
    return f"{QA_MARKER}\n\n{body}"


def should_skip(user_request: str, draft_output: str, loop_count: int, status: str) -> bool:
    if not parse_bool(os.environ.get("QA_REVIEW_HOOK_ENABLED"), default=True):
        return True

    if status != "completed":
        return True

    structural_enabled = parse_bool(
        os.environ.get("STRUCTURAL_AUDIT_HOOK_ENABLED"), default=True
    )
    if loop_count > 1:
        return True
    if loop_count == 1 and not structural_enabled:
        return True

    if is_hook_user_message(user_request):
        return True

    if not draft_output or len(draft_output) < MIN_DRAFT_CHARS:
        return True

    return False


def run_stop_hook(hook_input: dict) -> dict:
    status = str(hook_input.get("status", ""))
    loop_count = int(hook_input.get("loop_count", 0) or 0)
    transcript_path = hook_input.get("transcript_path")

    if not isinstance(transcript_path, str) or not transcript_path:
        return {}

    user_request, draft_output = extract_turn_pair(transcript_path)
    if should_skip(user_request, draft_output, loop_count, status):
        return {}

    return {"followup_message": build_followup_message(user_request, draft_output)}


def main() -> int:
    try:
        raw = sys.stdin.read()
        hook_input = json.loads(raw) if raw.strip() else {}
        payload = run_stop_hook(hook_input)
        print(json.dumps(payload))
        return 0
    except Exception as error:  # noqa: BLE001 - hook must fail open
        print(json.dumps({}), file=sys.stdout)
        print(f"[qa-response-review] failed: {error}", file=sys.stderr)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
