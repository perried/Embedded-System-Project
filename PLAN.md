# TRSMS — System Architecture & Implementation Plan

## 1. Overview

The Telecom Remote Site Monitoring System (TRSMS) uses a **bidirectional Socket.IO hub-and-spoke** architecture to connect multiple unmanned Raspberry Pi site nodes to a centralized NOC dashboard in real-time.

```
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  Site A   │     │  Site B   │     │  Site C   │
    │  (Pi #1) │     │  (Pi #2) │     │  (Pi #3) │
    └────┬─────┘     └────┬─────┘     └────┬─────┘
         │ WS /pi         │ WS /pi         │ WS /pi
         └────────────────┼────────────────┘
                          │
                  ┌───────┴────────┐
                  │   Hub Server   │  ← Docker on GCE
                  │  Express +     │
                  │  Socket.IO +   │
                  │  PostgreSQL    │
                  └───────┬────────┘
                          │ WS /dashboard + static files
                  ┌───────┴────────┐
                  │ NOC Dashboard  │  ← React SPA (same origin :3001)
                  └────────────────┘
```

**Components:**
- **Hub** = Node.js Express + Socket.IO server, deployed via Docker Compose on Google Compute Engine
- **Spokes** = Raspberry Pi devices running `python-socketio` as a background thread
- **Dashboard** = React 19 / Vite / TypeScript SPA, built in Docker and served as static files from the same Express server
- **Database** = PostgreSQL 16 (Docker container with persistent volume)

---

## 2. What Changed (Before → After)

| Component | Before | After |
|-----------|--------|-------|
| Pi → Server | HTTP POST every 30s | Socket.IO `/pi` namespace, `sensor:data` every 2s |
| Server → Dashboard | REST polling every 10s (`GET /api/sites`) | Socket.IO `/dashboard` push — real-time `site:data` events |
| Server → Pi | None (one-way) | Socket.IO push — `thresholds:update` events |
| Site registration | Manual (pre-create in Supabase) | Auto-register on Pi connect (`INSERT ... ON CONFLICT DO UPDATE`) |
| Thresholds (Pi) | Hardcoded `config.py` only | Defaults in `config.py` → overridable from dashboard → persisted in `thresholds.json` |
| Thresholds (Server) | Hardcoded in route files | Per-site JSONB column in `telco_sites`, editable from dashboard |
| Status detection | 5-minute timeout heuristic | Instant — WebSocket disconnect = offline |
| Database | Supabase (external) | Self-hosted PostgreSQL in Docker |
| Hosting | Not deployed | Docker Compose on Google Compute Engine |
| Dashboard serving | Separate (Vercel planned) | Built by Docker, served from same Express on :3001 |

## 3. What Did NOT Change

- **systemd service files** (`ems.service`, `ems-splash.service`)
- **Sensor code** (`sensors/dht_sensor.py`, `sensors/mq2_sensor.py`)
- **Actuator code** (`actuators/buzzer.py`, `actuators/fan.py`, `actuators/lcd_display.py`)
- **Boot splash** (`boot_splash.py`)
- **GPIO pin assignments** (all in `config.py`)
- **Firebase push notifications** (still triggered server-side)

---

## 4. Socket.IO Event Protocol

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `sensor:data` | Pi → Hub | `{siteId, sensors: {temperature, humidity, smoke}, timestamp}` | Stream readings every 2s |
| `thresholds:update` | Hub → Pi | `{temp_fan_on, temp_warning, temp_critical, humidity_warning, smoke_critical}` | Push threshold changes to Pi |
| `thresholds:ack` | Pi → Hub | `{siteId, thresholds}` | Pi confirms thresholds applied |
| `site:data` | Hub → Dashboard | `{siteId, sensors, status, timestamp}` | Real-time sensor broadcast |
| `site:status` | Hub → Dashboard | `{siteId, status, connected}` | Connect/disconnect events |
| `sites:list` | Hub → Dashboard | `[{id, name, location, status, connected, thresholds}]` | Full site list on dashboard connect |
| `thresholds:set` | Dashboard → Hub | `{siteId, thresholds}` | NOC operator edits thresholds |
| `site:subscribe` | Dashboard → Hub | `{siteId}` | Subscribe to a specific site's stream |

---

## 5. Threshold Flow

```
 NOC Dashboard               Hub Server                Raspberry Pi
 ─────────────               ──────────                ─────────────
 Operator edits thresholds
  → thresholds:set ─────────→ Save to PostgreSQL
                               telco_sites.thresholds
                               → thresholds:update ────→ Save to thresholds.json
                                                         Update in-memory dict
                               ← thresholds:ack ←──────┘
                                                         main.py calls get_thresholds()
                                                         each 2s loop iteration

 On Pi boot:
   1. Load thresholds.json (if exists)
   2. Fallback to config.py defaults
   3. On hub connect → receive thresholds:update from DB → overwrite local

 On hub restart:
   Thresholds survive in PostgreSQL → pushed to each Pi on reconnect
```

---

## 6. Database Schema

PostgreSQL 16, initialized automatically by `hub/init.sql` on first Docker start.

**`telco_sites`**
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | e.g. `site-001` |
| name | TEXT | e.g. `North Ridge Tower` |
| location | TEXT | GPS or description |
| status | TEXT | `online`, `warning`, `critical`, `offline` |
| thresholds | JSONB | Per-site threshold overrides (nullable) |
| created_at | TIMESTAMPTZ | Auto-set |

