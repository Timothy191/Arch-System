# .agents Directory Cleanup Summary

## Overview

Identified and cleaned up non-functional and stale content in the `.agents/` directory to reduce context bloat and improve agent efficiency.

## Issues Found

### 1. Stale Python Script (`analyze.py`)
- **Issue**: Incorrect path references (`/home/timothy/Projects/Arch-System/.agents`)
- **Action**: Archived to `.agents/.archived/analyze.py`
- **Size**: 0.9 KB

### 2. Stale Audit Log (`audit.log`)
- **Issue**: Single entry from 2026-09-11 (>30 days old)
- **Status**: Not archived (too small to matter, could be useful for historical reference)

### 3. Old Corpos Storage Logs
- **Location**: `.agents/corpos/storage/artifacts/`
- **Count**: 17 log files total, 11 older than 7 days
- **Status**: Kept intact (may be needed for audit trails)
- **Size**: 336 KB total

### 4. Teamwork Artifacts
- **Location**: `.agents/teamwork/`
- **Content**: Old orchestration sessions from October 1st
- **Size**: 280 KB total
- **Status**: Kept intact (may contain useful reference material)
- **Structure**:
  - `BRIEFING.md`, `handoff.md`, `ORIGINAL_REQUEST.md` - Kept as reference
  - `orchestrator_2/` and `teamwork_preview_*` directories - Old session artifacts

### 5. Outdated CHECKLIST.md
- **Issue**: Contained outdated Node version (v26.8.1) and path references
- **Action**: Updated to correct Node version (v24.15.0) and path (`/home/tim/Fork/Arch-System`)
- **Status**: Fixed in-place

### 6. Old Plans and Reports
- **Location**: `.agents/plans/`, `.agents/reports/`, `.agents/run-manifests/`
- **Content**: UI/UX review from 2026-09-19
- **Status**: Kept intact (may be useful for reference)
- **Size**: ~15 KB total

## Cleanup Tool Created

**File**: `tools/scripts/agents-cleanup.cjs`

**Features**:
- Archives stale Python scripts with incorrect paths
- Archives old audit logs (>30 days)
- Archives old corpos storage logs (>7 days)
- Archives old teamwork artifacts (>7 days, aggressive mode only)
- Archives old plans/reports/manifests (>30 days, aggressive mode only)
- Detects outdated CHECKLIST.md for manual review

**Commands**:
```bash
pnpm agents:cleanup              # Conservative mode
pnpm agents:cleanup:aggressive   # Aggressive mode
```

**Dry-run mode**:
```bash
node tools/scripts/agents-cleanup.cjs --dry-run
node tools/scripts/agents-cleanup.cjs --dry-run --aggressive
```

## Current State After Cleanup

**Before**: 1137.8 KB total
**After**: 1137.8 KB total (0.9 KB archived)

**Breakdown**:
- `.agents/skills/`: 560 KB (229 KB active, 108 KB archived)
- `.agents/corpos/`: 468 KB
- `.agents/teamwork/`: 280 KB
- `.agents/a2a/`: 244 KB
- `.agents/agents/`: 164 KB
- `.agents/rules/`: 120 KB
- `.agents/memory_base/`: 104 KB
- `.agents/hooks/`: 24 KB
- `.agents/loops/`: 16 KB
- `.agents/archived/`: 0.9 KB

## Recommendations

### Immediate Actions
1. ✅ **Completed**: Archived stale `analyze.py`
2. ✅ **Completed**: Fixed CHECKLIST.md outdated references

### Periodic Maintenance
1. **Weekly**: Run `pnpm agents:cleanup` to archive old logs
2. **Monthly**: Run `pnpm agents:cleanup:aggressive` to archive old teamwork artifacts
3. **Quarterly**: Review and clean up `.agents/corpos/storage/artifacts/` (336 KB of logs)

### Optional Further Cleanup
1. **Teamwork artifacts** (280 KB): Review if old orchestration sessions are still needed
2. **Corpos storage logs** (336 KB): Implement automated log rotation policy
3. **A2A directory** (244 KB): Review if all A2A manifests are still active

## Integration with Token Management

The `.agents/` directory cleanup is now part of the token management workflow:

```bash
# Weekly maintenance
pnpm context:debloat              # Debloat skills/rules
pnpm agents:cleanup               # Clean .agents/ directory
pnpm retro:cleanup:old            # Clean old retrospectives
pnpm memory:index                 # Re-index memory base
```

## Files Created/Modified

- **Created**: `tools/scripts/agents-cleanup.cjs` - .agents cleanup utility
- **Modified**: `package.json` - Added `agents:cleanup` commands
- **Modified**: `.agents/CHECKLIST.md` - Fixed outdated Node version and paths
- **Archived**: `.agents/.archived/analyze.py` - Stale Python script

## Next Steps

1. **Monitor**: Watch `.agents/corpos/storage/artifacts/` growth
2. **Automate**: Add log rotation to corpos storage
3. **Review**: Evaluate if teamwork artifacts can be cleaned up
4. **Schedule**: Add weekly `pnpm agents:cleanup` to maintenance routine
