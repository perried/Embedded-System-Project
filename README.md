# Telecom Remote Site Monitoring System (TRSMS)

## 1. Introduction

Telecommunication networks depend on a large number of remote equipment rooms spread across wide geographic areas. The shift toward **Software-Defined Networking (SDN)**, **Network Function Virtualization (NFV)**, and **Edge Computing** has replaced bulky, distributed hardware with high-density server racks. While this improves network performance, it has dramatically increased thermal density — a single modern rack produces more concentrated heat than several rooms of legacy equipment.

These remote sites are typically **unmanned**. A cooling failure can cause temperatures to spike within minutes, destroying expensive components or triggering emergency shutdowns. Existing monitoring approaches rely on **disconnected local alarms** or **SMS-only notifications** (Mwagi, 2016; Elago & Francis, 2017), which suffer from:

- **No centralized visibility** — each site operates in isolation with no aggregated view for the NOC
- **Unreliable alerting** — SMS notifications fail in low-signal areas or during GSM congestion
- **No historical data** — without long-term logging, trend analysis (e.g. detecting a gradually failing cooling unit) is impossible
- **Reactive-only response** — operators learn about failures only after equipment is already damaged

## 2. Problem Statement

Based on 3GPP TS standards, infrastructure health monitoring at remote sites remains a critical blind spot. The Central Office often has no real-time awareness of environmental conditions until equipment overheats and services go down — causing SLA violations, customer churn, and costly emergency repairs.

## 3. Proposed Solution

This project implements a **Centralized Environmental Management System (CEMS)** using a **star topology** architecture. It addresses the gaps in existing research by providing:

| Gap in Existing Solutions | How TRSMS Addresses It |
|---------------------------|----------------------|
| SMS-only alerts (unreliable) | Persistent WebSocket connection + web dashboard + Firebase push notifications |
| No centralized view | Single NOC dashboard aggregates all sites in real-time |
| No historical data | PostgreSQL database stores all readings for trend analysis |
| Point-to-point only | Hub-and-spoke model supports unlimited concurrent sites |
| Reactive maintenance | Historical trend data enables **preventive maintenance** — identify degrading equipment before failure |
| No remote configuration | Dashboard allows remote threshold adjustment, pushed instantly to site nodes |

The system consists of two subsystems:

- **Site Nodes** — Raspberry Pi units at each equipment room with sensors (temperature, humidity, smoke/fire) and local actuators (fan, buzzer, LCD) that respond immediately to hazards without waiting for central instructions
- **NOC Dashboard** — A centralized web interface that aggregates live and historical data from every site into a single visual interface

## 4. System Architecture

```
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  Site A   │     │  Site B   │     │  Site C   │
    │  (Pi #1) │     │  (Pi #2) │     │  (Pi #3) │
    └────┬─────┘     └────┬─────┘     └────┬─────┘
         │ WS /pi         │ WS /pi         │ WS /pi
         └────────────────┼────────────────┘
                          │
                  ┌───────┴────────┐
                  │   Hub Server   │
                  │  (Express +    │
                  │  Socket.IO +   │
                  │  PostgreSQL)   │
                  └───────┬────────┘
                          │ WS /dashboard
                  ┌───────┴────────┐
                  │ NOC Dashboard  │
                  │ (React SPA,    │
                  │  same origin)  │
                  └────────────────┘
```

**Data flow:**
1. Each Pi reads sensors every 2 seconds and streams data to the hub via Socket.IO WebSocket
2. The hub persists readings to PostgreSQL, derives site status, and broadcasts to all connected dashboards
3. The dashboard displays real-time gauges, historical charts, and alerts — NOC operators can adjust thresholds remotely
4. Threshold changes are pushed instantly from dashboard → hub → target Pi, where they take effect on the next sensor cycle

## 5. Features

- **Real-time streaming** — sensor data every 2 seconds via persistent WebSocket (not polling)
- **Multi-site aggregation** — unlimited Pi nodes connect to a single hub (star topology)
- **Automatic site registration** — new Pi auto-registers on first connection (no manual provisioning)
- **Local intelligence** — fan and buzzer activate immediately at the site without waiting for hub instructions
- **Remote threshold control** — NOC operators adjust per-site thresholds from the dashboard
- **Historical trend analysis** — PostgreSQL stores all readings; Recharts visualizes trends over time
- **Instant status detection** — online/offline determined by WebSocket disconnect (not 5-minute timeout)
- **Push notifications** — Firebase Cloud Messaging alerts for warning/critical states
- **Preventive maintenance** — historical data reveals gradual equipment degradation before failure

