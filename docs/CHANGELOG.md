# TRSMS Changelog

## [2026-03-06] — Dashboard Simplification

### Added
- **Sites management page** — register, edit, and delete monitoring sites from the sidebar (`Sites` nav button)
- **Empty state UI** — "No Sites Connected" placeholder shown when no Pi is connected and no sites exist in the database
- Backend `POST /api/sites` — manually register a new site
- Backend `PUT /api/sites/:id` — update site name/location
- Backend `DELETE /api/sites/:id` — delete a site and its sensor history

### Removed
- **User authentication** — removed login/register pages, JWT middleware, auth routes, user management (`/api/auth`, `/api/users`). Dashboard is now open-access.
- **Shippers page** — removed logistics provider management UI and `GET/POST/DELETE /api/shippers` backend routes
- **Mock data** — removed `MOCK_SITES` from `constants.ts`. Dashboard now shows only real data from the database; if no sites exist, it displays the empty state.
- Removed `AuthContext`, `Login.tsx`, `Shippers.tsx` frontend files
- Removed `bcryptjs`, `jsonwebtoken` dependencies from hub `package.json`
- Removed `users` and `shippers` tables from `init.sql`

### Changed
- `SOCKET_URL` in `config.py` updated to point to GCP VM (`http://34.35.155.136:3001`)
- Sidebar title fixed from "TERMS" to "TRSMS"
- Site CRUD routes (`POST`, `PUT`, `DELETE`) no longer require JWT — open access for simplicity
- `docker-compose.yml` removed `JWT_SECRET` environment variable

---

## [2026-03-06] — Hub-and-Spoke Architecture (Initial)

### Added
- **Socket.IO bidirectional communication** — Pi connects to `/pi` namespace, dashboard to `/dashboard`
- **Auto-registration** — Pi sites are created in the database automatically on first connect
- **Real-time dashboard** — sensor data streams every 2s via WebSocket (replaces REST polling)
- **Threshold editor** — NOC operators can adjust thresholds from the dashboard; changes push to Pi in real-time
- **PostgreSQL** — self-hosted database in Docker (replaces Supabase)
- **Docker Compose deployment** — hub + PostgreSQL on Google Compute Engine
- **Multi-stage Dockerfile** — builds React dashboard and serves it from the same Express server on port 3001
