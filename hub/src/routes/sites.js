import express from 'express';
import db from '../db.js';
import { getConnectedSiteIds } from '../socket/piHandler.js';
import { authenticateToken } from '../middleware/auth.js';

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

/**
 * POST /api/sites
 * Manually register a new site.
 */
router.post('/', authenticateToken, async (req, res) => {
  const { id, name, location } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO telco_sites (id, name, location) VALUES ($1, $2, $3) RETURNING *`,
      [id, name, location || 'Unknown']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Site ID already exists.' });
    }
    console.error('[SITES] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create site.' });
  }
});

/**
 * PUT /api/sites/:id
 * Update a site's name and/or location.
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, location } = req.body;

  try {
    const { rows, rowCount } = await db.query(
      `UPDATE telco_sites SET name = COALESCE($1, name), location = COALESCE($2, location)
       WHERE id = $3 RETURNING *`,
      [name || null, location || null, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Site not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[SITES] Update error:', err.message);
    res.status(500).json({ error: 'Failed to update site.' });
  }
});

/**
 * DELETE /api/sites/:id
 * Delete a site and its sensor history.
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await db.query('DELETE FROM telco_sites WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Site not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[SITES] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete site.' });
  }
});

export default router;
