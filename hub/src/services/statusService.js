/**
 * statusService.js
 * ================
 * Shared logic to derive a site's status from sensor readings + thresholds.
 * Used by both the REST ingest route and the Socket.IO pi handler.
 */

// Default thresholds — used when a site has no custom thresholds in the DB.
// These mirror the defaults in config.py on the Raspberry Pi.
const DEFAULT_THRESHOLDS = {
  temp_fan_on: 29.5,       // °C — fan relay activation temperature
  temp_warning: 38,        // °C — temperature warning threshold
  temp_critical: 45,       // °C — temperature critical threshold
  humidity_warning: 70,    // %  — humidity warning threshold
  smoke_critical: 0.5,     // digital — smoke detection threshold (MQ2 DO pin)
};

/**
 * Merge per-site thresholds with defaults.
 * @param {object|null} siteThresholds - Thresholds from DB (may be null/partial)
 * @returns {object} Complete thresholds with defaults filled in
 */
export function resolveThresholds(siteThresholds) {
  return { ...DEFAULT_THRESHOLDS, ...(siteThresholds || {}) };
}

/**
 * Derive site status from current sensor values and thresholds.
 * @param {object} sensors - { temperature, humidity, smoke }
 * @param {object|null} siteThresholds - Per-site thresholds from DB (nullable)
 * @returns {'online'|'warning'|'critical'}
 */
export function deriveStatus(sensors, siteThresholds = null) {
  const t = resolveThresholds(siteThresholds);

  const temp  = sensors.temperature ?? 0;
  const humid = sensors.humidity    ?? 0;
  const smoke = sensors.smoke ?? sensors.gas ?? 0;  // Support both 'smoke' and legacy 'gas' key

  // Priority: critical > warning > online
  // Smoke sensor is binary (MQ2 DO pin): 1 = gas/smoke above board threshold
  if (temp > t.temp_critical || smoke > t.smoke_critical) return 'critical';
  if (temp > t.temp_warning || humid > t.humidity_warning) return 'warning';
  return 'online';
}

export { DEFAULT_THRESHOLDS };
