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

echo "========================================================"
echo "✅ [AGENT VERIFICATION] 100% PASS. Code is real-world ready."
echo "========================================================"
