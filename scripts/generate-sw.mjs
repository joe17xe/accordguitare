/* Injecte la liste des fichiers construits dans dist/sw.js (précache PWA).
   Lancé automatiquement en fin de `npm run build`. */
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else files.push('./' + relative(dist, p).split('\\').join('/'));
  }
})(dist);

const precache = files.filter((f) => f !== './sw.js').sort();

const swPath = join(dist, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
const build = createHash('md5')
  .update(JSON.stringify(precache))
  .digest('hex')
  .slice(0, 8);

sw = sw
  .replace('/*__PRECACHE__*/[]', JSON.stringify(precache))
  .replace('__BUILD__', build);

writeFileSync(swPath, sw);
console.log(`[sw] ${precache.length} fichiers précachés — build ${build}`);
