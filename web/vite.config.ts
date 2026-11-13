import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The page and the API share an origin (nginx), so no proxy and no CORS (FR-004).
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false },
  test: { environment: 'jsdom' },
});
