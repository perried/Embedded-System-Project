/**
 * piHandler.js
 * =============
 * Socket.IO handler for the /pi namespace.
 * Each Raspberry Pi connects here, streams sensor data, and receives threshold updates.
 */

import db from '../db.js';
import { deriveStatus, resolveThresholds } from '../services/statusService.js';
import { sendPushNotification } from '../services/notificationService.js';

// In-memory map of connected Pi devices: siteId → socket.id
// Used to track which sites are online and to route threshold updates
const connectedPis = new Map();

/**
 * Returns the set of currently connected site IDs.
 */
export function getConnectedSiteIds() {
  return new Set(connectedPis.keys());
}

/**
 * Check if a specific site has a Pi connected.
 */
export function isSiteConnected(siteId) {
  return connectedPis.has(siteId);
}

/**
 * Get the /pi namespace reference (set during init).
 */
let piNamespace = null;

export function getPiNamespace() {
  return piNamespace;
}

/**
 * Initialise the /pi namespace handler.
 * @param {import('socket.io').Namespace} nsp - The /pi namespace
 * @param {import('socket.io').Namespace} dashboardNsp - The /dashboard namespace (for broadcasting)
 */
export default function initPiHandler(nsp, dashboardNsp) {
  piNamespace = nsp;

  nsp.on('connection', async (socket) => {
    const { siteId, siteName, location } = socket.handshake.auth;

    if (!siteId) {
      console.warn('[PI] Connection rejected — missing siteId in auth');
      socket.disconnect(true);
      return;
    }

    console.log(`[PI] Connected: ${siteId} (${siteName || 'unnamed'}) — socket ${socket.id}`);

    // Track this Pi
    connectedPis.set(siteId, socket.id);

    // Join a room named after the siteId
    socket.join(siteId);

    // ── Auto-register / update site in DB ──
    try {
      const { rows } = await db.query(
        `INSERT INTO telco_sites (id, name, location, status)
         VALUES ($1, $2, $3, 'online')
         ON CONFLICT (id) DO UPDATE SET status = 'online'
         RETURNING (xmax = 0) AS inserted`,
        [siteId, siteName || siteId, location || 'Unknown']
      );
      if (rows[0]?.inserted) {
        console.log(`[PI] Auto-registered new site: ${siteId}`);
      }
    } catch (err) {
      console.error(`[PI] DB error during site upsert for ${siteId}:`, err.message);
    }

    // ── Push stored thresholds to Pi ──
    try {
      const { rows } = await db.query(
        'SELECT thresholds FROM telco_sites WHERE id = $1',
        [siteId]
      );
      if (rows[0]?.thresholds) {
        socket.emit('thresholds:update', rows[0].thresholds);
        console.log(`[PI] Pushed thresholds to ${siteId}:`, rows[0].thresholds);
      }
    } catch (err) {
      console.error(`[PI] Failed to push thresholds to ${siteId}:`, err.message);
    }

    // ── Notify dashboard of new connection ──
    dashboardNsp.emit('site:status', {
      siteId,
      status: 'online',
      connected: true,
    });

    // ── Handle sensor data from Pi ──
    socket.on('sensor:data', async (payload) => {
      const { sensors, timestamp } = payload;

      if (!sensors || typeof sensors !== 'object') return;

      const ts = timestamp || Date.now();
      // Whitelist of accepted sensor types — prevents injection of arbitrary keys
      const ALLOWED_SENSORS = ['temperature', 'humidity', 'smoke'];

      // Build array of validated readings to batch-insert into PostgreSQL
      const readingsToInsert = [];
      for (let [type, value] of Object.entries(sensors)) {
        if (type === 'gas') type = 'smoke';           // Normalise legacy key
        if (!ALLOWED_SENSORS.includes(type)) continue; // Skip unknown sensor types
        if (typeof value !== 'number') continue;       // Skip non-numeric values
        readingsToInsert.push({
          site_id: siteId,
          sensor_type: type,
          value,
          timestamp: ts,
        });
      }

      try {
        if (readingsToInsert.length > 0) {
          const values = readingsToInsert.map((r, i) => {
            const o = i * 4;
            return `($${o+1}, $${o+2}, $${o+3}, $${o+4})`;
          }).join(', ');
          const params = readingsToInsert.flatMap(r => [r.site_id, r.sensor_type, r.value, r.timestamp]);
          await db.query(
            `INSERT INTO telco_sensor_readings (site_id, sensor_type, value, timestamp) VALUES ${values}`,
            params
          );
        }

        // Derive status using per-site thresholds
        let siteThresholds = null;
        try {
          const { rows: thRows } = await db.query(
            'SELECT thresholds FROM telco_sites WHERE id = $1', [siteId]
          );
          siteThresholds = thRows[0]?.thresholds || null;
        } catch { /* use defaults */ }

        const status = deriveStatus(sensors, siteThresholds);

        // Update site status
        const { rows: updatedRows } = await db.query(
          'UPDATE telco_sites SET status = $1 WHERE id = $2 RETURNING name',
          [status, siteId]
        );
        const siteData = updatedRows[0];

        // Broadcast to dashboard
        dashboardNsp.emit('site:data', {
          siteId,
          sensors,
          status,
          timestamp: ts,
        });

        // Trigger push notification for abnormal statuses
        if (status === 'critical' || status === 'warning') {
          const siteName = siteData?.name || siteId;
          sendPushNotification(siteName, status, sensors).catch(err => {
            console.error('[NOTIFICATION] Failed:', err.message);
          });
        }
      } catch (err) {
        console.error(`[PI] Error processing sensor data from ${siteId}:`, err.message);
      }
    });

    // ── Handle threshold acknowledgement from Pi ──
    socket.on('thresholds:ack', (payload) => {
      console.log(`[PI] Thresholds acknowledged by ${siteId}:`, payload?.thresholds);
      dashboardNsp.emit('thresholds:ack', {
        siteId,
        thresholds: payload?.thresholds,
      });
    });

    // ── Handle disconnect ──
    socket.on('disconnect', async (reason) => {
      console.log(`[PI] Disconnected: ${siteId} — reason: ${reason}`);
      connectedPis.delete(siteId);

      // Update DB status
      try {
        await db.query('UPDATE telco_sites SET status = $1 WHERE id = $2', ['offline', siteId]);
      } catch (err) {
        console.error(`[PI] Failed to update offline status for ${siteId}:`, err.message);
      }

      // Notify dashboard
      dashboardNsp.emit('site:status', {
        siteId,
        status: 'offline',
        connected: false,
      });
    });
  });
}
