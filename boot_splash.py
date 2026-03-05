#!/usr/bin/env python3
"""
Boot Splash for I2C LCD
========================
Displays boot progress messages on the 20x4 LCD during Pi startup,
before the main TERMS application takes over.

Runs as an early systemd service (before network-online.target).
"""

import subprocess
import time

from RPLCD.i2c import CharLCD

# ── LCD settings (must match config.py) ───────────────────────────────
LCD_I2C_ADDR = 0x27
LCD_COLS = 20
LCD_ROWS = 4

# ── Timing ────────────────────────────────────────────────────────────
LCD_INIT_RETRIES = 10      # I2C may not be ready right after power-on
LCD_INIT_DELAY = 2         # seconds between init attempts
NETWORK_POLL_INTERVAL = 2  # seconds between connectivity checks
NETWORK_TIMEOUT = 60       # give up waiting for network after this


def centre(text: str, width: int = LCD_COLS) -> str:
    """Centre-pad *text* to *width* characters."""
    return text.center(width)[:width]


def init_lcd():
    """Create the CharLCD object, retrying if I2C isn't ready yet."""
    for attempt in range(1, LCD_INIT_RETRIES + 1):
        try:
            lcd = CharLCD(
                i2c_expander="PCF8574",
                address=LCD_I2C_ADDR,
                port=1,
                cols=LCD_COLS,
                rows=LCD_ROWS,
                dotsize=8,
                auto_linebreaks=False,
                backlight_enabled=True,
            )
            lcd.clear()
            return lcd
        except OSError as exc:
            print(f"[Splash] LCD init attempt {attempt}/{LCD_INIT_RETRIES}: {exc}")
            if attempt < LCD_INIT_RETRIES:
                time.sleep(LCD_INIT_DELAY)
    return None


def write_lines(lcd, lines):
    """Write up to 4 lines to the LCD."""
    if lcd is None:
        return
    try:
        for row, text in enumerate(lines[:LCD_ROWS]):
            lcd.cursor_pos = (row, 0)
            lcd.write_string(text.ljust(LCD_COLS)[:LCD_COLS])
    except OSError:
        pass


def has_network() -> bool:
    """Return True if the Pi has network connectivity."""
    try:
        result = subprocess.run(
            ["ping", "-c", "1", "-W", "2", "8.8.8.8"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        return result.returncode == 0
    except Exception:
        return False


def main():
    # ── Stage 1: Booting ──────────────────────────────────────────────
    print("[Splash] Pi is booting...")
    lcd = init_lcd()

    if lcd is None:
        print("[Splash] LCD not available — exiting.")
        return

    write_lines(lcd, [
        centre("TERMS"),
        centre("--------------------"),
        centre("Pi is booting..."),
        centre("Please wait"),
    ])

    time.sleep(3)

    # ── Stage 2: Connecting to network ────────────────────────────────
    print("[Splash] Waiting for network...")
    write_lines(lcd, [
        centre("TERMS"),
        centre("--------------------"),
        centre("Connecting to"),
        centre("network..."),
    ])

    start = time.time()
    connected = False
    dots = 0
    while time.time() - start < NETWORK_TIMEOUT:
        if has_network():
            connected = True
            break
        # Animate dots so user knows it's alive
        dots = (dots % 3) + 1
        write_lines(lcd, [
            centre("TERMS"),
            centre("--------------------"),
            centre("Connecting to"),
            centre("network" + "." * dots),
        ])
        time.sleep(NETWORK_POLL_INTERVAL)

    if connected:
        print("[Splash] Network connected.")
        write_lines(lcd, [
            centre("TERMS"),
            centre("--------------------"),
            centre("Network connected!"),
            centre("Starting TERMS..."),
        ])
    else:
        print("[Splash] Network timeout — continuing anyway.")
        write_lines(lcd, [
            centre("TERMS"),
            centre("--------------------"),
            centre("No network!"),
            centre("Starting TERMS..."),
        ])

    time.sleep(3)

    # ── Stage 3: Handing off ──────────────────────────────────────────
    write_lines(lcd, [
        centre("TERMS"),
        centre("--------------------"),
        centre("Initialising"),
        centre("sensors & actuators"),
    ])
    print("[Splash] Handing off to TERMS service.")

    # Don't lcd.close() — the main TERMS service will take over the LCD.


if __name__ == "__main__":
    main()
