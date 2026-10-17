import { execFileSync } from 'node:child_process';
const composeArguments = ['compose', '--profile', 'app'];
/** Refuse migration while any application backend container is running. */
export function requireStoppedBackend() {
  const running = execFileSync('docker', [...composeArguments, 'ps', '--status', 'running', '-q', 'backend'], {
    encoding: 'utf8',
  }).trim();
  if (running) {
    throw new Error('Stop the backend before migrating.');
  }
}
/** Run a fresh one-shot job, propagating migration failure. */
export function migrateExclusively() {
  requireStoppedBackend();
  execFileSync('docker', [...composeArguments, 'run', '--rm', '--no-deps', 'migrate'], { stdio: 'inherit' });
}
if (process.argv[1]?.endsWith('dockerMigrate.ts')) {
  migrateExclusively();
}
