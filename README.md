# Telecom Remote Site Monitoring System (TRSMS)

A hub-and-spoke environmental monitoring system for telecom equipment rooms. Raspberry Pi devices collect sensor data (temperature, humidity, smoke) and stream it in real-time to a central dashboard via Socket.IO WebSockets.

## Architecture

```
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  Pi #1   │     │  Pi #2   │     │  Pi #3   │
    │ (Site A) │     │ (Site B) │     │ (Site C) │
    └────┬─────┘     └────┬─────┘     └────┬─────┘
         │ WS /pi         │ WS /pi         │ WS /pi
         └────────────────┼────────────────┘
                          │
                  ┌───────┴────────┐
                  │  Hub Server    │
                  │  (Express +    │
                  │  Socket.IO +   │
                  │  PostgreSQL)   │
                  └───────┬────────┘
                          │ WS /dashboard
                  ┌───────┴────────┐
                  │ React Dashboard│
                  │ (served from   │
                  │  same origin)  │
                  └────────────────┘
```

## Features

- **Real-time monitoring** — sensor data streamed every 2 seconds via WebSocket
- **Multi-site support** — connect unlimited Pi devices simultaneously
- **Automatic site registration** — new Pi auto-registers on first connection
- **Remote threshold control** — adjust fan/alarm thresholds from the dashboard
- **Local actuator control** — fan, buzzer, and LCD driven directly by the Pi
- **Data persistence** — PostgreSQL stores all readings for trend analysis
- **Instant status** — online/offline detected via WebSocket disconnect (no polling)
- **Push notifications** — Firebase alerts for warning/critical states

## Project Structure

```
ems/
├── main.py                  # Pi entry point — sensor loop + actuator control
├── config.py                # GPIO pins, thresholds, site identity, hub URL
├── thresholds.py            # Dynamic threshold manager (file + memory)
├── requirements.txt         # Python dependencies
├── ems.service              # systemd service for the monitoring loop
├── ems-splash.service       # systemd service for boot splash screen
├── boot_splash.py           # LCD boot animation
│
├── sensors/
│   ├── dht_sensor.py        # DHT11 temperature/humidity driver
│   └── mq2_sensor.py        # MQ2 smoke/gas digital output
│
├── actuators/
│   ├── buzzer.py            # Active buzzer control
│   ├── fan.py               # Fan relay control
│   └── lcd_display.py       # 20x4 I2C LCD display
│
├── services/
│   └── transmitter.py       # Socket.IO client — connects to hub, streams data
│
├── test_buzzer.py           # Buzzer diagnostic
├── test_relay.py            # Relay diagnostic
├── test_mq2.py              # MQ2 wiring test
├── test_lcd.py              # LCD display test
│
└── hub/                     # ── Hub Server (deploy to VM) ──
    ├── docker-compose.yml   # PostgreSQL + Hub containers
    ├── Dockerfile           # Multi-stage: builds React + runs Express
    ├── init.sql             # Database schema (auto-runs on first start)
    ├── package.json         # Node.js dependencies
    ├── .env.example         # Environment template
    │
    ├── src/
    │   ├── index.js         # Express server + Socket.IO setup + static serving
    │   ├── db.js            # PostgreSQL connection pool
    │   ├── routes/
    │   │   ├── ingest.js    # POST /api/ingest (legacy REST)
    │   │   └── sites.js     # GET /api/sites (initial hydration)
    │   ├── socket/
    │   │   ├── piHandler.js         # /pi namespace — Pi connections
    │   │   └── dashboardHandler.js  # /dashboard namespace — browser clients
    │   └── services/
    │       ├── statusService.js     # Status derivation logic
    │       └── notificationService.js # Firebase push notifications
    │
    └── templates/           # ── React Dashboard (built by Docker) ──
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── App.tsx
            ├── components/
            │   ├── Sidebar.tsx
            │   ├── SensorCard.tsx
            │   ├── AlertPanel.tsx
            │   ├── AlarmBanner.tsx
            │   └── ThresholdEditor.tsx
            └── lib/
                ├── socket.ts    # Socket.IO client singleton
                └── utils.ts
```

## Wiring (Raspberry Pi)

```
                    Raspberry Pi GPIO
                  ┌─────────────────────┐
    DHT11 DATA ───┤ GPIO 4    (pin 7)   │
   Buzzer (+)  ───┤ GPIO 17   (pin 11)  │
   Fan Relay IN ──┤ GPIO 27   (pin 13)  │
   MQ2 DO ────────┤ GPIO 22   (pin 15)  │
                  │                      │
              3.3V┤ pin 1               │
               5V ┤ pin 2               │
              GND ┤ pin 6, 9, etc.      │
                  └─────────────────────┘
```

| Component | VCC | GND | Signal |
|-----------|-----|-----|--------|
| DHT11 | 3.3V | GND | GPIO 4 (+ 10kΩ pull-up) |
| MQ2 | 5V | GND | DO → GPIO 22 |
| Buzzer | — | GND | (+) → GPIO 17 (active-LOW) |
| Fan Relay | 5V | GND | IN → GPIO 27 |

## Actuator Logic

| Condition | Fan | Buzzer |
|-----------|-----|--------|
| Temperature ≥ threshold | **ON** | OFF |
| Smoke detected (MQ2 DO = LOW) | **ON** | **ON** |
| Normal | OFF | OFF |

Thresholds are configurable from the dashboard or in `config.py`.

---

## Setup

### Pi Setup

```bash
# Install system dependencies
sudo apt update && sudo apt install -y python3-venv python3-dev libgpiod2

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure site identity and hub URL
# Edit config.py:
#   SITE_ID = "site-001"
#   SITE_NAME = "North Ridge Tower"
#   SOCKET_URL = "http://<VM-EXTERNAL-IP>:3001"

# Run manually
python main.py

# Or enable as systemd service
sudo systemctl enable ems
sudo systemctl start ems
```

### Hub Deployment (Google Compute Engine)

```bash
# Clone only the hub folder
git clone --no-checkout --filter=blob:none https://github.com/perried/Embedded-System-Project.git ems_project
cd ems_project
git sparse-checkout init --cone
git sparse-checkout set hub
git checkout main

# Configure
cd hub
cp .env.example .env    # values are pre-filled, edit DB_PASSWORD if needed

# Start (builds React dashboard + Express server + PostgreSQL)
docker compose up -d --build

# Verify
docker compose ps
curl http://localhost:3001/health
```

Dashboard is available at `http://<VM-EXTERNAL-IP>:3001`

### Firewall (GCE)

```bash
gcloud compute firewall-rules create allow-trsms \
  --allow tcp:3001 --direction INGRESS --source-ranges 0.0.0.0/0
```

---

## Testing Individual Components

```bash
python test_mq2.py         # MQ2 digital output (30s read loop)
python test_relay.py       # Relay active-HIGH vs active-LOW
python test_buzzer.py      # Buzzer active-HIGH vs active-LOW
python test_lcd.py         # LCD display test
python -m sensors.dht_sensor
python -m sensors.mq2_sensor
python -m actuators.buzzer
python -m actuators.fan
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Sensors | DHT11, MQ2, gpiozero, adafruit-circuitpython-dht |
| Actuators | Relay (fan), active buzzer, 20x4 I2C LCD |
| Pi Transport | python-socketio (WebSocket client) |
| Hub Server | Node.js, Express, Socket.IO |
| Database | PostgreSQL 16 (Docker) |
| Dashboard | React 19, Vite, TypeScript, Tailwind CSS v4, Recharts |
| Deployment | Docker Compose on GCE |
| Notifications | Firebase Cloud Messaging |
