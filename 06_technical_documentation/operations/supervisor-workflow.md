# Supervisor Workflow Guide

**Last Updated:** 2026-06-15  
**Audience:** Control Room Supervisors, Department Managers  
**Department:** Control Room

---

## Overview

This guide provides supervisors with the complete workflow for shift management, including shift preparation, monitoring, closeout procedures, and oversight responsibilities.

## Supervisor Responsibilities

### Primary Duties

1. **Shift Preparation**
   - Review previous shift's completeness
   - Address outstanding issues
   - Ensure all machines are operational
   - Verify operator availability

2. **Shift Monitoring**
   - Monitor Control Room Dashboard
   - Respond to alerts
   - Track machine status
   - Review hourly load updates

3. **Shift Closeout**
   - Verify shift data completeness
   - Approve shift closeout with PIN
   - Address any validation errors
   - Document shift summary

4. **Team Oversight**
   - Monitor operator activity
   - Provide guidance on issues
   - Ensure data quality
   - Report operational concerns

## Daily Workflow

### Shift Start (06:00 or 18:00)

1. **Review Previous Shift**
   - Navigate to Control Room → Shift Coverage
   - Check if previous shift is complete
   - Review any issues or alerts
   - Address incomplete data

2. **Check Machine Status**
   - Review SCADA Panel for machine status
   - Verify all machines are online
   - Acknowledge any offline machine alerts
   - Report persistent issues

3. **Brief Operators**
   - Communicate shift objectives
   - Highlight any issues from previous shift
   - Assign specific tasks if needed
   - Answer operator questions

4. **Monitor Initial Activity**
   - Check machine operations are being logged
   - Verify hourly loads are being updated
   - Monitor for operational delays
   - Respond to initial alerts

### During Shift

1. **Continuous Dashboard Monitoring**
   - Check Control Room Dashboard regularly
   - Monitor shift completeness status
   - Review activity feed for updates
   - Watch for new alerts

2. **Respond to Alerts**
   - Review new offline machine alerts
   - Acknowledge alerts when addressed
   - Track alert resolution
   - Escalate if needed

3. **Data Quality Oversight**
   - Verify machine operations are accurate
   - Check hourly loads are being updated hourly
   - Review delay entries for accuracy and completeness
   - Commit draft delay entries when validated
   - Correct errors as needed

4. **Operator Support**
   - Answer operator questions
   - Assist with system issues
   - Provide guidance on data entry
   - Report system problems

### Shift End (17:00 or 05:00)

1. **Verify Completeness**
   - Navigate to Shift Coverage page
   - Check all machines have entries
   - Verify hourly loads are complete
   - Ensure delays are logged

2. **Address Incomplete Data**
   - Contact operators for missing data
   - Add missing entries if authorized
   - Document reasons for missing data
   - Flag for review if needed

3. **Initiate Shift Closeout**
   - Click "Close Shift" button
   - Review validation errors
   - Enter supervisor PIN
   - Confirm closeout

4. **Review Shift Summary**
   - Review hours worked
   - Check loads completed
   - Review delays logged
   - Document shift notes

## Shift Closeout Process

### Pre-Closeout Checklist

Before initiating shift closeout, ensure:

- [ ] All active machines have entries
- [ ] All hourly loads are entered (for dump trucks)
- [ ] All operational delays are logged
- [ ] Machine operations are accurate
- [ ] No validation errors
- [ ] Supervisor PIN is ready

### Closeout Procedure

1. **Initiate Closeout**
   - Navigate to Control Room → Shift Coverage
   - Click "Close Shift" button for current shift
   - System validates completeness

2. **Review Validation Results**
   - If successful: Proceed to PIN verification
   - If errors: Review and fix before proceeding
   - Common errors:
     - Machine missing entries
     - Hours worked > 12h
     - Bin factor outside range
     - Loads per hour unreasonable

3. **Enter PIN**
   - Enter supervisor PIN (4 digits)
   - System verifies PIN
   - PIN must be set in employee profile

4. **Confirm Closeout**
   - Review shift summary
   - Confirm closeout
   - Shift status changes to "closed"
   - Closed shifts cannot be edited

5. **Document Shift**
   - Add shift notes if needed
   - Highlight any issues
   - Note any anomalies
   - Complete shift log

### PIN Verification

**PIN Requirements:**

- 4-digit numeric PIN
- Set by system administrator
- Can be reset if forgotten
- Locks after 3 failed attempts (15 min)

**PIN Security:**

- Never share PIN with others
- Change PIN if compromised
- Report lost PIN immediately
- Use unique PIN per supervisor

## Shift Completeness Monitoring

### Understanding Completeness

A shift is complete when:

- All active machines have required entries
- No machines are missing data
- All validation checks pass
- No unresolved errors

### Completeness Indicators

- **Complete:** Green checkmark - all data present
- **Incomplete:** Red indicator - missing data
- **Exempt:** Gray - machine exempt from reporting

