#!/usr/bin/env node
// Generates every app page from content/apps.mjs + content/apps/<slug>/*.html,
// and refreshes the shared header, apps shelf and footer inside index.html.
// Output is committed; the deployed site is still plain static files.
//
//   node tools/build.mjs          # write files
//   node tools/build.mjs --check  # exit 1 if anything is out of date
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS, DOC_TITLES } from '../content/apps.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://wilmoth.engineering';
const CHECK = process.argv.includes('--check');
const DOC_ORDER = ['privacy', 'terms', 'support'];
const stale = [];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function out(rel, html) {
  const file = join(ROOT, rel);
  if (CHECK) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== html) stale.push(rel);
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---------------------------------------------------------------- partials

// Icons live at the site root; sources and the master mark are in the
// we-brand-claude repo (final/, built by tools/final.py).
const ICONS = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

function head({ title, description, canonical, noindex, extra = '' }) {
  if (noindex) extra = `<meta name="robots" content="noindex">\n${extra}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">\n` : ''}${canonical ? `<link rel="canonical" href="${ORIGIN}${canonical}">\n` : ''}<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f1ede4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121416" media="(prefers-color-scheme: dark)">
${ICONS}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
${extra}</head>`;
}

// The WE mark: one PCB trace (the W's right leg is the E's spine) starting at
// a via. Trace is currentColor; the via takes the accent via .brand-mark-dot.
const MARK = `<svg class="brand-mark" viewBox="8 15 48 34" width="28" height="20" aria-hidden="true"><path d="M14 24V45" fill="none" stroke="currentColor" stroke-width="4.5"/><path d="M14 45L25 34L36 45H52M36 45V21H52M36 33H48" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path class="brand-mark-dot" fill-rule="evenodd" d="M9 21a5 5 0 1 0 10 0a5 5 0 1 0-10 0ZM12.2 21a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0Z"/></svg>`;

function header(current) {
  const item = (href, label, key) =>
    `<li><a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a></li>`;
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap masthead-inner">
    <a href="/" class="brand" aria-label="Wilmoth Engineering, home">${MARK}<span class="brand-name">Wilmoth Engineering</span></a>
    <nav class="nav" aria-label="Primary">
      <ul>
        ${item('/#system', 'System', 'system')}
        ${item('/#work', 'Work', 'work')}
        ${item('/apps/', 'Apps', 'apps')}
        ${item('/#field', 'Off the bench', 'field')}
        ${item('/#contact', 'Contact', 'contact')}
      </ul>
    </nav>
  </div>
</header>`;
}

