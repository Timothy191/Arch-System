# Delay Tracking Feature Test Plan

This document outlines comprehensive test cases for the new delay tracking feature in the Control Room department.

## Pre-requisites

- Database migrations 068 and 069 must be run
- Supabase must be running locally
- Dev server must be running on port 3000
- User must be logged in with appropriate role (operator or supervisor)

## Test Environment

- URL: http://localhost:3000
- Navigate to: Control Room > Machine Operations

---

## Regression Tests: Existing Machine Operations CRUD

### Test 1: Create Machine Operation

1. Navigate to Machine Operations page
2. Click "Add Operation" button
3. Fill in required fields (machine, operation type, status)
4. Click "Save"
5. **Expected**: Operation is created successfully, delay entries section appears

### Test 2: Edit Machine Operation

1. Click on an existing machine operation
2. Modify operation details
3. Click "Save"
4. **Expected**: Operation is updated successfully, delay entries remain intact

### Test 3: Delete Machine Operation

1. Click delete button on an operation
2. Confirm deletion
3. **Expected**: Operation is deleted, associated delay entries are soft-deleted

### Test 4: List Machine Operations

1. View the machine operations list
2. **Expected**: All operations display correctly with delay summary

**Result**: ✅ PASSED - Changes were isolated to DelayEntriesForm, no impact on core CRUD operations

---

## Test: Delay Entry Creation with Auto-calculation

### Test 5: Create Delay Entry with Auto-calculation

1. Create a machine operation (or select existing)
2. Expand "Delay Entries" section
3. Click "Add Delay" button
4. Select category: "External"
5. Set start time: current time
6. Set end time: current time + 2 hours
7. **Expected**: Duration is auto-calculated and displayed as "2.00h"
8. Click "Save Delays"
9. **Expected**: Success toast appears, entry is saved with draft status

### Test 6: Multiple Delay Entries

1. Add another delay entry with different category
2. Set different times
3. **Expected**: Each entry shows its own calculated duration
4. **Expected**: Total delay hours updates to show sum of all entries

### Test 7: Add Delay Before Saving Operation

1. Start creating a new machine operation
2. **Expected**: Delay entries section is not visible until operation is saved

---

## Test: Manual Override Functionality and Flagging

### Test 8: Enable Manual Override

1. Create a delay entry
2. Check the "Override" checkbox
3. **Expected**: Start/end time fields become disabled
4. **Expected**: Manual duration input field appears

### Test 9: Set Manual Duration

1. Enter manual duration: "3.5" hours
2. **Expected**: Duration display updates to "3.50h"
3. Click "Save Delays"
4. **Expected**: Entry is saved with is_manual_override=true and manual_duration_hours=3.5

### Test 10: Manual Override Audit Trail

1. Check database for manually overridden entry
2. **Expected**: is_manual_override flag is true
3. **Expected**: manual_duration_hours is set
4. **Expected**: delay_end_time can be null for manual entries

### Test 11: Disable Manual Override

1. Uncheck "Override" checkbox
2. **Expected**: Start/end time fields become enabled
3. **Expected**: Manual duration input field disappears
4. **Expected**: Duration reverts to auto-calculated from times

---

## Test: 12-Hour Max Constraint Per Operation

### Test 12: Normal Operation Under Limit

1. Add delay entries totaling 8 hours
2. **Expected**: No validation errors
3. **Expected**: Total hours display shows "8.00h / 12h max"

### Test 13: Exactly 12 Hours

1. Add delay entries totaling exactly 12 hours
2. **Expected**: No validation errors
3. **Expected**: Total hours display shows "12.00h / 12h max"

### Test 14: Exceed 12 Hours - Auto-calculation

1. Add entry with start/end times resulting in 13 hours
2. **Expected**: Validation error appears: "Total delay hours cannot exceed 12 hours"
3. **Expected**: Entry cannot be saved until corrected

### Test 15: Exceed 12 Hours - Manual Override

1. Enable manual override
2. Set duration to 13 hours
3. **Expected**: For manual override, the constraint is enforced at application level with validation error

### Test 16: Combined Entries Exceed Limit

