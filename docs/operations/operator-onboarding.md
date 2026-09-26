# Control Room Operator Onboarding Guide

**Last Updated:** 2026-06-15  
**Audience:** Control Room Operators  
**Department:** Control Room

---

## Overview

The Control Room Department is the central hub for monitoring and managing mining operations in real-time. This guide provides operators with the essential knowledge and procedures needed to effectively use the Control Room system.

### Key Responsibilities

- Monitor machine status and SCADA systems
- Log machine operations throughout the shift
- Update hourly load data for dump trucks
- Report operational delays as they occur
- Ensure shift completeness before shift closeout

---

## System Navigation

### Accessing the Control Room

1. Navigate to the Control Room department via the main dashboard
2. The Control Room dashboard displays real-time operational data
3. Access operational pages through the Quick Actions or navigation menu

### Dashboard Components

- **Control Room Summary Grid**: Shows hours worked, loads completed, delays, and active machines
- **Weather Widget**: Current weather conditions affecting operations
- **Quick Actions**: Fast access to Log Operation, Log Delay, and Update Loads
- **Shift Coverage Widget**: Real-time shift status and coverage information
- **SCADA Panel**: Machine list and SCADA dashboard integration
- **Alert Panel**: Offline machine alerts and acknowledgment
- **Activity Feed**: Real-time machine status updates

---

## Daily Workflow

### Shift Start (06:00 or 18:00)

1. **Verify Machine Status**
   - Check the SCADA Panel for all machine statuses
   - Acknowledge any offline machine alerts
   - Report machines that should be online but are offline to supervisors

2. **Review Previous Shift**
   - Check the Shift Coverage page for previous shift completeness
   - Review any outstanding issues or delays from the previous shift

3. **Begin Logging Operations**
   - Use the "Log Operation" Quick Action to start recording machine activities
   - Ensure all machine movements are logged with accurate timestamps

### During Shift

1. **Continuous Monitoring**
   - Monitor the Alert Panel for new offline machine alerts
   - Acknowledge alerts as they are addressed
   - Watch the Activity Feed for real-time status changes

2. **Update Hourly Loads**
   - Navigate to the Hourly Loads page
   - Update load counts for each dump truck hourly
   - Select the appropriate material type (Waste or Coal) for each machine

3. **Report Delays**
   - Use "Log Delay" Quick Action when operational delays occur
   - Provide accurate delay category, duration, and description
   - Include machine(s) affected by the delay

### Shift End (17:00 or 05:00)

1. **Verify Completeness**
   - Check the Shift Coverage page for completeness status
   - Ensure all machines have entries for the shift
   - Verify all hourly loads are entered

2. **Coordinate with Supervisor**
   - Notify supervisor when shift is complete
   - Supervisor will perform PIN-verified shift closeout
   - Shift cannot be closed if data is incomplete

---

## Logging Machine Operations

### How to Log an Operation

1. Click the "Log Operation" button in Quick Actions
2. Fill in the required fields:
   - **Machine**: Select the machine from the dropdown
   - **Operation Type**: Choose from predefined types (loading, dumping, maintenance, etc.)
   - **Start Time**: Auto-populated with current time, can be adjusted
   - **End Time**: Enter when the operation completed
   - **Notes**: Add any relevant details
3. Click "Submit" to save the operation

### Best Practices

- Log operations in real-time or as close to the event as possible
- Use consistent operation types for better reporting
- Include detailed notes for unusual events
- Verify machine status before logging (active vs. offline)

---

## Updating Hourly Loads

### Accessing Hourly Loads

1. Navigate to Control Room → Hourly Loads from the navigation menu
2. The page displays a grid of all dump trucks with hourly load cells

### Updating Load Data

1. **Increment/Decrement Method** (recommended):
   - Click the up/down arrows next to each hour cell
   - Values automatically save after each change

2. **Direct Edit Method**:
   - Click on a cell and type the value directly
   - Press Enter or click outside to save
   - Valid range: 0-100 loads per hour

3. **Material Type Selection**:
   - Click the Material button (Waste/Coal) to toggle
   - Selects the material type being moved by that machine

### Understanding the Grid

- **Day Shift Hours**: 06:00-17:00 (displayed as 06-17)
- **Night Shift Hours**: 18:00-05:00 (displayed as 18-05)
- **Bin Factor**: Shows the machine's bin factor (if configured)
- **Total Material**: Calculated as loads × bin factor (in tonnes)
- **Site Assignment**: Each machine can be assigned to a specific site

### Best Practices

- Update loads hourly to ensure data accuracy
- Double-check values before saving
- Monitor total loads for anomalies
- Correct errors immediately to avoid data integrity issues

---

## Reporting Operational Delays

### When to Report Delays

Report delays immediately when they occur:

- Equipment breakdowns
- Weather-related stoppages
- Access issues
- Personnel shortages
- Safety incidents
- Any interruption to normal operations