### Completeness Categories

**Machine Operations:**

- Required for all non-exempt machines
- Tracks hours worked and activities
- Validated for reasonable hours (≤12h/shift)

**Hourly Loads:**

- Required for dump trucks
- Tracks material movement
- Validated for reasonable loads per hour (5-50)

**Excavator Activity:**

- Required for excavators
- Tracks excavation operations

**Roll-Over:**

- Required for dozers
- Tracks dozer operations

## Alert Management

### Alert Types

**Offline Machine Alerts:**

- Generated when machine goes offline
- Severity: Critical
- Action: Acknowledge when addressed

**Shift Completeness Alerts:**

- Generated when machines missing >30min into shift
- Severity: Warning
- Action: Ensure operators log data

**Data Integrity Alerts:**

- Generated by automated jobs
- Severity: Variable
- Action: Review and resolve

### Alert Response Procedure

1. **Review Alert**
   - Check alert details
   - Identify affected machine
   - Determine severity

2. **Acknowledge Alert**
   - Click "Acknowledge" when addressed
   - Alert remains visible but acknowledged
   - Track resolution time

3. **Escalate if Needed**
   - Contact SCADA team for machine issues
   - Contact IT for system issues
   - Contact management for operational issues

4. **Document Resolution**
   - Note resolution steps
   - Record resolution time
   - Update shift log if relevant

## Delay Tracking Management

### Overview

Delay tracking has been integrated into machine operations with a draft/committed workflow. Operators can create and edit draft delay entries, while supervisors must commit them to lock the data for official records.

### Delay Entry Workflow

1. **Operator Creates Draft Delays**
   - Operators log delays directly within machine operations
   - Delays are created in "draft" status
   - Draft entries can be edited or deleted
   - Categories: External, Production, Engineering
   - Start/end times with auto-calculation of duration
   - Manual override option for direct hour entry (flagged for audit)

2. **Supervisor Commits Delays**
   - Supervisors review draft delay entries for accuracy
   - Click "Submit Delays" to commit all draft entries
   - Committed entries become read-only
   - Audit trail records who committed and when
   - Total delay hours validated (max 12 hours per operation)

3. **Supervisor Override**
   - Supervisors can uncommit entries if corrections are needed
   - Requires mandatory reason for audit trail
   - Records who uncommitted, when, and why
   - Reverts entries to draft status for editing

### Supervisor Responsibilities for Delays

**Daily Delay Management:**

- Review draft delay entries for completeness and accuracy
- Commit validated delays before shift closeout
- Verify delay categories are correctly assigned
- Check for manual override entries and validate their accuracy
- Ensure total delay hours are reasonable (≤12 hours per operation)

**Delay Quality Checks:**

- Verify delay start/end times are accurate
- Check delay descriptions are complete
- Confirm delay categories match actual causes
- Validate manual override entries have proper justification
- Ensure no duplicate delay entries

**Commit Procedure:**

1. Navigate to Machine Operations page
2. Review operations with draft delays
3. Expand delay entries for each operation
4. Verify accuracy of all delay entries
5. Click "Submit Delays" button
6. System validates and commits entries
7. Review confirmation message

**Uncommit Procedure (if corrections needed):**

1. Navigate to operation with committed delays
2. Click appropriate uncommit action
3. Enter mandatory reason for audit trail
4. Confirm uncommit
5. Entry returns to draft status
6. Make necessary corrections
7. Re-commit after corrections

### Delay Categories

**External Delays:**

- Caused by factors outside operational control
- Examples: Weather, third-party delays, supplier issues
- Typically requires cross-department coordination

**Production Delays:**

- Related to production processes and operations
- Examples: Material shortages, process bottlenecks, coordination issues
- Often addressable within operations team

**Engineering Delays:**

- Caused by equipment breakdowns, maintenance, or engineering issues
- Examples: Machine failure, scheduled maintenance, technical issues
- Typically requires engineering/maintenance intervention

### Delay Validation Rules

**System Enforced:**

- Total delay hours per operation ≤ 12 hours
- End time must be after start time
- Duration must be greater than 0
- Only draft entries can be edited
- Only supervisors can commit/uncommit

**Manual Validation:**

- Delay times align with actual operation times
- Delay categories accurately reflect cause
- Manual override entries have proper justification
- Descriptions provide sufficient context
- No duplicate delay entries for same issue

### Shift Closeout and Delays

**Before Closeout:**

- Ensure all draft delay entries are reviewed
- Commit validated delays
- Address any uncommitted draft delays
- Document reasons for any missing delays

**After Closeout:**

- Committed delays are part of official shift record
- Delays cannot be edited without supervisor override
- Audit trail protects data integrity
- Historical delays remain in system

### Delay Metrics and Reporting

**Dashboard Metrics:**

- Total delay hours today
- Committed delay hours
- Draft delay hours (awaiting review)
- Number of delay entries by category
- Delay trends over time

