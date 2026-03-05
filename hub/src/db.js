import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'telcoguard',
  user:     process.env.DB_USER     || 'telcoguard',
  password: process.env.DB_PASSWORD || 'telcoguard',
  max:      20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Quick connectivity check on startup
pool.query('SELECT NOW()')
  .then(() => console.log('[DB] PostgreSQL connected'))
  .catch(err => console.error('[DB] PostgreSQL connection failed:', err.message));

export default pool;
