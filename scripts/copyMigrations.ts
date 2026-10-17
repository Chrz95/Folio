import { cpSync } from 'node:fs';
cpSync('backend/src/db/migrations', 'backend/dist/db/migrations', { recursive: true });
