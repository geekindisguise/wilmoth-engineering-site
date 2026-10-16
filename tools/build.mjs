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

const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#16181b"/><path d="M4 16h8M20 16h8M12 8v16M17 12v8" stroke="#f1ede4" stroke-width="2.6" stroke-linecap="round"/><circle cx="26" cy="7" r="2.6" fill="#e2560b"/></svg>')}`;

function head({ title, description, canonical, extra = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">\n` : ''}${canonical ? `<link rel="canonical" href="${ORIGIN}${canonical}">\n` : ''}<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f1ede4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121416" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
${extra}</head>`;
}

// Battery-cell schematic symbol: long plate (+), short plate (−).
const MARK = `<svg class="brand-mark" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M3 16h9M20 16h9M12 7v18M17 11v10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="26" cy="7" r="2.4" class="brand-mark-dot"/></svg>`;

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

const published = APPS.filter(a => !a.unpublished);
const docsOf = app => DOC_ORDER.filter(d => app.docs[d]);
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

function docPage(app, d, { legacyOf } = {}) {
  const fragment = readFileSync(join(ROOT, 'content/apps', app.slug, `${d}.html`), 'utf8');
  const title = `${docTitle(app, d)} — ${app.name} | Wilmoth Engineering`;
  const tabs = [`<li><a href="${appUrl(app)}">Overview</a></li>`]
    .concat(docsOf(app).map(x => `<li><a href="${docUrl(app, x)}"${x === d ? ' aria-current="page"' : ''}>${docTitle(app, x)}</a></li>`))
    .join('\n          ');
  return `${head({ title, canonical: docUrl(app, d) })}
<body class="page-doc">
${header('apps')}

<main id="main" class="doc wrap">
  <aside class="doc-rail">
    <a class="doc-app" href="${appUrl(app)}">
      ${appIcon(app, 44)}
      <span><span class="doc-app-name">${esc(app.name)}</span><span class="doc-app-meta">${esc(app.platforms)}</span></span>
    </a>
    <nav aria-label="${esc(app.name)} pages">
      <ol class="doc-tabs">
          ${tabs}
      </ol>
    </nav>
    <p class="doc-url"><span class="cell-label">Address</span>${shownUrl(docUrl(app, d))}</p>
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
  return `${head({ title: `${app.name} — ${app.kind} | Wilmoth Engineering`, description: app.summary, canonical: appUrl(app) })}
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

function shelf({ headingLevel = 3 } = {}) {
  const h = `h${headingLevel}`;
  return APPS.map(app => {
    if (app.unpublished) {
      return `<li class="shelf-item shelf-item--pending">
        ${appIcon(app, 64)}
        <div class="shelf-text"><${h} class="shelf-name">${esc(app.name)}</${h}><p class="shelf-kind">Page not published yet</p></div>
      </li>`;
    }
    return `<li class="shelf-item" data-accent="${app.accent}">
        <a class="shelf-link" href="${appUrl(app)}">
          ${appIcon(app, 64)}
          <div class="shelf-text">
            <${h} class="shelf-name">${esc(app.name)}</${h}>
            <p class="shelf-kind">${esc(app.kind)} · ${esc(app.platforms)}</p>
            <p class="shelf-summary">${esc(app.summary)}</p>
          </div>
        </a>
        <p class="shelf-docs mono">${docsOf(app).map(d => `<a href="${docUrl(app, d)}">${d}</a>`).join('')}</p>
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
  <ul class="shelf shelf--index">
      ${shelf({ headingLevel: 2 })}
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
out('apps/index.html', appsIndex());
out('sitemap.xml', sitemap());

const indexPath = join(ROOT, 'index.html');
let index = readFileSync(indexPath, 'utf8');
index = inject(index, 'header', header(''));
index = inject(index, 'apps', `      ${shelf()}`);
index = inject(index, 'footer', footer());
out('index.html', index);

if (CHECK) {
  if (stale.length) { console.error('Out of date:\n  ' + stale.join('\n  ')); process.exit(1); }
  console.log('All generated files are up to date.');
} else {
  console.log(`Built ${published.length} apps.`);
}
