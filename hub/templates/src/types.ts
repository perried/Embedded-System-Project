/**
 * types.ts
 * ========
 * Shared TypeScript interfaces for the TRSMS dashboard.
 * Defines the data shapes for sites, sensors, alerts, and thresholds.
 */

/** The three sensor types monitored by the system */
export type SensorType = 'temperature' | 'humidity' | 'smoke';

/** A single timestamped sensor reading (used in history arrays) */
export interface SensorReading {
  timestamp: number;   // Unix milliseconds
  value: number;       // Sensor value (°C, %, or 0/1 for smoke)
}

/** Per-site threshold configuration (pushed to Pi, stored in PostgreSQL JSONB) */
export interface Thresholds {
  temp_fan_on: number;       // °C — fan relay activation temperature
  temp_warning: number;      // °C — temperature warning threshold
  temp_critical: number;     // °C — temperature critical threshold
  humidity_warning: number;  // %  — humidity warning threshold
  smoke_critical: number;    // digital — smoke detection threshold
}

/** Complete site status object returned by GET /api/sites and Socket.IO events */
export interface SiteStatus {
  id: string;            // Unique site identifier (e.g. 'site-001')
  name: string;          // Human-readable site name
  location: string;      // GPS coordinates or description
  status: 'online' | 'warning' | 'critical' | 'offline';
  lastUpdate: number;    // Unix ms of last sensor reading
  connected?: boolean;   // True if Pi has an active WebSocket connection
  thresholds?: Thresholds | null;  // Per-site threshold overrides (null = use defaults)
  sensors: {
    temperature: {
      current: number;           // Latest reading in °C
      unit: string;              // Display unit ('°C')
      history: SensorReading[];  // Recent readings for chart
      threshold: number;         // Warning threshold for display
    };
    humidity: {
      current: number;
      unit: string;
      history: SensorReading[];
      threshold: number;
    };
    smoke: {
      current: number;           // 0 = clear, 1 = smoke detected
      unit: string;
      history: SensorReading[];
      threshold: number;
    };
  };
}

/** Active alert generated from threshold comparison (client-side only) */
export interface Alert {
  id: string;              // Composite key: 'alert-{siteId}-{sensorType}'
  siteId: string;
  siteName: string;
  type: SensorType;
  severity: 'warning' | 'critical';
  message: string;         // Human-readable alert description
  timestamp: number;       // When the alert was generated (Unix ms)
  resolved: boolean;       // Whether the alert has been acknowledged
}
