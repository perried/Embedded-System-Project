# TRSMS — Hub-and-Spoke WebSocket Architecture Plan

## Overview

Replace the current one-way HTTP POST transmitter with a **bidirectional Socket.IO hub-and-spoke** model.

```
                    ┌─────────┐
                    │  Pi #1  │
                    └────┬────┘
                         │ Socket.IO (/pi)
    ┌─────────┐    ┌─────┴──────┐    ┌─────────┐
    │  Pi #2  ├────┤  EXPRESS   ├────┤  Pi #4  │
    └─────────┘    │   SERVER   │    └─────────┘
                   │   (HUB)    │
    ┌─────────┐    │            │
    │  Pi #3  ├────┤            │
    └─────────┘    └─────┬──────┘
                         │ Socket.IO (/dashboard)
                    ┌────┴────┐
                    │ REACT   │
                    │DASHBOARD│
                    └─────────┘
```

- **Hub** = Node.js Express server (hosted on **Render** — supports WebSockets, free tier)
- **Spokes** = Raspberry Pi devices running `python-socketio`
- **Dashboard** = React/Vite app connecting via `socket.io-client`

### Why NOT Vercel or PythonAnywhere?

| Platform        | Problem                                                              |
|-----------------|----------------------------------------------------------------------|
| **Vercel**      | Serverless only — functions timeout (10-60s), no persistent WS conns |
| **PythonAnywhere** | No WebSocket support; Python-focused (our backend is Node.js)     |
| **Render** ✅    | Always-on web service, WebSocket support, Node.js, free tier         |

---

## What Changes

| Component | Current | New |
|-----------|---------|-----|
| Pi → Server | HTTP POST every 30s (`services/transmitter.py`) | Socket.IO client, emits `sensor:data` every 2s |
| Server → Dashboard | REST polling every 10s (`GET /api/sites`) | Socket.IO push — real-time `site:data` events |
| Server → Pi | None (one-way) | Socket.IO push — `thresholds:update` events |
| Site registration | Manual (pre-create in DB) | Auto-register on Pi connect (upsert) |
| Thresholds on Pi | Hardcoded `config.py` | Defaults in `config.py`, overridable from dashboard, persisted locally as `thresholds.json` |
| Thresholds on Server | Hardcoded in `ingest.js` and `sites.js` | Per-site JSONB column in `telco_sites`, editable from dashboard |
| Status detection | 5-minute timeout heuristic | Instant — WS disconnect = offline |

## What Does NOT Change

- **systemd service files** (`ems.service`, `ems-splash.service`) — untouched
- **LCD display configuration** (`actuators/lcd_display.py`, `LCD_I2C_ADDR`, `LCD_COLS`, `LCD_ROWS`) — untouched
- **Sensor reading code** (`sensors/dht_sensor.py`, `sensors/mq2_sensor.py`) — untouched
- **Actuator control** (`actuators/buzzer.py`, `actuators/fan.py`) — untouched
- **PostgreSQL** for persistence — `telco_sites` and `telco_sensor_readings` tables
- **Firebase push notifications** — still triggered server-side
- **REST routes** (`/api/ingest`, `/api/sites`) — kept for backward compat / initial hydration

---

## Socket.IO Event Protocol

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `sensor:data` | Pi → Hub | `{siteId, sensors: {temperature, humidity, smoke}, timestamp}` | Stream readings every 2s |
| `thresholds:update` | Hub → Pi | `{temp_fan_on, temp_warning, temp_critical, humidity_warning, smoke_critical}` | Push threshold changes |
| `thresholds:ack` | Pi → Hub | `{siteId, thresholds}` | Confirm thresholds applied on Pi |
| `site:data` | Hub → Dashboard | `{siteId, sensors, status, timestamp}` | Real-time sensor push |
| `site:status` | Hub → Dashboard | `{siteId, status, connected}` | Connect/disconnect events |
| `sites:list` | Hub → Dashboard | `[{id, name, location, status, connected, thresholds}]` | Full site list on dashboard connect |
| `thresholds:set` | Dashboard → Hub | `{siteId, thresholds}` | User edits thresholds from UI |
| `site:subscribe` | Dashboard → Hub | `{siteId}` | Subscribe to a specific site's stream |

---

## Threshold Flow

```
 Dashboard UI                Server (Hub)              Raspberry Pi
 ────────────                ───────────               ─────────────
 User edits thresholds
  → emit thresholds:set ────→ Save to PostgreSQL
                              telco_sites.thresholds
                               → emit thresholds:update ───→ Save to thresholds.json
                                                             Update in-memory
                               ←── emit thresholds:ack  ←──┘
                                                             main.py reads get_thresholds()
                                                             each loop iteration

 On Pi boot:
   1. Load thresholds.json (if exists)
   2. Fallback to config.py defaults
   3. On server connect → receive thresholds:update from DB → overwrite local

 On server restart:
   Thresholds survive in PostgreSQL → pushed to Pi on reconnect
```

