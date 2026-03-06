/**
 * index.js
 * ========
 * TRSMS Hub Server — Express + Socket.IO entry point.
 *
 * Creates the HTTP server, attaches Socket.IO with two namespaces
 * (/pi for Raspberry Pi devices, /dashboard for browser clients),
 * mounts REST API routes, and serves the built React dashboard.
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';
import ingestRouter  from './routes/ingest.js';
import sitesRouter   from './routes/sites.js';
import initPiHandler from './socket/piHandler.js';
import initDashboardHandler from './socket/dashboardHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app  = express();
const port = process.env.PORT || 3001;

// ── HTTP server (required for Socket.IO to attach to) ──
const server = http.createServer(app);

// ── Socket.IO server — allow all origins for Pi and dashboard connections ──
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Create namespaces for separation of concerns:
//   /pi        — Raspberry Pi devices connect here to stream sensor data
//   /dashboard — Browser clients connect here for real-time updates
const piNamespace        = io.of('/pi');
const dashboardNamespace = io.of('/dashboard');

// Initialise Socket.IO event handlers for each namespace
initPiHandler(piNamespace, dashboardNamespace);
initDashboardHandler(dashboardNamespace);

// ── Middleware ──
app.use(cors());           // Allow cross-origin requests from any domain
app.use(express.json());   // Parse JSON request bodies

// ── REST API Routes ──
app.use('/api/ingest',   ingestRouter);   // POST - Pi sensor data (legacy HTTP fallback)
app.use('/api/sites',    sitesRouter);    // CRUD - Site management + dashboard hydration

// Health check endpoint (used by Docker healthcheck / load balancers)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Serve React dashboard (built static files) ──────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// SPA fallback — any non-API route serves index.html
app.get('*', (_req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:4rem">
          <h1>TRSMS Hub</h1>
          <p>API is running. Dashboard not built yet.</p>
          <code>GET /api/sites</code> · <code>WS /pi</code> · <code>WS /dashboard</code>
        </body></html>
      `);
    }
  });
});

// ── Start (use server.listen, not app.listen, for Socket.IO) ──────────
server.listen(port, () => {
  console.log(`TRSMS hub running at http://localhost:${port}`);
  console.log(`  POST /api/ingest  — Raspberry Pi sensor data (legacy REST)`);
  console.log(`  GET  /api/sites   — Dashboard data`);
  console.log(`  WS   /pi          — Raspberry Pi Socket.IO namespace`);
  console.log(`  WS   /dashboard   — Dashboard Socket.IO namespace`);
});
