import express from 'express';
import db from '../db.js';
import { sendPushNotification } from '../services/notificationService.js';
import { deriveStatus } from '../services/statusService.js';

const router = express.Router();

/**
 * Middleware: verify X-API-Key header
 * The Raspberry Pi must include this header with every ingest request.
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.INGEST_API_KEY;

  if (!expectedKey) {
    console.error('[AUTH] INGEST_API_KEY is not set in environment variables!');
    return res.status(500).json({ error: 'Server misconfigured: API key not set.' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    console.warn(`[AUTH] Rejected ingest request — invalid or missing API key.`);
    return res.status(401).json({ error: 'Unauthorized: invalid or missing X-API-Key header.' });
  }

  next();
}

  /**
   * POST /api/ingest
   * Accepts sensor readings from the Raspberry Pi.
   *
   * Expected body:
   * {
   *   "siteId": "site-001",
   *   "sensors": {
   *     "temperature": 27.4,   // °C
   *     "humidity": 55.2,      // %
   *     "smoke": 1             // 0=Clear, 1=Detected
   *   }
   * }
   *
   * Headers:
   *   X-API-Key: <your secret key>
   */
router.post('/', requireApiKey, async (req, res) => {
  const { siteId, sensors } = req.body;

  if (!siteId || typeof sensors !== 'object') {
    return res.status(400).json({ error: 'Request must include siteId and sensors object.' });
  }

  const ALLOWED_SENSORS = ['temperature', 'humidity', 'smoke'];
  const timestamp = Date.now();

  const readingsToInsert = [];
  for (let [type, value] of Object.entries(sensors)) {
    // Normalise legacy 'gas' key → 'smoke'
    if (type === 'gas') type = 'smoke';

    if (!ALLOWED_SENSORS.includes(type)) continue; // ignore unknown sensors
    if (typeof value !== 'number') continue;

    readingsToInsert.push({
      site_id: siteId,
      sensor_type: type,
      value,
      timestamp
    });
  }

  try {
    // Insert sensor readings
    if (readingsToInsert.length > 0) {
      const values = readingsToInsert.map((r, i) => {
        const offset = i * 4;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4})`;
      }).join(', ');
      const params = readingsToInsert.flatMap(r => [r.site_id, r.sensor_type, r.value, r.timestamp]);

      await db.query(
        `INSERT INTO telco_sensor_readings (site_id, sensor_type, value, timestamp) VALUES ${values}`,
        params
      );
    }

    // Fetch per-site thresholds (if any) for status derivation
    let siteThresholds = null;
    try {
      const { rows } = await db.query('SELECT thresholds FROM telco_sites WHERE id = $1', [siteId]);
      siteThresholds = rows[0]?.thresholds || null;
    } catch { /* use defaults */ }

    // Derive site status using shared service (respects per-site thresholds)
    const status = deriveStatus(sensors, siteThresholds);

    // Update site status and fetch name for notification
    const { rows: updatedRows } = await db.query(
      'UPDATE telco_sites SET status = $1 WHERE id = $2 RETURNING name',
      [status, siteId]
    );

    if (updatedRows.length === 0) throw new Error(`Site ${siteId} not found`);

    // Trigger push notification for abnormal statuses
    if (status === 'critical' || status === 'warning') {
      const siteName = updatedRows[0]?.name || siteId;
      sendPushNotification(siteName, status, sensors).catch(err => {
        console.error('[NOTIFICATION] Failed to send push notification:', err.message);
      });
    }

    console.log(`[INGEST] site=${siteId} temp=${sensors.temperature} humid=${sensors.humidity} smoke=${sensors.smoke ?? sensors.gas}`);
    res.status(200).json({ success: true, timestamp });
  } catch (err) {
    console.error('[INGEST] DB error:', err.message);
    res.status(500).json({ error: 'Failed to store sensor readings.' });
  }
});

export default router;
