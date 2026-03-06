import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/users/currentuser
 * Returns the authenticated user's profile. Used by AuthContext to verify stored tokens.
 */
router.get('/currentuser', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, full_name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[USERS] Current user error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

export default router;