## 6. Project Structure

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
    │   │   ├── ingest.js    # POST /api/ingest (legacy REST fallback)
    │   │   └── sites.js     # GET /api/sites (initial hydration with history)
    │   ├── socket/
    │   │   ├── piHandler.js         # /pi namespace — Pi connections
    │   │   └── dashboardHandler.js  # /dashboard namespace — browser clients
    │   └── services/
    │       ├── statusService.js     # Status derivation logic
    │       └── notificationService.js # Firebase push notifications
    │
    └── templates/           # ── React NOC Dashboard (built by Docker) ──
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── App.tsx
            ├── components/
            │   ├── Sidebar.tsx          # Multi-site sidebar with live status
            │   ├── SensorCard.tsx       # Real-time gauge + sparkline chart
            │   ├── AlertPanel.tsx       # Active alerts list
            │   ├── AlarmBanner.tsx      # Full-screen smoke/fire alarm
            │   └── ThresholdEditor.tsx  # Remote threshold configuration
            └── lib/
                ├── socket.ts    # Socket.IO client singleton
                └── utils.ts
```

## 7. Hardware Wiring

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
| DHT11 (Temperature/Humidity) | 3.3V | GND | GPIO 4 (+ 10kΩ pull-up) |
| MQ2 (Smoke/Gas) | 5V | GND | DO → GPIO 22 |
| Active Buzzer | — | GND | (+) → GPIO 17 (active-LOW) |
| Fan Relay Module | 5V | GND | IN → GPIO 27 |

## 8. Actuator Logic (Local Intelligence)

Site nodes respond to hazards **immediately** without waiting for hub instructions:

| Condition | Fan | Buzzer | Rationale |
|-----------|-----|--------|-----------|
| Temperature ≥ threshold | **ON** | OFF | Active cooling to prevent thermal damage |
| Smoke/gas detected | **ON** | **ON** | Ventilation + audible alarm for fire safety |
| Normal | OFF | OFF | — |

Thresholds are configurable remotely from the NOC dashboard or locally in `config.py`.

---

## 9. Setup & Deployment

### 9.1 Site Node (Raspberry Pi)

```bash
# Install system dependencies
sudo apt update && sudo apt install -y python3-venv python3-dev libgpiod2

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure site identity and hub URL in config.py:
#   SITE_ID = "site-001"
#   SITE_NAME = "North Ridge Tower"
#   SOCKET_URL = "http://<VM-EXTERNAL-IP>:3001"

# Run manually
python main.py

# Or enable as systemd service (auto-start on boot)
sudo systemctl enable ems
sudo systemctl start ems
```

### 9.2 Hub Server (Google Compute Engine)

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

### 9.3 Firewall (GCE)

```bash
gcloud compute firewall-rules create allow-trsms \
  --allow tcp:3001 --direction INGRESS --source-ranges 0.0.0.0/0
```

---

## 10. Testing Individual Components

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

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Sensors | DHT11, MQ2, gpiozero, adafruit-circuitpython-dht |
| Actuators | Relay (fan), active buzzer, 20x4 I2C LCD (PCF8574 backpack) |
| Pi Transport | python-socketio (WebSocket client) |
| Hub Server | Node.js 20, Express, Socket.IO |
| Database | PostgreSQL 16 (Docker) |
| Dashboard | React 19, Vite 6, TypeScript, Tailwind CSS v4, Recharts |
| Deployment | Docker Compose on Google Compute Engine |
| Notifications | Firebase Cloud Messaging |

## 12. References

- 3GPP TS 32.300 — Telecommunication Management; Configuration Management (CM)
- Mwagi, A. (2016). *Overlay Monitoring System for Telecom Equipment Rooms* — SMS-based fault detection
- Elago, S. & Francis, J. (2017). *Real-Time Monitoring System for DSLAM Equipment Rooms* — Local LCD + SMS alerts
