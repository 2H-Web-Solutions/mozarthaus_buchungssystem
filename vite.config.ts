import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { regiondoProductsApiPlugin } from './vite/plugins/regiondoProductsApi';

/**
 * Regiondo API keys use the VITE_ prefix for naming consistency in .env files.
 * They must never be inlined into the client bundle — scrub them here (the dev
 * proxy reads them from `loadEnv(..., '')` in this file instead).
 */
const SCRUB_REGIONDO_KEYS_FROM_CLIENT = {
  'import.meta.env.VITE_REGIONDO_PUBLIC_KEY': 'undefined',
  'import.meta.env.VITE_REGIONDO_PRIVATE_KEY': 'undefined',
} as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: SCRUB_REGIONDO_KEYS_FROM_CLIENT,
    plugins: [
      react(),
      regiondoProductsApiPlugin(env)
    ],
  };
});
