#!/usr/bin/env node

// AGENT-TRACE: Post-Edit Tracing Check Reminder
// Created: 2026-06-05 by Devin (Claude Code) to enforce MANDATORY tracing rule
// This script runs after Edit/Write operations to gently remind agents
// to update AGENT_TRACER.md if they've made significant changes.
// Purpose: Provide gentle reminder after edits to ensure AGENT_TRACER.md is updated

const fs = require('fs');
const path = require('path');

// Get the edited file path from stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(inputData);
    const filePath = data.tool_response?.filePath || data.tool_input?.file_path || data.tool_input?.TargetFile || data.tool_input?.target_file;
    
    if (!filePath) return;
    
    // Determine if this is a significant edit that warrants tracing
    const packageMatch = filePath.match(/(packages\/[^\/]+|apps\/[^\/]+)/);
    if (!packageMatch) return;
    
    const packagePath = packageMatch[1];
    const tracerPath = path.join(process.cwd(), packagePath, 'AGENT_TRACER.md');
    
    // Only remind if AGENT_TRACER.md exists in the package
    if (fs.existsSync(tracerPath)) {
      console.log(`\n💡 Remember to update ${packagePath}/AGENT_TRACER.md with your changes`);
      console.log('   Add context breadcrumbs with // AGENT-TRACE: for complex logic\n');
    }
  } catch (error) {
    // Silent fail - don't break the edit workflow
  }
});
