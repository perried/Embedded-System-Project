"""
Fan Actuator (Relay-controlled)
================================
Controls an exhaust/cooling fan through a relay module.
Activates on high temperature OR gas detection.

Wiring:
    Relay IN   → GPIO 27
    Relay VCC  → 5V
    Relay GND  → GND
    Relay NO/COM → Fan power circuit

Note:
    This relay module triggers on ANY driven GPIO state (both HIGH
    and LOW) because it is designed for 5 V logic.  The 3.3 V Pi
    output cannot pull the optocoupler input high enough to
    de-energise the relay.  As a workaround we switch the pin
    between OUTPUT mode (relay ON) and INPUT / floating mode
    (relay OFF) instead of toggling HIGH / LOW.
"""

from gpiozero import OutputDevice

import config


class Fan:
    """Fan controlled via a relay module using gpiozero OutputDevice.

    Because the relay module energises on any driven GPIO state,
    we release the pin entirely (close the OutputDevice) to turn
    the relay OFF, and re-create the OutputDevice to turn it ON.
    """

    def __init__(self, pin: int = config.FAN_RELAY_PIN):
        self._pin = pin
        self._relay = None   # None ⇒ pin floating ⇒ relay OFF
        self._active = False

    def turn_on(self):
        """Claim the GPIO pin as output → relay ON → fan ON."""
        if not self._active:
            self._relay = OutputDevice(self._pin, active_high=True,
                                       initial_value=True)
            self._active = True

    def turn_off(self):
        """Release the GPIO pin (floating) → relay OFF → fan OFF."""
        if self._relay is not None:
            self._relay.close()
            self._relay = None
        self._active = False

    @property
    def is_active(self) -> bool:
        """Return True if the fan relay is currently energised."""
        return self._active

    def cleanup(self):
        """Release GPIO resources and de-energise the relay."""
        self.turn_off()


# ── Quick standalone test ─────────────────────────────────────────────
if __name__ == "__main__":
    import time

    fan = Fan()
    print("Fan Relay Test — ON for 3 seconds then OFF\n")
    try:
        fan.turn_on()
        print(f"  Fan active: {fan.is_active}")
        time.sleep(3)
        fan.turn_off()
        print(f"  Fan active: {fan.is_active}")
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        fan.turn_off()
        fan.cleanup()

