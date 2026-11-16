#!/usr/bin/env bash
set -euo pipefail

SOURCE_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SOURCE_PATH")" && pwd)"
ARCH_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIBEMON_DIR="$HOME/.vibemon"
NOTIFY_SH="$VIBEMON_DIR/notify.sh"
LOCAL_SINK_DIR="$ARCH_ROOT/.vibemon"
LOCAL_EVENTS_FILE="$LOCAL_SINK_DIR/events.jsonl"
DEFAULT_LOCAL_KEY="vbm_local_arch_system"
INSTALL_URL="https://vibemon.dev/install.sh"

patch_notify_script() {
  if [ ! -f "$NOTIFY_SH" ]; then
    echo "[vibemon] notify.sh not found at $NOTIFY_SH" >&2
    return 1
  fi

  python3 - "$NOTIFY_SH" "$ARCH_ROOT" << 'PYPATCH'
import pathlib
import sys

notify_path = pathlib.Path(sys.argv[1])
arch_root = sys.argv[2]
text = notify_path.read_text(encoding="utf-8")

marker = "# ─── Local project-root telemetry sink"
if marker not in text:
    anchor = 'if [ "$EVENT_TYPE" = "test" ]; then'
    sink_block = (
        '# ─── Local project-root telemetry sink (Arch-System/.vibemon/events.jsonl) ───\n'
        f'_vibemon_local_root="{arch_root}"\n'
        'if [ ! -d "$_vibemon_local_root" ]; then\n'
        '  _vibemon_local_root="$(pwd)"\n'
        'fi\n'
        'mkdir -p "$_vibemon_local_root/.vibemon" 2>/dev/null || true\n'
        'printf \'%s\\n\' "$HOOK_BODY" >> "$_vibemon_local_root/.vibemon/events.jsonl" 2>/dev/null || true\n\n'
        'if [ "$EVENT_TYPE" = "test" ]; then\n'
        '  if [ "$API_KEY" = "vbm_local_arch_system" ]; then\n'
        '    echo "[vibemon] ✓ Local telemetry sink active (.vibemon/events.jsonl)"\n'
        '  else\n'
        '    # Synchronous — connection probe.\n'
        '    HTTP_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -X POST "$API_URL/hook" \\\n'
        '      -H "Content-Type: application/json" \\\n'
        '      -H "Authorization: Bearer $API_KEY" \\\n'
        '      -H "X-Vibemon-Version: $VIBEMON_VER" \\\n'
        '      -d "$HOOK_BODY")\n'
        '    if [ "$HTTP_CODE" = "200" ]; then\n'
        '      echo "[vibemon] ✓ Connection successful"\n'
        '    else\n'
        '      echo "[vibemon] ✗ Connection failed (HTTP $HTTP_CODE)" >&2\n'
        '      exit 1\n'
        '    fi\n'
        '  fi'
    )
    old_test_block = (
        'if [ "$EVENT_TYPE" = "test" ]; then\n'
        '  # Synchronous — connection probe.\n'
        '  HTTP_CODE=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" -X POST "$API_URL/hook" \\\n'
        '    -H "Content-Type: application/json" \\\n'
        '    -H "Authorization: Bearer $API_KEY" \\\n'
        '    -H "X-Vibemon-Version: $VIBEMON_VER" \\\n'
        '    -d "$HOOK_BODY")\n'
        '  if [ "$HTTP_CODE" = "200" ]; then\n'
        '    echo "[vibemon] ✓ Connection successful"\n'
        '  else\n'
        '    echo "[vibemon] ✗ Connection failed (HTTP $HTTP_CODE)" >&2\n'
        '    exit 1\n'
        '  fi'
    )
    if old_test_block in text:
        text = text.replace(old_test_block, sink_block, 1)
    elif anchor in text:
        text = text.replace(anchor, sink_block.split('if [ "$EVENT_TYPE" = "test" ]; then')[0] + anchor, 1)

post_fn = "  _vibemon_post() {\n"
if post_fn in text and 'if [ "$API_KEY" = "vbm_local_arch_system" ]; then return 0; fi' not in text:
    text = text.replace(
        post_fn,
        post_fn + '    if [ "$API_KEY" = "vbm_local_arch_system" ]; then return 0; fi\n',
        1,
    )

notify_path.write_text(text, encoding="utf-8")
PYPATCH
  chmod 0755 "$NOTIFY_SH"
}

