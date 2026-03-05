"""
I2C LCD Display (24x4)
=======================
Displays real-time sensor readings and system status on a 24x4 LCD
connected via an I2C (PCF8574) backpack.

Wiring (I2C):
    LCD SDA  → GPIO 2 (board pin 3)
    LCD SCL  → GPIO 3 (board pin 5)
    LCD VCC  → 5V
    LCD GND  → GND

Dependencies:
    pip install RPLCD smbus2
"""

import time

from RPLCD.i2c import CharLCD

import config

# Number of retries on I2C I/O errors before giving up
_MAX_RETRIES = 3
_RETRY_DELAY = 0.1  # seconds between retries


class LCDDisplay:
    """24x4 I2C LCD controlled via RPLCD (with I2C retry logic)."""

    # Number of attempts to initialise the LCD at startup
    _INIT_RETRIES = 5
    _INIT_DELAY = 3  # seconds between init attempts

    def __init__(
        self,
        address: int = config.LCD_I2C_ADDR,
        cols: int = config.LCD_COLS,
        rows: int = config.LCD_ROWS,
    ):
        self._address = address
        self._cols = cols
        self._rows = rows
        self._lcd = self._init_lcd_with_retries()
        if self._lcd is not None:
            self._safe_call(self._lcd.clear)

    @property
    def available(self) -> bool:
        """Return True if the LCD was successfully initialised."""
        return self._lcd is not None

    def _init_lcd_with_retries(self):
        """Try to create the LCD connection several times (I2C may not be ready at boot)."""
        for attempt in range(1, self._INIT_RETRIES + 1):
            try:
                lcd = self._create_lcd()
                print(f"[LCD] Initialised on attempt {attempt}.")
                return lcd
            except OSError as exc:
                print(f"[LCD] Init failed (attempt {attempt}/{self._INIT_RETRIES}): {exc}")
                if attempt < self._INIT_RETRIES:
                    time.sleep(self._INIT_DELAY)
        print("[LCD] Could not initialise LCD after all retries — running without display.")
        return None

    def _create_lcd(self):
        """Create (or re-create) the underlying CharLCD object."""
        return CharLCD(
            i2c_expander="PCF8574",
            address=self._address,
            port=1,              # /dev/i2c-1 on Raspberry Pi
            cols=self._cols,
            rows=self._rows,
            dotsize=8,
            auto_linebreaks=False,
            backlight_enabled=True,
        )

    def _safe_call(self, fn, *args, **kwargs):
        """
        Call *fn* with retry logic to handle transient I2C I/O errors.
        On repeated failure, re-initialise the LCD bus and try once more.
        """
        if self._lcd is None:
            # LCD was previously unavailable — try to reconnect
            try:
                self._lcd = self._create_lcd()
                print("[LCD] Reconnected successfully.")
            except OSError:
                return  # still not available
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return fn(*args, **kwargs)
            except OSError as exc:
                print(f"[LCD] I/O error (attempt {attempt}/{_MAX_RETRIES}): {exc}")
                time.sleep(_RETRY_DELAY)
                if attempt == _MAX_RETRIES:
                    # Last resort: re-create the LCD connection
                    try:
                        self._lcd = self._create_lcd()
                        return fn(*args, **kwargs)
                    except OSError:
                        print("[LCD] Could not recover — marking LCD unavailable.")
                        self._lcd = None

    def _write_lines(self, lines):
        """Write a list of strings, one per row, with explicit cursor positioning."""
        if self._lcd is None:
            return
        for row, text in enumerate(lines):
            if row >= self._rows:
                break
            self._lcd.cursor_pos = (row, 0)
            self._lcd.write_string(text)

    # ── Public helpers ────────────────────────────────────────────────

    def show_status(self, temp, humidity, gas_detected, fan_on, buzzer_on):
        """
        Update the LCD with the current sensor/actuator state.

        Layout (24x4):
            Row 0:  Temp: 25.0 C
            Row 1:  Humidity: 60.1%
            Row 2:  Gas: Normal
            Row 3:  Fan: OFF   Buzzer: OFF
        """
        # ── Row 0 — temperature ───────────────────────────────────
        if temp is not None:
            line0 = f"Temp: {temp:.1f} C"
        else:
            line0 = "Temp: N/A"

        # ── Row 1 — humidity ──────────────────────────────────────
        if humidity is not None:
            line1 = f"Humidity: {humidity:.1f}%"
        else:
            line1 = "Humidity: N/A"

        # ── Row 2 — gas status ────────────────────────────────────
        if gas_detected:
            line2 = "Gas: !! WARNING !!"
        else:
            line2 = "Gas: Normal"

        # ── Row 3 — fan & buzzer ──────────────────────────────────
        fan_str = "ON" if fan_on else "OFF"
        buz_str = "ON" if buzzer_on else "OFF"
        line3 = f"Fan: {fan_str:<4s}Buzzer: {buz_str}"

        # Pad / truncate each line to column width
        lines = [l.ljust(self._cols)[:self._cols] for l in (line0, line1, line2, line3)]

        # ── Write to LCD ──────────────────────────────────────────
        def _write():
            self._lcd.home()
            time.sleep(0.01)
            self._write_lines(lines)

        self._safe_call(_write)

    def show_message(self, line0: str = "", line1: str = "",
                     line2: str = "", line3: str = ""):
        """Display an arbitrary message across up to 4 lines."""
        lines = [l.ljust(self._cols)[:self._cols]
                 for l in (line0, line1, line2, line3)]

        def _write():
            self._lcd.clear()
            time.sleep(0.01)
            self._write_lines(lines)

        self._safe_call(_write)

    def clear(self):
        """Clear the display."""
        self._safe_call(self._lcd.clear)

    def cleanup(self):
        """Clear the display and release resources."""
        if self._lcd is None:
            return
        try:
            self._lcd.clear()
            time.sleep(0.01)
            self._lcd.close()
        except Exception:
            pass


# ── Quick standalone test ─────────────────────────────────────────────
if __name__ == "__main__":
    import time

    lcd = LCDDisplay()
    print("LCD Test — showing sample data for 5 seconds\n")
    try:
        lcd.show_message("TERMS", "Equipment Room Monitor", "", "Starting...")
        time.sleep(2)
        lcd.show_status(temp=25.3, humidity=60.1, gas_detected=False,
                        fan_on=True, buzzer_on=False)
        time.sleep(5)
        lcd.show_status(temp=30.0, humidity=55.0, gas_detected=True,
                        fan_on=True, buzzer_on=True)
        time.sleep(5)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        lcd.clear()
        lcd.cleanup()
        print("LCD cleaned up.")
