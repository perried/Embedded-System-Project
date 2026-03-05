/**
 * vite-env.d.ts
 * =============
 * Vite environment variable type declarations.
 * Provides TypeScript IntelliSense for import.meta.env properties.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API requests (default: '' for same-origin) */
  readonly VITE_API_BASE_URL: string
  /** Gemini API key (unused — reserved for future AI features) */
  readonly VITE_GEMINI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
