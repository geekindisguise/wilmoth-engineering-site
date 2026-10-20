#!/usr/bin/env node
// Guards the "legal copy is verbatim" rule. For every legal/support page
// that existed at the given git ref, compares the text of its old <main>
// with the text of the generated <article class="legal"> at both the old
// URL (legacy file) and the canonical /apps/<slug>/<doc>/ page (for a draft
// app, its local preview under drafts/). Also checks
// link targets inside the copy still resolve to the same pages.
//
//   node tools/check-legal.mjs            # against 8f9de4d (pre-overhaul main)
//   node tools/check-legal.mjs <ref>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS } from '../content/apps.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REF = process.argv[2] || '8f9de4d';
// Doodle A Day's privacy and terms were rewritten for 1.1.1. Those pages
// must match content/apps/doodle-a-day/, not the January 2026 text at REF.
const REVISED = new Set(['doodle-a-day/privacy', 'doodle-a-day/terms']);

const text = html => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&ldquo;|&rdquo;/g, '"').replace(/&copy;/g, '©')
  .replace(/\s+/g, ' ').trim();
// Old pages used relative hrefs; normalise both sides to root-absolute.
const hrefs = (html, base) => [...html.matchAll(/href="([^"]+)"/g)].map(m => {
  const h = m[1];
  if (/^(https?:|mailto:)/.test(h)) return h;
  return new URL(h, 'https://x' + base).pathname.replace(/\/index\.html$/, '/').replace(/^\/index\.html$/, '/');
});

let failures = 0, checked = 0;
for (const app of APPS) {
  for (const [doc, meta] of Object.entries(app.docs)) {
    for (const legacy of meta.legacy || []) {
      let old;
      try { old = execFileSync('git', ['show', `${REF}:${legacy.slice(1)}`], { cwd: ROOT, encoding: 'utf8' }); }
      catch { console.error(`MISSING at ${REF}: ${legacy}`); failures++; continue; }
      const oldMain = old.match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
      const fragment = readFileSync(join(ROOT, 'content/apps', app.slug, `${doc}.html`), 'utf8');
      const revised = REVISED.has(`${app.slug}/${doc}`);
      // Draft apps have no public /apps/ page; check their local preview instead.
      for (const now of [legacy, `${app.draft ? '/drafts' : ''}/apps/${app.slug}/${doc}/index.html`]) {
        const html = readFileSync(join(ROOT, now.slice(1)), 'utf8');
        const m = html.match(/<article class="legal">([\s\S]*?)<\/article>/);
        checked++;
        if (!m) { console.error(`NO ARTICLE: ${now}`); failures++; continue; }
        if (revised) {
          if (text(fragment) !== text(m[1])) {
            console.error(`TEXT DIFFERS FROM SOURCE: ${now}`); failures++;
          }
          const a = hrefs(fragment, legacy).join(' '), b = hrefs(m[1], now).join(' ');
          if (a !== b) { console.error(`LINKS DIFFER FROM SOURCE: ${now}\n  source: ${a}\n  page: ${b}`); failures++; }
        } else {
          if (text(oldMain) !== text(m[1])) {
            console.error(`TEXT DIFFERS: ${legacy} vs ${now}`); failures++;
          }
          const a = hrefs(oldMain, legacy).join(' '), b = hrefs(m[1], now).join(' ');
          if (a !== b) { console.error(`LINKS DIFFER: ${legacy} vs ${now}\n  old: ${a}\n  new: ${b}`); failures++; }
        }
      }
    }
  }
}
console.log(`${checked} pages checked against ${REF}, ${failures} problem(s).`);
process.exit(failures ? 1 : 0);
