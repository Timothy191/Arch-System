# Control Room Shift Closeout - Operational Runbook

**Purpose:** Standard operating procedures for Control Room shift closeout  
**Last Updated:** 2026-06-15  
**Target Audience:** Control Room Operators, Supervisors, Administrators  
**Priority:** CRITICAL - Shift closeout is required for production operations

---

## 📋 **Prerequisites**

### **Before Shift Closeout**

- [ ] **All machines must have entries for the shift**
  - Machine Operations log (required for all machine types)
  - Hourly Loads (required for Dump Trucks)
  - Dozer Rolls (required for Dozers)
  - Excavator Activity (required for Excavators)

- [ ] **Supervisor must be available with PIN**
  - Supervisor or admin with PIN access must be on-site or remotely available
  - PIN must be previously set via Admin panel or self-service

- [ ] **Shift must be within operational hours**
  - Day shift: 06:00 - 18:00
  - Night shift: 18:00 - 06:00 (next day)
  - Late closeout requires supervisor approval

- [ ] **No active machine operations in progress**
  - All machines should have end_time set
  - No machines should be in active operation state

---

## 🔄 **Shift Closeout Procedure**

### **Step 1: Navigate to Shift Coverage**

1. Log in to Control Room portal
2. Navigate to: `control-room` → `Shift Coverage`
3. Verify current shift is displayed correctly (Day/Night)
4. Review machine coverage table

### **Step 2: Review Shift Completeness**

**Check Shift Coverage Widget:**

- All machines should show green checkmark (✓)
- Machines with yellow warning (⚠) need attention
- Machines with red X (✗) must have entries before closeout

**Common Issues:**

- **Machine not reported:** Click "Log Operation" to add entry
- **Hours worked = 0:** Update machine operation with actual hours
- **Hours worked > 12h:** Contact supervisor for override

### **Step 3: Click "Close Shift" Button**

1. Locate "Close Shift" button at bottom of Shift Coverage widget
2. Click button to initiate closeout process
3. Wait for validation to complete

### **Step 4: Address Validation Errors (if any)**

**If validation fails, system will display:**

- List of machines missing entries
- Machines exceeding 12-hour limit
- Any other validation issues

**Resolution:**

1. Click the specific machine/form link in error message
2. Add or update required information
3. Return to Shift Coverage
4. Click "Close Shift" again

### **Step 5: Enter Supervisor PIN**

**When validation passes:**

1. Enter supervisor's Employee Code (e.g., EMP001)
2. Enter supervisor's PIN (4-6 digit code)
3. Click "Verify PIN"

**If PIN verification fails:**

- Check employee code is correct
- Check PIN is correct (case-sensitive)
- Contact supervisor if PIN forgotten

**If supervisor PIN not set:**

- Contact administrator to set PIN via Admin panel
- Supervisor can set their own PIN via Admin → Personnel

### **Step 6: Approve Shift Closeout**

**After successful PIN verification:**

1. Review supervisor name displayed for confirmation
2. Click "Close Shift & Lock" to confirm
3. Wait for confirmation message

**Success indicators:**

- Green checkmark: "Shift closed successfully"
- Shift Coverage widget shows "Shift Closed" badge
- Shift is no longer editable
- Date is highlighted in calendar/history

---

## ⚠️ **Error Resolution**

### **Common Error Messages**

#### **"Shift is already closed"**

- **Cause:** Shift was already closed by another user
- **Action:** Verify shift status in Shift Coverage or History tab
- **Resolution:** No action needed if closed correctly

#### **"Machine '{name}': not reported"**

- **Cause:** Required form entry missing for this machine
- **Action:** Navigate to required form and add entry
- **Required Forms by Machine Type:**
  - Dump Trucks: Hourly Loads
  - Dozers: Roll-Over
  - Excavators: Excavator Activity
  - Other: Machine Operations

#### **"Machine '{name}': {hours}h exceeds 12h maximum"**

- **Cause:** Machine logged hours exceed shift limit
- **Action:** Review and correct hours worked
- **Exception:** Contact supervisor for override if legitimate overtime

