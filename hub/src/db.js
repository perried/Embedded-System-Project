/**
 * db.js
 * =====
 * PostgreSQL connection pool using the `pg` package.
 *
 * Reads connection parameters from environment variables (set via .env).
 * Exports a shared Pool instance used by all route handlers and socket handlers.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool — max 20 concurrent clients, idle timeout 30s
const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'trsms',
  user:     process.env.DB_USER     || 'trsms',
  password: process.env.DB_PASSWORD || 'trsms',
  max:      20,                       // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,           // Close idle clients after 30 seconds
});

// Log unexpected errors on idle clients (prevents unhandled rejections)
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Verify connectivity on startup — fail-fast if DB is unreachable
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] PostgreSQL connected'))
  .catch(err => console.error('[DB] PostgreSQL connection failed:', err.message));

export default pool;
