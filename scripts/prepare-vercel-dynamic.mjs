/**
 * Expo static export writes dynamic routes as bracket files
 * (`dist/pin/[id].html`). Vercel rewrite destinations are checked with a
 * glob, so `[id]` is a character class and the rewrite never matches the
 * file — `/pin/:id` stays 404. Copy each template to a bracket-free HTML
 * file. `cleanUrls` serves those as `/pin/_id` and `/chat/_pinId`.
 *
 * `vercel.json` must rewrite to those extensionless paths. A destination
 * ending in `.html` is not served in place: with `cleanUrls: true` Vercel
 * answers 308 (observed as `/_id`, then 404) instead of the pin or chat shell.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dist = join(process.cwd(), 'dist');

const copies = [
  ['pin/[id].html', 'pin/_id.html'],
  ['chat/[pinId].html', 'chat/_pinId.html'],
];

let missing = false;
for (const [fromRel, toRel] of copies) {
  const from = join(dist, fromRel);
  const to = join(dist, toRel);
  if (!existsSync(from)) {
    console.error(`prepare-vercel-dynamic: missing ${fromRel}`);
    missing = true;
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`prepare-vercel-dynamic: ${fromRel} -> ${toRel}`);
}

if (missing) process.exit(1);