#### **"Invalid supervisor PIN"**

- **Cause:** Incorrect employee code or PIN entered
- **Action:** Verify credentials with supervisor
- **Resolution:** Re-enter correct credentials

#### **"Approving supervisor not found or has no PIN set"**

- **Cause:** Supervisor account missing or PIN not set
- **Action:** Contact administrator
- **Resolution:** Admin must set supervisor PIN via Admin panel

---

## 🚨 **Emergency Procedures**

### **System Unavailable During Closeout**

**If portal is unavailable when shift needs closing:**

1. **Document all machine operations manually**
   - Use paper forms or backup system
   - Record machine IDs, hours, operators, loads
   - Note exact timestamps

2. **Contact supervisor immediately**
   - Inform of system issue
   - Provide manual documentation
   - Get supervisor approval for manual closeout

3. **System Recovery Actions**
   - When system recovers, enter all manual data
   - Verify data accuracy with paper records
   - Perform shift closeout normally
   - Note emergency closeout in comments

### **Supervisor Unavailable**

**If supervisor with PIN is unavailable:**

1. **Contact administrator immediately**
   - Inform of supervisor unavailability
   - Request emergency PIN reset or override
   - Provide context and urgency

2. **Alternative Approval**
   - Admin may provide temporary override
   - Document alternative approval process
   - Follow up with normal approval when supervisor returns

---

## 📊 **Post-Closeout Verification**

### **Immediate Verification**

- [ ] Shift shows "Closed" status in Shift Coverage
- [ ] Shift is no longer editable (forms disabled)
- [ ] All machine entries are present and accurate
- [ ] Hours and loads calculations correct
- [ ] No validation warnings remain

### **Audit Trail Verification**

1. Navigate to: `control-room` → `History`
2. Locate the closed shift in history
3. Verify audit log entry exists
4. Check who closed shift and when
5. Verify supervisor approval is recorded

### **Data Integrity Check**

- [ ] Total hours match machine operations sum
- [ ] Total loads match hourly loads sum
- [ ] BCM calculations are correct (loads × bin_factor)
- [ ] No duplicate entries exist
- [ ] All end times are set (no active operations)

---

## 🛠️ **Troubleshooting**

### **Shift Closeout Button Disabled**

**Possible causes:**

- Shift already closed
- Validation still in progress
- User lacks required permissions

**Resolution:**

1. Refresh page and check shift status
2. Wait for validation to complete
3. Verify user role (control_room_operator or admin)

### **PIN Verification Timeout**

**Possible causes:**

- Network connectivity issue
- Database connection problem
- Browser timeout

**Resolution:**

1. Check network connectivity
2. Refresh page and retry
3. Try different browser
4. Contact IT support if issue persists

### **Validation Hangs**

**Possible causes:**

- Database slow response
- Large number of machines to validate
- Network latency

**Resolution:**

1. Wait 30 seconds for validation to complete
2. Refresh page and retry
3. Contact support if validation consistently hangs

---

## 📞 **Support Contacts**

- **Technical Issues:** DevOps Team
- **Database Issues:** DBA Team
- **PIN/Access Issues:** HR/IT Team
- **Process Questions:** Operations Lead
- **Emergency:** Site Supervisor

---

## 📝 **Audit Requirements**

### **Records to Maintain**

- Shift closeout timestamps
- Supervisor approvals
- Manual closeout documentation (emergency)
- PIN reset logs
- Override authorizations

### **Retention**

- All shift closeout records: 7 years minimum
- Audit logs: 7 years minimum
- Manual documentation: 1 year minimum

---

## ✅ **Success Criteria**

Shift closeout is considered successful when:

- All machines have required entries for the shift
- Shift status shows "Closed" in system
- Supervisor approval is recorded with PIN verification
- Audit trail is complete and accurate
- Data integrity checks pass
- No validation errors or warnings remain
- Calculated totals (hours, loads, BCM) are correct

---

_This runbook should be reviewed quarterly and updated as processes evolve. All emergency procedures should be tested annually._
