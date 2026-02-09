# Zabbix Integration

This document describes the Zabbix monitoring integration for the customer portal services.

## Overview

The Zabbix integration allows you to:
- Link services to Zabbix hosts for real-time monitoring
- Display service health status (Operational, Degraded, Critical)
- Show uptime percentage and response time metrics
- View active alerts/triggers from Zabbix
- Sync monitoring data automatically

## Setup

### 1. Configure Zabbix API Access

1. Go to **Admin → Zabbix** in the internal dashboard
2. Select an organization
3. Enter your Zabbix API URL (e.g., `https://zabbix.yourdomain.com`)
4. Enter your Zabbix API token

To create an API token in Zabbix:
- Go to **Administration → General → API tokens** in Zabbix
- Click "Create API token"
- Set name (e.g., "AGR Networks Integration")
- Set role with appropriate permissions (e.g., "Super admin" or custom role with host.read, trigger.read permissions)
- Copy the generated token

### 2. Link Services to Zabbix Hosts

1. In the Zabbix admin page, click "Load Zabbix Hosts"
2. For each service, select the corresponding Zabbix host from the dropdown
3. Toggle monitoring "On" to enable

### 3. Test Connection

Click "Test Connection" to verify the API credentials work.

### 4. Sync Data

Click "Sync Now" to immediately pull data from Zabbix, or wait for the automatic sync (runs every 5 minutes).

## How It Works

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Zabbix    │────▶│  API Sync   │────▶│  Database   │
│   Server    │     │   Service   │     │  (services) │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Customer  │◀────│  Services   │◀────│   Portal    │
│   Portal    │     │    Page     │     │   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Status Mapping

| Zabbix Triggers | Service Status |
|----------------|----------------|
| No problems | Operational (green) |
| Warning triggers | Minor Issues (orange) |
| High priority triggers | Degraded (yellow) |
| Disaster/Critical triggers | Critical (red) |
| Connection error | Error (gray) |

### Automatic Sync

The system syncs with Zabbix automatically via:
1. **Cron Job**: Runs every 6 hours via Vercel Cron (Hobby plan limitation)
2. **Manual Sync**: Admin can trigger immediate sync anytime
3. **On Link**: When linking a service to a host

**Note**: Vercel Hobby accounts are limited to daily/periodic cron jobs. For more frequent syncing (e.g., every 5 minutes), upgrade to Pro plan or use an external cron service.

## API Endpoints

### Test Connection
```
POST /api/zabbix/test
Body: { apiUrl: string, apiToken: string }
```

### Get Zabbix Hosts
```
GET /api/zabbix/hosts?orgId=<orgId>&search=<optional>
```

### Trigger Sync
```
POST /api/zabbix/sync
Body: { orgId: string, serviceId?: string }
```

## Database Schema

### services table (new columns)
- `zabbix_host_id`: Zabbix host ID
- `zabbix_host_name`: Host name from Zabbix
- `zabbix_triggers`: JSON array of trigger data
- `monitoring_enabled`: Boolean flag
- `monitoring_status`: Current status (OPERATIONAL, DEGRADED, etc.)
- `uptime_percentage`: Calculated uptime
- `response_time_ms`: Response time from Zabbix items
- `last_synced_at`: Last sync timestamp

### zabbix_configs table
- Organization-level Zabbix configuration
- API URL and token
- Sync interval settings

### service_monitoring_history table
- Historical monitoring data
- Used for uptime calculations and trends

## Environment Variables

```bash
# Optional: Secret token for cron job security
CRON_SECRET_TOKEN=your-secret-token-here
```

## More Frequent Sync (Optional)

Vercel Hobby plans are limited to daily/periodic cron jobs (max once per hour). If you need more frequent updates:

### Option 1: External Cron Service
Use an external cron service like:
- **Cron-job.org** (free) - Set up a job to call your sync endpoint
- **UptimeRobot** - Can call HTTP endpoints at intervals
- **GitHub Actions** - Schedule workflows to trigger the sync

Example cron-job.org setup:
- URL: `https://yourdomain.com/api/cron/zabbix-sync?token=CRON_SECRET_TOKEN`
- Schedule: Every 5 minutes
- Method: GET

### Option 2: Upgrade to Vercel Pro
Pro plan allows cron jobs down to 1 minute intervals.

### Option 3: Client-Side Polling
The customer portal can also fetch fresh data on page load - users will see updated status whenever they refresh the page.

## Troubleshooting

### "Connection failed" error
- Verify API URL is correct (include protocol, e.g., `https://`)
- Check API token is valid and not expired
- Ensure Zabbix server allows API access from your IP
- Check firewall rules

### "Host not found" error
- Verify the host exists in Zabbix
- Check API token has host.read permissions

### Data not updating
- Check cron job is configured in vercel.json
- Verify `monitoring_enabled` is true for the service
- Check browser console for JavaScript errors

## Security Considerations

1. API tokens are stored encrypted in the database
2. Zabbix API calls are made server-side only
3. Customers only see monitoring data, not raw Zabbix credentials
4. Use read-only API tokens where possible
5. Set appropriate CORS policies on Zabbix server

## Future Enhancements

- [ ] Custom trigger filtering (ignore certain triggers)
- [ ] SLA reporting based on monitoring data
- [ ] Incident auto-creation from Zabbix alerts
- [ ] Multiple Zabbix server support
- [ ] Custom metric mapping
- [ ] Historical uptime graphs
