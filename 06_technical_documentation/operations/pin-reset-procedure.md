# Supervisor PIN Reset Procedure

**Last Updated:** 2026-06-15  
**Audience:** System Administrators, IT Support  
**Department:** Control Room

---

## Overview

This procedure documents how to reset a supervisor's PIN when it has been forgotten, locked out due to too many failed attempts, or needs to be changed for security reasons.

## Prerequisites

- Database access (service role or admin privileges)
- Knowledge of the employee's email or employee code
- Understanding of bcrypt for PIN hashing

## Reset Procedure

### Method 1: Direct Database Update (Recommended)

1. **Identify the Employee**

   ```sql
   SELECT id, employee_code, full_name
   FROM employees
   WHERE employee_code = 'EMPLOYEE_CODE' OR email = 'email@domain.com';
   ```

   Note the employee's UUID.

2. **Generate New PIN Hash**
   - The new PIN must be 4 digits
   - Use bcrypt to hash the new PIN
   - Example (Node.js):

     ```javascript
     const bcrypt = require("bcryptjs");
     const newPIN = "1234"; // New temporary PIN
     const pinHash = await bcrypt.hash(newPIN, 10);
     console.log(pinHash); // Copy this hash
     ```

3. **Update PIN Hash in Database**

   ```sql
   UPDATE employees
   SET pin_hash = '<bcrypt_hash_from_step_2>'
   WHERE id = '<employee_uuid>';
   ```

4. **Verify Update**

   ```sql
   SELECT employee_code, full_name, pin_hash IS NOT NULL as has_pin
   FROM employees
   WHERE id = '<employee_uuid>';
   ```

5. **Communicate New PIN to Supervisor**
   - Contact the supervisor via secure channel (in person or encrypted email)
   - Provide the temporary PIN
   - Instruct them to change it immediately after first login

6. **Reset PIN Lockout (if applicable)**

   ```sql
   -- Clear Redis lockout key
   -- Use Redis CLI: DEL pin_attempts:<employee_code>
   -- Or via application:
   DELETE FROM pin_attempts WHERE employee_code = 'EMPLOYEE_CODE';
   ```

### Method 2: Via Application Interface

If the application has an admin interface for PIN management:

1. Navigate to Admin → Employees
2. Search for the employee by name or code
3. Click "Reset PIN" on the employee record
4. Enter the new temporary PIN
5. Click "Save"
6. The system will automatically hash the PIN and update the database

## PIN Requirements

- **Length:** Exactly 4 digits
- **Characters:** Numbers only (0-9)
- **Format:** Plain text (not padded)
- **Hashing:** Bcrypt with salt factor of 10
- **Temporary PINs:** Should be changed after first use

## Security Considerations

### PIN Lockout Mechanism

- **Trigger:** 3 failed attempts within 5 minutes
- **Lockout Duration:** 15 minutes
- **Automatic Reset:** Lockout expires after 15 minutes
- **Manual Reset:** Can be cleared by administrator

### Security Best Practices

1. **Never share PINs via unencrypted channels**
   - Avoid sending PINs via plain email
   - Use secure messaging or in-person delivery
   - Temporary PINs should be changed immediately

2. **Force PIN Change After Reset**
   - Set a flag to force PIN change on next login
   - Or communicate that the temporary PIN must be changed

3. **Audit Trail**
   - Log all PIN reset operations
   - Include: who performed reset, when, which employee, reason
   - Store in audit_logs table

4. **Rate Limiting**
   - PIN reset attempts should be rate limited
   - Prevent automated PIN reset attacks
   - Use existing rate limiting infrastructure

## Emergency PIN Reset

If the supervisor needs immediate access and the database is unavailable:

1. **Bypass PIN Verification (Emergency Only)**
   - Use service role to directly close the shift
   - This bypasses PIN verification but logs the action
   - Should only be used in genuine emergencies

2. **Document the Emergency**
   - Create an audit entry explaining the bypass
   - Include justification and approving authority
   - Review within 24 hours

## Common Issues

### Issue: PIN Hash Update Not Working

**Symptoms:** Supervisor cannot log in with new PIN after reset

**Possible Causes:**

- Incorrect bcrypt hash format
- PIN hash was not properly updated
- Employee ID incorrect

**Resolution:**

1. Verify the bcrypt hash was generated correctly
2. Check the database update was committed
3. Verify the employee ID is correct
4. Test the hash verification in isolation

### Issue: PIN Lockout Persists After Reset

**Symptoms:** Supervisor still locked out even after PIN reset

**Possible Causes:**

- Redis lockout key not cleared
- Time window not expired
- Multiple lockout keys exist

**Resolution:**

1. Check Redis for lockout keys: `KEYS pin_attempts:*`
2. Delete the specific lockout key: `DEL pin_attempts:<employee_code>`
3. Verify lockout is cleared by checking shift closeout attempt

### Issue: PIN Not Accepted (Correct PIN)

**Symptoms:** Supervisor enters correct PIN but validation fails

**Possible Causes:**

- Brypt hash comparison failing
- Salt factor mismatch
- Character encoding issues

**Resolution:**

1. Verify bcrypt version matches application requirements
2. Check for character encoding issues (UTF-8 vs ASCII)
3. Test hash generation with same bcrypt version
4. Regenerate hash with proper parameters

## Monitoring

### Key Metrics to Monitor

- **PIN Reset Frequency:** Track how often PINs are reset
  - High frequency may indicate usability issues or security concerns
- **Failed PIN Attempts:** Track failed attempts before reset
  - May indicate unauthorized access attempts
- **PIN Lockout Rate:** Track lockout frequency
  - May need adjustment of lockout thresholds

### Alerts

Configure alerts for:

- > 5 PIN resets per day (abnormal activity)
- > 10 failed PIN attempts from same source (brute force attempt)
- PIN reset without proper authorization (security incident)

## PIN Rotation Policy

### Recommended Schedule

- **Temporary PINs:** Change within 24 hours
- **Regular PINs:** Change every 90 days
- **After Security Incident:** Immediately change all supervisor PINs

### Forced PIN Change

If the application supports it:

- Set `force_pin_change` flag on employee record
- On login, check flag and prompt for PIN change
- Clear flag after successful change

## Compliance Considerations

### Audit Requirements

All PIN resets should be logged with:

- Timestamp
- Administrator who performed reset
- Employee whose PIN was reset
- Reason for reset
- Method used (direct DB or application interface)

### Data Protection

- PINs should never be stored in plain text
- PIN hashes should use bcrypt (minimum salt factor 10)
- Temporary PINs should be delivered securely
- Audit logs should be protected and retained

## Contact Information

- **IT Support:** [Contact details]
- **Database Administrator:** [Contact details]
- **Security Team:** [Contact details]

## Related Documentation

- **Shift Closeout Runbook:** Complete shift closeout procedures
- **Operator Onboarding Guide:** General system usage
- **Security Policy:** Password and authentication requirements
- **Audit Log Procedures:** Logging and review processes

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
