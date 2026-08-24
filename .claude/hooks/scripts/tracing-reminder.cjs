#!/usr/bin/env node

// AGENT-TRACE: Agent Tracing Reminder Hook
// Created: 2026-06-05 by Devin (Claude Code) to enforce MANDATORY tracing rule
// This script runs at session start to remind agents about the MANDATORY tracing rule.
// Purpose: Ensure agents never miss the tracing rule when starting work
// It checks if the agent is about to modify code and reminds them to:
// 1. Update AGENT_TRACER.md in the package/app they're modifying
// 2. Leave inline // AGENT-TRACE: comments for complex architectural logic
// 3. Ensure functions are instrumented where applicable

const fs = require("fs");
const path = require("path");

// AGENT-TRACE: Agent Tracing Reminder Hook (Compact)
console.log(
  "[Tracing] MANDATORY: (1) Update <pkg>/AGENT_TRACER.md, (2) Inline // AGENT-TRACE: comments, (3) Telemetry (CLAUDE.md)."
);

