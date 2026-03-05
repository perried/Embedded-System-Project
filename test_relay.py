#!/usr/bin/env python3
"""
Relay Diagnostic Test
======================
Tests GPIO 27 with both HIGH and LOW to determine
which state activates your relay module.

Run: python test_relay.py
"""

import time

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("RPi.GPIO not available. Run this on the Raspberry Pi.")
    exit(1)

PIN = 27

GPIO.setmode(GPIO.BCM)
GPIO.setup(PIN, GPIO.OUT)

print("=" * 50)
print("  RELAY DIAGNOSTIC — GPIO 27")
print("=" * 50)

# Test 1: HIGH
print("\n[TEST 1] Setting GPIO 27 → HIGH for 5 seconds...")
print("         Watch the relay: does the red LED turn on? Does the fan spin?")
GPIO.output(PIN, GPIO.HIGH)
time.sleep(5)
GPIO.output(PIN, GPIO.LOW)
print("         → GPIO 27 back to LOW.\n")

time.sleep(2)

# Test 2: LOW
print("[TEST 2] Setting GPIO 27 → LOW for 5 seconds...")
print("         Watch the relay: does the red LED turn on? Does the fan spin?")
GPIO.output(PIN, GPIO.LOW)
time.sleep(5)
GPIO.output(PIN, GPIO.HIGH)
print("         → GPIO 27 back to HIGH.\n")

GPIO.cleanup()

print("=" * 50)
print("  Which test activated the relay?")
print("  TEST 1 (HIGH) → relay is active-HIGH")
print("  TEST 2 (LOW)  → relay is active-LOW")
print("  Neither       → check wiring / relay power")
print("=" * 50)

