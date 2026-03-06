"""
MQ2 Gas / Smoke Sensor (Digital Output)
=========================================
Reads the digital output (DO) of an MQ-2 sensor module directly
via a GPIO pin. The gas detection threshold is set by the
potentiometer on the MQ2 module board.

DO behaviour:
    - HIGH (1) → gas/smoke concentration ABOVE threshold (detected)
    - LOW  (0) → gas/smoke concentration BELOW threshold (normal)

Wiring:
    MQ2 VCC  → 5V
    MQ2 GND  → GND
    MQ2 DO   → GPIO 22 (board pin 15)
"""

import RPi.GPIO as GPIO

import config


class MQ2Sensor:
    """Reads MQ2 gas sensor digital output via GPIO."""

    def __init__(self, pin: int = config.MQ2_DO_PIN):
        self._pin = pin
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self._pin, GPIO.IN, pull_up_down=GPIO.PUD_OFF)

    def read(self) -> dict:
        """
        Read current gas detection state from the MQ2 DO pin.

        Returns
        -------
        dict  {"gas_detected": bool}
              gas_detected : True when DO is LOW (gas above threshold)
        """
        # DO is active-HIGH: HIGH = gas detected, LOW = normal
        state = GPIO.input(self._pin)
        gas_detected = state == GPIO.HIGH
        return {"gas_detected": gas_detected}

    def cleanup(self):
        """Release GPIO resources."""
        GPIO.cleanup(self._pin)


# ── Quick standalone test ─────────────────────────────────────────────
if __name__ == "__main__":
    import time

    sensor = MQ2Sensor()
    print("MQ2 Sensor Test (Digital Output) — press Ctrl+C to stop")
    print("Adjust the potentiometer on the MQ2 board to set sensitivity.\n")
    try:
        while True:
            data = sensor.read()
            status = "⚠ GAS DETECTED" if data["gas_detected"] else "Normal"
            print(f"  DO State: {'LOW (gas)' if data['gas_detected'] else 'HIGH (ok)':>12s}  |  {status}")
            time.sleep(config.READ_INTERVAL)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        sensor.cleanup()

