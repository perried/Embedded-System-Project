/**
 * dashboardHandler.js
 * ====================
 * Socket.IO handler for the /dashboard namespace.
 * Browser clients connect here to receive real-time site data and send threshold changes.
 */

import db from '../db.js';
import { getConnectedSiteIds, getPiNamespace } from './piHandler.js';

/**
 * Initialise the /dashboard namespace handler.
 * @param {import('socket.io').Namespace} nsp - The /dashboard namespace
 */
export default function initDashboardHandler(nsp) {
  nsp.on('connection', async (socket) => {
    console.log(`[DASHBOARD] Client connected: ${socket.id}`);

    // ── Send full site list on connect ──
    try {
      const { rows: sites } = await db.query(
        'SELECT id, name, location, status, thresholds, created_at FROM telco_sites'
      );

      const connected = getConnectedSiteIds();

      const sitesList = sites.map(site => ({
        id: site.id,
        name: site.name,
        location: site.location,
        status: connected.has(site.id) ? site.status : 'offline',
        connected: connected.has(site.id),
        thresholds: site.thresholds || null,
      }));

      socket.emit('sites:list', sitesList);
    } catch (err) {
      console.error('[DASHBOARD] Error sending sites list:', err.message);
    }

    // ── Subscribe to a specific site's data stream ──
    socket.on('site:subscribe', ({ siteId }) => {
      if (!siteId) return;
      // Leave all previous site rooms (except the socket's own room)
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.leave(room);
      }
      socket.join(siteId);
      console.log(`[DASHBOARD] ${socket.id} subscribed to site: ${siteId}`);
    });

    // ── Handle threshold updates from dashboard UI ──
    socket.on('thresholds:set', async ({ siteId, thresholds }) => {
      if (!siteId || !thresholds || typeof thresholds !== 'object') {
        socket.emit('thresholds:error', { message: 'Invalid payload — need siteId and thresholds object' });
        return;
      }

      console.log(`[DASHBOARD] Thresholds update for ${siteId}:`, thresholds);

      // Persist to DB
      try {
        await db.query(
          'UPDATE telco_sites SET thresholds = $1 WHERE id = $2',
          [JSON.stringify(thresholds), siteId]
        );

        // Forward to the target Pi via /pi namespace
        const piNsp = getPiNamespace();
        if (piNsp) {
          piNsp.to(siteId).emit('thresholds:update', thresholds);
          console.log(`[DASHBOARD] Forwarded thresholds to Pi ${siteId}`);
        }

        // Confirm back to the requesting dashboard
        socket.emit('thresholds:saved', { siteId, thresholds });

        // Broadcast to all dashboard clients so they see the update
        nsp.emit('thresholds:updated', { siteId, thresholds });
      } catch (err) {
        console.error(`[DASHBOARD] Failed to save thresholds for ${siteId}:`, err.message);
        socket.emit('thresholds:error', { siteId, message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[DASHBOARD] Client disconnected: ${socket.id}`);
    });
  });
}
