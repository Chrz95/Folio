import { rmSync } from 'node:fs';
// Clear only generated frontend assets before Vite/PWA builds its precache manifest.
rmSync('frontend/dist', { recursive: true, force: true });
