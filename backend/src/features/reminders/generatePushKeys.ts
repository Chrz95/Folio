import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import webpush from 'web-push';
import { z } from 'zod';
const PRIVATE_MODE = 0o600;
/** Create one private environment file, refusing to overwrite existing signing keys.
 * @param {string} destination - Explicit output path. @param {string} subject - Operator mailto/HTTPS contact.
 * @returns {string} Written path, never the private signing key. */
export function generatePushConfiguration(destination: string, subject: string): string {
  z.string()
    .regex(/^(mailto:|https:\/\/)[^\r\n]+$/)
    .parse(subject);
  const path = resolve(destination);
  const keys = webpush.generateVAPIDKeys();
  const content =
    `VAPID_PUBLIC_KEY=${keys.publicKey}\n` + `VAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=${subject}\n`;
  writeFileSync(path, content, { mode: PRIVATE_MODE, flag: 'wx' });
  return path;
}
if (/generatePushKeys\.(js|ts)$/.test(process.argv[1] ?? '')) {
  const [, , destination, subject] = process.argv;
  if (!destination || !subject) {
    throw new Error('Usage: push:keys OUTPUT_FILE mailto:operator@example.com');
  }
  process.stdout.write(`Private push configuration written to ${generatePushConfiguration(destination, subject)}\n`);
}
