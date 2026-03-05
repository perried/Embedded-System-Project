# TRSMS — File Reference

Complete documentation of every file in the Telecom Remote Site Monitoring System codebase.

---

## Table of Contents

- [Project Root (Raspberry Pi)](#project-root-raspberry-pi)
- [Sensors (`sensors/`)](#sensors-sensors)
- [Actuators (`actuators/`)](#actuators-actuators)
- [Services (`services/`)](#services-services)
- [Test Scripts](#test-scripts)
- [systemd Service Files](#systemd-service-files)
- [Hub Server (`hub/`)](#hub-server-hub)
  - [Server Source (`hub/src/`)](#server-source-hubsrc)
  - [Socket Handlers (`hub/src/socket/`)](#socket-handlers-hubsrcsocket)
  - [REST Routes (`hub/src/routes/`)](#rest-routes-hubsrcroutes)
  - [Server Services (`hub/src/services/`)](#server-services-hubsrcservices)
- [Dashboard Frontend (`hub/templates/`)](#dashboard-frontend-hubtemplates)
  - [React Components (`hub/templates/src/components/`)](#react-components-hubtemplatessrccomponents)
  - [Libraries (`hub/templates/src/lib/`)](#libraries-hubtemplatessrclib)
- [Docker & DevOps](#docker--devops)
- [Documentation (`docs/`)](#documentation-docs)

---

## Project Root (Raspberry Pi)

### `main.py`
**Purpose:** Main application entry point for the Raspberry Pi sensor node.

Initialises all hardware (DHT11, MQ2, fan relay, buzzer, LCD), starts the Socket.IO transmitter as a background thread, then enters an infinite loop that:
1. Reads temperature/humidity from the DHT11 sensor
2. Reads gas detection status from the MQ2 sensor
3. Writes sensor data to `/tmp/sensor_data.json` for the transmitter
4. Evaluates dynamic thresholds (from dashboard or local config)
5. Controls the fan relay (temperature or gas) and buzzer (gas only)
6. Updates the terminal and LCD display

On shutdown (Ctrl+C or SIGTERM), cleans up all GPIO and stops the transmitter.

**Key functions:**
- `print_header()` — Prints a startup banner with current thresholds and hub URL
- `print_status()` — Prints a single-line sensor/actuator status to terminal
- `write_sensor_data()` — Writes JSON to `/tmp/sensor_data.json` for the transmitter thread
- `main()` — Initialises hardware, starts transmitter, runs the sensor loop

**Dependencies:** `config`, `sensors.dht_sensor`, `sensors.mq2_sensor`, `actuators.buzzer`, `actuators.fan`, `actuators.lcd_display`, `thresholds`, `services.transmitter`

---

### `config.py`
**Purpose:** Central configuration file for all hardware pins, thresholds, and connection settings.

Contains all constants needed to configure the Pi node:
- **GPIO pins:** DHT11 (GPIO 4), buzzer (GPIO 17), fan relay (GPIO 27), MQ2 (GPIO 22)
- **LCD settings:** I2C address (0x27), 20 columns × 4 rows
- **Default thresholds:** Fan activation (29.5°C), temperature warning (38°C), critical (45°C), humidity warning (70%), smoke critical (0.5)
- **Timing:** `READ_INTERVAL = 2` seconds
- **Backend:** `SITE_ID`, `SITE_NAME`, `SITE_LOCATION`, `SOCKET_URL`, `API_KEY`

Thresholds here serve as ultimate fallbacks — they can be overridden from the dashboard via Socket.IO.

---

### `thresholds.py`
**Purpose:** Thread-safe threshold manager with 3-tier fallback.

Manages sensor thresholds that determine when alarms trigger. Uses a priority system:
1. **Dashboard-pushed values** (received via Socket.IO, highest priority)
2. **Local `thresholds.json` file** (survives Pi reboot)
3. **`config.py` defaults** (ultimate fallback)

**Key functions:**
- `load_thresholds()` — Called once at import time; loads from file or falls back to defaults
- `save_thresholds(dict)` — Persists thresholds to `thresholds.json`
- `get_thresholds()` — Returns a thread-safe copy of current thresholds (called every 2s by main loop)
- `update_thresholds(new)` — Merges new values, saves to file, updates in-memory (called by transmitter on `thresholds:update`)

**Thread safety:** Uses `threading.Lock` — the main loop reads thresholds while the transmitter thread writes them.

---

### `boot_splash.py`
**Purpose:** LCD boot splash screen displayed during Pi startup.

Runs as an early systemd service (`ems-splash.service`) before the main application. Shows boot progress on the 20×4 LCD:
1. "Pi is booting…" message
2. "Connecting to network…" with animated dots
3. Network connectivity check (pings 8.8.8.8)
4. IP address display on successful connection, or timeout message after 60 seconds

**Key functions:**
- `centre(text)` — Centre-pads text to LCD width
- `init_lcd()` — Creates CharLCD with retries (I2C may not be ready at boot)
- `write_lines(lcd, lines)` — Writes up to 4 lines to the LCD
- `has_network()` — Checks connectivity by pinging 8.8.8.8
- `main()` — Orchestrates the boot splash sequence

---

### `requirements.txt`
**Purpose:** Python dependencies for the Raspberry Pi.

Packages:
- `adafruit-circuitpython-dht` — DHT11 sensor driver
- `adafruit-blinka` — CircuitPython compatibility layer for Pi
- `gpiozero` — High-level GPIO library (buzzer, fan relay)
- `RPi.GPIO` — Low-level GPIO (MQ2 sensor)
- `RPLCD` — LCD display driver
- `smbus2` — I2C communication
- `python-socketio[client]` — Socket.IO client for hub communication

Install: `pip install -r requirements.txt`

---

## Sensors (`sensors/`)

### `sensors/__init__.py`
Empty package initialiser. Makes `sensors/` a Python package.

### `sensors/dht_sensor.py`
**Purpose:** DHT11 temperature and humidity sensor driver.

Reads temperature (°C) and relative humidity (%) using the Adafruit CircuitPython DHT library. Includes a last-good-value cache — when the DHT11 throws a checksum error (common), returns the previous successful reading instead of `None`. This prevents actuators from flapping off during transient errors.

**Wiring:** DHT11 DATA → GPIO 4 (with 10kΩ pull-up to 3.3V)

**Class `DHTSensor`:**
- `__init__(pin)` — Maps GPIO number to board pin, creates DHT11 device
- `read()` → `{"temperature": float|None, "humidity": float|None}` — Reads sensor, returns cached value on error
- `cleanup()` — Release resources (inherited from adafruit driver)

---

### `sensors/mq2_sensor.py`
**Purpose:** MQ-2 gas/smoke sensor driver (digital output only).

Reads the digital output (DO) pin of the MQ-2 module. The detection threshold is set by the potentiometer on the MQ2 board itself — this code only reads the binary result.

**DO behaviour:** LOW = gas detected (active-LOW), HIGH = normal

**Wiring:** MQ2 DO → GPIO 22

**Class `MQ2Sensor`:**
- `__init__(pin)` — Sets up GPIO input (no pull-up/down)
- `read()` → `{"gas_detected": bool}` — True when DO is LOW
- `cleanup()` — Releases GPIO resources

Includes a standalone test mode (`python sensors/mq2_sensor.py`).

---

## Actuators (`actuators/`)

### `actuators/__init__.py`
Empty package initialiser. Makes `actuators/` a Python package.

### `actuators/buzzer.py`
**Purpose:** Active buzzer controller for gas/smoke alerts.

Uses `gpiozero.Buzzer` to control an active buzzer on GPIO 17. Only sounds when gas/smoke is detected — never for temperature-only events.

**Wiring:** Buzzer + → GPIO 17 (through transistor/driver if needed), Buzzer − → GND

**Class `Buzzer`:**
- `turn_on()` — Continuous buzzer activation
- `turn_off()` — Silence the buzzer
- `beep(on_time, off_time, n)` — Intermittent alarm pattern
- `is_active` — Property: True if currently sounding
- `cleanup()` — Release GPIO resources

Includes a standalone test mode (`python actuators/buzzer.py`).

---

### `actuators/fan.py`
**Purpose:** Exhaust/cooling fan controller via relay module.

Controls a fan through a relay module on GPIO 27. Has a special workaround: the relay module energises on ANY driven GPIO state (both HIGH and LOW) because Pi's 3.3V output cannot pull the optocoupler high enough. Solution: switches between OUTPUT mode (relay ON) and floating/INPUT mode (relay OFF).

**Wiring:** Relay IN → GPIO 27, Relay VCC → 5V, Relay GND → GND, Relay NO/COM → Fan circuit

**Class `Fan`:**
- `turn_on()` — Claims GPIO pin as output → relay energised → fan ON
- `turn_off()` — Releases GPIO pin (floating) → relay de-energised → fan OFF
- `is_active` — Property: True if relay is energised
- `cleanup()` — De-energise relay and release resources

Includes a standalone test mode (`python actuators/fan.py`).

---

### `actuators/lcd_display.py`
**Purpose:** 20×4 I2C LCD display driver with retry logic.

Controls a 20×4 character LCD via a PCF8574 I2C backpack using the RPLCD library. Features robust error handling — retries I2C operations up to 3 times, and re-initialises the LCD connection on repeated failures. If the LCD is physically disconnected, the application continues to run without it.

**Wiring (I2C):** SDA → GPIO 2, SCL → GPIO 3, VCC → 5V, GND → GND

**Class `LCDDisplay`:**
- `__init__(address, cols, rows)` — Initialises LCD with up to 5 retry attempts
- `available` — Property: True if LCD was successfully initialised
- `show_status(temp, humidity, gas_detected, fan_on, buzzer_on)` — Updates LCD with current sensor/actuator state
- `show_message(line0, line1, line2, line3)` — Display arbitrary text across 4 lines
- `clear()` — Clear the display
- `cleanup()` — Clear display and release resources
- `_safe_call(fn)` — Internal: retries I2C calls, re-creates LCD connection on failure

Includes a standalone test mode (`python actuators/lcd_display.py`).

---

## Services (`services/`)

### `services/transmitter.py`
**Purpose:** Socket.IO client that connects to the TRSMS hub and streams sensor data.

Runs as a background daemon thread started by `main.py`. Connects to the hub's `/pi` namespace with site credentials (siteId, siteName, location) and:
- **Emits `sensor:data`** every 2 seconds (reads `/tmp/sensor_data.json`)
- **Listens for `thresholds:update`** from the dashboard → calls `update_thresholds()` and sends `thresholds:ack`
- **Auto-reconnects** on disconnect (infinite retries, exponential backoff up to 30s)

Can also run standalone with `--simulate` flag for testing without hardware.

**Class `SocketTransmitter`:**
- `__init__(simulate)` — Creates Socket.IO client with event handlers
- `connect()` — Connects to hub with site auth credentials
- `start()` — Connects and starts the emit loop in a background thread
- `stop()` — Stops the loop and disconnects
- `_emit_loop()` — Background loop: reads sensor data, emits to hub

**Helper functions:**
- `read_sensor_data()` — Reads and validates `/tmp/sensor_data.json`
- `simulate_sensor_data()` — Generates random sensor values for testing

---

## Test Scripts

### `test_buzzer.py`
**Purpose:** GPIO 17 buzzer diagnostic.

Tests both HIGH and LOW states on GPIO 17 to determine which activates the buzzer. Runs 4 tests: HIGH steady, LOW steady, HIGH pulse pattern, LOW pulse pattern. Helps diagnose wiring (active-HIGH vs active-LOW).

### `test_relay.py`
**Purpose:** GPIO 27 relay diagnostic.

Tests both HIGH and LOW states on GPIO 27 to determine which activates the relay module. Helps determine if the relay is active-HIGH or active-LOW.

### `test_mq2.py`
**Purpose:** MQ-2 sensor digital output diagnostic.

Reads GPIO 22 every second for 30 seconds and reports the state. Used to verify wiring and calibrate the MQ2 potentiometer sensitivity threshold.

### `test_lcd.py`
**Purpose:** LCD display test.

Cycles through 5 sample screens on the 20×4 LCD: startup message, normal readings, high temp with fan, gas detection, and sensor error state. Uses the `LCDDisplay` class from `actuators/`.

---

## systemd Service Files

### `ems.service`
**Purpose:** Main application systemd service unit.

Runs `main.py` as the primary monitoring daemon. Configuration:
- **Type:** `simple` (long-running foreground process)
- **User:** `groupmmsp`
- **WorkingDirectory:** `/home/groupmmsp/ems`
- **ExecStartPre:** `sleep 5` (allows hardware to settle)
- **ExecStart:** `.venv/bin/python3 main.py`
- **Restart:** `on-failure` with 10-second delay
- **After:** `network-online.target`, `ems-splash.service` (waits for network and splash)
- **Requires:** `ems-splash.service` (splash must complete first)
- **Output:** Journal (viewable with `journalctl -u ems`)

**Commands:**
```bash
sudo systemctl enable ems          # Enable on boot
sudo systemctl start ems           # Start now
sudo systemctl status ems          # Check status
sudo journalctl -u ems -f          # Tail logs
```

### `ems-splash.service`
**Purpose:** Boot splash systemd service unit.

Runs `boot_splash.py` as a one-shot service early in the boot sequence, before the network is up. Shows boot progress messages on the LCD.

- **Type:** `oneshot` (runs once and exits)
- **User:** `groupmmsp`
- **DefaultDependencies:** `no` (runs very early)
- **After:** `local-fs.target` (filesystem must be mounted)
- **Before:** `network-online.target`, `ems.service`
- **TimeoutStartSec:** `120` (allows time for network wait)
- **ExecStart:** `.venv/bin/python3 boot_splash.py`

**Boot sequence:** `local-fs.target` → `ems-splash.service` (LCD splash) → `network-online.target` → `ems.service` (main app)

---

## Hub Server (`hub/`)

### `hub/package.json`
**Purpose:** Node.js project configuration for the hub server.

- **Name:** `trsms-hub`
- **Type:** ES modules (`"type": "module"`)
- **Entry:** `src/index.js`
- **Scripts:** `npm start` (production), `npm run dev` (watch mode)
- **Dependencies:** express, socket.io, pg (PostgreSQL), cors, dotenv, firebase-admin
- **Engine:** Node.js ≥ 18

---

### Server Source (`hub/src/`)

#### `hub/src/index.js`
**Purpose:** Express + Socket.IO server entry point.

Creates the HTTP server, attaches Socket.IO with CORS, creates `/pi` and `/dashboard` namespaces, mounts REST routes, and serves the built React dashboard as static files.

**Responsibilities:**
- HTTP server creation (required for Socket.IO)
- Socket.IO namespace setup (`/pi` for Pi devices, `/dashboard` for browser clients)
- REST route mounting (`/api/ingest`, `/api/sites`, `/health`)
- Static file serving (built React dashboard from `public/`)
- SPA fallback (all non-API routes serve `index.html`)

**Listens on:** Port 3001 (configurable via `PORT` env var)

#### `hub/src/db.js`
**Purpose:** PostgreSQL connection pool.

Creates a `pg.Pool` with up to 20 connections. Configuration via environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Performs a connectivity check on startup (`SELECT NOW()`). Logs unexpected pool errors.

---

### Socket Handlers (`hub/src/socket/`)

#### `hub/src/socket/piHandler.js`
**Purpose:** Socket.IO handler for the `/pi` namespace — Pi device connections.

Manages Pi device connections, sensor data ingestion, and threshold distribution. Each Pi authenticates with `{siteId, siteName, location}` in the handshake.

**On connection:**
1. Validates `siteId` (rejects if missing)
2. Tracks socket in `connectedPis` Map
3. Auto-registers site in PostgreSQL (`INSERT ... ON CONFLICT DO UPDATE`)
4. Pushes stored thresholds from DB to the Pi
5. Notifies dashboard namespace of new connection

**On `sensor:data`:**
1. Validates and normalises sensor readings
2. Batch-inserts readings into `telco_sensor_readings`
3. Derives site status using `deriveStatus()` with per-site thresholds
4. Updates `telco_sites.status`
5. Broadcasts `site:data` to dashboard namespace
6. Triggers Firebase push notification for warning/critical

**On disconnect:** Sets site to `offline`, broadcasts `site:status` to dashboard.

**Exports:** `getConnectedSiteIds()`, `isSiteConnected(siteId)`, `getPiNamespace()`

#### `hub/src/socket/dashboardHandler.js`
**Purpose:** Socket.IO handler for the `/dashboard` namespace — browser client connections.

Manages browser dashboard connections, site subscriptions, and threshold editing.

**On connection:** Queries all sites from PostgreSQL, enriches with live `connected` status from Pi handler, emits `sites:list`.

**On `site:subscribe`:** Joins the socket to a site-specific room for targeted data streaming. Leaves all previous room subscriptions.

**On `thresholds:set`:**
1. Validates payload (requires `siteId` and `thresholds` object)
2. Persists thresholds to `telco_sites.thresholds` (JSONB)
3. Forwards `thresholds:update` to the target Pi via `/pi` namespace
4. Confirms back to requesting client (`thresholds:saved`)
5. Broadcasts to all dashboard clients (`thresholds:updated`)

---

### REST Routes (`hub/src/routes/`)

#### `hub/src/routes/ingest.js`
**Purpose:** Legacy REST endpoint for sensor data ingestion.

`POST /api/ingest` — Accepts sensor readings from Pi devices that haven't been migrated to Socket.IO. Protected by `X-API-Key` header authentication.

**Request body:** `{ siteId, sensors: { temperature, humidity, smoke } }`

**Flow:** Validates API key → validates payload → batch-inserts readings → derives status using `deriveStatus()` → updates site status → triggers Firebase notification if abnormal.

#### `hub/src/routes/sites.js`
**Purpose:** REST endpoint for dashboard data hydration.

`GET /api/sites` — Returns all sites with their latest sensor values, reading history (last 100 per sensor type), thresholds, and live connection status. Used by the React dashboard for initial page load (history data not available via Socket.IO).

---

### Server Services (`hub/src/services/`)

#### `hub/src/services/statusService.js`
**Purpose:** Shared status derivation logic.

Determines a site's status (`online`, `warning`, or `critical`) from sensor readings and thresholds. Used by both the REST ingest route and the Socket.IO pi handler to ensure consistent status logic.

**Functions:**
- `resolveThresholds(siteThresholds)` — Merges per-site thresholds with defaults
- `deriveStatus(sensors, siteThresholds)` → `'online' | 'warning' | 'critical'`
- `DEFAULT_THRESHOLDS` — Fallback values: temp_warning=38, temp_critical=45, humidity_warning=70, smoke_critical=0.5

**Status logic:** `critical` if temp > 45°C or smoke > 0.5; `warning` if temp > 38°C or humidity > 70%; else `online`.

#### `hub/src/services/notificationService.js`
**Purpose:** Firebase Cloud Messaging push notification service.

Sends push notifications to the `alerts` FCM topic when a site enters warning or critical status. Supports two Firebase credential methods: JSON string in env (for Docker/cloud) or file path (for local dev).

**Function:** `sendPushNotification(siteName, level, sensors)` — Formats and sends an FCM message with high priority, smoke alert prefix if applicable, and temperature/humidity details.

Gracefully degrades — if no Firebase credentials are configured, notifications are silently disabled.

---

## Dashboard Frontend (`hub/templates/`)

### `hub/templates/package.json`
**Purpose:** React dashboard project configuration.

- **Name:** `trsms-dashboard`
- **Framework:** React 19 + Vite 6 + TypeScript
- **Scripts:** `npm run dev` (dev server :3000), `npm run build` (production), `npm run lint`
- **Dependencies:** react, react-dom, recharts (charts), socket.io-client, lucide-react (icons), motion (animations), tailwind-merge, clsx, date-fns

### `hub/templates/tsconfig.json`
**Purpose:** TypeScript compiler configuration. Targets ES2022, uses ESNext modules with bundler resolution.

### `hub/templates/vite.config.ts`
**Purpose:** Vite build configuration. Plugins: React + Tailwind CSS v4. Defines `@` path alias to project root.

### `hub/templates/src/main.tsx`
**Purpose:** React application mount point. Renders `<App />` inside `<StrictMode>` into the `#root` DOM element.

### `hub/templates/src/index.css`
**Purpose:** Global CSS with Tailwind CSS v4 import and CSS custom properties.

Defines light and dark theme variables for backgrounds, text colours, and borders. The dark theme is the default. Variables are toggled by adding `.dark` class to the root element.

### `hub/templates/src/types.ts`
**Purpose:** TypeScript type definitions shared across the dashboard.

**Types:**
- `SensorType` — `'temperature' | 'humidity' | 'smoke'`
- `SensorReading` — `{ timestamp, value }` for history arrays
- `Thresholds` — Per-site threshold values (5 fields)
- `SiteStatus` — Full site data structure (id, name, location, status, sensors with history, thresholds, connected)
- `Alert` — Alert notification (id, siteId, severity, message, resolved)

### `hub/templates/src/constants.ts`
**Purpose:** Application constants and mock data.

- `API_BASE_URL` — Reads from `VITE_API_BASE_URL` env var, defaults to `''` (same-origin, used in Docker)
- `MOCK_SITES` — Sample site data with generated history for development/demo

### `hub/templates/src/App.tsx`
**Purpose:** Root React component — the main dashboard application.

Orchestrates all dashboard functionality:
- **Initial hydration:** Fetches sites via `GET /api/sites` (includes history data)
- **Real-time updates:** Socket.IO listeners for `site:data`, `site:status`, `thresholds:updated`
- **Site selection:** Sidebar navigation with `site:subscribe` for targeted streaming
- **Theme:** Light/dark toggle, persisted to localStorage (`trsms_theme`)
- **Smoke alarm:** Audio siren when smoke is detected, with silence button
- **Alerts:** Derived from sensor readings, shown in alert panel
- **Threshold editor:** Opens a panel to edit per-site thresholds remotely

---

### React Components (`hub/templates/src/components/`)

#### `hub/templates/src/components/Sidebar.tsx`
**Purpose:** Site navigation sidebar.

Displays all registered sites with:
- Site name and location
- Live status indicator (green=online, amber=warning, red=critical+pulse, grey=offline)
- Last update timestamp
- Active site highlighted with emerald accent bar

Uses the WebSocket `connected` field for instant offline detection (replaces the old 5-minute timeout heuristic). Responsive — slides in/out on mobile.

#### `hub/templates/src/components/SensorCard.tsx`
**Purpose:** Individual sensor data card with chart.

Renders a card for each sensor type (temperature, humidity, smoke):
- **Temperature/Humidity:** Current value with trend arrow, Recharts area chart with history, threshold reference line, min/max/avg stats
- **Smoke:** Binary status (Clear/Detected), timeline bar showing 24h history colour-coded, last incident timestamp

Uses Recharts `AreaChart` with gradient fills. Alert styling when values exceed thresholds.

#### `hub/templates/src/components/ThresholdEditor.tsx`
**Purpose:** Remote threshold configuration panel.

Allows NOC operators to edit per-site thresholds from the dashboard:
- 4 input fields: fan activation temp, temp warning, temp critical, humidity warning
- "Apply" button emits `thresholds:set` via Socket.IO
- Shows Pi online/offline status
- Displays confirmation when server saves (`thresholds:saved`) and when Pi acknowledges (`thresholds:ack`)
- Timeout fallback if server doesn't respond within 5 seconds

#### `hub/templates/src/components/AlertPanel.tsx`
**Purpose:** Active alerts list panel.

Displays a scrollable list of current alerts with severity badges (warning/critical), timestamps, site names, and acknowledge buttons. Shows "No active alerts" with a green checkmark when empty.

#### `hub/templates/src/components/AlarmBanner.tsx`
**Purpose:** Critical smoke alarm banner.

A full-width red banner that appears at the top of the dashboard when smoke is detected at any site. Features animated flame icon, pulsing background, site name, and a "Silence Siren" button that mutes the audio alarm without dismissing the visual alert.

---

### Libraries (`hub/templates/src/lib/`)

#### `hub/templates/src/lib/socket.ts`
**Purpose:** Socket.IO client singleton and typed event helpers.

Creates a single Socket.IO connection to the `/dashboard` namespace with WebSocket transport (polling fallback), infinite reconnection, and exponential backoff (2s–30s).

**Event helpers (all return unsubscribe functions):**
- `onSitesList(cb)` — Full site list on initial connect
- `onSiteData(cb)` — Real-time sensor updates
- `onSiteStatus(cb)` — Site connect/disconnect events
- `onThresholdsSaved(cb)` — Server confirms threshold save
- `onThresholdsAck(cb)` — Pi confirms threshold application
- `onThresholdsUpdated(cb)` — Threshold change broadcast

**Emitters:**
- `subscribeSite(siteId)` — Subscribe to a site's data room
- `emitThresholdsSet(siteId, thresholds)` — Send threshold edit to server
- `disconnectSocket()` — Disconnect and clean up

#### `hub/templates/src/lib/utils.ts`
**Purpose:** Utility functions.

- `cn(...inputs)` — Merges Tailwind CSS class names using `clsx` + `tailwind-merge` to handle conflicting utility classes.

---

## Docker & DevOps

### `hub/Dockerfile`
**Purpose:** Multi-stage Docker build for the TRSMS hub.

- **Stage 1 (frontend-build):** Installs npm deps for the React dashboard, runs `vite build`, outputs to `/build/dist`
- **Stage 2 (production):** Installs server-only npm deps, copies server source + built dashboard into `/app/public/`
- **Result:** A single container that serves both the Express API/Socket.IO server and the React dashboard on port 3001

### `hub/docker-compose.yml`
**Purpose:** Docker Compose orchestration for the full hub stack.

Defines two services:
- **postgres:** PostgreSQL 16 Alpine with persistent volume (`pg_data`), healthcheck (`pg_isready`), `init.sql` mounted for schema auto-creation, bound to localhost:5432 only
- **hub:** TRSMS Express server, depends on healthy postgres, exposed on port 3001, env vars from `.env` file

### `hub/init.sql`
**Purpose:** PostgreSQL schema initialisation.

Creates two tables on first Docker start (via `/docker-entrypoint-initdb.d/`):
- `telco_sites` — Site registry with JSONB thresholds column
- `telco_sensor_readings` — Time-series sensor data with FK to sites

Creates indexes for fast dashboard queries: `(site_id, timestamp DESC)` and `(sensor_type)`.

### `hub/.env.example`
**Purpose:** Environment variable template for the hub server. Copy to `.env` and fill in values.

Required variables: `INGEST_API_KEY`, `DB_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT`, `PORT`
Optional: `FIREBASE_SERVICE_ACCOUNT` (JSON string) or `FIREBASE_SERVICE_ACCOUNT_PATH`

---

## Documentation (`docs/`)

### `docs/PLAN.md`
**Purpose:** Architecture plan and implementation record. Documents the hub-and-spoke WebSocket architecture, Socket.IO event protocol, threshold flow, database schema, and deployment configuration.

### `docs/README_API.md`
**Purpose:** REST API reference. Documents `POST /api/ingest` and `GET /api/sites` endpoints with request/response examples.

### `docs/FILE_REFERENCE.md`
**Purpose:** This file. Comprehensive documentation of every file in the codebase.

---

## Configuration Files

### `.gitignore`
Excludes: `node_modules/`, `.env`, `__pycache__/`, `thresholds.json`, `pg_data/`, build artifacts.

### `README.md`
Project README at the repository root. Contains academic context, system overview, architecture diagram, hardware wiring guide, setup instructions, and technology stack.
