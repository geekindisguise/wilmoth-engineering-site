// 2D schematic renderer: plan view of graph.js, drawn as SVG. Used on
// phones, under prefers-reduced-motion, and wherever WebGL is unavailable.
// Units are drawing units straight from graph.js (viewBox does the scaling).
import { COMPONENTS, NETS, TAP_X, BUS_Z, MODULE_X, isLive, flowOf } from './graph.js';

const NS = 'http://www.w3.org/2000/svg';
const VIEW = [-7.45, -2.95, 14.9, 6.55];

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

const pathD = pts => 'M' + pts.map(p => p[0].toFixed(3) + ' ' + p[1].toFixed(3)).join(' L');

// Twisted pair: two sine-offset strands along a polyline.
function twisted(pts, phase) {
  const out = [];
  const amp = 0.045, wave = 0.32, step = 0.04;
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    for (let d = 0; d <= len; d += step) {
      const o = amp * Math.sin((2 * Math.PI * (s + d)) / wave + phase);
      out.push([x0 + (x1 - x0) * d / len + nx * o, z0 + (z1 - z0) * d / len + nz * o]);
    }
    s += len;
  }
  return pathD(out);
}

export function createSchematic(container) {
  const svg = el('svg', { viewBox: VIEW.join(' '), class: 'schematic', role: 'presentation', focusable: 'false' });
  const gNets = el('g', { class: 'nets' }, svg);
  const gCmp = el('g', { class: 'cmps' }, svg);
  const gPk = el('g', { class: 'packets' }, svg);
  const netEls = {};
  const cmpEls = {};
  const rxEls = {};

  for (const n of NETS) {
    const g = el('g', { class: `net net-${n.kind}`, 'data-id': n.id }, gNets);
    if (n.kind === 'can') {
      el('path', { d: twisted(n.pts, 0), class: 'strand strand-h' }, g);
      el('path', { d: twisted(n.pts, Math.PI), class: 'strand strand-l' }, g);
    } else {
      el('path', { d: pathD(n.pts), class: 'wire' }, g);
      if (n.kind === 'hv' || n.kind === 'phase' || n.kind === 'ac') el('path', { d: pathD(n.pts), class: 'flow' }, g);
    }
    netEls[n.id] = g;
  }
  // Junction dots where each stub lands on the trunk.
  for (const id in TAP_X) el('circle', { cx: TAP_X[id], cy: BUS_Z, r: 0.07, class: 'junction' }, gNets);

  for (const c of COMPONENTS) {
    const g = el('g', { class: `cmp cmp-${c.type}`, 'data-id': c.id }, gCmp);
    const x = c.x - c.w / 2, y = c.z - c.d / 2;
    if (c.type === 'motor') {
      el('circle', { cx: c.x, cy: c.z, r: c.d / 2, class: 'body' }, g);
      el('text', { x: c.x, y: c.z + 0.13, class: 'sym' }, g).textContent = 'M';
      el('path', { d: `M${c.x} ${c.z - c.d / 2 + 0.1} L${c.x} ${c.z - c.d / 2 + 0.26}`, class: 'rotor' }, g);
    } else if (c.type === 'inlet') {
      el('circle', { cx: c.x, cy: c.z, r: c.w / 2, class: 'body' }, g);
      // J1772: L1, N, PE, plus the small CP and PP pins.
      [[-0.17, -0.1, 0.08], [0.17, -0.1, 0.08], [0, 0.16, 0.08], [-0.13, 0.12, 0.045], [0.13, 0.12, 0.045]]
        .forEach(([dx, dz, r]) => el('circle', { cx: c.x + dx, cy: c.z + dz, r, class: 'pin' }, g));
    } else if (c.type === 'pack') {
      el('rect', { x, y, width: c.w, height: c.d, rx: 0.05, class: 'body' }, g);
      MODULE_X.forEach((mx, i) => {
        el('rect', { x: mx - 0.47, y: y + 0.12, width: 0.94, height: c.d - 0.24, rx: 0.03, class: 'module', 'data-m': i }, g);
        // cell symbol on each module
        el('path', { d: `M${mx - 0.08} ${c.z - 0.2} v0.4 M${mx + 0.08} ${c.z - 0.11} v0.22`, class: 'sym-line' }, g);
      });
    } else if (c.type === 'contactor') {
      el('rect', { x, y, width: c.w, height: c.d, rx: 0.05, class: 'body' }, g);
      el('path', { d: `M${x + 0.1} ${c.z} h0.17`, class: 'sym-line' }, g);
      el('path', { d: `M${x + c.w - 0.27} ${c.z} h0.17`, class: 'sym-line' }, g);
      el('path', { d: `M${x + 0.27} ${c.z} L${x + c.w - 0.27} ${c.z - 0.22}`, class: 'sym-line switch' }, g);
    } else if (c.type === 'resistor' || c.type === 'powerres') {
      const vert = c.vertical;
      const w = vert ? c.d : c.w, h = vert ? c.w : c.d;
      el('rect', { x: c.x - w / 2, y: c.z - h / 2, width: w, height: h, rx: 0.03, class: 'body' }, g);
    } else if (c.type === 'laptop' || c.type === 'screen') {
      el('rect', { x, y, width: c.w, height: c.d, rx: 0.06, class: 'body' }, g);
      el('rect', { x: x + 0.1, y: y + 0.1, width: c.w - 0.2, height: c.d - 0.2, rx: 0.03, class: 'glass' }, g);
      const ch = [];
      for (let i = 0; i <= 12; i++) ch.push([x + 0.18 + i * (c.w - 0.36) / 12, c.z + 0.12 * Math.sin(i * 1.3) - (c.type === 'laptop' ? 0.05 : 0)]);
      el('path', { d: pathD(ch), class: 'trace-line' }, g);
    } else {
      el('rect', { x, y, width: c.w, height: c.d, rx: c.type === 'board' ? 0.02 : 0.05, class: 'body' }, g);
      if (c.type === 'board') for (let i = 0; i < 3; i++) el('rect', { x: x + 0.35 + i * 0.75, y: c.z - 0.12, width: 0.4, height: 0.24, rx: 0.02, class: 'chip' }, g);
      if (c.type === 'battery12') el('path', { d: `M${c.x - 0.08} ${c.z - 0.16} v0.32 M${c.x + 0.08} ${c.z - 0.08} v0.16`, class: 'sym-line' }, g);
    }
    // Reference designator on the drawing; names go in the parts key.
    el('title', {}, g).textContent = `${c.id} · ${c.name}`;
    const ly = c.type === 'laptop' || c.type === 'screen' ? c.z + c.d / 2 + 0.34
      : c.id === 'R1' || c.id === 'R2' ? c.z + 0.52
      : c.id === 'U1' ? c.z + 0.08
      : c.z - (c.type === 'motor' || c.type === 'inlet' ? c.d / 2 : c.d / 2) - 0.12;
    const t = el('text', { x: c.x, y: ly, class: 'ref' }, g);
    t.textContent = c.id;
    if (c.id in TAP_X) rxEls[c.id] = g;
    cmpEls[c.id] = g;
  }

  const pool = [];
  for (let i = 0; i < 48; i++) pool.push(el('rect', { width: 0.24, height: 0.13, rx: 0.065, class: 'frame', x: -99, y: -99 }, gPk));

  container.appendChild(svg);

  // Parts key, like the one on a drawing sheet. Shown where the bus trace
  // would be when the trace isn't running (reduced motion).
  const instruments = container.parentElement.querySelector('.system-instruments');
  let key = null;
  if (instruments) {
    key = document.createElement('ol');
    key.className = 'parts-key';
    const seen = new Set();
    key.innerHTML = COMPONENTS.filter(c => !seen.has(c.name) && seen.add(c.name))
      .map(c => `<li><b>${c.id === 'R1' ? 'R1, R2' : c.id}</b>${c.name}</li>`).join('');
    instruments.appendChild(key);
  }

  let lastRx = {};
  return {
    el: svg,
    setState(state, key) {
      svg.dataset.state = key;
      for (const n of NETS) {
        const g = netEls[n.id];
        g.classList.toggle('is-live', isLive(state, n.id));
        const f = flowOf(state, n.id);
        g.classList.toggle('is-flow', f !== 0);
      }
      svg.classList.toggle('has-focus', state.focus.length > 0);
      for (const id in cmpEls) cmpEls[id].classList.toggle('is-focus', state.focus.includes(id));
      svg.classList.toggle('contactor-closed', !!state.contactor);
      svg.classList.toggle('motor-on', !!state.motor);
      svg.classList.toggle('charging', !!state.charging);
      svg.classList.toggle('scan', !!state.scan);
    },
    frame(bus) {
      const heads = bus ? bus.heads() : [];
      for (let i = 0; i < pool.length; i++) {
        const h = heads[i];
        if (h) { pool[i].setAttribute('x', (h[0] - 0.12).toFixed(3)); pool[i].setAttribute('y', (h[1] - 0.065).toFixed(3)); }
        else if (pool[i].getAttribute('x') !== '-99') { pool[i].setAttribute('x', '-99'); }
      }
      if (!bus) return;
      const act = bus.activity();
      for (const id in rxEls) {
        const on = act[id] > 0.4;
        if (on !== lastRx[id]) { rxEls[id].classList.toggle('is-rx', on); lastRx[id] = on; }
      }
    },
    destroy() { svg.remove(); if (key) key.remove(); },
  };
}
