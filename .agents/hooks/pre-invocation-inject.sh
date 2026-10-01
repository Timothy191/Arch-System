#!/bin/bash
if [ -z "$GEMINI_API_KEY" ]; then
  echo "ERROR: GEMINI_API_KEY is missing."
  exit 1
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
