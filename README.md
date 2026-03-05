# Telecom Equipment Room Monitor

Raspberry Pi-based environmental monitoring system for a telecom equipment room.  
Reads **temperature/humidity** (DHT11) and **gas/smoke** (MQ2 digital output), then controls a **fan** (relay) and **buzzer** to protect equipment.

## Actuator Logic

| Condition | Fan (Relay) | Buzzer |
|---|---|---|
| Temperature ≥ 27 °C | **ON** | OFF |
| Gas/smoke detected (MQ2 DO = LOW) | **ON** | **ON** |
| Normal (temp < 27 °C, no gas) | OFF | OFF |

- **Buzzer** activates on **gas/smoke only**.
- **Fan** activates on **high temperature OR gas/smoke** (ventilation + cooling).

---

## Wiring Diagram

```
                    Raspberry Pi GPIO
                  ┌─────────────────────┐
                  │                     │
    DHT11 DATA ───┤ GPIO 4    (pin 7)  │
                  │                     │
   Buzzer (+)  ───┤ GPIO 17   (pin 11) │
                  │                     │
   Fan Relay IN ──┤ GPIO 27   (pin 13) │
                  │                     │
   MQ2 DO ────────┤ GPIO 22   (pin 15) │
                  │                     │
              3.3V┤ pin 1              │
               5V ┤ pin 2              │
              GND ┤ pin 6, 9, etc.     │
                  └─────────────────────┘

    DHT11:     VCC → 3.3V, GND → GND, DATA → GPIO 4 (+ 10kΩ pull-up to 3.3V)
    MQ2:       VCC → 5V,   GND → GND, DO → GPIO 22 (threshold set via onboard potentiometer)
    Buzzer:    (+) → GPIO 17, (−) → GND  (active buzzer, active-LOW)
    Fan Relay: IN → GPIO 27, VCC → 5V, GND → GND, NO/COM → Lucky Sky 80x80x25 fan
```

---

## Project Structure

```
RASPBERRY PI PROJECT/
├── main.py              # Entry point — monitoring loop
├── config.py            # GPIO pins + thresholds
├── requirements.txt     # Python dependencies
├── README.md            # This file
├── test_relay.py        # Relay diagnostic (active-HIGH vs LOW)
├── test_buzzer.py       # Buzzer diagnostic (active-HIGH vs LOW)
├── test_mq2.py          # MQ2 DO wiring & potentiometer test
├── sensors/
│   ├── __init__.py
│   ├── dht_sensor.py    # DHT11 driver
│   └── mq2_sensor.py    # MQ2 digital output via GPIO
├── actuators/
│   ├── __init__.py
│   ├── buzzer.py        # Buzzer control
│   └── fan.py           # Fan relay control
└── .venv/               # Python virtual environment
```

---

## Setup (on Raspberry Pi)

### 1. Install system dependencies

```bash
sudo apt update
sudo apt install -y python3-venv python3-dev libgpiod2
```

### 2. Activate virtual environment & install packages

```bash
cd ~/RASPBERRY\ PI\ PROJECT
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run

```bash
python main.py
```

Press **Ctrl+C** to stop — GPIO is cleaned up automatically.

---

## Adjust Thresholds

Edit `config.py`:

```python
TEMP_FAN_ON   = 27.0   # °C — fan ON at this temperature
READ_INTERVAL = 2      # seconds between readings
```

The **gas detection threshold** is set by adjusting the **potentiometer on the MQ2 module board** (no software threshold needed — the DO pin outputs HIGH/LOW directly).

---

## Run as a systemd Service (auto-start on boot)

Create `/etc/systemd/system/telecom-monitor.service`:

```ini
[Unit]
Description=Telecom Room Monitor
After=multi-user.target

[Service]
Type=simple
WorkingDirectory=/home/pi/RASPBERRY PI PROJECT
ExecStart=/home/pi/RASPBERRY PI PROJECT/.venv/bin/python main.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable telecom-monitor
sudo systemctl start telecom-monitor
```

Check status: `sudo systemctl status telecom-monitor`

---

## Testing Individual Components

```bash
# Test DHT11 readings
python -m sensors.dht_sensor

# Test MQ2 digital output (30s read loop)
python test_mq2.py

# Test MQ2 sensor module
python -m sensors.mq2_sensor

# Diagnose relay (determine active-HIGH or active-LOW)
python test_relay.py

# Diagnose buzzer (determine active-HIGH or active-LOW)
python test_buzzer.py

# Test buzzer module
python -m actuators.buzzer

# Test fan relay module
python -m actuators.fan
```
