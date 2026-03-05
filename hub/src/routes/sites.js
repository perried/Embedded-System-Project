import express from 'express';
import db from '../db.js';
import { getConnectedSiteIds } from '../socket/piHandler.js';

const router = express.Router();

// Maximum number of historical readings per sensor type returned to the dashboard
const HISTORY_LIMIT = 100;

// Default sensor display config — threshold used when site has no custom overrides
const SENSOR_DEFAULTS = {
  temperature: { threshold: 29.5, unit: '°C' },      // Warning threshold for display
  humidity:    { threshold: 70.0, unit: '%'  },       // Humidity warning level
  smoke:       { threshold: 0.5,  unit: 'digital'},   // MQ2 digital output threshold
};

/**
 * GET /api/sites
 * Returns all sites with their latest sensor values and reading history.
 */
router.get('/', async (req, res) => {
  try {
    const { rows: sites } = await db.query('SELECT * FROM telco_sites');

    const connectedSiteIds = getConnectedSiteIds();

    const enrichedSites = await Promise.all(sites.map(async (site) => {
      const { rows } = await db.query(
        `SELECT sensor_type, value, timestamp FROM telco_sensor_readings
         WHERE site_id = $1 ORDER BY timestamp DESC LIMIT $2`,
        [site.id, HISTORY_LIMIT * Object.keys(SENSOR_DEFAULTS).length]
      );

      // Group readings by sensor type for the frontend's per-sensor history arrays
      const readingsByType = {};
      rows.forEach((r) => {
        const type = r.sensor_type === 'gas' ? 'smoke' : r.sensor_type; // Normalise legacy key
        if (!SENSOR_DEFAULTS[type]) return;   // Skip unknown sensor types
        if (!readingsByType[type]) readingsByType[type] = [];
        readingsByType[type].push({ timestamp: r.timestamp, value: r.value });
      });

      // Shape sensors object expected by the frontend
      const sensors = {};
      for (const [type, defaults] of Object.entries(SENSOR_DEFAULTS)) {
        const history = readingsByType[type] || [];
        // Use per-site thresholds if available, otherwise defaults
        const siteThreshold = site.thresholds?.[
          type === 'temperature' ? 'temp_warning' :
          type === 'humidity' ? 'humidity_warning' :
          'smoke_critical'
        ];
        sensors[type] = {
          current:   history.length > 0 ? history[0].value : 0,
          history,
          threshold: siteThreshold ?? defaults.threshold,
          unit:      defaults.unit,
        };
      }

      return {
        id:         site.id,
        name:       site.name,
        location:   site.location,
        status:     connectedSiteIds.has(site.id) ? site.status : 'offline',
        connected:  connectedSiteIds.has(site.id),
        lastUpdate: rows.length > 0 ? rows[0].timestamp : new Date(site.created_at).getTime(),
        sensors,
        thresholds: site.thresholds || null,
      };
    }));

    res.json(enrichedSites);
  } catch (err) {
    console.error('[SITES] Error fetching sites:', err.message);
    res.status(500).json({ error: 'Failed to retrieve site data.' });
  }
});

export default router;
