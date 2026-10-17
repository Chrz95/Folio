import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const directory = 'frontend/dist';
const manifest = JSON.parse(readFileSync(`${directory}/manifest.webmanifest`, 'utf8'));
for (const field of [
  'name',
  'short_name',
  'description',
  'lang',
  'dir',
  'id',
  'start_url',
  'scope',
  'display',
  'theme_color',
  'background_color',
  'categories',
  'icons',
]) {
  assert.ok(manifest[field], `Missing ${field}`);
}
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.theme_color, '#315c46');
for (const size of ['192x192', '512x512']) {
  assert.ok(manifest.icons.some((icon) => icon.sizes === size));
}
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
for (const icon of manifest.icons) {
  assert.ok(existsSync(`${directory}${icon.src}`));
}
for (const file of ['index.html', 'sw.js', 'favicon.svg', 'favicon.ico', 'icons/apple-touch-icon-180x180.png']) {
  assert.ok(statSync(`${directory}/${file}`).size > 0);
}
process.stdout.write('Manifest, icons, app shell and service-worker artifacts verified.\n');

const assets = readdirSync(`${directory}/assets`);
const worker = assets.find((file) => /^actual\.worker-.*\.js$/.test(file));
const wasm = assets.find((file) => /^sql-wasm-browser-.*\.wasm$/.test(file));
assert.ok(worker && wasm, 'Native import worker and WASM must be bundled');
assert.ok(readFileSync(`${directory}/assets/${worker}`, 'utf8').includes(wasm));
const serviceWorker = readFileSync(`${directory}/sw.js`, 'utf8');
assert.ok(serviceWorker.includes(worker) && serviceWorker.includes(wasm), 'Importer must be precached');
process.stdout.write('Native import worker, WASM reference and offline precache verified.\n');
