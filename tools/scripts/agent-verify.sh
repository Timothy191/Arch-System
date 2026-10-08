#!/bin/bash
# Autonomous Agent Real-World Verification Gate
# Agents MUST run this and achieve a 0 exit code before prompting the user.

set -e
echo "========================================================"
echo "🔍 [AGENT VERIFICATION] Starting Real-World Quality Gates..."
echo "========================================================"

echo -n "⚙️  1. Type Checking... "
if pnpm type-check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix TypeScript errors."; exit 1; fi

echo -n "🧹 2. Linting & Formatting... "
if pnpm lint > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix Biome/ESLint errors."; exit 1; fi

echo -n "🛡️  3. Architectural Boundaries... "
if pnpm policy:check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix cross-domain imports."; exit 1; fi

echo -n "📊 4. Contract Drift Audit... "
if pnpm audit:drift > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Align Zod types with DB."; exit 1; fi

echo -n "🛡️  5. Agent Skill Security (SkillSpector)... "
if bash tools/audits/skill-spector.sh > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Security vulnerability in .agents/skills."; exit 1; fi

echo -n "🤖 6. MCP Server Registration & Toolchain... "
if pnpm mcp:verify > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm mcp:onboard' to register required MCP servers."; exit 1; fi

echo -n "💰 7. Context Budget Enforcement... "
if pnpm token:budget-check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm context:debloat' to prune context bloat."; exit 1; fi

echo -n "📜 8. Agent Rule Drift (workspace ↔ project)... "
if node tools/audits/audit-agent-rules-drift.cjs > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'node tools/audits/audit-agent-rules-drift.cjs' and sync the diverged rule to BOTH .agents/rules/ trees."; exit 1; fi

echo "========================================================"
echo "✅ [AGENT VERIFICATION] 100% PASS. Code is real-world ready."
echo "========================================================"
