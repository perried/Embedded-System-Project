/**
 * constants.ts
 * ============
 * Application constants for the TRSMS dashboard.
 *
 * API_BASE_URL defaults to '' (empty string) so that API requests go to the
 * same origin as the dashboard. Override via VITE_API_BASE_URL env var.
 */

/** Base URL for REST API requests — empty string = same-origin (served by Express) */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