---

## Database Change

**Add `thresholds` JSONB column to `telco_sites`** (default: `NULL`):

```sql
ALTER TABLE telco_sites
ADD COLUMN thresholds JSONB DEFAULT NULL;
```

Schema when populated:
```json
{
  "temp_fan_on": 29.5,
  "temp_warning": 38,
  "temp_critical": 45,
  "humidity_warning": 70,
  "smoke_critical": 0.5
}
```

When `NULL`, the server/Pi use built-in defaults.

---

## Implementation Steps

### Phase 1 — Server (Node.js Hub)

#### 1.1 Install dependency
```bash
cd frontend && npm install socket.io
```

#### 1.2 Create `frontend/src/services/statusService.js`
Extract hardcoded threshold logic from `ingest.js` into a shared function:
- `deriveStatus(sensors, thresholds)` → returns `'online' | 'warning' | 'critical'`
- Accepts per-site thresholds with fallback defaults
- Used by both the Socket handler and the REST ingest route

#### 1.3 Create `frontend/src/socket/piHandler.js`
Handles the `/pi` namespace:
- **`connection`**: Read `{siteId, siteName, location}` from `socket.handshake.auth`. Join room `siteId`. Upsert into `telco_sites` (auto-register). Push stored thresholds via `thresholds:update`. Broadcast `site:status {connected: true}` to dashboard namespace.
- **`sensor:data`**: Receive sensor readings. Insert into `telco_sensor_readings`. Derive status via `statusService`. Update `telco_sites.status`. Broadcast `site:data` to `/dashboard` room. Trigger Firebase notification if warning/critical.
- **`thresholds:ack`**: Log confirmation.
- **`disconnect`**: Update `telco_sites.status = 'offline'`. Broadcast `site:status {connected: false}` to dashboard.
- Track connected sockets in `Map<siteId, socketId>`.

#### 1.4 Create `frontend/src/socket/dashboardHandler.js`
Handles the `/dashboard` namespace:
- **`connection`**: Emit `sites:list` with all sites + connected status from Pi handler map.
- **`site:subscribe`**: Join room for that siteId.
- **`thresholds:set`**: Persist to `telco_sites.thresholds` in PostgreSQL. Forward `thresholds:update` to target Pi via `/pi` namespace.
- Receives broadcasts from Pi handler (site:data, site:status).

#### 1.5 Update `frontend/src/index.js`
- Wrap Express app with `http.createServer()`
- Attach `socket.io` Server with CORS config
- Create `/pi` and `/dashboard` namespaces
- Pass to handlers
- Keep existing REST routes working

#### 1.6 Update `frontend/src/routes/ingest.js`
- Import and use `deriveStatus()` from statusService instead of inline logic

#### 1.7 Update `frontend/src/routes/sites.js`
- Include `thresholds` field from `telco_sites` in the response

---

### Phase 2 — Pi (Python Spoke)

#### 2.1 Install dependency
```bash
pip install python-socketio[client] requests
```
Add `python-socketio[client]` to `requirements.txt`.

#### 2.2 Create `thresholds.py` (threshold manager)
- `load_thresholds()` → Read `thresholds.json`, fallback to `config.py` defaults
- `save_thresholds(data)` → Write to `thresholds.json`
- `get_thresholds()` → Return current in-memory thresholds (thread-safe)
- `update_thresholds(new)` → Merge, save to file, update in-memory

#### 2.3 Rewrite `services/transmitter.py`
- Connect to `{SOCKET_URL}` on `/pi` namespace with auth `{siteId, siteName, location}`
- On `connect`: start emitting `sensor:data` every 2s (read `/tmp/sensor_data.json`)
- On `thresholds:update`: call `update_thresholds()`, emit `thresholds:ack`
- On `disconnect`: stop emitting, Socket.IO auto-reconnects
- Run as a background thread (not subprocess)

#### 2.4 Update `config.py`
- Add `SOCKET_URL` (e.g. `http://<VM-EXTERNAL-IP>:3001`)
- Add `SITE_NAME` and `SITE_LOCATION` for auto-registration
- Keep existing threshold constants as defaults only

#### 2.5 Update `main.py`
- Import `thresholds.get_thresholds()` instead of using `config.TEMP_FAN_ON` directly
- Start transmitter as a background **thread** (not subprocess)
- Each loop iteration calls `get_thresholds()` for latest values
- Remove subprocess spawn logic, replace with thread start