**Shift Summary Metrics:**

- Delay hours per operation
- Delay distribution by category
- Manual override entry count
- Commit/uncommit activity

### Common Delay Issues

**Issue: Cannot Commit Delays**

**Symptoms:** "Submit Delays" button is disabled or fails

**Resolution:**

1. Verify you have supervisor or admin role
2. Check there are draft delays to commit
3. Ensure delay entries pass validation
4. Contact IT if permission issue

**Issue: Delay Hours Exceed 12 Hours**

**Symptoms:** Validation error on delay entry

**Resolution:**

1. Review all delay entries for the operation
2. Check for duplicate or overlapping delays
3. Verify delay times are accurate
4. Split delays if truly exceeds 12 hours
5. Contact operations team if exception needed

**Issue: Manual Override Entry Flagged**

**Symptoms:** Manual override indicator shows warning

**Resolution:**

1. Review the manual override entry
2. Verify justification is documented
3. Consider converting to time-based entry if possible
4. Note reason for manual override in description
5. Ensure proper audit documentation

## Supervisor PIN Management

### Setting Initial PIN

Initial PIN is set by system administrator using PIN reset procedure.

### Changing PIN

If the application supports self-service PIN change:

1. Navigate to Profile → Settings
2. Click "Change PIN"
3. Enter current PIN
4. Enter new PIN
5. Confirm new PIN

### Resetting PIN

If PIN is forgotten or locked:

1. Contact IT support
2. Provide identification
3. Request PIN reset
4. Receive temporary PIN
5. Change PIN immediately

## Reporting Requirements

### Daily Reports

Supervisors should review daily:

- Shift completeness status
- Active alerts
- Machine uptime
- Operator activity

### Weekly Reports

Supervisors should review weekly:

- Data integrity score
- Shift completeness rate
- Alert trends
- Performance metrics

### Issue Reporting

Report to management:

- Repeated machine issues
- System problems
- Operator performance concerns
- Data quality issues

## Training Requirements

### Initial Training

New supervisors should complete:

- Operator onboarding training
- Supervisor-specific training
- PIN usage training
- System overview

### Ongoing Training

Refresher training annually:

- System updates
- New features
- Process changes
- Security updates

## Communication Protocols

### With Operators

- Provide clear shift objectives
- Communicate issues promptly
- Answer questions timely
- Provide constructive feedback

### With Management

- Report shift outcomes
- Highlight operational issues
- Suggest improvements
- Request resources as needed

### With Support Teams

- Report system issues
- Provide detailed problem descriptions
- Follow up on resolution
- Document outcomes

## Emergency Procedures

### System Outage

If Control Room system is unavailable:

1. Use fallback procedures (paper records)
2. Contact IT support immediately
3. Document operations offline
4. Enter data when system restored

### SCADA Failure

If SCADA system is unavailable:

1. Use machine status from manual checks
2. Contact SCADA team
3. Monitor machine status via other means
4. Document SCADA downtime

### Operator Unavailability

If operator is unavailable:

1. Reassign tasks if possible
2. Document missing data
3. Follow up with operator
4. Report to management

## Performance Monitoring

### Key Metrics

Supervisors should monitor:

- Shift closeout on-time rate
- Data completeness rate
- Alert resolution time
- Operator productivity

### Improvement Goals

Target metrics:

- Shift closeout within 2 hours of shift end
- Data completeness >95%
- Alert resolution <30 minutes
- 100% machine uptime

## Common Issues

### Issue: Shift Cannot Be Closed

**Symptoms:** Validation errors prevent closeout

**Resolution:**

1. Review validation errors
2. Fix missing machine entries
3. Correct unreasonable values
4. Retry closeout after fixes

### Issue: PIN Not Working

**Symptoms:** PIN verification fails

**Resolution:**

1. Check if account is locked (3 failed attempts)
2. Wait 15 minutes if locked
3. Contact IT for PIN reset
4. Verify correct PIN

### Issue: Machine Status Incorrect

**Symptoms:** Machine shows wrong status

**Resolution:**

1. Verify SCADA connection
2. Check machine is actually in that state
3. Contact SCADA team if discrepancy
4. Use manual status if needed

## Contact Information

- **IT Support:** [Contact details]
- **SCADA Team:** [Contact details]
- **Management:** [Contact details]
- **Operator Support:** [Contact details]

## Related Documentation

- **Operator Onboarding Guide:** Operator procedures
- **Shift Closeout Runbook:** Detailed closeout procedures
- **PIN Reset Procedure:** PIN management
- **Alert Response Procedures:** Alert handling
- **Performance Optimization:** System monitoring
- **Delay Tracking:** Delay entry workflow (this document)

---

**Last Review:** 2026-06-15  
**Last Updated:** 2025-01-15 (Delay tracking integration)  
**Next Review:** 2026-09-15 (quarterly)
