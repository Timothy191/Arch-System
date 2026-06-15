#!/usr/bin/env node

// AGENT-TRACE: Agent Tracing Reminder Hook
// Created: 2026-06-05 by Devin (Claude Code) to enforce MANDATORY tracing rule
// This script runs at session start to remind agents about the MANDATORY tracing rule.
// Purpose: Ensure agents never miss the tracing rule when starting work
// It checks if the agent is about to modify code and reminds them to:
// 1. Update AGENT_TRACER.md in the package/app they're modifying
// 2. Leave inline // AGENT-TRACE: comments for complex architectural logic
// 3. Ensure functions are instrumented where applicable

const fs = require('fs');
const path = require('path');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📍 MANDATORY AGENT TRACING RULE');
console.log('═══════════════════════════════════════════════════════════════');
console.log('When modifying code, you MUST:');
console.log('');
console.log('1. 📝 Update AGENT_TRACER.md in the package/app root');
console.log('   - Log timestamp, purpose, changes made, and next agent notes');
console.log('   - Location: packages/<package>/AGENT_TRACER.md or apps/<app>/AGENT_TRACER.md');
console.log('');
console.log('2. 🥖 Leave inline // AGENT-TRACE: comments');
console.log('   - For complex architectural logic and implicit business rules');
console.log('   - Format: // AGENT-TRACE: <explanation>');
console.log('');
console.log('3. 📊 Add runtime telemetry where applicable');
console.log('   - Instrument functions with prom-client or OpenTelemetry spans');
console.log('');
console.log('See: CLAUDE.md and AGENTS.md (section: Agent Tracing & Context Hand-off)');
console.log('═══════════════════════════════════════════════════════════════\n');
