import { execFileSync } from 'node:child_process';
import { migrateExclusively } from './dockerMigrate.js';
const composeArguments = ['compose', '--profile', 'app'];
execFileSync('docker', [...composeArguments, 'stop', 'backend'], { stdio: 'inherit' });
// Each release runs a fresh migrator; no old completed container is treated as migration evidence.
migrateExclusively();
// Compose 2.20+ waits only on long-running services; the one-shot job already succeeded above.
execFileSync('docker', [...composeArguments, 'up', '-d', '--no-deps', '--force-recreate', '--wait', 'backend'], {
  stdio: 'inherit',
});
execFileSync('docker', [...composeArguments, 'up', '-d', '--no-deps', '--force-recreate', '--wait', 'frontend'], {
  stdio: 'inherit',
});
