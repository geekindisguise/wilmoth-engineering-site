#!/usr/bin/env node
// Local preview server that resolves paths the way the production Caddyfile
// does: try_files {path} {path}.html {path}/index.html, plus the same
// redirects. Zero dependencies.
//
//   node tools/serve.mjs            # http://0.0.0.0:8788
//   node tools/serve.mjs 9000      # or PORT=9000
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2] || process.env.PORT || 8788);
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// Keep in sync with the `redir` lines in Caddyfile.
const REDIRECTS = {
  '/apps': '/apps/',
};

const BLOCKED = /^\/(\.git|tools|content|design-pass|node_modules)(\/|$)|\.md$/;

async function isFile(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (REDIRECTS[path]) {
    res.writeHead(301, { Location: REDIRECTS[path] + url.search });
    return res.end();
  }
  if (BLOCKED.test(path)) { res.writeHead(404); return res.end('Not found'); }

  const base = normalize(join(ROOT, path));
  if (!base.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  const candidates = [base, base + '.html', join(base, 'index.html')];
  for (const file of candidates) {
    if (await isFile(file)) {
      const body = await readFile(file);
      const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
      if (path === '/snap-and-wind/review-demo.mp4') headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive';
      res.writeHead(200, headers);
      return res.end(body);
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}).listen(PORT, HOST, () => {
  console.log(`wilmoth.engineering preview on http://${HOST}:${PORT}/`);
});
