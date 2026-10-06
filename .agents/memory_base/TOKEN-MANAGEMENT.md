# Token Management & Context Budget System

## Overview

This system provides automated token usage tracking, context debloating, and budget enforcement to prevent context explosion during autonomous agent operations.

## Components

### 1. Token Tracker (`tools/scripts/token-tracker.cjs`)

Monitors token usage and enforces context budget limits.

**Commands:**
```bash
pnpm token:analyze           # Analyze current context usage
pnpm token:prune             # Prune oversized and old retrospectives
pnpm token:budget-check      # Check if within budget limits (exit code 0/1)
```

**Budget Configuration:**
Located in `.agents/memory_base/context-budget.json` (auto-generated with defaults):

```json
{
  "maxRetrospectives": 50,
  "maxRetrospectiveSize": 5000,
  "maxRulesSize": 100000,
  "maxSkillsSize": 350000,
  "maxSessionContext": 500000
}
```

**Set custom budget:**
```bash
pnpm token-tracker.cjs set-budget <key> <value>
# Example: node tools/scripts/token-tracker.cjs set-budget maxSkillsSize 400000
```

### 2. Context Debloating (`tools/scripts/context-debloat.cjs`)

Prunes unnecessary skills, rules, and retrospectives to reduce context size.

**Commands:**
```bash
pnpm context:debloat                # Conservative mode (minimal pruning)
pnpm context:debloat:aggressive     # Aggressive mode (more pruning)
```

**Strategies:**
- Archives external skills (firecrawl, azure, upstash, etc.) - loaded on-demand
- Prunes oversized rules (>10KB)
- Removes stale session logs (>7 days old)
- Re-indexes memory base after cleanup

### 3. Retrospective Cleanup (`tools/scripts/retrospective-cleanup.cjs`)

Manages error retrospectives in the memory base.

**Commands:**
```bash
pnpm retro:cleanup                    # Analyze retrospectives
pnpm retro:cleanup:old               # Remove retrospectives older than 30 days
```

**Advanced usage:**
```bash
node tools/scripts/retrospective-cleanup.cjs --older-than 60     # Remove >60 days
node tools/scripts/retrospective-cleanup.cjs --category SECURITY # Remove by category
node tools/scripts/retrospective-cleanup.cjs --remove-duplicates # Remove duplicates
```

### 4. Agent Hooks

**Pre-Task Hook (`.agents/hooks/pre-task-budget-check.cjs`)**
- Runs before autonomous agent tasks
- Checks context budget compliance
- Blocks execution if budget exceeded
- Exit code 0 = pass, 1 = fail

**Post-Task Hook (`.agents/hooks/post-task-token-track.cjs`)**
- Runs after autonomous agent tasks
- Records token usage estimates
- Tracks session metadata
- Maintains lifetime token totals

**Usage:**
```bash
pnpm agent:hook:pre-task    # Run pre-task check manually
pnpm agent:hook:post-task  # Run post-task tracking manually
```

### 5. Agent Verification Integration

The `pnpm agent:verify` gate now includes context budget enforcement:

```bash
pnpm agent:verify
```

Gate 7 checks context budget and fails if exceeded, directing agents to run `pnpm context:debloat`.

## Current State

**After initial debloating:**
- Skills: 55 skills, 229.0 KB (within 341.8 KB budget)
- Rules: 25 rules, 66.0 KB (within 97.7 KB budget)
- Retrospectives: 14 entries, 21.1 KB (within 50 count budget)

**Archived:**
- 12 firecrawl-related skills (108 KB) - external, load on-demand
- 1 oversized rule (structured-thinking-mandate.md)

## Best Practices

1. **Before long-running agent tasks:**
   ```bash
   pnpm token:budget-check
   pnpm context:debloat  # If budget exceeded
   ```

2. **After agent sessions:**
   ```bash
   pnpm retro:cleanup:old  # Clean up old retrospectives
   pnpm memory:index       # Re-index memory base
   ```

3. **Weekly maintenance:**
   ```bash
   pnpm context:debloat:aggressive  # More aggressive cleanup
   pnpm token:analyze               # Review usage trends
   ```

4. **Monitor token usage:**
   ```bash
   cat .agents/memory_base/token-usage.json
   ```

## Integration with Agent Workflows

Add to your agent orchestration scripts:

```bash
# Pre-task
pnpm agent:hook:pre-task || exit 1

# Run agent task
# ... agent execution ...

# Post-task
TASK_TAG="feature-xyz" TASK_DURATION="45s" pnpm agent:hook:post-task
```

## Troubleshooting

**Budget exceeded error:**
```bash
pnpm context:debloat
pnpm token:budget-check  # Verify fix
```

**Context still too large:**
```bash
pnpm context:debloat:aggressive
node tools/scripts/token-tracker.cjs set-budget maxSkillsSize 500000
```

**Memory base errors:**
```bash
pnpm memory:index  # Re-index
pnpm retro:cleanup --remove-duplicates  # Remove duplicates
```

## Files Created

- `tools/scripts/token-tracker.cjs` - Token usage tracker
- `tools/scripts/context-debloat.cjs` - Context debloating utility
- `tools/scripts/retrospective-cleanup.cjs` - Retrospective cleanup
- `.agents/hooks/pre-task-budget-check.cjs` - Pre-task hook
- `.agents/hooks/post-task-token-track.cjs` - Post-task hook
- `.agents/memory_base/context-budget.json` - Budget configuration (auto-generated)
- `.agents/memory_base/token-usage.json` - Token usage tracking (auto-generated)