#### 2.6 Keep `transmitter.py` (root level)
- Leave the root-level `transmitter.py` as-is or deprecate it — it's a legacy class

---

### Phase 3 — Frontend (React Dashboard)

#### 3.1 Install dependency
```bash
cd frontend/templates && npm install socket.io-client
```

#### 3.2 Create `frontend/templates/src/lib/socket.ts`
- Socket.IO client singleton connecting to `/dashboard` namespace
- Typed event helpers: `onSiteData()`, `onSiteStatus()`, `onSitesList()`, `emitThresholdsSet()`, `subscribeSite()`

#### 3.3 Update `frontend/templates/src/types.ts`
- Add `Thresholds` interface
- Add `thresholds?: Thresholds` and `connected?: boolean` to `SiteStatus`

#### 3.4 Update `frontend/templates/src/App.tsx`
- Replace `setInterval(fetchSites, 10000)` with Socket.IO listeners
- One-time `GET /api/sites` for initial hydration (history data)
- Live updates via `site:data` and `site:status` events
- Subscribe to selected site's room

#### 3.5 Create `frontend/templates/src/components/ThresholdEditor.tsx`
- Renders in the dashboard when a site is selected
- Shows current thresholds with editable input fields:
  - `temp_fan_on` — Fan activation temperature
  - `temp_warning` — Temperature warning level
  - `temp_critical` — Temperature critical level
  - `humidity_warning` — Humidity warning level
- "Apply" button emits `thresholds:set` via socket
- Shows Pi ack confirmation or "Pi offline — will apply on next connect"

#### 3.6 Update `frontend/templates/src/components/Sidebar.tsx`
- Show real-time connected/disconnected indicator (green = WS connected, grey = disconnected)
- Replace the 5-minute timeout heuristic with live `connected` field

#### 3.7 Update `frontend/templates/src/constants.ts`
- Update `API_BASE_URL` default if deploying to Render

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/services/statusService.js` | Shared status derivation logic |
| `frontend/src/socket/piHandler.js` | Pi namespace Socket.IO handler |
| `frontend/src/socket/dashboardHandler.js` | Dashboard namespace Socket.IO handler |
| `frontend/templates/src/lib/socket.ts` | Socket.IO client singleton |
| `frontend/templates/src/components/ThresholdEditor.tsx` | Threshold editor UI |
| `thresholds.py` | Pi-side threshold manager |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/index.js` | Add Socket.IO server, create namespaces |
| `frontend/src/routes/ingest.js` | Use shared `deriveStatus()` |
| `frontend/src/routes/sites.js` | Return `thresholds` field |
| `frontend/package.json` | Add `socket.io` |
| `frontend/templates/package.json` | Add `socket.io-client` |
| `frontend/templates/src/types.ts` | Add `Thresholds` type, update `SiteStatus` |
| `frontend/templates/src/App.tsx` | Replace polling with Socket.IO |
| `frontend/templates/src/components/Sidebar.tsx` | Live connected status |
| `config.py` | Add `SOCKET_URL`, `SITE_NAME`, `SITE_LOCATION` |
| `requirements.txt` | Add `python-socketio[client]` |
| `services/transmitter.py` | Full rewrite — Socket.IO client |
| `main.py` | Dynamic thresholds, thread-based transmitter |
| `thresholds.py` | New — threshold manager |

### Untouched Files
| File | Reason |
|------|--------|
| `ems.service` | systemd — do not touch |
| `ems-splash.service` | systemd — do not touch |
| `boot_splash.py` | Splash screen — no changes needed |
| `actuators/lcd_display.py` | LCD config stays the same |
| `actuators/buzzer.py` | No changes needed |
| `actuators/fan.py` | No changes needed |
| `sensors/dht_sensor.py` | No changes needed |
| `sensors/mq2_sensor.py` | No changes needed |

---

## Verification Checklist

- [ ] Start server, connect 2+ Pi (or simulated `socketio` clients) — both appear in sidebar in real-time with green indicators
- [ ] Disconnect one Pi — turns grey/offline in sidebar within seconds (not 5 minutes)
- [ ] Edit thresholds from dashboard for a connected Pi — Pi receives them, writes `thresholds.json`, applies them (e.g. fan threshold changes)
- [ ] Restart Pi — loads thresholds from `thresholds.json` (not defaults)
- [ ] Restart server — thresholds still in PostgreSQL, pushed to Pi on reconnect
- [ ] Sensor data appears in dashboard in real-time (~2s latency, no 10s polling)
- [ ] REST routes still work (`GET /api/sites`, `POST /api/ingest`)
- [ ] Firebase push notifications still fire for warning/critical states
- [ ] LCD display, buzzer, fan all work as before
