#!/usr/bin/env python3
"""
MQ2 Digital Output Diagnostic Test
====================================
Reads the MQ2 DO pin (GPIO 22) and reports the state every second.
Use this to verify wiring and adjust the potentiometer sensitivity.

The MQ2 DO pin is typically active-LOW:
    LOW  → gas/smoke detected (above threshold)
    HIGH → normal (below threshold)

Run: python test_mq2.py
"""

import time

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("RPi.GPIO not available. Run this on the Raspberry Pi.")
    exit(1)

PIN = 22

GPIO.setmode(GPIO.BCM)
GPIO.setup(PIN, GPIO.IN, pull_up_down=GPIO.PUD_OFF)

print("=" * 50)
print("  MQ2 DIGITAL OUTPUT DIAGNOSTIC — GPIO 22")
print("=" * 50)
print()
print("  Reading DO pin every second for 30 seconds...")
print("  Adjust the MQ2 potentiometer to set sensitivity.")
print("  Expose the sensor to gas/smoke to test detection.")
print()
print(f"  {'Time':>5s}   {'GPIO State':>12s}   {'Status'}")
print("  " + "-" * 42)

try:
    for i in range(30):
        state = GPIO.input(PIN)
        if state == GPIO.LOW:
            state_str = "LOW"
            status = "⚠ GAS DETECTED"
        else:
            state_str = "HIGH"
            status = "Normal"
        print(f"  {i+1:3d}s    {state_str:>12s}   {status}")
        time.sleep(1)
except KeyboardInterrupt:
    print("\n  Stopped early.")

GPIO.cleanup()

print()
print("=" * 50)
print("  Results:")
print("  - If always HIGH → no gas detected (normal)")
print("  - If always LOW  → gas present OR threshold too low")
print("    (turn potentiometer clockwise to raise threshold)")
print("  - If it never changes → check wiring / MQ2 power")
print("  - MQ2 needs 1-2 min warm-up for accurate readings")
print("=" * 50)

