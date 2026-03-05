#!/usr/bin/env python3
"""
TRSMS — Socket.IO Sensor Data Transmitter
==========================================
Connects to the TRSMS hub server via Socket.IO (/pi namespace)
and streams sensor data every READ_INTERVAL seconds.

Also listens for threshold updates pushed from the dashboard.

This script runs as a background thread started by main.py,
or can be run standalone for testing.

Usage:
  python services/transmitter.py               # real sensor mode
  python services/transmitter.py --simulate    # simulation mode
"""

import sys
import os

# Add project root to sys.path so we can import config, thresholds, etc.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse
import json
import random
import time
import logging
import threading
import socketio

import config
from thresholds import update_thresholds, get_thresholds

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Config ───────────
SOCKET_URL       = getattr(config, 'SOCKET_URL', 'http://localhost:3001')
SITE_ID          = getattr(config, 'SITE_ID', 'site-001')
SITE_NAME        = getattr(config, 'SITE_NAME', 'Unknown Site')
SITE_LOCATION    = getattr(config, 'SITE_LOCATION', 'Unknown Location')
INTERVAL_SECONDS = getattr(config, 'READ_INTERVAL', 2)
SENSOR_DATA_FILE = os.getenv("SENSOR_DATA_FILE", "/tmp/sensor_data.json")
# ───────────────


def read_sensor_data() -> dict:
    """
    Read sensor values from the shared JSON file written by main.py.
    """
    try:
        with open(SENSOR_DATA_FILE, "r") as f:
            data = json.load(f)
        for key in ("temperature", "humidity", "smoke"):
            if key not in data:
                raise ValueError(f"Missing sensor key: '{key}'")
        return {
            "temperature": float(data["temperature"]),
            "humidity":    float(data["humidity"]),
            "smoke":       int(data["smoke"]),
        }
    except FileNotFoundError:
        raise RuntimeError(f"Sensor data file not found: {SENSOR_DATA_FILE}")
    except (json.JSONDecodeError, ValueError) as e:
        raise RuntimeError(f"Invalid sensor data file: {e}")


def simulate_sensor_data() -> dict:
    """Generate realistic fake sensor readings for testing without hardware."""
    return {
        "temperature": round(random.uniform(20.0, 35.0), 1),
        "humidity":    round(random.uniform(40.0, 70.0), 1),
        "smoke":       1 if random.random() < 0.05 else 0,
    }


class SocketTransmitter:
    """
    Socket.IO client that connects to the TRSMS hub and streams sensor data.
    Can be run as a background thread or standalone.
    """

    def __init__(self, simulate=False):
        self.simulate = simulate
        self._running = False
        self._thread = None

        # Create Socket.IO client
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_attempts=0,  # infinite retries
            reconnection_delay=2,
            reconnection_delay_max=30,
            logger=False,
        )

        # ── Event handlers (on /pi namespace) ──
        @self.sio.on('connect', namespace='/pi')
        def on_connect():
            logger.info(f"[TRANSMITTER] Connected to hub at {SOCKET_URL}")
            logger.info(f"[TRANSMITTER] Site: {SITE_ID} ({SITE_NAME})")

        @self.sio.on('disconnect', namespace='/pi')
        def on_disconnect():
            logger.warning("[TRANSMITTER] Disconnected from hub — will auto-reconnect")

        @self.sio.on('connect_error', namespace='/pi')
        def on_connect_error(data):
            logger.error(f"[TRANSMITTER] Connection error: {data}")

        @self.sio.on('thresholds:update', namespace='/pi')
        def on_thresholds_update(data):
            logger.info(f"[TRANSMITTER] Received thresholds from hub: {data}")
            try:
                merged = update_thresholds(data)
                # Acknowledge back to the hub
                self.sio.emit('thresholds:ack', {
                    'siteId': SITE_ID,
                    'thresholds': merged,
                }, namespace='/pi')
                logger.info(f"[TRANSMITTER] Thresholds applied and acknowledged")
            except Exception as e:
                logger.error(f"[TRANSMITTER] Failed to apply thresholds: {e}")

    def _emit_loop(self):
        """Background loop that emits sensor data at the configured interval."""
        cycle = 0
        while self._running:
            cycle += 1
            try:
                if not self.sio.connected:
                    time.sleep(1)
                    continue

                if self.simulate:
                    values = simulate_sensor_data()
                else:
                    values = read_sensor_data()

                self.sio.emit('sensor:data', {
                    'siteId': SITE_ID,
                    'sensors': values,
                    'timestamp': int(time.time() * 1000),
                }, namespace='/pi')

                logger.info(
                    f"[{time.strftime('%H:%M:%S')}] #{cycle:04d} "
                    f"temp={values['temperature']}°C  "
                    f"humid={values['humidity']}%  "
                    f"smoke={values['smoke']}"
                )

            except RuntimeError as e:
                logger.error(f"[{time.strftime('%H:%M:%S')}] #{cycle:04d} ERROR — {e}")
            except Exception as e:
                logger.error(f"[{time.strftime('%H:%M:%S')}] #{cycle:04d} UNEXPECTED — {e}")

            time.sleep(INTERVAL_SECONDS)

    def connect(self):
        """Connect to the hub server."""
        try:
            self.sio.connect(
                SOCKET_URL,
                namespaces=['/pi'],
                auth={
                    'siteId': SITE_ID,
                    'siteName': SITE_NAME,
                    'location': SITE_LOCATION,
                },
                wait_timeout=10,
            )
        except Exception as e:
            logger.error(f"[TRANSMITTER] Initial connection failed: {e} — will retry automatically")

    def start(self):
        """Start the transmitter in a background thread."""
        if self._running:
            return
        self._running = True

        # Connect to hub
        self.connect()

        # Start emit loop in a background thread
        self._thread = threading.Thread(target=self._emit_loop, daemon=True)
        self._thread.start()
        logger.info("[TRANSMITTER] Background transmitter started")

    def stop(self):
        """Stop the transmitter and disconnect."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        try:
            self.sio.disconnect()
        except Exception:
            pass
        logger.info("[TRANSMITTER] Transmitter stopped")


def main():
    """Standalone entry point for testing."""
    parser = argparse.ArgumentParser(description="TRSMS Socket.IO Transmitter")
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Use simulated sensor values instead of reading from sensor data file",
    )
    args = parser.parse_args()

    mode = "SIMULATE" if args.simulate else "REAL"
    print(f"[BOOT] TRSMS Socket.IO Transmitter starting")
    print(f"       Mode:      {mode}")
    print(f"       Hub:       {SOCKET_URL}")
    print(f"       Site ID:   {SITE_ID}")
    print(f"       Site Name: {SITE_NAME}")
    print(f"       Interval:  {INTERVAL_SECONDS}s")
    if not args.simulate:
        print(f"       Data file: {SENSOR_DATA_FILE}")
    print()

    tx = SocketTransmitter(simulate=args.simulate)

    try:
        tx.sio.connect(
            SOCKET_URL,
            namespaces=['/pi'],
            auth={
                'siteId': SITE_ID,
                'siteName': SITE_NAME,
                'location': SITE_LOCATION,
            },
            wait_timeout=10,
        )
    except Exception as e:
        logger.error(f"Initial connection failed: {e}")
        logger.info("Will keep retrying in the background...")

    tx._running = True

    try:
        tx._emit_loop()  # Run in foreground when standalone
    except KeyboardInterrupt:
        print("\nShutting down transmitter...")
    finally:
        tx.stop()


if __name__ == "__main__":
    main()
