/**
 * Expo static export writes dynamic routes as bracket files
 * (`dist/pin/[id].html`). Vercel rewrite destinations are checked with a
 * glob, so `[id]` is a character class and the rewrite never matches the
 * file — `/pin/:id` stays 404. Copy each template to a bracket-free HTML
 * file that `vercel.json` can rewrite to.
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