cmd_update() {
  mkdir -p "$VIBEMON_DIR" "$LOCAL_SINK_DIR"
  local effective_key="${VIBEMON_API_KEY:-}"
  if [ -z "$effective_key" ] && [ -f "$VIBEMON_DIR/api-key" ]; then
    effective_key="$(cat "$VIBEMON_DIR/api-key")"
  fi
  if [ -z "$effective_key" ]; then
    effective_key="$DEFAULT_LOCAL_KEY"
  fi
  printf '%s' "$effective_key" > "$VIBEMON_DIR/api-key"
  chmod 0600 "$VIBEMON_DIR/api-key"

  if [ "$effective_key" != "$DEFAULT_LOCAL_KEY" ]; then
    curl -fsSL "$INSTALL_URL" | bash -s -- "$effective_key"
  else
    local tmp_script
    tmp_script="$(mktemp /tmp/vibemon-install.XXXXXX.sh)"
    trap 'rm -f "$tmp_script"' RETURN
    curl -fsSL "$INSTALL_URL" -o "$tmp_script"
    python3 - "$tmp_script" << 'PYGUARD'
import pathlib
import sys

p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
target = 'bash "$VIBEMON_DIR/notify.sh" test claude_code </dev/null'
replacement = (
    'if [ "$API_KEY" != "vbm_local_arch_system" ]; then\n'
    '  bash "$VIBEMON_DIR/notify.sh" test claude_code </dev/null\n'
    'else\n'
    '  echo "  ✓ Local mode active (set VIBEMON_API_KEY to enable remote sync)"\n'
    'fi'
)
if target in s:
    s = s.replace(target, replacement, 1)
p.write_text(s, encoding="utf-8")
PYGUARD
    bash "$tmp_script"
  fi

  patch_notify_script
  bash "$NOTIFY_SH" test claude_code </dev/null
  (cd "$ARCH_ROOT" && bash "$NOTIFY_SH" session_start antigravity </dev/null >/dev/null 2>&1 || true)
  echo "  ✓ Local sink ready ($LOCAL_EVENTS_FILE)"
}

cmd_track() {
  local event="${1:-activity}"
  local agent="${2:-antigravity}"
  if [ ! -x "$NOTIFY_SH" ]; then
    cmd_update >/dev/null
  fi
  mkdir -p "$LOCAL_SINK_DIR"
  cd "$ARCH_ROOT"
  if [ -t 0 ]; then
    printf '{}' | bash "$NOTIFY_SH" "$event" "$agent"
  else
    bash "$NOTIFY_SH" "$event" "$agent"
  fi
}

cmd_status() {
  local ver="missing"
  if [ -f "$VIBEMON_DIR/version" ]; then
    ver="v$(cat "$VIBEMON_DIR/version")"
  fi
  local key_mode="unset"
  if [ -f "$VIBEMON_DIR/api-key" ]; then
    local k
    k="$(cat "$VIBEMON_DIR/api-key")"
    if [ "$k" = "$DEFAULT_LOCAL_KEY" ]; then
      key_mode="local-only ($DEFAULT_LOCAL_KEY)"
    else
      key_mode="remote (${k:0:8}...)"
    fi
  fi

  echo "VibeMon Status:"
  echo "  Version:       $ver ($VIBEMON_DIR)"
  echo "  API Key Mode:  $key_mode"
  echo "  notify.sh:     $([ -x "$NOTIFY_SH" ] && echo "executable" || echo "missing")"

  python3 - "$HOME/.claude/settings.json" "$HOME/.gemini/settings.json" "$HOME/.cursor/hooks.json" << 'PYCHK'
import json
import pathlib
import sys

for raw in sys.argv[1:]:
    p = pathlib.Path(raw)
    if not p.exists():
        print(f"  {p.name}: missing")
        continue
    try:
        txt = p.read_text(encoding="utf-8")
        has_hook = "vibemon" in txt
        print(f"  {p}: {'wired' if has_hook else 'NOT wired'}")
    except Exception as exc:
        print(f"  {p}: error ({exc})")
PYCHK

  if [ -f "$LOCAL_EVENTS_FILE" ]; then
    local total
    total="$(wc -l < "$LOCAL_EVENTS_FILE" | tr -d ' ')"
    local last_line
    last_line="$(tail -n 1 "$LOCAL_EVENTS_FILE" 2>/dev/null || true)"
    echo "  Local Ledger:  $LOCAL_EVENTS_FILE ($total event(s))"
    if [ -n "$last_line" ]; then
      echo "  Latest Event:  $last_line"
    fi
  else
    echo "  Local Ledger:  $LOCAL_EVENTS_FILE (0 events)"
  fi
}

case "${1:-status}" in
  update)
    shift || true
    cmd_update "$@"
    ;;
  track)
    shift || true
    cmd_track "$@"
    ;;
  status)
    shift || true
    cmd_status "$@"
    ;;
  *)
    echo "Usage: $(basename "$0") <update|track <event> [agent]|status>" >&2
    exit 1
    ;;
esac
