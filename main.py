#!/usr/bin/env python3
"""
Telecom Equipment Room Monitor
================================
Continuously reads temperature/humidity (DHT11) and gas/smoke levels
(MQ2 digital output) and controls actuators accordingly:

    Fan (relay)  → ON when temp ≥ threshold
    Buzzer       → ON when gas detected ONLY

Run:  python main.py
Stop: Ctrl+C (GPIO cleaned up automatically)
"""

# ── Standard library ──
import sys
import time
import json
import logging
import os
from datetime import datetime

# ── Project modules ──
import config
from sensors.dht_sensor import DHTSensor       # DHT11 temperature & humidity
from sensors.mq2_sensor import MQ2Sensor       # MQ-2 gas/smoke digital output
from actuators.buzzer import Buzzer             # Active buzzer (gas alert only)
from actuators.fan import Fan                   # Exhaust fan via relay module
from actuators.lcd_display import LCDDisplay    # 20x4 I2C LCD
from thresholds import get_thresholds           # Thread-safe threshold manager
from services.transmitter import SocketTransmitter  # Socket.IO hub client

# ── Logging ──
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────

def print_header():
    """Print a static banner once at startup."""
    from thresholds import get_thresholds
    thresholds = get_thresholds()
    print("=" * 60)
    print("   TELECOM EQUIPMENT ROOM MONITOR")
    print("=" * 60)
    print(f"   Fan threshold  : {thresholds.get('temp_fan_on', config.TEMP_FAN_ON)}°C (dynamic)")
    print(f"   Gas threshold  : set on MQ2 board potentiometer")
    print(f"   Read interval  : {config.READ_INTERVAL}s")
    print(f"   Hub URL        : {config.SOCKET_URL}")
    print("=" * 60)
    print()


def print_status(temp, humidity, gas_detected, fan_on, buzzer_on):
    """Print a single-line status update to the terminal."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    temp_str = f"{temp:.1f}°C" if temp is not None else " N/A "
    hum_str = f"{humidity:.1f}%" if humidity is not None else " N/A "
    gas_str = "⚠ GAS DETECTED" if gas_detected else "Normal"

    fan_status = "ON " if fan_on else "OFF"
    buz_status = "ON " if buzzer_on else "OFF"

    print(
        f"[{now}]  "
        f"Temp: {temp_str:>7s}  "
        f"Hum: {hum_str:>6s}  "
        f"Gas: {gas_str:<16s}  "
        f"| Fan: {fan_status}  Buzzer: {buz_status}"
    )


def write_sensor_data(temp, humidity, gas_detected):
    """Writes sensor data to a JSON file for the transmitter to read."""
    try:
        data = {
            "temperature": temp if temp is not None else 0,
            "humidity": humidity if humidity is not None else 0,
            "smoke": 1 if gas_detected else 0  # Mapping gas_detected (bool) to smoke (int)
        }
        with open("/tmp/sensor_data.json", "w") as f:
            json.dump(data, f)
        logger.info(f"Sensor data written to /tmp/sensor_data.json: {data}")
    except Exception as e:
        logger.error(f"Failed to write sensor data to file: {e}")


# ── Main loop ─────────────────────────────────────────────────────────

def main():
    # Initialise hardware
    dht = DHTSensor()
    mq2 = MQ2Sensor()
    fan = Fan()
    buzzer = Buzzer()
    lcd = LCDDisplay()

    # ── Start Socket.IO Transmitter (background thread) ──────
    transmitter = SocketTransmitter(simulate=False)
    try:
        transmitter.start()
        logger.info("Socket.IO transmitter started (background thread)")
    except Exception as e:
        logger.error(f"Failed to start transmitter: {e}")
        transmitter = None

    lcd.show_message("TERMS Running",
                     "--------------------",
                     "Sensors: OK",
                     "Monitoring...")
    print_header()
    time.sleep(2)

    try:
        while True:
            # ── Read sensors ──────────────────────────────────────
            # DHT11 returns cached values on checksum error to avoid actuator flapping
            dht_data = dht.read()
            mq2_data = mq2.read()

            temp = dht_data["temperature"]       # °C or None if no read yet
            humidity = dht_data["humidity"]       # %RH or None
            gas_detected = mq2_data["gas_detected"]  # True = smoke/gas above MQ2 threshold

            # Write sensor data to /tmp/sensor_data.json for the transmitter thread to read
            write_sensor_data(temp, humidity, gas_detected)

            # ── Actuator logic ────────────────────────────────────
            # Fetch latest thresholds — may have been updated remotely from dashboard
            thresholds = get_thresholds()
            fan_threshold = thresholds.get('temp_fan_on', config.TEMP_FAN_ON)

            # Fan: ON if temperature is high
            if temp is not None and temp >= fan_threshold:
                fan.turn_on()
            else:
                fan.turn_off()

            # Buzzer: ON for gas/smoke ONLY
            if gas_detected:
                buzzer.beep(on_time=0.5, off_time=0.5)
            else:
                buzzer.turn_off()

            # ── Display ───────────────────────────────────────────
            print_status(
                temp, humidity,
                gas_detected,
                fan.is_active, buzzer.is_active,
            )
            lcd.show_status(
                temp, humidity,
                gas_detected,
                fan.is_active, buzzer.is_active,
            )

            time.sleep(config.READ_INTERVAL)

    except KeyboardInterrupt:
        print("\n\nShutting down...")

    finally:
        # ── Graceful shutdown — release all GPIO and stop background threads ──
        buzzer.turn_off()
        fan.turn_off()
        lcd.show_message("TERMS",
                         "Equipment Room Monitor",
                         "",
                         "Shutting down...")
        buzzer.cleanup()   # Release buzzer GPIO
        fan.cleanup()      # De-energise relay, release GPIO
        lcd.cleanup()      # Clear display, release I2C
        dht.cleanup()      # Release DHT11 resources
        mq2.cleanup()      # Release MQ2 GPIO
        
        # Stop Socket.IO transmitter background thread
        if 'transmitter' in locals() and transmitter:
            logger.info("Stopping Socket.IO transmitter...")
            transmitter.stop()
            logger.info("Transmitter stopped.")

        print("GPIO cleaned up. Goodbye.")


if __name__ == "__main__":
    main()