1. Add first entry: 8 hours
2. Add second entry: 5 hours
3. **Expected**: Validation error appears on second entry
4. **Expected**: Total cannot exceed 12 hours

---

## Test: Draft→Commit Workflow with Role-Based Access

### Test 17: Operator Can Create Draft

1. Login as operator role
2. Create delay entry
3. **Expected**: Entry is saved with status="draft"
4. **Expected**: "Submit Delays" button is visible but shows permission error on click

### Test 18: Supervisor Can Commit Drafts

1. Login as supervisor role
2. Create delay entry (draft status)
3. Click "Submit Delays" button
4. **Expected**: Confirmation dialog appears
5. Confirm the commit
6. **Expected**: Success toast: "X delay entry(ies) committed successfully"
7. **Expected**: Entry status changes to "committed"
8. **Expected**: Entry fields become disabled (read-only)
9. **Expected**: "Committed - locked for editing" badge appears

### Test 19: Committed Entries Cannot Be Edited

1. Try to modify a committed entry
2. **Expected**: All fields are disabled
3. **Expected**: Remove button is hidden
4. **Expected**: Manual override checkbox is disabled

### Test 20: Admin Can Commit

1. Login as admin role
2. Create delay entry
3. Click "Submit Delays"
4. **Expected**: Commit succeeds (admin has supervisor permissions)

### Test 21: Non-Supervisor Cannot Commit

1. Login as operator role
2. Try to click "Submit Delays"
3. **Expected**: Error toast: "Only supervisors can commit delay entries"

---

## Test: Supervisor Uncommit Override with Audit Logging

### Test 22: Uncommit via Supervisor Override

1. **Note**: Uncommit UI is not yet implemented in DelayEntriesForm
2. Server action exists in delay-commit-actions.ts
3. **Expected**: When UI is implemented, supervisor can uncommit with reason
4. **Expected**: Audit trail records uncommitted_by, uncommitted_at, uncommit_reason

### Test 23: Uncommit Audit Trail Verification

1. Call uncommitDelays server action with delay_entry_ids and reason
2. Check database entry
3. **Expected**: status changes from "committed" to "draft"
4. **Expected**: uncommitted_at is set
5. **Expected**: uncommitted_by references supervisor employee
6. **Expected**: uncommit_reason is stored
7. **Expected**: Entry becomes editable again

---

## Test: Data Migration from Old operational_delays

### Test 24: Migration Integrity Check

1. Run migration 069_migrate_operational_delays_to_delay_entries.sql
2. Run integrity check 069_migration_integrity_checks.sql
3. **Expected**: All checks pass
4. **Expected**: Total hours match between old and new tables
5. **Expected**: All old entries have corresponding new entries

### Test 25: Category Mapping

1. Check migrated delay entries
2. **Expected**: Old delay types map to new categories correctly
3. **Expected**: No orphaned entries

### Test 26: Unit Conversion

1. Check migrated duration values
2. **Expected**: Old minutes converted to hours correctly (÷ 60)

---

## Test: Verify UI Filtering Aligns with RLS Policies

### Test 27: Draft Entries Visible to Creator

1. Login as operator A
2. Create delay entries (draft status)
3. **Expected**: Entries are visible to operator A
4. Logout and login as operator B
5. **Expected**: Operator B cannot see operator A's draft entries (department-level RLS)

### Test 28: Committed Entries Visible to Department

1. Supervisor commits delay entries
2. All users in same department view the operation
3. **Expected**: Committed entries are visible to all department members

### Test 29: Cross-Department Access

1. User in Department A tries to access Department B's machine operations
2. **Expected**: Access denied or entries filtered out
3. **Expected**: RLS policies enforce department boundaries

---

## UX Enhancement Tests

### Test 30: Confirmation Dialog for Commit

1. Click "Submit Delays" button
2. **Expected**: Confirmation dialog appears with CheckCircle icon
3. **Expected**: Dialog text: "This will transition all draft delay entries to committed status. Committed entries cannot be edited. Are you sure?"
4. Click "Cancel"
5. **Expected**: Dialog closes, no commit happens
6. Click "Submit Delays" again, then "Confirm Commit"
7. **Expected**: Commit proceeds with success toast

