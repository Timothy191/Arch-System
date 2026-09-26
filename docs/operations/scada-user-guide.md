# SCADA User Guide

**Last Updated:** 2026-06-15  
**Audience:** SCADA Engineers, Control Room Operators, IT Support  
**Department:** Control Room

---

## Overview

This guide covers the FUXA SCADA system used in the Control Room for real-time machine monitoring and status tracking.

## System Architecture

### Components

1. **FUXA SCADA Server**
   - Web-based SCADA system
   - Real-time data visualization
   - Equipment monitoring and control

2. **Data Sources**
   - MQTT: Message queue for real-time updates
   - Modbus: Industrial protocol for equipment communication
   - OPC-UA: Industrial automation protocol

3. **Integration**
   - Embedded in Control Room via iframe
   - Status updates via Supabase realtime
   - Fallback to cached data when unavailable

### Access

- **URL:** Configured via `NEXT_PUBLIC_FUXA_URL` environment variable
- **Development:** Typically `http://localhost:1881`
- **Staging:** Staging FUXA server URL
- **Production:** Production FUXA server URL

## FUXA Interface

### Login

1. Navigate to FUXA URL
2. Enter credentials
3. Select dashboard
4. Access equipment views

### Dashboard Types

**Machine List Dashboard**

- Shows all registered machines
- Displays status, location, key metrics
- Real-time updates via subscriptions

**SCADA Dashboard**

- Detailed equipment views
- Customizable widgets
- Historical data views
- Control interfaces (if enabled)

### Equipment Management

### Adding Equipment

1. Navigate to Equipment → Add
2. Enter equipment details:
   - Name (must match database machine name)
   - Type/Category
   - Description
3. Configure data points:
   - Status indicator
   - Position/Location
   - Load status (for dump trucks)
   - Fuel level
   - Temperature
4. Set communication parameters:
   - Protocol (MQTT, Modbus, OPC-UA)
   - Connection details
   - Polling interval (typically 5-10s)
5. Save equipment configuration

### Data Point Configuration

**Status Data Point**

- Type: Boolean
- Name: `status`
- Description: Online/Offline status
- Update frequency: Per polling interval

**Position Data Point**

- Type: String or Object
- Name: `position`
- Description: GPS coordinates or location
- Update frequency: Per polling interval

**Load Data Point**

- Type: String or Number
- Name: `load_status`
- Description: Current load status (loaded/empty)
- Update frequency: Per polling interval or event-driven

## Integration with Control Room

### Status Update Flow

1. FUXA polls equipment at configured interval
2. Equipment status changes detected
3. FUXA updates equipment state
4. Status change triggers database update
5. Supabase realtime subscription fires
6. Control Room UI updates automatically

### Connection States

**Connected (Green)**

- FUXA is responding normally
- Real-time updates working
- Dashboard interactive

**Degraded (Yellow)**

- FUXA responding slowly
- Some updates delayed
- Partial functionality available

**Offline (Red)**

- FUXA unavailable
- Showing cached data
- Automatic retry with backoff

### Fallback Mode

When FUXA is unavailable:

- System shows last-known cached data
- Cache duration: 5 minutes
- Connection status indicator shows Offline
- Manual refresh button available
- Automatic recovery when FUXA returns

## Troubleshooting

### Equipment Not Showing

**Symptoms:** Equipment registered in database but not in FUXA

**Resolution:**

1. Verify equipment is added to FUXA
2. Check equipment name matches database
3. Verify data source connection
4. Review FUXA logs for errors
5. Test data point mapping

### Status Not Updating

**Symptoms:** Equipment status stuck on old value

**Resolution:**

1. Check polling interval is set
2. Verify data source connection
3. Test data point configuration
4. Check FUXA logs for errors
5. Restart data source if needed

### Connection Lost

**Symptoms:** FUXA shows offline, status not updating

**Resolution:**

1. Check FUXA server status
2. Verify network connectivity
3. Check data source connection
4. Review FUXA logs
5. Contact SCADA team if issue persists

## Configuration Files

### Environment Variables

```bash
# FUXA server URL
NEXT_PUBLIC_FUXA_URL=https://fuxa.your-domain.com
```

### FUXA Configuration

FUXA uses JSON configuration files for:

- Equipment definitions
- Data source connections
- Dashboard layouts
- User permissions

## Security

### Authentication

FUXA authentication:

- Username/password
- Role-based access
- Session management

### Access Control

**View-Only Access:**

- Can view dashboards
- Cannot control equipment
- Cannot modify configurations

**Control Access:**

- Can view dashboards
- Can control equipment (if enabled)
- Cannot modify configurations

**Admin Access:**

- Full access to all features
- Can modify configurations
- Can manage users

### Best Practices

1. Use strong passwords
2. Rotate credentials regularly
3. Use role-based access (least privilege)
4. Monitor access logs
5. Report suspicious activity

## Performance

### Optimization Tips

1. **Polling Interval**
   - Set appropriate intervals (5-10s typical)
   - Too frequent: unnecessary load
   - Too infrequent: stale data

2. **Data Points**
   - Only configure necessary data points
   - Remove unused data points
   - Optimize data point types

3. **Dashboard Design**
   - Keep dashboards simple
   - Avoid too many widgets
   - Use efficient visualization types

### Monitoring

Monitor:

- FUXA server response time
- Data source connection status
- Equipment update frequency
- System resource usage

## Maintenance

### Regular Tasks

- **Daily:** Check connection status
- **Weekly:** Review equipment status
- **Monthly:** Review configuration
- **Quarterly:** Audit access and security

### Backups

- Backup FUXA configuration files
- Export dashboard layouts
- Archive equipment definitions
- Document custom configurations

## Development and Testing

### Testing Data Sources

1. Configure test data source
2. Add test equipment
3. Verify data flow
4. Test dashboard display
5. Validate integration

### Simulating Equipment Status

For testing without real equipment:

- Use simulation mode
- Manually update data points
- Test alert generation
- Verify Control Room updates

## Contact Information

- **SCADA Engineer:** [Contact details]
- **IT Support:** [Contact details]
- **FUXA Support:** [Contact details]

## Related Documentation

- **Machine Registration Guide:** Equipment integration
- **FUXA Troubleshooting Guide:** Detailed troubleshooting
- **Performance Optimization:** System tuning
- **Operator Onboarding Guide:** User-facing features

---

**Last Review:** 2026-06-15  
**Next Review:** 2026-09-15 (quarterly)
