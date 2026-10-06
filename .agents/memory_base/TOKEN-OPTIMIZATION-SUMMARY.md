# Token Optimization & Context Debloating Summary

## What Was Done

I've implemented a comprehensive token usage tracking and context debloating system to prevent context explosion during autonomous agent operations.

## Created Components

### 1. Token Tracker (`tools/scripts/token-tracker.cjs`)
- Monitors token usage across agent sessions
- Enforces context budget limits
- Tracks retrospectives, rules, and skills size
- Configurable budget thresholds

**Commands:**
```bash
pnpm token:analyze           # Analyze current context usage
pnpm token:prune             # Prune oversized/old retrospectives
pnpm token:budget-check      # Check budget compliance (exit code 0/1)
```

### 2. Context Debloating (`tools/scripts/context-debloat.cjs`)
- Archives external skills (firecrawl, azure, upstash, etc.)
- Prunes oversized rules (>10KB)
- Removes stale session logs (>7 days)
- Conservative and aggressive modes

**Commands:**
```bash
pnpm context:debloat                # Conservative mode
pnpm context:debloat:aggressive     # Aggressive mode
```

### 3. Retrospective Cleanup (`tools/scripts/retrospective-cleanup.cjs`)
- Removes old retrospectives by age
- Removes by category
- Removes duplicates
- Analyzes retrospective distribution

**Commands:**
```bash
pnpm retro:cleanup                    # Analyze retrospectives
pnpm retro:cleanup:old               # Remove >30 days old
```

### 4. Agent Hooks
- **Pre-task hook**: Checks context budget before agent execution
- **Post-task hook**: Tracks token usage after agent completion

**Commands:**
```bash
pnpm agent:hook:pre-task    # Run pre-task check
pnpm agent:hook:post-task  # Run post-task tracking
```

### 5. Agent Workflow Wrapper (`tools/scripts/agent-workflow-wrapper.cjs`)
- Orchestrates pre-task quality gates
- Runs type-check, lint, policy check, budget check
- Logs workflow execution
- Blocks execution if quality gates fail

**Command:**
```bash
pnpm agent:workflow --task "description" --agent devin
```

### 6. Agent Verification Integration
- Added context budget check as Gate 7 in `pnpm agent:verify`
- Fails if budget exceeded, directs to `pnpm context:debloat`

## Results After Initial Debloating

**Before:**
- Skills: 66 skills, 308.7 KB (exceeded 195.3 KB budget)
- Rules: 25 rules, 66.0 KB
- Retrospectives: 14 entries, 21.1 KB

**After:**
- Skills: 55 skills, 229.0 KB (within 341.8 KB budget) ✅
- Rules: 25 rules, 66.0 KB (within 97.7 KB budget) ✅
- Retrospectives: 14 entries, 21.1 KB (within 50 count budget) ✅

**Archived:**
- 12 firecrawl-related skills (108 KB) - external, load on-demand
- 1 oversized rule (structured-thinking-mandate.md)

## Budget Configuration

Located in `.agents/memory_base/context-budget.json`:
```json
{
  "maxRetrospectives": 50,
  "maxRetrospectiveSize": 5000,
  "maxRulesSize": 100000,
  "maxSkillsSize": 350000,
  "maxSessionContext": 500000
}
```

**Adjust budget:**
```bash
node tools/scripts/token-tracker.cjs set-budget maxSkillsSize 400000
```

## Integration with Agent Workflows

### Before Long-Running Tasks
```bash
pnpm token:budget-check          # Check budget
pnpm context:debloat            # Debloat if needed
pnpm agent:workflow --task "..." --agent devin  # Run with checks
```

### After Agent Sessions
```bash
TASK_TAG="feature-xyz" TASK_DURATION="45s" pnpm agent:hook:post-task
pnpm retro:cleanup:old          # Clean old retrospectives
pnpm memory:index               # Re-index memory base
```

### Weekly Maintenance
```bash
pnpm context:debloat:aggressive  # Aggressive cleanup
pnpm token:analyze              # Review usage trends
```

## Documentation

Full documentation available in `.agents/memory_base/TOKEN-MANAGEMENT.md`

## Next Steps

1. **Integrate with agent orchestrators**: Add pre/post hooks to your agent execution pipelines
2. **Monitor token usage**: Review `.agents/memory_base/token-usage.json` periodically
3. **Adjust budgets**: Tune budget limits based on actual usage patterns
4. **Automate cleanup**: Add `pnpm retro:cleanup:old` to weekly cron jobs
5. **Track efficiency**: Use workflow logs to identify high-token tasks

## Verification

Run the agent verification gate to ensure all systems are working:
```bash
pnpm agent:verify
```

All 7 gates should pass, including the new context budget check (Gate 7).
