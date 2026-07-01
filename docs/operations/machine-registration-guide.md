# Machine Registration Guide

**Last Updated:** 2026-06-15  
**Audience:** System Administrators, IT Support, Fleet Managers  
**Department:** Control Room

---

## Overview

This guide covers the process of registering new machines in the Control Room system, including configuration, SCADA integration, and operational setup.

## Prerequisites

- Machine serial number and specifications
- Machine type (dump truck, excavator, dozer, etc.)
- Bin factor (for dump trucks)
- Department assignment
- SCADA system access (if applicable)

## Registration Process

### Step 1: Gather Machine Information

Collect the following information for each machine:

**Required Fields:**

- **Serial Number:** Unique identifier from manufacturer
- **Name:** Human-readable name (e.g., "DT-001", "EX-005")
- **Machine Type:** Category (dump truck, excavator, dozer, etc.)
- **Department ID:** UUID of the department (e.g., control-room)
- **Active Status:** Whether the machine is currently operational

**Optional Fields:**

- **Bin Factor:** For dump trucks (tonnage per load, typically 30-50)
- **Capacity:** Maximum load capacity
- **Manufacturer:** Equipment manufacturer
- **Model:** Machine model
- **Year:** Manufacturing year
- **Site Assignment:** Specific site/location
- **Report Exempt:** Whether machine is exempt from shift reporting

### Step 2: Add Machine to Database

#### Option A: Via Admin Interface

1. Navigate to Admin → Machines → Add Machine
2. Fill in the required fields
3. Configure optional fields as needed
4. Click "Save"
5. Verify the machine appears in the machine list

#### Option B: Direct Database Insert

```sql
INSERT INTO machines (
  serial_number,
  name,
  machine_type,
  department_id,
  active,
  bin_factor,
  capacity,
  manufacturer,
  model,
  year,
  site_id,
  report_exempt
) VALUES (
  'SN123456',
  'DT-001',
  'Dump Truck',
  '<department_uuid>',
  true,
  40.5,
  250,
  'Caterpillar',
  '797F',
  2020,
  '<site_uuid>',
  false
);
```

### Step 3: Configure SCADA Integration

If the machine is monitored via FUXA SCADA system:

1. **Add Machine to FUXA**
   - Login to FUXA SCADA system
   - Navigate to Equipment → Add Equipment
   - Enter machine details matching the database
   - Configure data points (sensors, status indicators)
   - Save the equipment configuration

2. **Map Machine to SCADA Data Points**
   - Identify the SCADA equipment ID
   - Map to the machine's serial number
   - Configure status update polling interval
   - Test the integration

3. **Verify Connection**
   - Check Control Room → SCADA Panel
   - Verify machine appears in the list
   - Confirm status updates correctly
   - Check connection status indicator

### Step 4: Configure Machine-Specific Settings

#### Bin Factor (Dump Trucks Only)

The bin factor represents the tonnage per load and is used for material calculations.

**Typical Values:**

- Small dump trucks: 20-30 tonnes
- Medium dump trucks: 30-50 tonnes
- Large dump trucks: 50-80 tonnes

**Configuration:**

```sql
UPDATE machines
SET bin_factor = 40.5
WHERE id = '<machine_uuid>';
```

**Validation:**

- Bin factor must be between 20-100
- Values outside this range will trigger validation errors
- Contact fleet management if unsure of correct value

#### Report Exemption

Some machines may be exempt from shift reporting (e.g., backup equipment, seasonal machinery).

**To Exempt:**

```sql
UPDATE machines
SET report_exempt = true
WHERE id = '<machine_uuid>';
```

**Note:** Exempt machines do not require hourly loads or machine operations for shift completeness.

### Step 5: Test Machine Registration

1. **Navigate to Control Room Dashboard**
2. **Check Machine Count:** Verify new machine appears in "Machines" count
3. **Check SCADA Panel:** Verify machine status is displayed
4. **Test Machine Operations:** Try logging an operation for the machine
5. **Test Hourly Loads:** If dump truck, test load entry
6. **Verify Completeness Check:** Ensure machine is included in shift completeness

## Machine Types

### Dump Trucks (Dumper Trucks)

**Characteristics:**

- Requires bin_factor configuration
- Uses hourly loads for reporting
- Monitored via SCADA for status
- Critical for production tracking

**Required Forms:**

- Hourly loads (increment/decrement or direct entry)
- Machine operations (optional, for activities)

**SCADA Integration:**

- Status: Online/Offline
- Location/Position (if equipped)
- Load status (if sensors available)

### Excavators

**Characteristics:**

- No bin factor required
- Uses excavator activity form
- Monitored for operational efficiency

**Required Forms:**

- Excavator activity

**SCADA Integration:**

- Status: Online/Offline
- Bucket status
- Operating mode

