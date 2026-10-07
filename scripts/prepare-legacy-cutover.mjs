import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { legacyRouting } from './legacy-routing.mjs';

const root = new URL('../', import.meta.url);
const origin = process.argv[2];
if (!origin) throw new Error('Usage: node scripts/prepare-legacy-cutover.mjs https://confirmed-php-origin.example [--write]');
const file = new URL('vercel.json', root);
const proposed = legacyRouting(JSON.parse(readFileSync(file, 'utf8')), origin);
const restored = new URL('public/legacy-restored-index.html', root);
if (!existsSync(restored)) throw new Error('The recovered legacy build is missing.');
if (process.argv.includes('--write')) {
  writeFileSync(file, JSON.stringify(proposed, null, 2) + '\n');
  copyFileSync(restored, new URL('public/legacy-index.html', root));
  console.log(`Updated ${fileURLToPath(file)} and the legacy entry point. Review, validate the original API/files, then commit and deploy.`);
} else {
  console.log(JSON.stringify(proposed, null, 2));
}
