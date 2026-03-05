#!/usr/bin/env python3
"""
Buzzer Diagnostic Test
=======================
Tests GPIO 17 with both HIGH and LOW to determine
which state activates your buzzer module.

Run: python test_buzzer.py
"""

import time

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("RPi.GPIO not available. Run this on the Raspberry Pi.")
    exit(1)

PIN = 17

GPIO.setmode(GPIO.BCM)
GPIO.setup(PIN, GPIO.OUT)

print("=" * 50)
print("  BUZZER DIAGNOSTIC — GPIO 17")
print("=" * 50)

# Test 1: HIGH
print("\n[TEST 1] Setting GPIO 17 → HIGH for 3 seconds...")
print("         Listen: does the buzzer sound?")
GPIO.output(PIN, GPIO.HIGH)
time.sleep(3)
GPIO.output(PIN, GPIO.LOW)
print("         → GPIO 17 back to LOW.\n")

time.sleep(2)

# Test 2: LOW
print("[TEST 2] Setting GPIO 17 → LOW for 3 seconds...")
print("         Listen: does the buzzer sound?")
GPIO.output(PIN, GPIO.LOW)
time.sleep(3)
GPIO.output(PIN, GPIO.HIGH)
print("         → GPIO 17 back to HIGH.\n")

time.sleep(2)

# Test 3: Beep pattern (HIGH pulses)
print("[TEST 3] Beeping with HIGH pulses (0.5s on / 0.5s off × 5)...")
for i in range(5):
    GPIO.output(PIN, GPIO.HIGH)
    time.sleep(0.5)
    GPIO.output(PIN, GPIO.LOW)
    time.sleep(0.5)
print("         → Done.\n")

time.sleep(2)

# Test 4: Beep pattern (LOW pulses)
print("[TEST 4] Beeping with LOW pulses (0.5s on / 0.5s off × 5)...")
for i in range(5):
    GPIO.output(PIN, GPIO.LOW)
    time.sleep(0.5)
    GPIO.output(PIN, GPIO.HIGH)
    time.sleep(0.5)
print("         → Done.\n")

GPIO.cleanup()

print("=" * 50)
print("  Which test activated the buzzer?")
print("  TEST 1 (HIGH)       → buzzer is active-HIGH")
print("  TEST 2 (LOW)        → buzzer is active-LOW")
print("  TEST 3 (HIGH beep)  → confirms active-HIGH")
print("  TEST 4 (LOW beep)   → confirms active-LOW")
print("  None                → check wiring / buzzer power")
print("=" * 50)

