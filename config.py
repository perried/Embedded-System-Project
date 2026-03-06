"""
Configuration for Telecom Room Monitoring System
=================================================
Central file for GPIO pin assignments and alert thresholds.
Adjust values below to match your wiring and environment requirements.
"""

# ── GPIO Pin Assignments ──────────────────────────────────────────────
DHT_PIN = 4            # DHT11 data pin (GPIO 4 / board pin 7)
BUZZER_PIN = 17        # Active buzzer signal pin (GPIO 17 / board pin 11)
FAN_RELAY_PIN = 27     # Fan relay module IN pin (GPIO 27 / board pin 13)
MQ2_DO_PIN = 22        # MQ2 digital output pin (GPIO 22 / board pin 15)

# ── I2C LCD Display ──────────────────────────────────────────────────
LCD_I2C_ADDR = 0x27    # PCF8574 backpack address (common: 0x27 or 0x3F)
LCD_COLS = 20          # Number of columns on the LCD
LCD_ROWS = 4           # Number of rows on the LCD

# ── Thresholds (defaults — can be overridden from dashboard) ──────────
TEMP_FAN_ON = 29.5         # °C — fan relay activates at or above this temp
TEMP_WARNING = 38          # °C — warning status threshold
TEMP_CRITICAL = 45         # °C — critical status threshold
HUMIDITY_WARNING = 70      # %  — humidity warning threshold
SMOKE_CRITICAL = 0.5       # digital — smoke critical threshold
# Gas threshold is set via the potentiometer on the MQ2 module board

# ── Timing ────────────────────────────────────────────────────────────
READ_INTERVAL = 2      # Seconds between sensor readings

# ── Backend Configuration ─────────────────────────────────────────────
API_KEY = "trsms-key"
SITE_ID = "site-001"
SITE_NAME = "North Ridge Tower"     # Display name for this site
SITE_LOCATION = "40.71° N, 74.00° W"  # GPS / description
SEND_INTERVAL = 30   # Seconds between data transmissions (legacy HTTP)

# ── Socket.IO Hub ─────────────────────────────────────────────────────
SOCKET_URL = "http://34.35.155.136:3001"  # GCP VM hub
