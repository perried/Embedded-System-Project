# TelcoGuard Backend API Documentation

## BASE URL: 
https://telco-guard-backend.vercel.app

This directory contains the REST API for TelcoGuard.

## Endpoints

### POST /api/ingest
Receives sensor data from Raspberry Pi.
- **Headers:** `X-API-Key: telco-guard`
- **Body:** `{ "siteId": "site-001", "sensors": { "temperature": 0, "humidity": 0, "smoke": 0 } }`

### GET /api/sites
Returns current site status and historical sensor data for the dashboard.

### GET /health
Health check endpoint.

## Environment Variables (.env)
- `PORT`: Server port (default 3001)
- `INGEST_API_KEY`: API key for ingestion
- `SUPABASE_URL`: Supabase URL
- `SUPABASE_ANON_KEY`: Supabase Anon Key
