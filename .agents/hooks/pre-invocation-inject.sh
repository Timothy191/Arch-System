#!/bin/bash
if [ -z "$GEMINI_API_KEY" ]; then
  echo "ERROR: GEMINI_API_KEY is missing."
  exit 1
fi
if [ -f .agents/context/architecture.md ]; then
  cat .agents/context/architecture.md
fi
exit 0
