# TRSMS Hub — API & WebSocket Documentation

## Base URL
`http://<VM-EXTERNAL-IP>:3001`

This directory contains the Express + Socket.IO hub server for the Telecom Remote Site Monitoring System.

## REST Endpoints

### POST /api/ingest
Receives sensor data from Raspberry Pi (legacy HTTP fallback).
- **Headers:** `X-API-Key: <INGEST_API_KEY>`
- **Body:** `{ "siteId": "site-001", "sensors": { "temperature": 0, "humidity": 0, "smoke": 0 } }`

### GET /api/sites
Returns all sites with sensor history for initial dashboard hydration.

### GET /health
Health check endpoint.

## Socket.IO Namespaces

### /pi — Raspberry Pi connections
- `sensor:data` (Pi → Hub) — Stream sensor readings
- `thresholds:update` (Hub → Pi) — Push threshold changes
- `thresholds:ack` (Pi → Hub) — Confirm thresholds applied

### /dashboard — Browser dashboard connections
- `sites:list` (Hub → Dashboard) — Full site list on connect
- `site:data` (Hub → Dashboard) — Real-time sensor data
- `site:status` (Hub → Dashboard) — Connect/disconnect events
- `thresholds:set` (Dashboard → Hub) — Edit thresholds from UI

## Environment Variables (.env)
- `PORT`: Server port (default 3001)
- `INGEST_API_KEY`: API key for REST ingestion
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL connection
