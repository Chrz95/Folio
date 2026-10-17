import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
execFileSync('pnpm', ['exec', 'pwa-assets-generator', '--config', 'frontend/pwa-assets.config.ts'], {
  stdio: 'inherit',
});
copyFileSync('frontend/public/icons/favicon.ico', 'frontend/public/favicon.ico');
