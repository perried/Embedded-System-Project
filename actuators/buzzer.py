"""
Buzzer Actuator
================
Controls an active buzzer for gas/smoke alerts ONLY.

Wiring:
    Buzzer +   → GPIO 17 (through a transistor/driver if needed)
    Buzzer -   → GND
"""

from gpiozero import Buzzer as _GpioZeroBuzzer

import config


class Buzzer:
    """Active buzzer controlled via gpiozero."""

    def __init__(self, pin: int = config.BUZZER_PIN):
        # active_high=True: buzzer sounds when GPIO is HIGH (active-HIGH)
        self._buzzer = _GpioZeroBuzzer(pin, active_high=True)

    def turn_on(self):
        """Activate the buzzer (continuous)."""
        self._buzzer.on()

    def turn_off(self):
        """Silence the buzzer."""
        self._buzzer.off()

    def beep(self, on_time: float = 0.5, off_time: float = 0.5, n: int = None):
        """
        Intermittent alarm pattern.

        Parameters
        ----------
        on_time  : seconds the buzzer is ON per cycle
        off_time : seconds the buzzer is OFF per cycle
        n        : number of cycles (None = forever until turn_off)
        """
        self._buzzer.beep(on_time=on_time, off_time=off_time, n=n)

    @property
    def is_active(self) -> bool:
        """Return True if the buzzer is currently sounding."""
        return self._buzzer.is_active

    def cleanup(self):
        """Release GPIO resources."""
        self._buzzer.close()


# ── Quick standalone test ─────────────────────────────────────────────
if __name__ == "__main__":
    import time

    buzzer = Buzzer()
    print("Buzzer Test — 3 beeps then off\n")
    try:
        buzzer.beep(on_time=0.3, off_time=0.3, n=3)
        time.sleep(2)
        print("  Done.")
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        buzzer.turn_off()
        buzzer.cleanup()

