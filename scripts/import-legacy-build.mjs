import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] || '../gla-legacy-restore');
const root = fileURLToPath(new URL('../', import.meta.url));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source }).toString().trim();
if (execFileSync('git', ['status', '--porcelain'], { cwd: source }).toString().trim()) {
  throw new Error('Commit the reviewed legacy source before importing its build.');
}
execFileSync('npm', ['run', 'build'], { cwd: source, stdio: 'inherit' });
const dist = resolve(source, 'dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
const files = [...html.matchAll(/(?:src|href)="(\/legacy-assets\/[^"?#]+)"/g)].map(match => match[1]);
if (files.length < 3 || !files.some(file => file.endsWith('.js'))) throw new Error('Expected the recovered legacy JS, CSS, and font.');
for (const file of new Set(files)) {
  const from = resolve(dist, `.${file}`);
  if (!from.startsWith(`${dist}/legacy-assets/`)) throw new Error('Invalid build asset path');
  const to = resolve(root, 'public', `.${file}`);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
// Prepare a separate entry point; only the cutover script activates it.
writeFileSync(resolve(root, 'public/legacy-restored-index.html'), html.replace('href="/favicon.ico"', 'href="/legacy-img/favicon.png"'));
mkdirSync(resolve(root, 'docs'), { recursive: true });
writeFileSync(resolve(root, 'docs/legacy-build.json'), JSON.stringify({
  repository: 'jaygbarton/gla-v3', revision, baseRevision: '4a45ae226fd8510e95d24ba5325de3d0639caefd',
  entry: 'public/legacy-restored-index.html', active: false,
  activationRequires: 'Verified original PHP backend and uploads origin',
  assets: [...new Set(files)],
}, null, 2) + '\n');
console.log(`Prepared legacy UI from ${revision}; live legacy-index.html is unchanged.`);
