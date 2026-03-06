-- TRSMS PostgreSQL Schema
-- ==============================
-- Run once to initialise the database tables.
-- This script is executed automatically by Docker on first start
-- via the /docker-entrypoint-initdb.d/ mechanism.

CREATE TABLE IF NOT EXISTS telco_sites (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    location    TEXT DEFAULT 'Unknown',
    status      TEXT DEFAULT 'offline',
    thresholds  JSONB DEFAULT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telco_sensor_readings (
    id          SERIAL PRIMARY KEY,
    site_id     TEXT NOT NULL REFERENCES telco_sites(id) ON DELETE CASCADE,
    sensor_type TEXT NOT NULL,
    value       DOUBLE PRECISION NOT NULL,
    timestamp   BIGINT NOT NULL
);

-- Index for fast lookups by site + time (dashboard history queries)
CREATE INDEX IF NOT EXISTS idx_readings_site_time
    ON telco_sensor_readings (site_id, timestamp DESC);

-- Index for fast lookups by sensor type
CREATE INDEX IF NOT EXISTS idx_readings_type
    ON telco_sensor_readings (sensor_type);

-- ── Alert History ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telco_alerts (
    id            SERIAL PRIMARY KEY,
    site_id       TEXT NOT NULL REFERENCES telco_sites(id) ON DELETE CASCADE,
    sensor_type   TEXT NOT NULL,
    severity      TEXT NOT NULL DEFAULT 'warning',
    message       TEXT NOT NULL,
    created_at    BIGINT NOT NULL,
    resolved_at   BIGINT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_site_time
    ON telco_alerts (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_open
    ON telco_alerts (resolved_at) WHERE resolved_at IS NULL;
