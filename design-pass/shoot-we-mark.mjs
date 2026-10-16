#!/usr/bin/env node
// Renders design-pass/we-mark-header.png: the live header (from the preview on
// :8789) with the favicon strip composed below it. Uses the Playwright-cached
// Chromium in headless mode (no screencapture).
//
//   node tools/serve.mjs 8789 &   then   node design-pass/shoot-we-mark.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const cache = join(homedir(), 'Library/Caches/ms-playwright');
const dir = readdirSync(cache).filter(d => d.startsWith('chromium-')).sort().pop();
const chrome = join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

execFileSync(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  '--force-device-scale-factor=1', '--window-size=1440,1310', '--virtual-time-budget=4000',
  `--screenshot=${join(HERE, 'we-mark-header.png')}`,
  `file://${join(HERE, 'we-mark-header.html')}`,
], { stdio: 'inherit' });
console.log('wrote', join(HERE, 'we-mark-header.png'));
