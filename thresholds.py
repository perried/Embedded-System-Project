"""
Threshold Manager
=================
Manages sensor thresholds with a 3-tier fallback:
  1. Dashboard-pushed values (persisted in thresholds.json)
  2. Local thresholds.json file (survives Pi reboot)
  3. Defaults from config.py (ultimate fallback)

Thread-safe — can be read from main loop and written from transmitter thread.
"""

import os
import json
import threading
import logging

import config

logger = logging.getLogger(__name__)

# Path to the local thresholds file (next to this script)
_THRESHOLDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "thresholds.json")

# Defaults from config.py
_DEFAULTS = {
    "temp_fan_on": getattr(config, "TEMP_FAN_ON", 29.5),
    "temp_warning": getattr(config, "TEMP_WARNING", 38),
    "temp_critical": getattr(config, "TEMP_CRITICAL", 45),
    "humidity_warning": getattr(config, "HUMIDITY_WARNING", 70),
    "smoke_critical": getattr(config, "SMOKE_CRITICAL", 0.5),
}

# In-memory thresholds (thread-safe access via lock)
_lock = threading.Lock()
_current = dict(_DEFAULTS)


def load_thresholds():
    """
    Load thresholds from the local JSON file.
    Falls back to config.py defaults if the file doesn't exist or is invalid.
    Called once at startup.
    """
    global _current

    if os.path.exists(_THRESHOLDS_FILE):
        try:
            with open(_THRESHOLDS_FILE, "r") as f:
                saved = json.load(f)
            # Merge with defaults (saved values take priority)
            with _lock:
                _current = {**_DEFAULTS, **saved}
            logger.info(f"Loaded thresholds from {_THRESHOLDS_FILE}: {_current}")
            return
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to read {_THRESHOLDS_FILE}: {e} — using defaults")

    with _lock:
        _current = dict(_DEFAULTS)
    logger.info(f"Using default thresholds: {_current}")


def save_thresholds(thresholds_dict):
    """
    Persist thresholds to the local JSON file.
    """
    try:
        with open(_THRESHOLDS_FILE, "w") as f:
            json.dump(thresholds_dict, f, indent=2)
        logger.info(f"Saved thresholds to {_THRESHOLDS_FILE}")
    except IOError as e:
        logger.error(f"Failed to write thresholds file: {e}")


def get_thresholds():
    """
    Return the current in-memory thresholds dict (thread-safe copy).
    Keys: temp_fan_on, temp_warning, temp_critical, humidity_warning, smoke_critical
    """
    with _lock:
        return dict(_current)


def update_thresholds(new_thresholds):
    """
    Merge new thresholds into current, persist to file, and update in-memory.
    Called when the server pushes a thresholds:update event.
    """
    global _current
    with _lock:
        _current = {**_current, **new_thresholds}
        merged = dict(_current)

    save_thresholds(merged)
    logger.info(f"Thresholds updated: {merged}")
    return merged


# Load on import
load_thresholds()
