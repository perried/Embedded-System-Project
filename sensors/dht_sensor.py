"""
DHT11 Temperature & Humidity Sensor
====================================
Reads temperature (°C) and relative humidity (%) from a DHT11 sensor
using the Adafruit CircuitPython DHT library.

Wiring:
    DHT11 VCC  → 3.3V
    DHT11 GND  → GND
    DHT11 DATA → GPIO 4 (with 10kΩ pull-up resistor to 3.3V)
"""

import adafruit_dht
import board

import config


# Map GPIO number → board pin object
_BOARD_PINS = {
    4: board.D4,
    17: board.D17,
    27: board.D27,
    22: board.D22,
}


class DHTSensor:
    """Wrapper around the Adafruit DHT11 driver with last-good caching."""

    def __init__(self, pin: int = config.DHT_PIN):
        board_pin = _BOARD_PINS.get(pin)
        if board_pin is None:
            raise ValueError(f"Unsupported GPIO pin {pin}. Add it to _BOARD_PINS.")
        self._device = adafruit_dht.DHT11(board_pin, use_pulseio=False)
        # Cache to hold the last successful reading so actuators
        # don't flap off during transient DHT11 checksum errors.
        self._last_good = {"temperature": None, "humidity": None}

    def read(self) -> dict:
        """
        Attempt to read the sensor.

        Returns
        -------
        dict  {"temperature": float|None, "humidity": float|None}
              On a failed read, returns the last successful values.
              Only None if no successful read has occurred yet.
        """
        try:
            temperature = self._device.temperature   # °C
            humidity = self._device.humidity          # %RH
            # Update cache on success
            self._last_good = {"temperature": temperature, "humidity": humidity}
        except RuntimeError as e:
            # DHT11 occasionally throws RuntimeError — return cached values
            print(f"  [DHT11] Read error (using cached value): {e}")
            return self._last_good
        return {"temperature": temperature, "humidity": humidity}

    def cleanup(self):
        """Release the sensor resources."""
        self._device.exit()


# ── Quick standalone test ─────────────────────────────────────────────
if __name__ == "__main__":
    import time

    sensor = DHTSensor()
    print("DHT11 Sensor Test — press Ctrl+C to stop\n")
    try:
        while True:
            data = sensor.read()
            if data["temperature"] is not None:
                print(f"  Temp: {data['temperature']:.1f}°C  |  Humidity: {data['humidity']:.1f}%")
            time.sleep(config.READ_INTERVAL)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        sensor.cleanup()

