import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All shippers routes require authentication
router.use(authenticateToken);

/**
 * GET /api/shippers
 * List all shippers.
 */
router.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM shippers ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('[SHIPPERS] List error:', err.message);
    res.status(500).json({ error: 'Failed to fetch shippers.' });
  }
});

/**
 * POST /api/shippers
 * Create a new shipper.
 */
router.post('/', async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Shipper name is required.' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO shippers (name, contact_person, phone, email, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, contact_person || null, phone || null, email || null, address || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[SHIPPERS] Create error:', err.message);
    res.status(500).json({ error: 'Failed to create shipper.' });
  }
});

/**
 * DELETE /api/shippers/:id
 * Delete a shipper.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await db.query('DELETE FROM shippers WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Shipper not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[SHIPPERS] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete shipper.' });
  }
});

export default router;
