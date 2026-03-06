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

-- ── Users (NOC dashboard authentication) ──
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    full_name   TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    role        TEXT DEFAULT 'operator',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shippers (logistics providers) ──
CREATE TABLE IF NOT EXISTS shippers (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    contact_person  TEXT,
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
