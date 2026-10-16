// Hero controller: picks a renderer, maps the step being read to a system
// state, and runs the animation loop only while the drawing is on screen.
//
//   phones / coarse pointers  → SVG schematic, animated
//   prefers-reduced-motion    → SVG schematic, static, every step visible
//   desktop with WebGL        → SVG first, then three.js is lazy-loaded and
//                               cross-fades in once its first frame is drawn
import { STATES } from './graph.js';
import { Bus } from './bus.js';
import { createSchematic } from './svg.js';

const art = document.getElementById('systemArt');
const viewport = document.getElementById('systemViewport');
const traceEl = document.getElementById('busTrace');
const steps = Array.from(document.querySelectorAll('.system-steps .step'));

if (art && viewport) init();

function webgl() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

function init() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 960px) and (pointer: fine)');
  const saveData = navigator.connection && navigator.connection.saveData;

  let renderer = createSchematic(viewport);
  let stateKey = 'running';
  let visible = true;
  let raf = 0;
  let last = 0;

  // ---- bus trace ticker (desktop + phones; never under reduced motion)
  const lines = [];
  let traceDirty = false;
  const bus = new Bus({
    onFrame(f) {
      lines.unshift(`<li><span>${f.time.toFixed(3)}</span><span>${f.src}</span><span>${f.name}</span></li>`);
      if (lines.length > 6) lines.length = 6;
      traceDirty = true;
      stamps.push(f.time);
    },
  });
  let traceAt = 0;

  // ---- readout: plain-language state of the drawing
  const R = {};
  document.querySelectorAll('#readout [data-r]').forEach(n => (R[n.dataset.r] = n));
  const stamps = [];
  function readout(s) {
    if (!R.lv) return;
    R.lv.textContent = s.live.includes('lv') ? 'On' : 'Off';
    R.k.textContent = s.k.K1 && s.k.K2 ? 'K1 + K2 closed' : s.k.K2 ? 'K2 closed · precharging' : 'Open';
    R.k.classList.toggle('is-hv', !!(s.k.K1 || s.k.K2));
    R.motor.textContent = s.motor ? 'Driving' : 'Stopped';
    R.evse.textContent = s.charging ? 'Plugged in · pilot on' : 'Unplugged';
    R.evse.classList.toggle('is-can', !!s.charging);
    const meter = R.dclink;
    meter.classList.toggle('is-ramp', s.dclink === 'ramp');
    meter.style.transform = `scaleX(${s.dclink === 'ramp' ? 0.95 : s.dclink ? 1 : 0})`;
  }

  function apply(key) {
    stateKey = key;
    const s = STATES[key] || STATES.running;
    renderer.setState(s, key);
    bus.setTalkers(reduce.matches ? {} : s.talkers);
    art.dataset.state = key;
    readout(s);
  }

  function tick(now) {
    raf = 0;
    if (!visible || document.hidden || reduce.matches) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    bus.update(dt);
    renderer.frame(bus, dt);
    if (traceDirty && now - traceAt > 160) {
      traceEl.innerHTML = lines.join('');
      traceDirty = false;
      traceAt = now;
      while (stamps.length && stamps[0] < bus.time - 2) stamps.shift();
      if (R.fps) R.fps.textContent = `${(stamps.length / 2).toFixed(1)} frames/s`;
    }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (!raf && visible && !document.hidden && !reduce.matches) { last = 0; raf = requestAnimationFrame(tick); }
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // ---- which step is being read
  if ('IntersectionObserver' in window && steps.length) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        steps.forEach(s => s.classList.toggle('is-active', s === e.target));
        apply(e.target.dataset.state);
      }
    }, { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach(s => io.observe(s));

    // Pause everything when the hero is off screen.
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }).observe(art);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduce.addEventListener?.('change', () => { apply(stateKey); reduce.matches ? (stop(), renderer.frame(null, 0)) : start(); });

  apply(stateKey);
  if (reduce.matches) { document.documentElement.classList.add('still'); renderer.frame(null, 0); }
  start();

  // ---- upgrade to three.js on capable desktops
  if (!reduce.matches && desktop.matches && !saveData && webgl()) {
    const load = () => import('./scene.js')
      .then(m => m.createScene(viewport))
      .then(scene => {
        const flat = renderer;
        renderer = scene;
        apply(stateKey);
        art.classList.add('is-3d');
        // keep the SVG until the fade finishes, then drop it
        setTimeout(() => flat.destroy(), 700);
      })
      .catch(err => { console.warn('3D scene unavailable, keeping the schematic.', err); });
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 300);
  }
}