### Dozers (Bulldozers)

**Characteristics:**

- No bin factor required
- Uses roll-over form for reporting
- Monitored for availability

**Required Forms:**

- Roll-over (dozer rolls)

**SCADA Integration:**

- Status: Online/Offline
- Blade position (if equipped)

### Other Equipment

**Characteristics:**

- Uses generic machine operations form
- Configurable based on equipment type

**Required Forms:**

- Machine operations

## SCADA Integration Details

### FUXA Equipment Configuration

1. **Equipment Properties**
   - Name: Must match database machine name
   - Type: Equipment category
   - Description: Optional description

2. **Data Points**
   - Status: Online/Offline indicator
   - Position: GPS location (if available)
   - Load: Current load status (for dump trucks)
   - Fuel: Fuel level (if sensors available)
   - Temperature: Engine/machine temperature (if available)

3. **Communication**
   - Polling interval: How often SCADA checks status (typically 5-10s)
   - Protocol: MQTT, Modbus, or OPC-UA
   - Authentication: Credentials for data source

### Troubleshooting SCADA Integration

**Machine Not Appearing in SCADA Panel:**

1. Verify machine is registered in database
2. Check FUXA equipment configuration
3. Verify polling interval is set
4. Check connection status in FUXA
5. Review SCADA logs for errors

**Status Not Updating:**

1. Check data source connection
2. Verify polling interval is not too long
3. Test data point mapping
4. Check network connectivity
5. Review FUXA logs

## Machine Deactivation

When a machine is decommissioned or temporarily out of service:

1. **Set Active Status to False**

   ```sql
   UPDATE machines
   SET active = false
   WHERE id = '<machine_uuid>';
   ```

2. **Archive Historical Data**
   - Ensure all shift data is archived
   - Export machine operation history
   - Save hourly loads data

3. **Update SCADA (if applicable)**
   - Disable equipment in FUXA
   - Or remove from FUXA completely

4. **Document Decommissioning**
   - Record reason for deactivation
   - Note decommission date
   - Archive documentation

## Bulk Registration

For registering multiple machines at once:

### CSV Import Template

| serial_number | name   | machine_type | department_id | bin_factor | capacity | manufacturer | model | year | active |
| ------------- | ------ | ------------ | ------------- | ---------- | -------- | ------------ | ----- | ---- | ------ |
| SN001         | DT-001 | Dump Truck   | <uuid>        | 40         | 250      | Caterpillar  | 797F  | 2020 | true   |
| SN002         | DT-002 | Dump Truck   | <uuid>        | 40         | 250      | Caterpillar  | 797F  | 2020 | true   |

### Bulk Import Process

1. Prepare CSV file with required fields
2. Use admin interface → Bulk Import → Machines
3. Upload CSV file
4. Validate data
5. Import machines
6. Verify import results

## Validation Rules

The system validates machine data according to these rules:

1. **Serial Number:** Must be unique across all machines
2. **Name:** Must be unique within department
3. **Bin Factor:** Must be between 20-100 (if provided)
4. **Department ID:** Must be a valid, active department
5. **Machine Type:** Must match predefined types

## Audit Trail

All machine registration actions are logged:

- **Creation:** New machine added
- **Updates:** Any field modifications
- **Deactivation:** Machine set to inactive
- **SCADA Changes:** Integration modifications

Review audit logs via Admin → Audit Logs → filter by "machines" table.

## Common Issues

### Issue: Serial Number Already Exists

**Symptoms:** Error when adding machine with duplicate serial number

**Resolution:**

1. Check if machine exists in another department
2. If so, determine correct department assignment
3. If duplicate entry, delete one and re-register

### Issue: Machine Not Appearing in Dashboard

**Symptoms:** Machine registered but not visible in Control Room

**Resolution:**

1. Verify active status is true
2. Check department assignment
3. Verify machine is not report_exempt
4. Check cache (may need to invalidate)
5. Refresh dashboard

### Issue: Bin Factor Validation Error

**Symptoms:** Cannot save machine with bin_factor value

**Resolution:**

1. Ensure bin_factor is between 20-100
2. Contact fleet management for correct value
3. If value is genuinely outside range, request exception

## Maintenance

Regular maintenance tasks:

- **Quarterly:** Review all active machines, update status
- **Annually:** Audit machine specifications, update as needed
- **As Needed:** Update bin factors if equipment changes
- **As Needed:** Reassign machines between departments

## Contact Information

- **Fleet Management:** [Contact details]
- **SCADA Team:** [Contact details]
- **IT Support:** [Contact details]

## Related Documentation

- **Operator Onboarding Guide:** How operators use registered machines
- **SCADA User Guide:** FUXA system configuration
- **Shift Closeout Runbook:** Shift reporting with machines
- **Performance Optimization:** Machine status monitoring

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
