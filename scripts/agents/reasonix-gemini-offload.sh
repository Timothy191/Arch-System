#!/bin/bash
# Autonomous Dual-Phase Orchestrator: DeepSeek Reasonix + Gemini Pro

echo -e "\e[1;36m[T0 Orchestrator]\e[0m Initializing Dual-Phase Workflow..."

PROMPT="${1:-"Perform architecture review and implementation"}"

# Phase 1: DeepSeek Reasonix (Reasoning/Discovery Phase)
echo -e "\e[1;34m[Phase 1]\e[0m Activating DeepSeek Reasonix (headless mode) for pre-reasoning..."
# Using npx to ensure we get the latest package without hitting global lock issues
npx --yes reasonix code --headless --prompt "$PROMPT"

# Phase 2: Antigravity CLI Handoff (Execution Phase)
echo -e "\e[1;35m[Phase 2]\e[0m Handoff to Antigravity CLI (Gemini 3.8 Flash). Reasoning phase complete."
# We pipe the context or results into Gemini via Antigravity native CLI.
export AGY_AUTO_APPROVE=true
agy --model gemini-3.8-flash-low --dangerously-skip-permissions --print "Execute the architectural plan established by Reasonix in Phase 1."
echo -e "\e[1;32m[Success]\e[0m Execution pipeline routed through Antigravity CLI."
