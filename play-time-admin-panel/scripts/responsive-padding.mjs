/**
 * One-off / maintenance: replace Tailwind padding utility `p-8` with `p-4 sm:p-8`.
 * Uses a delimiter so we do NOT match `p-8` inside `gap-8`, `top-8`, `xl:gap-8`, etc.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Space, quote, or start of string before `p-8`; then end delimiter after (space, quote, or end)
const re = /(^|[\s"'`])p-8([\s"'`]|$)/g;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== 'dist') {
      walk(p);
    } else if (ent.name.endsWith('.tsx')) {
      let s = fs.readFileSync(p, 'utf8');
      const next = s.replace(re, '$1p-4 sm:p-8$2');
      if (next !== s) {
        fs.writeFileSync(p, next);
        console.log(path.relative(root, p));
      }
    }
  }
}

walk(root);
