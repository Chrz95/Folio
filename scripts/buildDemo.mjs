import { execFileSync } from 'node:child_process';
execFileSync('pnpm', ['build'], { stdio: 'inherit', env: { ...process.env, VITE_DEMO_MODE: 'true' } });
