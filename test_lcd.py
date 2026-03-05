#!/usr/bin/env python3
"""
Quick test for the 24x4 I2C LCD display.
Run:  python test_lcd.py
"""

import time
from actuators.lcd_display import LCDDisplay


def main():
    lcd = LCDDisplay()
    print("LCD Test — cycling through sample screens (Ctrl+C to stop)\n")

    try:
        # Screen 1: startup message
        lcd.show_message("EMS System",
                         "Environment Monitor",
                         "",
                         "Starting...")
        print("  Screen 1: startup message")
        time.sleep(3)

        # Screen 2: normal readings
        lcd.show_status(temp=25.3, humidity=60.1,
                        gas_detected=False, fan_on=False, buzzer_on=False)
        print("  Screen 2: normal readings")
        time.sleep(3)

        # Screen 3: high temp — fan on
        lcd.show_status(temp=30.0, humidity=55.0,
                        gas_detected=False, fan_on=True, buzzer_on=False)
        print("  Screen 3: high temp, fan ON")
        time.sleep(3)

        # Screen 4: gas detected — fan & buzzer on
        lcd.show_status(temp=28.5, humidity=58.0,
                        gas_detected=True, fan_on=True, buzzer_on=True)
        print("  Screen 4: gas detected, fan ON, buzzer ON")
        time.sleep(3)

        # Screen 5: sensor error (None values)
        lcd.show_status(temp=None, humidity=None,
                        gas_detected=False, fan_on=False, buzzer_on=False)
        print("  Screen 5: sensor error (N/A)")
        time.sleep(3)

    except KeyboardInterrupt:
        print("\nStopped.")

    finally:
        lcd.clear()
        lcd.cleanup()
        print("\nLCD cleaned up.")


if __name__ == "__main__":
    main()
