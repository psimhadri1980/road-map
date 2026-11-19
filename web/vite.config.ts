import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The page and the API share an origin (the gateway), so no proxy and no CORS (FR-004).
export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false },
  // css.include: Vitest blanks CSS by default, even ?raw; tokens.test.ts reads layout.css's text (014 FR-008).
  test: { environment: 'jsdom', css: { include: [/layout\.css/] } },
});
