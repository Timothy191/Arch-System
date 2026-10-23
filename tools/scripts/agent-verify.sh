#!/bin/bash
# Autonomous Agent Real-World Verification Gate
# Agents MUST run this and achieve a 0 exit code before prompting the user.

set -e
echo "========================================================"
echo "🔍 [AGENT VERIFICATION] Starting Enhanced Real-World Quality Gates..."
echo "========================================================"

echo -n "⚙️  1. Type Checking... "
if pnpm type-check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix TypeScript errors."; exit 1; fi

echo -n "🧹 2. Linting & Formatting... "
if pnpm lint > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix Biome/ESLint errors."; exit 1; fi

echo -n "🧪 3. Unit Tests... "
if pnpm test > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix failing unit tests."; exit 1; fi

echo -n "🛡️  4. Architectural Boundaries... "
if pnpm policy:check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix cross-domain imports."; exit 1; fi

echo -n "📊 5. Contract Drift Audit... "
if pnpm audit:drift > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Align Zod types with DB."; exit 1; fi

echo -n "🛡️  6. Agent Skill Security (SkillSpector)... "
if bash tools/audits/skill-spector.sh > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Security vulnerability in .agents/skills."; exit 1; fi

echo -n "🤖 7. MCP Server Registration & Toolchain... "
if pnpm mcp:verify > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm mcp:onboard' to register required MCP servers."; exit 1; fi

echo -n "💰 8. Context Budget Enforcement... "
if pnpm token:budget-check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm context:debloat' to prune context bloat."; exit 1; fi

echo -n "📜 9. Agent Rule Drift (workspace ↔ project)... "
if node tools/audits/audit-agent-rules-drift.cjs > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'node tools/audits/audit-agent-rules-drift.cjs' and sync the diverged rule to BOTH .agents/rules/ trees."; exit 1; fi

echo -n "🗺️ 10. Architecture Maps Parity... "
if node tools/repo/generate-codebase-maps.cjs --check > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm maps:sync' or 'pnpm maps:gen' to refresh codebase-maps."; exit 1; fi

echo -n "🔐 11. Security Headers... "
if pnpm audit:hooks > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix security-related hooks and clients."; exit 1; fi

echo -n "📦 12. Dependency License Check... "
if pnpm deps:lint > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Fix dependency license issues."; exit 1; fi

echo -n "🔄 13. Circular Dependencies... "
if pnpm cycles > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm cycles' and break the reported import cycle (dependency inversion or extract shared code)."; exit 1; fi

echo -n "🎨 14. Tailwind Utility Composition... "
if pnpm audit:tailwind > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm audit:tailwind' and combine repeated utility chains into a component, CVA variant, or cn() constant. Never regenerate the baseline to hide a violation."; exit 1; fi

echo -n "✂️  15. Dead Code & Unresolved Imports (Knip)... "
if pnpm knip > /dev/null 2>&1; then echo "✅ PASS"; else echo "❌ FAIL"; echo "AGENT DIRECTIVE: Run 'pnpm knip' and remove dead files/unresolved imports."; exit 1; fi

echo "========================================================"
echo "✅ [AGENT VERIFICATION] 100% PASS. Code is real-world ready."
echo "========================================================"
