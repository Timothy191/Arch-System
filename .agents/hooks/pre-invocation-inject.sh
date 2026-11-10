#!/bin/bash
export PATH="/home/tim/.local/share/mise/installs/node/24.15.0/bin:/home/tim/.local/share/mise/installs/node/26.8.1/bin:$PATH"

if [ -f tools/scripts/compact-context.cjs ]; then
  node tools/scripts/compact-context.cjs --hook --quiet 2>/dev/null || true
fi

if [ -f .handoff/handoff.json ]; then
  node -e "
    const h = JSON.parse(require('fs').readFileSync('.handoff/handoff.json', 'utf8'));
    if (h && h.skillState && h.skillState.state) {
      console.log('### Active Compaction SKILL.state Spine (.handoff/handoff.json)');
      console.log(JSON.stringify(h.skillState.state));
    }
  " 2>/dev/null || true
fi

if [ -f .agents/context/architecture.md ]; then
  cat .agents/context/architecture.md
fi

if [ -f .agents/memory_base/index.json ]; then
  echo -e "\n### Autonomous Memory Guardrails (.agents/memory_base/)"
  node -e "
    const idx = JSON.parse(require('fs').readFileSync('.agents/memory_base/index.json', 'utf8'));
    idx.entries.slice(0, 5).forEach(e => console.log('- [' + e.category + '] ' + e.preventionRule));
  " 2>/dev/null || true
fi

exit 0