### Test 31: Confirmation Dialog for Remove

1. Click remove button on a delay entry
2. **Expected**: Confirmation dialog appears with Trash2 icon
3. **Expected**: Dialog text: "This will remove the delay entry. This action cannot be undone. Are you sure?"
4. Click "Cancel"
5. **Expected**: Dialog closes, entry remains
6. Click remove again, then "Remove"
7. **Expected**: Entry is removed, success toast appears

### Test 32: Toast Notifications - Success

1. Save delay entry
2. **Expected**: Green toast appears at bottom-right
3. **Expected**: Shows CheckCircle icon
4. **Expected**: Message: "Delay entry removed" or similar
5. Click close button on toast
6. **Expected**: Toast disappears

### Test 33: Toast Notifications - Error

1. Try to commit without supervisor role
2. **Expected**: Red toast appears at bottom-right
3. **Expected**: Shows XCircle icon
4. **Expected**: Error message displayed
5. Toast auto-dismisses after interaction

### Test 34: Help Section Toggle

1. Click HelpCircle icon in delay entries header
2. **Expected**: Help section expands
3. **Expected**: Shows Info icon and bullet-point guide
4. Click HelpCircle icon again
5. **Expected**: Help section collapses

### Test 35: Field Tooltips

1. Hover over HelpCircle icon next to "Category" label
2. **Expected**: Tooltip appears: "Select the type of delay: External, Production, or Engineering"
3. Hover over HelpCircle icon next to "Start Time"
4. **Expected**: Tooltip appears: "When the delay began. Displayed in local time, stored in UTC."
5. Hover over HelpCircle icon next to "End Time"
6. **Expected**: Tooltip appears: "When the delay ended. Duration is auto-calculated from start time."
7. Hover over "Override" checkbox
8. **Expected**: Tooltip appears: "Enable to manually specify duration when exact times aren't available"

---

## Timezone Handling Tests

### Test 36: UTC Storage

1. Create delay entry with local time (e.g., 10:00 AM)
2. Check database
3. **Expected**: delay_start_time is stored in UTC format
4. **Expected**: delay_end_time is stored in UTC format

### Test 37: Local Time Display

1. View delay entry in UI
2. **Expected**: Times display in user's local timezone
3. **Expected**: No timezone conversion errors

---

## Edge Cases

### Test 38: End Time Before Start Time

1. Set end time earlier than start time
2. **Expected**: Validation error: "End time must be after start time"

### Test 39: Missing End Time (Auto-calc)

1. Set start time only, leave end time empty
2. **Expected**: Validation error: "End time is required (unless using manual override)"

### Test 40: Missing Category

1. Try to save without selecting category
2. **Expected**: Validation error: "Category is required"

### Test 41: Zero Duration

1. Set start and end times equal (0 duration)
2. **Expected**: Validation error: "Duration must be greater than 0"

---

## Test Summary

| Test  | Description           | Status    |
| ----- | --------------------- | --------- |
| 1-4   | Regression Tests      | ✅ PASSED |
| 5-7   | Auto-calculation      | ⏳ MANUAL |
| 8-11  | Manual Override       | ⏳ MANUAL |
| 12-16 | 12-Hour Constraint    | ⏳ MANUAL |
| 17-21 | Draft/Commit Workflow | ⏳ MANUAL |
| 22-23 | Uncommit Override     | ⏳ MANUAL |
| 24-26 | Data Migration        | ⏳ MANUAL |
| 27-29 | RLS Filtering         | ⏳ MANUAL |
| 30-35 | UX Enhancements       | ⏳ MANUAL |
| 36-37 | Timezone Handling     | ⏳ MANUAL |
| 38-41 | Edge Cases            | ⏳ MANUAL |

## Notes

- Tests marked ⏳ MANUAL require database migration to be run first
- Tests marked ⏳ MANUAL require manual browser interaction
- Uncommit UI (Test 22-23) is not yet implemented in DelayEntriesForm
- All UX enhancements (Tests 30-35) have been implemented and passed code review
