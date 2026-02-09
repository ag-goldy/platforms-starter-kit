-- Add Zabbix monitoring columns to services table
ALTER TABLE services 
ADD COLUMN zabbix_host_id VARCHAR(255),
ADD COLUMN zabbix_host_name VARCHAR(255),
ADD COLUMN zabbix_triggers JSONB DEFAULT '[]',
ADD COLUMN monitoring_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN monitoring_status VARCHAR(50) DEFAULT 'UNKNOWN',
ADD COLUMN last_synced_at TIMESTAMP,
ADD COLUMN uptime_percentage DECIMAL(5,2),
ADD COLUMN response_time_ms INTEGER;

-- Create table for service monitoring history
CREATE TABLE service_monitoring_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL,
    uptime_percentage DECIMAL(5,2),
    response_time_ms INTEGER,
    alerts_count INTEGER DEFAULT 0,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_monitoring_history_service_id ON service_monitoring_history(service_id);
CREATE INDEX idx_service_monitoring_history_timestamp ON service_monitoring_history(timestamp);

-- Create table for Zabbix organization configuration
CREATE TABLE zabbix_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    api_url TEXT NOT NULL,
    api_token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP,
    sync_interval_minutes INTEGER DEFAULT 5,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(org_id)
);

CREATE INDEX idx_zabbix_configs_org_id ON zabbix_configs(org_id);