**`telco_sensor_readings`**
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-increment |
| site_id | TEXT FK | References `telco_sites(id)` |
| sensor_type | TEXT | `temperature`, `humidity`, `smoke` |
| value | DOUBLE PRECISION | Sensor reading |
| timestamp | BIGINT | Unix ms |

**Indexes:** `(site_id, timestamp DESC)`, `(sensor_type)`

---

## 7. Implemented File Changes

### New Files
| File | Purpose |
|------|---------|
| `hub/src/services/statusService.js` | Shared `deriveStatus(sensors, thresholds)` logic |
| `hub/src/socket/piHandler.js` | `/pi` namespace — auto-register, ingest, threshold push |
| `hub/src/socket/dashboardHandler.js` | `/dashboard` namespace — sites list, threshold edits |
| `hub/src/db.js` | PostgreSQL connection pool (`pg.Pool`) |
| `hub/init.sql` | Database schema (auto-run by Docker) |
| `hub/docker-compose.yml` | PostgreSQL + Hub containers |
| `hub/Dockerfile` | Multi-stage: build React + run Express |
| `hub/templates/src/lib/socket.ts` | Socket.IO client singleton for dashboard |
| `hub/templates/src/components/ThresholdEditor.tsx` | Remote threshold editor UI |
| `thresholds.py` | Pi-side threshold manager (file + memory, thread-safe) |

### Modified Files
| File | Change |
|------|--------|
| `hub/src/index.js` | `http.createServer()` + Socket.IO + static file serving |
| `hub/src/routes/ingest.js` | Raw SQL via `pg`, shared `deriveStatus()` |
| `hub/src/routes/sites.js` | Raw SQL, returns `thresholds` + `connected` fields |
| `hub/package.json` | Replaced `@supabase/supabase-js` with `pg`, added `socket.io` |
| `hub/templates/package.json` | Added `socket.io-client` |
| `hub/templates/src/App.tsx` | Socket.IO listeners replace polling |
| `hub/templates/src/components/Sidebar.tsx` | Live `connected` field for status |
| `hub/templates/src/types.ts` | Added `Thresholds` interface, `connected` field |
| `hub/templates/src/constants.ts` | `API_BASE_URL` defaults to `''` (same origin) |
| `config.py` | Added `SOCKET_URL`, `SITE_NAME`, `SITE_LOCATION`, threshold constants |
| `requirements.txt` | Added `python-socketio[client]` |
| `services/transmitter.py` | Full rewrite — Socket.IO client with background thread |
| `main.py` | Dynamic thresholds via `get_thresholds()`, thread-based transmitter |

### Untouched Files
| File | Reason |
|------|--------|
| `ems.service`, `ems-splash.service` | systemd config — no changes needed |
| `boot_splash.py` | LCD splash screen — no changes needed |
| `actuators/lcd_display.py` | LCD I2C config unchanged |
| `actuators/buzzer.py`, `actuators/fan.py` | Actuator logic unchanged |
| `sensors/dht_sensor.py`, `sensors/mq2_sensor.py` | Sensor drivers unchanged |

---

## 8. Deployment Architecture

```
┌─ Google Compute Engine VM ──────────────────────┐
│                                                  │
│  Docker Compose                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  PostgreSQL   │    │  Hub (Express+React)   │  │
│  │  :5432        │◄───│  :3001                 │  │
│  │  (pg_data vol)│    │  - Socket.IO server    │  │
│  └──────────────┘    │  - REST API             │  │
│                       │  - Static dashboard     │  │
│                       └────────────────────────┘  │
│                              ▲                    │
└──────────────────────────────┼────────────────────┘
                               │ port 3001 (firewall open)
              ┌────────────────┼────────────────┐
              │                │                │
         Pi Site A        Browser (NOC)    Pi Site B
         WS /pi           WS /dashboard    WS /pi
```

**Deploy commands:**
```bash
# On VM
git clone --no-checkout --filter=blob:none https://github.com/perried/Embedded-System-Project.git ems_project
cd ems_project && git sparse-checkout init --cone && git sparse-checkout set hub && git checkout main
cd hub && cp .env.example .env && docker compose up -d --build
```

**Update commands:**
```bash
cd ~/ems_project && git pull && cd hub && docker compose up -d --build
```

---

## 9. Verification Checklist

- [x] Start server, connect 2+ Pi — both appear in sidebar with green indicators
- [x] Disconnect one Pi — turns grey/offline within seconds (not 5 minutes)
- [x] Edit thresholds from dashboard — Pi receives, writes `thresholds.json`, applies immediately
- [x] Restart Pi — loads thresholds from `thresholds.json` (not defaults)
- [x] Restart server — thresholds persist in PostgreSQL, pushed to Pi on reconnect
- [x] Sensor data appears in dashboard in real-time (~2s latency)
- [x] REST routes still work (`GET /api/sites`, `POST /api/ingest`)
- [x] Firebase push notifications fire for warning/critical states
- [x] LCD display, buzzer, fan all work as before
- [x] Docker Compose deploys both PostgreSQL and hub on GCE
- [x] React dashboard built in Docker and served from same port :3001