// Only released apps reach the public site; see `draft` in content/apps.mjs.
const published = APPS.filter(a => !a.draft);
const drafts = APPS.filter(a => a.draft);
const docsOf = app => DOC_ORDER.filter(d => app.docs[d]);
// A draft's own URLs: the legacy addresses App Store Connect already has.
const legacyUrl = (app, d) => app.docs[d].legacy[0].replace(/(\/index)?\.html$/, '');
const appUrl = app => `/apps/${app.slug}/`;
// Display form of a URL: lets long paths wrap at slashes, not mid-word.
const shownUrl = path => `wilmoth.engineering${path}`.replace(/\//g, '/<wbr>');
const docUrl = (app, d) => `/apps/${app.slug}/${d}`;
const docTitle = (app, d) => app.docs[d].title || DOC_TITLES[d];

function appIcon(app, size = 56) {
  if (app.icon) return `<img class="app-icon" src="${app.icon}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
  const mono = app.monogram || app.name[0];
  return `<span class="app-icon app-icon--mono" data-accent="${app.accent}" data-len="${[...mono].length}" style="--size:${size}px" aria-hidden="true">${esc(mono)}</span>`;
}

function footer() {
  const rows = published.map(app => `
          <li>
            <a class="dir-app" href="${appUrl(app)}">${esc(app.name)}</a>
            <span class="dir-docs">${docsOf(app).map(d => `<a href="${docUrl(app, d)}">${d[0].toUpperCase() + d.slice(1)}</a>`).join('')}</span>
          </li>`).join('');
  return `<footer class="colophon">
  <div class="wrap">
    <div class="colophon-grid">
      <div class="colophon-cell colophon-firm">
        <p class="cell-label">Firm</p>
        <p class="colophon-name">Wilmoth Engineering, LLC</p>
        <p><a href="mailto:hello@wilmoth.engineering">hello@wilmoth.engineering</a></p>
      </div>
      <div class="colophon-cell colophon-dir">
        <p class="cell-label">Apps · privacy, terms &amp; support</p>
        <ul class="dir">${rows}
        </ul>
      </div>
      <div class="colophon-cell">
        <p class="cell-label">Elsewhere</p>
        <ul class="plain">
          <li><a href="https://jacobwilmoth.com" rel="noopener">Photography · jacobwilmoth.com</a></li>
          <li><a href="https://evengineeringlab.com" rel="noopener">EV Engineering Lab · evengineeringlab.com</a></li>
        </ul>
      </div>
    </div>
    <p class="colophon-copy">&copy; 2026 Wilmoth.Engineering. All rights reserved.</p>
  </div>
</footer>`;
}

// ---------------------------------------------------------------- pages

// mode: 'public'  canonical /apps/<slug>/<doc> page (and its legacy copies)
//       'unlisted' a draft app's legacy URL: no overview, tabs between its
//                  own legacy URLs, noindex, nothing else links here
//       'preview'  local-only drafts/apps/<slug>/<doc>/
function docPage(app, d, mode = 'public') {
  const fragment = readFileSync(join(ROOT, 'content/apps', app.slug, `${d}.html`), 'utf8');
  const title = `${docTitle(app, d)} — ${app.name} | Wilmoth Engineering`;
  const unlisted = mode === 'unlisted';
  const url = x => unlisted ? legacyUrl(app, x) : docUrl(app, x);
  const tabs = (unlisted ? [] : [`<li><a href="${appUrl(app)}">Overview</a></li>`])
    .concat(docsOf(app).map(x => `<li><a href="${url(x)}"${x === d ? ' aria-current="page"' : ''}>${docTitle(app, x)}</a></li>`))
    .join('\n          ');
  const appTag = unlisted ? 'div' : 'a';
  return `${head({ title, canonical: mode === 'public' ? docUrl(app, d) : null, noindex: mode !== 'public' })}
<body class="page-doc">
${header('apps')}

<main id="main" class="doc wrap">
  <aside class="doc-rail">
    <${appTag} class="doc-app"${unlisted ? '' : ` href="${appUrl(app)}"`}>
      ${appIcon(app, 44)}
      <span><span class="doc-app-name">${esc(app.name)}</span><span class="doc-app-meta">${esc(app.platforms)}</span></span>
    </${appTag}>
    <nav aria-label="${esc(app.name)} pages">
      <ol class="doc-tabs">
          ${tabs}
      </ol>
    </nav>
    <p class="doc-url"><span class="cell-label">Address</span>${shownUrl(url(d))}</p>
  </aside>

  <article class="legal">
${fragment}  </article>
</main>

${footer()}
</body>
</html>
`;
}

function landingPage(app) {
  const docs = docsOf(app);
  const store = app.appStore
    ? `<a class="btn btn-solid" href="${app.appStore}" rel="noopener">View on the App Store</a>`
    : '';
  return `${head({ title: `${app.name} — ${app.kind} | Wilmoth Engineering`, description: app.summary, canonical: app.draft ? null : appUrl(app), noindex: app.draft })}
<body class="page-app" data-accent="${app.accent}">
${header('apps')}

<main id="main" class="app-page wrap">
  <p class="crumbs mono"><a href="/apps/">Apps</a> / ${esc(app.name)}</p>
  <section class="app-hero">
    ${appIcon(app, 120)}
    <div>
      <p class="kicker">${esc(app.kind)} · ${esc(app.platforms)}</p>
      <h1>${esc(app.name)}</h1>
      <p class="lede">${esc(app.summary)}</p>
      ${store}
    </div>
  </section>

  <section class="app-spec" aria-labelledby="spec-h">
    <h2 id="spec-h" class="cell-label">What it does</h2>
    <ul class="spec-list">
      ${app.facts.map(f => `<li>${esc(f)}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="app-docs" aria-labelledby="docs-h">
    <h2 id="docs-h" class="cell-label">Documents</h2>
    <ul class="doc-cards">
      ${docs.map(d => `<li><a href="${docUrl(app, d)}"><span class="doc-card-title">${docTitle(app, d)}</span><span class="doc-card-url mono">${shownUrl(docUrl(app, d))}</span></a></li>`).join('\n      ')}
    </ul>
  </section>
</main>

${footer()}
</body>
</html>
`;
}

// The apps, laid out as detail views on a drawing sheet: each app gets a
// lettered detail balloon, its icon inside a detail circle (with centre
// lines), drawing notes for what it does, and a document schedule.
const DETAIL_LETTERS = 'ABCDEFGHJKLMNPRTUVWY'; // drawing practice skips I, O, Q, S, X, Z
function details({ headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  return published.map((app, i) => {
    const L = DETAIL_LETTERS[i];
    const store = app.appStore ? `<p class="detail-store"><a class="btn btn-line" href="${app.appStore}" rel="noopener">App Store &#8599;</a></p>` : '';
    const xref = app.xref ? `<p class="detail-xref mono"><a href="${app.xref.href}">${esc(app.xref.text)}</a></p>` : '';
    return `<li class="detail" data-accent="${app.accent}">
        <figure class="detail-fig">
          <a class="detail-view" href="${appUrl(app)}" tabindex="-1" aria-hidden="true">${appIcon(app, 104)}</a>
          <span class="detail-balloon" aria-hidden="true">${L}</span>
          <figcaption class="detail-cap mono"><b>Detail ${L}</b>${esc(app.platforms)}</figcaption>
        </figure>
        <div class="detail-body">
          <p class="detail-kind mono">${esc(app.kind)}</p>
          <${h} class="detail-name"><a href="${appUrl(app)}">${esc(app.name)}</a></${h}>
          <p class="detail-summary">${esc(app.summary)}</p>
          <p class="cell-label">Notes</p>
          <ol class="detail-notes">
            ${app.facts.map(f => `<li>${esc(f)}</li>`).join('\n            ')}
          </ol>
          ${xref}
          <p class="cell-label">Documents</p>
          <ul class="detail-docs">
            ${docsOf(app).map(d => `<li><a href="${docUrl(app, d)}">${docTitle(app, d)}</a><span class="mono">${shownUrl(docUrl(app, d))}</span></li>`).join('\n            ')}
          </ul>
          ${store}
        </div>
      </li>`;
  }).join('\n      ');
}

function appsIndex() {
  return `${head({ title: 'Apps | Wilmoth Engineering', description: 'iPhone, iPad and Mac apps from Wilmoth Engineering, with their privacy, terms and support pages.', canonical: '/apps/' })}
<body class="page-apps">
${header('apps')}

<main id="main" class="apps-index wrap">
  <p class="kicker">Software</p>
  <h1>Apps</h1>
  <p class="lede">iPhone, iPad and Mac apps from Wilmoth Engineering, LLC. Each one has its own page with privacy, terms and support.</p>
  <ul class="details">
      ${details({ headingLevel: 2 })}
  </ul>
</main>

${footer()}
</body>
</html>
`;
}

function sitemap() {
  const urls = ['/', '/apps/'];
  for (const app of published) {
    urls.push(appUrl(app));
    for (const d of docsOf(app)) urls.push(docUrl(app, d));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${ORIGIN}${u}</loc></url>`).join('\n')}
</urlset>
`;
}

function inject(html, name, content) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html is missing the build:${name} markers`);
  return html.replace(re, `$1\n${content}\n$2`);
}

// ---------------------------------------------------------------- run

for (const app of published) {
  out(`apps/${app.slug}/index.html`, landingPage(app));
  for (const d of docsOf(app)) {
    const page = docPage(app, d);
    out(`apps/${app.slug}/${d}/index.html`, page);
    for (const legacy of app.docs[d].legacy || []) out(legacy.slice(1), page);
  }
}

// Drafts: unlisted legacy URLs only, plus a local preview under drafts/.
const toPreview = (app, html) => html.replaceAll(`"/apps/${app.slug}/`, `"/drafts/apps/${app.slug}/`)
  .replace('<main id="main" class="', '<p class="draft-flag mono wrap">Draft · not published · local preview only</p>\n<main id="main" class="');
for (const app of drafts) {
  const docs = docsOf(app);
  if (!docs.length) continue;
  out(`drafts/apps/${app.slug}/index.html`, toPreview(app, landingPage(app)));
  for (const d of docs) {
    out(`drafts/apps/${app.slug}/${d}/index.html`, toPreview(app, docPage(app, d, 'preview')));
    const page = docPage(app, d, 'unlisted');
    for (const legacy of app.docs[d].legacy || []) out(legacy.slice(1), page);
  }
}

out('apps/index.html', appsIndex());
out('sitemap.xml', sitemap());

const indexPath = join(ROOT, 'index.html');
let index = readFileSync(indexPath, 'utf8');
index = inject(index, 'icons', ICONS);
index = inject(index, 'header', header(''));
index = inject(index, 'apps', `      ${details()}`);
index = inject(index, 'footer', footer());
out('index.html', index);

// A draft must never ship /apps/<slug>/ (the Dockerfile copies all of apps/).
// .dockerignore excludes each draft's folder from the image even if old
// generated files are still in the tree, and drafts/ is never shipped.
const ignorePath = join(ROOT, '.dockerignore');
const ignoreBlock = `# build:drafts (generated by tools/build.mjs: draft apps never ship)\ndrafts\n${drafts.map(a => `apps/${a.slug}`).join('\n')}\n# /build:drafts`;
let ignore = readFileSync(ignorePath, 'utf8');
const ignoreRe = /# build:drafts[\s\S]*?# \/build:drafts/;
ignore = ignoreRe.test(ignore) ? ignore.replace(ignoreRe, ignoreBlock) : ignore.replace(/\n*$/, '\n') + ignoreBlock + '\n';
out('.dockerignore', ignore);
const leftover = drafts.filter(a => existsSync(join(ROOT, 'apps', a.slug))).map(a => `apps/${a.slug}`);
if (leftover.length) {
  console.warn(`Note: old public pages for draft apps are still in the tree (excluded from the image by .dockerignore):\n  git rm -r ${leftover.join(' ')}`);
}

if (CHECK) {
  if (stale.length) { console.error('Out of date:\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('All generated files are up to date.');
} else {
  console.log(`Built ${published.length} public apps; ${drafts.length} drafts kept off the public site.`);
}
