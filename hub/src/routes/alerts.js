import express from 'express';
import db from '../db.js';

const router = express.Router();

/**
 * GET /api/alerts
 * Returns alert history (most recent first).
 * Query params: ?limit=50&siteId=site-001&open=true
 */
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const siteId = req.query.siteId || null;
  const openOnly = req.query.open === 'true';

  let query = `
    SELECT a.*, s.name AS site_name
    FROM telco_alerts a
    JOIN telco_sites s ON a.site_id = s.id
  `;
  const params = [];
  const conditions = [];

  if (siteId) {
    params.push(siteId);
    conditions.push(`a.site_id = $${params.length}`);
  }
  if (openOnly) {
    conditions.push('a.resolved_at IS NULL');
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  params.push(limit);
  query += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

  try {
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[ALERTS] Error fetching alerts:', err.message);
    res.status(500).json({ error: 'Failed to retrieve alerts.' });
  }
});

export default router;