### How to Log a Delay

1. Click the "Log Delay" button in Quick Actions
2. Fill in the required fields:
   - **Machine(s)**: Select affected machines
   - **Delay Category**: Choose from predefined categories (breakdown, weather, access, etc.)
   - **Start Time**: Auto-populated, can be adjusted
   - **End Time**: Enter when the delay resolved
   - **Description**: Provide detailed explanation
3. Click "Submit" to save the delay

### Delay Categories

- **Breakdown**: Mechanical or electrical failure
- **Weather**: Rain, high winds, lightning, etc.
- **Access**: Road conditions, flooding, obstructions
- **Personnel**: Operator availability, training
- **Safety**: Incidents requiring investigation
- **Other**: Any other type of delay

### Best Practices

- Report delays as they happen, not at shift end
- Be specific in delay descriptions
- Include multiple machines if affected
- Track resolution time for analysis

---

## Shift Coverage Requirements

### Understanding Shift Completeness

A shift is considered complete when:

- All active machines have entries for the shift
- All hourly loads are entered for dump trucks
- Operational delays are logged
- Machine operations are recorded

### Completeness Indicators

- **Complete**: All required data is present (green indicator)
- **Incomplete**: Missing data for one or more machines (red indicator)
- **Exempt**: Machine is exempt from reporting (gray indicator)

### Shift Closeout Process

1. Operators ensure shift is complete
2. Supervisor initiates shift closeout
3. System validates completeness
4. Supervisor enters PIN for verification
5. Shift status changes to "closed"
6. Closed shifts cannot be edited

### Supervisor PIN

- Supervisors must have a PIN set for shift closeout approval
- PINs are verified through the system
- Contact system administrator if PIN needs to be reset

---

## SCADA Panel

### Machine List View

- Shows all registered machines for the department
- Displays machine name, type, serial number, and status
- Green badge = Online, Red badge = Offline
- Real-time updates via Supabase subscriptions

### SCADA Dashboard View

- Embedded FUXA SCADA system for detailed monitoring
- Toggle between Machine List and SCADA Dashboard using the buttons
- Requires FUXA server to be accessible
- Falls back to cached data if FUXA is unavailable

### Connection Status

- **Connected**: FUXA is responding normally (green indicator)
- **Degraded**: FUXA is slow but partially functional (yellow indicator)
- **Offline**: FUXA is unavailable, showing cached data (red indicator)

---

## Alert Panel

### Understanding Alerts

- Alerts are generated when machines go offline
- Each alert shows machine name and timestamp
- Severity: Critical (red) for offline machines
- Unacknowledged alerts show a count badge

### Acknowledging Alerts

1. Click the "Acknowledge" button on an alert
2. Alert will be marked as acknowledged and dimmed
3. Acknowledged alerts remain visible but won't affect the unacknowledged count

### Dismissing Alerts

1. Click the "Dismiss" button to remove an alert
2. Dismissed alerts are removed from the panel
3. New alerts will be generated if the machine remains offline

---

## Troubleshooting

### Common Issues

**Machine shows as offline but should be online**

- Check if FUXA is accessible
- Verify machine status in the SCADA Panel
- Contact SCADA engineer if issue persists

**Cannot save hourly loads**

- Check your internet connection
- Verify you're logged in
- Refresh the page and try again
- Contact supervisor if issue continues

**Shift won't close**

- Verify all machines have entries
- Check for missing hourly loads
- Ensure all delays are logged
- Contact supervisor if data is complete but won't close

**FUXA dashboard not loading**

- Check the FUXA server status
- The system will fall back to cached data
- Connection status indicator will show current state
- Contact IT if FUXA is consistently unavailable

### Getting Help

1. **Check the Shift Closeout Runbook** for detailed procedures
2. **Contact your supervisor** for operational issues
3. **Contact IT/Support** for technical issues
4. **Reference FUXA Troubleshooting Guide** for SCADA issues

---

## Performance Tips

1. **Stay Current**: Log operations and updates in real-time
2. **Be Accurate**: Double-check data before saving
3. **Monitor Alerts**: Respond to alerts promptly
4. **Communicate**: Keep supervisors informed of issues
5. **Complete Data**: Ensure shift completeness before leaving

---

## Security Awareness

- Never share your login credentials
- Log out when leaving your workstation
- Report suspicious activity immediately
- Follow all safety protocols
- Protect supervisor PINs and don't attempt to bypass them

---

## Additional Resources

- **Shift Closeout Runbook**: Detailed procedures for shift closeout
- **FUXA Troubleshooting Guide**: SCADA system troubleshooting
- **PIN Reset Procedure**: How to reset supervisor PINs
- **Machine Registration Guide**: Understanding machine setup

---

**For questions or issues not covered in this guide, contact your supervisor or the system administrator.**
