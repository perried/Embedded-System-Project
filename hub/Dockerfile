# ── TelcoGuard Hub Server ──
# Multi-stage build:
#   Stage 1 — Build the React dashboard (Vite)
#   Stage 2 — Run Express + Socket.IO, serve the built dashboard as static files

# ────────────────── Stage 1: Build React dashboard ──────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /build

COPY templates/package.json ./
RUN npm install

COPY templates/ ./

# VITE_API_BASE_URL left empty → dashboard uses same origin
RUN npm run build

# ────────────────── Stage 2: Production server ──────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

RUN npm install --omit=dev

# Copy server source
COPY src/ ./src/

# Copy built dashboard into /app/public (Express serves this)
COPY --from=frontend-build /build/dist ./public/

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "src/index.js"]
