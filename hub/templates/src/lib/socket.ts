/**
 * socket.ts
 * =========
 * Socket.IO client singleton for the /dashboard namespace.
 * Provides typed event helpers for the React app.
 */

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../constants';

// ── Types for socket events ──
export interface SiteStatusEvent {
  siteId: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  connected: boolean;
}

export interface SiteDataEvent {
  siteId: string;
  sensors: {
    temperature: number;
    humidity: number;
    smoke: number;
  };
  status: 'online' | 'warning' | 'critical';
  timestamp: number;
}

export interface SitesListItem {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  connected: boolean;
  thresholds: Thresholds | null;
}

export interface Thresholds {
  temp_fan_on: number;
  temp_warning: number;
  temp_critical: number;
  humidity_warning: number;
  smoke_critical: number;
}

export interface ThresholdsSavedEvent {
  siteId: string;
  thresholds: Thresholds;
}

export interface ThresholdsAckEvent {
  siteId: string;
  thresholds: Thresholds;
}

// ── Singleton socket instance ──
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${API_BASE_URL}/dashboard`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    socket.on('connect', () => {
      console.log('[SOCKET] Connected to dashboard namespace');
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err.message);
    });
  }
  return socket;
}

// ── Typed event helpers ──

export function onSitesList(cb: (sites: SitesListItem[]) => void): () => void {
  const s = getSocket();
  s.on('sites:list', cb);
  return () => { s.off('sites:list', cb); };
}

export function onSiteData(cb: (data: SiteDataEvent) => void): () => void {
  const s = getSocket();
  s.on('site:data', cb);
  return () => { s.off('site:data', cb); };
}

export function onSiteStatus(cb: (data: SiteStatusEvent) => void): () => void {
  const s = getSocket();
  s.on('site:status', cb);
  return () => { s.off('site:status', cb); };
}

export function onThresholdsSaved(cb: (data: ThresholdsSavedEvent) => void): () => void {
  const s = getSocket();
  s.on('thresholds:saved', cb);
  return () => { s.off('thresholds:saved', cb); };
}

export function onThresholdsAck(cb: (data: ThresholdsAckEvent) => void): () => void {
  const s = getSocket();
  s.on('thresholds:ack', cb);
  return () => { s.off('thresholds:ack', cb); };
}

export function onThresholdsUpdated(cb: (data: ThresholdsSavedEvent) => void): () => void {
  const s = getSocket();
  s.on('thresholds:updated', cb);
  return () => { s.off('thresholds:updated', cb); };
}

export function subscribeSite(siteId: string): void {
  getSocket().emit('site:subscribe', { siteId });
}

export function emitThresholdsSet(siteId: string, thresholds: Partial<Thresholds>): void {
  getSocket().emit('thresholds:set', { siteId, thresholds });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
