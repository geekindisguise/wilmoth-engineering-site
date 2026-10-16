// three.js renderer for the hero: the same system as graph.js, drawn as an
// axonometric technical illustration. Loaded only on desktops with WebGL
// and without prefers-reduced-motion (see index.js).
//
// What moves, and why:
//   cables      colour up when their net is live (HV orange, CAN blue, 12 V ink)
//   dots        current along HV runs that are actually carrying it
//   pills       CAN frames: sender stub → trunk → both ways to every node
//   K1          plunger drops when the contactor closes
//   U2 gauge    DC-link voltage: ramps during precharge
//   M1          rotor turns when the controller is driving it
//   BT1         module scan during BMS check; state of charge rises on charge
//   U6 / U5     screens draw what's on the bus
import * as T from '../vendor/three.js';
import { COMPONENTS, NETS, MODULE_X, TAP_X, isLive, flowOf } from './graph.js';

const BOUNDS = { x0: -7.4, x1: 7.4, z0: -2.95, z1: 3.7, y1: 1.3 };
// Mostly frontal and high, so the left-to-right power flow reads like the
// schematic and the wide drawing fills a wide panel.
const CAM_DIR = new T.Vector3(-0.08, 0.8, 0.62).normalize();
const CABLE_Y = { hv: 0.075, phase: 0.06, ac: 0.06, lv: 0.035, sense: 0.03, pilot: 0.03, can: 0.05 };
const CABLE_R = { hv: 0.065, phase: 0.05, ac: 0.05, lv: 0.028, sense: 0.016, pilot: 0.024 };

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}
function palette() {
  return {
    paper: new T.Color(css('--paper-2')), // the drawing panel's background
    part: new T.Color(css('--part')),
    partDark: new T.Color(css('--part-dark')),
    ink: new T.Color(css('--ink')),
    ink3: new T.Color(css('--ink-3')),
    rule: new T.Color(css('--rule')),
    dead: new T.Color(css('--wire-dead')),
    hv: new T.Color(css('--hv')),
    can: new T.Color(css('--can')),
    lv: new T.Color(css('--ink-2')),
    glass: new T.Color(css('--glass')),
  };
}

// Polyline with rounded corners, lifted to height y.
function cablePath(pts, y, radius = 0.12) {
  const path = new T.CurvePath();
  const v = pts.map(p => new T.Vector3(p[0], y, p[1]));
  let start = v[0];
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1], b = v[i], c = v[i + 1];
    const r = Math.min(radius, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
    const p1 = b.clone().add(a.clone().sub(b).setLength(r));
    const p2 = b.clone().add(c.clone().sub(b).setLength(r));
    path.add(new T.LineCurve3(start, p1));
    path.add(new T.QuadraticBezierCurve3(p1, b, p2));
    start = p2;
  }
  path.add(new T.LineCurve3(start, v[v.length - 1]));
  return path;
}

// One strand of a twisted pair as a sampled helix around the polyline.
function strandCurve(pts, y, phase) {
  const out = [];
  const r = 0.03, wave = 0.24, step = 0.02;
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    for (let d = i === 1 ? 0 : step; d <= len + 1e-6; d += step) {
      const th = (2 * Math.PI * (s + d)) / wave + phase;
      out.push(new T.Vector3(
        x0 + (x1 - x0) * d / len + nx * r * Math.cos(th),
        y + r * Math.sin(th),
        z0 + (z1 - z0) * d / len + nz * r * Math.cos(th)));
    }
    s += len;
  }
  return { curve: new T.CatmullRomCurve3(out), n: out.length };
}

function polyPoint(pts, dist) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (dist <= seg) {
      const f = dist / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    dist -= seg;
  }
  return pts[pts.length - 1];
}
function polyLen(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

export async function createScene(container) {
  let C = palette();
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'scene-canvas';
  container.appendChild(canvas);

  const labelsEl = document.createElement('div');
  labelsEl.className = 'scene-labels';
  container.appendChild(labelsEl);
  const tip = document.createElement('div');
  tip.className = 'scene-tip';
  container.appendChild(tip);

  const scene = new T.Scene();
  const root = new T.Group();
  scene.add(root);

  // ---- light: soft sky + one key light for the drawing-board shadows
  const hemi = new T.HemisphereLight(0xffffff, 0xd8d0c0, 1.35);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // ---- ground: shadow catcher + drafting grid that fades to paper
  const ground = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ opacity: 0.13 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const gridGeo = new T.BufferGeometry();
  const gridPos = [], gridCol = [];
  function buildGridColors() {
    gridCol.length = 0;
    for (let i = 0; i < gridPos.length; i += 3) {
      const x = gridPos[i], z = gridPos[i + 2];
      const fade = Math.min(1, Math.max(0, 1 - Math.hypot(x / 9, (z - 0.4) / 5) ** 2));
      const c = C.paper.clone().lerp(C.rule, fade);
      gridCol.push(c.r, c.g, c.b);
    }
    gridGeo.setAttribute('color', new T.Float32BufferAttribute(gridCol, 3));
  }
  for (let x = -9; x <= 9.001; x += 0.5) for (let z = -4; z < 5; z += 0.25) gridPos.push(x, 0.002, z, x, 0.002, z + 0.25);
  for (let z = -4; z <= 5.001; z += 0.5) for (let x = -9; x < 9; x += 0.25) gridPos.push(x, 0.002, z, x + 0.25, 0.002, z);
  gridGeo.setAttribute('position', new T.Float32BufferAttribute(gridPos, 3));
  buildGridColors();
  root.add(new T.LineSegments(gridGeo, new T.LineBasicMaterial({ vertexColors: true })));

  // ---- shared materials
  const M = {
    part: new T.MeshLambertMaterial({ color: C.part }),
    dark: new T.MeshLambertMaterial({ color: C.partDark }),
    hvBand: new T.MeshLambertMaterial({ color: C.hv }),
    edge: new T.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.85 }),
    pin: new T.MeshBasicMaterial({ color: C.ink }),
    current: new T.MeshBasicMaterial({ color: C.hv.clone().lerp(new T.Color(0xffffff), 0.35) }),
    frame: new T.MeshBasicMaterial({ color: C.can }),
  };

  const pickables = [];
  const cmp = {};
  const edgeMats = {};

  function addBox(group, w, h, d, x, y, z, mat = M.part, edges = true, id) {
    const geo = new T.BoxGeometry(w, h, d);
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    if (edges) {
      const e = new T.LineSegments(new T.EdgesGeometry(geo), edgeMats[id] || M.edge);
      e.position.copy(m.position);
      group.add(e);
    }
    if (id) { m.userData.id = id; pickables.push(m); }
    return m;
  }
  function addCyl(group, r, h, x, y, z, mat = M.part, rot = null, edges = true, id, seg = 28) {
    const geo = new T.CylinderGeometry(r, r, h, seg);
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    if (edges) {
      const e = new T.LineSegments(new T.EdgesGeometry(geo, 30), edgeMats[id] || M.edge);
      e.position.copy(m.position); e.rotation.copy(m.rotation);
      group.add(e);
    }
    if (id) { m.userData.id = id; pickables.push(m); }
    return m;
  }

  // Screen textures (CANnery trace, dash gauge), redrawn ~12 fps.
  function screenTexture(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return { cv, ctx: cv.getContext('2d'), tex };
  }
  const canneryTex = screenTexture(512, 300);
  const dashTex = screenTexture(384, 216);
  const trace = { a: [], b: [], c: [] };

  // ---- components
  const live = { modules: [], socBars: [], gauge: null, plunger: null, rotor: null };
  for (const c of COMPONENTS) {
    const g = new T.Group();
    g.position.set(c.x, 0, c.z);
    root.add(g);
    cmp[c.id] = { c, g };
    edgeMats[c.id] = M.edge.clone();
    const id = c.id;

    switch (c.type) {
      case 'box':
      case 'battery12': {
        addBox(g, c.w, c.h, c.d, 0, c.h / 2, 0, M.part, true, id);
        if (c.hv) addBox(g, c.w * 0.5, 0.012, 0.09, 0, c.h + 0.006, c.d / 2 - 0.12, M.hvBand, false);
        if (c.type === 'battery12') {
          addCyl(g, 0.06, 0.1, -c.w / 2 + 0.18, c.h + 0.05, 0, M.dark, null, false);
          addCyl(g, 0.06, 0.1, c.w / 2 - 0.18, c.h + 0.05, 0, M.hvBand, null, false);
        } else {
          // vent slots
          for (let i = 0; i < 4; i++) addBox(g, 0.02, 0.012, c.d * 0.5, -c.w / 2 + 0.2 + i * 0.09, c.h + 0.006, -0.05, M.dark, false);
        }
        break;
      }
      case 'pack': {
        addBox(g, c.w, 0.12, c.d, 0, 0.06, 0, M.dark, true, id);
        MODULE_X.forEach((mx, i) => {
          const mat = M.part.clone();
          mat.emissive = new T.Color(0x000000);
          const m = addBox(g, 0.94, c.h - 0.12, c.d - 0.24, mx - c.x, 0.12 + (c.h - 0.12) / 2, 0, mat, true, id);
          live.modules.push(m);
          // SoC bar on the module lid
          addBox(g, 0.7, 0.012, 0.1, mx - c.x, c.h + 0.006, c.d / 2 - 0.28, M.dark, false);
          const bar = addBox(g, 0.7, 0.016, 0.1, mx - c.x, c.h + 0.01, c.d / 2 - 0.28, new T.MeshBasicMaterial({ color: C.can }), false);
          bar.geometry.translate(0.35, 0, 0);
          bar.position.x -= 0.35;
          live.socBars.push(bar);
          addBox(g, 0.94 * 0.5, 0.012, 0.09, mx - c.x, c.h + 0.006, -c.d / 2 + 0.3, M.hvBand, false);
        });
        break;
      }
      case 'board': {
        addBox(g, c.w, c.h, c.d, 0, c.h / 2 + 0.04, 0, M.dark, true, id);
        for (let i = 0; i < 4; i++) addCyl(g, 0.03, 0.04, -c.w / 2 + 0.2 + i * 0.8, 0.02, -c.d / 2 + 0.08, M.dark, null, false);
        for (let i = 0; i < 3; i++) addBox(g, 0.42, 0.06, 0.26, -0.75 + i * 0.75, c.h + 0.07, 0, M.part, true, id);
        break;
      }
      case 'contactor': {
        addBox(g, c.w, c.h, c.d, 0, c.h / 2, 0, M.part, true, id);
        addCyl(g, 0.07, 0.12, -0.22, c.h + 0.06, -0.15, M.dark, null, false);
        addCyl(g, 0.07, 0.12, 0.22, c.h + 0.06, -0.15, M.dark, null, false);
        live.plunger = addCyl(g, 0.15, 0.28, 0, c.h + 0.14, 0.15, M.hvBand, null, true, id);
        break;
      }
      case 'powerres': {
        addBox(g, c.w, c.h * 0.6, c.d, 0, c.h * 0.3, 0, M.part, true, id);
        for (let i = 0; i < 4; i++) addBox(g, c.w, 0.03, 0.04, 0, c.h * 0.6 + 0.015, -c.d / 2 + 0.06 + i * 0.06, M.part, true, id);
        break;
      }
      case 'inverter': {
        addBox(g, c.w, c.h, c.d, 0, c.h / 2, 0, M.part, true, id);
        for (let i = 0; i < 9; i++) addBox(g, 0.035, 0.16, c.d - 0.2, -c.w / 2 + 0.2 + i * 0.125, c.h + 0.08, 0, M.part, true, id);
        // DC-link voltage gauge on the front face
        addBox(g, 0.08, 0.42, 0.012, c.w / 2 - 0.18, c.h / 2, c.d / 2 + 0.006, M.dark, false);
        const gauge = addBox(g, 0.06, 0.4, 0.016, c.w / 2 - 0.18, c.h / 2 - 0.2, c.d / 2 + 0.01, M.hvBand, false);
        gauge.geometry.translate(0, 0.2, 0);
        live.gauge = gauge;
        addBox(g, c.w * 0.4, 0.012, 0.09, -0.2, c.h + 0.006 - 0.0, c.d / 2 - 0.06, M.hvBand, false);
        break;
      }
      case 'motor': {
        const r = c.d / 2, len = c.w;
        // axis along z, so the end cap faces the viewer
        addCyl(g, r, len, 0, r + 0.05, 0, M.part, [Math.PI / 2, 0, 0], true, id, 40);
        addBox(g, r * 1.6, 0.1, len * 0.7, 0, 0.05, 0, M.dark, true, id);
        const rotor = new T.Group();
        rotor.position.set(0, r + 0.05, len / 2 + 0.01);
        g.add(rotor);
        addCyl(rotor, 0.09, 0.3, 0, 0, 0.15, M.dark, [Math.PI / 2, 0, 0], true);
        for (let i = 0; i < 3; i++) {
          const spoke = addBox(rotor, 0.06, r * 1.5, 0.02, 0, 0, 0.012, M.dark, false);
          spoke.rotation.z = (i * Math.PI) / 3;
        }
        addBox(rotor, 0.05, 0.05, 0.06, 0, 0.09, 0.3, M.hvBand, false);
        live.rotor = rotor;
        break;
      }
      case 'inlet': {
        addCyl(g, c.w / 2, c.h, 0, c.h / 2, 0, M.part, null, true, id, 40);
        addCyl(g, c.w / 2 - 0.08, 0.02, 0, c.h + 0.01, 0, M.dark, null, false, undefined, 40);
        [[-0.17, -0.1, 0.075], [0.17, -0.1, 0.075], [0, 0.16, 0.075], [-0.13, 0.12, 0.04], [0.13, 0.12, 0.04]]
          .forEach(([dx, dz, r]) => addCyl(g, r, 0.02, dx, c.h + 0.022, dz, M.pin, null, false));
        break;
      }
      case 'resistor': {
        const body = new T.Group();
        g.add(body);
        addCyl(body, 0.075, c.w * 0.62, 0, 0.09, 0, M.part, [Math.PI / 2, 0, 0], true, id, 20);
        addCyl(body, 0.012, c.w, 0, 0.09, 0, M.dark, [Math.PI / 2, 0, 0], false, undefined, 8);
        // 120 Ω: brown, red, brown, gold
        [0x6b3b1f, 0xc0392b, 0x6b3b1f, 0xb8962e].forEach((col, i) =>
          addCyl(body, 0.079, 0.03, 0, 0.09, -0.11 + i * 0.065 + (i === 3 ? 0.03 : 0), new T.MeshLambertMaterial({ color: col }), [Math.PI / 2, 0, 0], false, undefined, 20));
        break;
      }
      case 'laptop': {
        addBox(g, c.w, 0.06, c.d * 0.8, 0, 0.03, 0.1, M.part, true, id);
        addBox(g, c.w * 0.86, 0.006, c.d * 0.42, 0, 0.063, 0.05, M.dark, false);
        const lid = new T.Group();
        lid.position.set(0, 0.06, 0.1 - c.d * 0.4);
        lid.rotation.x = -0.26;
        g.add(lid);
        addBox(lid, c.w, c.d * 0.78, 0.05, 0, c.d * 0.39, 0, M.part, true, id);
        const scr = new T.Mesh(new T.PlaneGeometry(c.w * 0.92, c.d * 0.7), new T.MeshBasicMaterial({ map: canneryTex.tex, toneMapped: false }));
        scr.position.set(0, c.d * 0.39, 0.027);
        lid.add(scr);
        break;
      }
      case 'screen': {
        addBox(g, 0.5, 0.05, 0.35, 0, 0.025, 0, M.dark, true, id);
        addBox(g, 0.08, c.h * 0.7, 0.08, 0, c.h * 0.35, -0.05, M.dark, false);
        const panel = new T.Group();
        panel.position.set(0, c.h * 0.7, 0);
        panel.rotation.x = -0.32;
        g.add(panel);
        addBox(panel, c.w, c.d * 0.95, 0.06, 0, c.d * 0.3, 0, M.part, true, id);
        const scr = new T.Mesh(new T.PlaneGeometry(c.w * 0.9, c.d * 0.8), new T.MeshBasicMaterial({ map: dashTex.tex, toneMapped: false }));
        scr.position.set(0, c.d * 0.3, 0.032);
        panel.add(scr);
        break;
      }
    }
  }

  // ---- cables
  const nets = {};
  for (const n of NETS) {
    const mat = new T.MeshLambertMaterial({ color: C.dead.clone(), emissive: new T.Color(0x000000) });
    const group = new T.Group();
    const y = CABLE_Y[n.kind];
    if (n.kind === 'can') {
      for (const ph of [0, Math.PI]) {
        const { curve, n: count } = strandCurve(n.pts, y, ph);
        const m = new T.Mesh(new T.TubeGeometry(curve, count * 2, 0.017, 5, false), mat);
        m.castShadow = true;
        group.add(m);
      }
    } else if (n.kind === 'pilot') {
      const len = polyLen(n.pts);
      for (let d = 0; d < len - 0.05; d += 0.14) {
        const a = polyPoint(n.pts, d), b = polyPoint(n.pts, Math.min(len, d + 0.08));
        const m = new T.Mesh(new T.TubeGeometry(cablePath([a, b], y), 2, CABLE_R.pilot, 6, false), mat);
        group.add(m);
      }
    } else {
      const m = new T.Mesh(new T.TubeGeometry(cablePath(n.pts, y), Math.ceil(polyLen(n.pts) * 16), CABLE_R[n.kind], 10, false), mat);
      m.castShadow = true;
      group.add(m);
    }
    root.add(group);
    const color = n.kind === 'can' || n.kind === 'pilot' ? 'can' : (n.kind === 'lv' || n.kind === 'sense') ? 'lv' : 'hv';
    nets[n.id] = { n, mat, color, level: 0, target: 0, len: polyLen(n.pts), y: y + (CABLE_R[n.kind] || 0.03) };
  }
  // Junction dots on the trunk
  for (const id in TAP_X) addCyl(root, 0.055, 0.12, TAP_X[id], 0.05, 1.6, M.pin, null, false, undefined, 16);

  // ---- moving things
  const MAX_DOTS = 260, MAX_FRAMES = 60;
  const dots = new T.InstancedMesh(new T.SphereGeometry(0.038, 10, 8), M.current, MAX_DOTS);
  dots.instanceMatrix.setUsage(T.DynamicDrawUsage);
  root.add(dots);
  const frames = new T.InstancedMesh(new T.BoxGeometry(0.2, 0.07, 0.11), M.frame, MAX_FRAMES);
  frames.instanceMatrix.setUsage(T.DynamicDrawUsage);
  root.add(frames);
  const tmp = new T.Object3D();

  // ---- labels
  const labels = COMPONENTS.map(c => {
    const d = document.createElement('div');
    d.className = 'scene-label';
    d.innerHTML = `<b>${c.id}</b><span>${c.name}</span>`;
    labelsEl.appendChild(d);
    const anchorY = c.type === 'laptop' ? 1.05 : c.type === 'screen' ? 1.05 : c.type === 'motor' ? c.h + 0.35 : c.h + 0.32;
    return { c, d, p: new T.Vector3(c.x, anchorY, c.z - (c.type === 'laptop' ? 0.3 : 0)) };
  });

  // ---- camera
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const baseTarget = new T.Vector3((BOUNDS.x0 + BOUNDS.x1) / 2, 0.3, (BOUNDS.z0 + BOUNDS.z1) / 2);
  const target = baseTarget.clone();
  const goal = { target: baseTarget.clone(), zoom: 1 };
  let W = 1, H = 1, halfW = 1, halfH = 1;

  function placeCamera() {
    camera.position.copy(target).addScaledVector(CAM_DIR, 30);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function fit() {
    W = container.clientWidth || 1; H = container.clientHeight || 1;
    renderer.setSize(W, H, false);
    const keep = target.clone();
    target.copy(baseTarget);
    placeCamera();
    let mx = 0, my = 0;
    for (const x of [BOUNDS.x0, BOUNDS.x1]) for (const y of [0, BOUNDS.y1]) for (const z of [BOUNDS.z0, BOUNDS.z1]) {
      const v = new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      mx = Math.max(mx, Math.abs(v.x)); my = Math.max(my, Math.abs(v.y));
    }
    mx *= 1.02; my *= 1.06;
    const aspect = W / H;
    if (mx / my > aspect) my = mx / aspect; else mx = my * aspect;
    halfW = mx; halfH = my;
    Object.assign(camera, { left: -mx, right: mx, top: my, bottom: -my });
    camera.updateProjectionMatrix();
    target.copy(keep);
    placeCamera();
  }

  // The drawing fills the panel edge to edge, so any zoom would crop part of
  // the system. Focus is shown by dimming the other parts' labels and by
  // which nets are live; the camera stays at rest.
  function focusOn() {
    goal.target.copy(baseTarget);
    goal.zoom = 1;
  }

  // ---- interaction: hover a part to name it, slight parallax
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  let hoverId = null;
  let parallax = 0, parallaxGoal = 0;
  container.addEventListener('pointermove', e => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    parallaxGoal = ndc.x * 0.05;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const id = hit ? hit.object.userData.id : null;
    if (id !== hoverId) {
      if (hoverId) edgeMats[hoverId].color.copy(C.ink);
      hoverId = id;
      if (id) {
        edgeMats[id].color.copy(cmp[id].c.hv ? C.hv : C.can);
        const c = cmp[id].c;
        tip.innerHTML = `<b>${c.id} · ${c.name}</b>${c.note ? `<span>${c.note}</span>` : ''}`;
      }
      tip.classList.toggle('is-on', !!id);
      container.style.cursor = id ? 'help' : '';
    }
    if (id) {
      const x = Math.min(e.clientX - r.left + 16, r.width - 260);
      tip.style.transform = `translate(${x}px, ${e.clientY - r.top + 18}px)`;
    }
  });
  container.addEventListener('pointerleave', () => {
    parallaxGoal = 0;
    if (hoverId) edgeMats[hoverId].color.copy(C.ink);
    hoverId = null;
    tip.classList.remove('is-on');
  });

  // ---- theme
  const dark = matchMedia('(prefers-color-scheme: dark)');
  function recolor() {
    C = palette();
    M.part.color.copy(C.part); M.dark.color.copy(C.partDark); M.hvBand.color.copy(C.hv);
    M.edge.color.copy(C.ink); M.pin.color.copy(C.ink);
    M.current.color.copy(C.hv.clone().lerp(new T.Color(0xffffff), 0.35)); M.frame.color.copy(C.can);
    for (const id in edgeMats) edgeMats[id].color.copy(C.ink);
    live.modules.forEach(m => m.material.color.copy(C.part));
    hemi.groundColor.copy(C.paper);
    buildGridColors();
    ground.material.opacity = dark.matches ? 0.35 : 0.13;
  }
  dark.addEventListener?.('change', recolor);
  recolor();

  // ---- state
  let state = null, stateKey = '', stateTime = 0;
  const anim = { motor: 0, dclink: 0, contactor: 0, soc: 0.62, scan: 0, flowPhase: 0 };

  function setState(s, key) {
    if (key !== stateKey) stateTime = 0;
    state = s; stateKey = key;
    for (const id in nets) nets[id].target = isLive(s, id) ? 1 : 0;
    focusOn(s.focus);
    labels.forEach(l => l.d.classList.toggle('is-dim', s.focus.length > 0 && !s.focus.includes(l.c.id)));
  }

  // ---- screens
  let screenAt = 0;
  function drawScreens(t, act) {
    const ink = '#e9e6de';
    { // CANnery: decoded signals scrolling, one strip per signal
      const { ctx, cv, tex } = canneryTex;
      const w = cv.width, h = cv.height;
      ctx.fillStyle = '#15171a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#23262b'; ctx.fillRect(0, 0, w, 34);
      ctx.fillStyle = '#e2560b'; ctx.fillRect(14, 11, 12, 12);
      ctx.font = '600 17px "IBM Plex Mono", monospace'; ctx.fillStyle = ink; ctx.fillText('CANnery', 34, 23);
      ctx.font = '13px "IBM Plex Mono", monospace'; ctx.fillStyle = '#8b8f96'; ctx.fillText('demo trace', w - 104, 23);
      const rows = [['MOTOR_SPEED', '#ff7a33', trace.a], ['DC_LINK_VOLTAGE', '#7c9cff', trace.b], ['STATE_OF_CHARGE', '#d8d3c8', trace.c]];
      rows.forEach(([name, col, arr], i) => {
        const y0 = 46 + i * 84, hh = 70;
        ctx.strokeStyle = '#2b2f35'; ctx.lineWidth = 1; ctx.strokeRect(10.5, y0 + 0.5, w - 21, hh);
        ctx.fillStyle = '#8b8f96'; ctx.font = '12px "IBM Plex Mono", monospace'; ctx.fillText(name, 18, y0 + 16);
        ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
        arr.forEach((v, k) => { const x = 12 + (k / 119) * (w - 24), y = y0 + hh - 8 - v * (hh - 26); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      });
      if (act.U6 > 0.4) { ctx.fillStyle = '#7c9cff'; ctx.beginPath(); ctx.arc(w - 18, 17, 5, 0, 7); ctx.fill(); }
      tex.needsUpdate = true;
    }
    { // Dash: speed arc + pack bar
      const { ctx, cv, tex } = dashTex;
      const w = cv.width, h = cv.height;
      ctx.fillStyle = '#121416'; ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2b2f35'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(120, 128, 72, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
      ctx.strokeStyle = '#ff7a33'; ctx.beginPath(); ctx.arc(120, 128, 72, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * anim.motor * (0.75 + 0.08 * Math.sin(t * 0.7)))); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = '600 22px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(anim.contactor > 0.5 ? 'READY' : anim.dclink > 0.05 ? 'PRECHG' : state && state.charging ? 'CHARGE' : 'KEY ON', 120, 136);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8b8f96'; ctx.font = '13px "IBM Plex Mono", monospace'; ctx.fillText('PACK', 246, 64);
      ctx.strokeStyle = '#3a3f45'; ctx.lineWidth = 2; ctx.strokeRect(246, 74, 110, 26);
      ctx.fillStyle = '#7c9cff'; ctx.fillRect(250, 78, 102 * anim.soc, 18);
      ctx.fillStyle = '#8b8f96'; ctx.fillText('BUS', 246, 134);
      ctx.fillStyle = act.U5 > 0.3 ? '#7c9cff' : '#2b2f35'; ctx.beginPath(); ctx.arc(256, 150, 7, 0, 7); ctx.fill();
      tex.needsUpdate = true;
    }
  }

  // ---- frame
  const proj = new T.Vector3();
  let time = 0;
  function frame(bus, dt) {
    if (!state) return;
    time += dt; stateTime += dt;
    const k = 1 - Math.exp(-dt * 4);

    // nets fade in/out
    for (const id in nets) {
      const n = nets[id];
      n.level += (n.target - n.level) * k;
      const col = C[n.color];
      n.mat.color.copy(C.dead).lerp(col, n.level);
      n.mat.emissive.copy(col).multiplyScalar(n.level * 0.28);
    }

    // mechanical state
    anim.motor += ((state.motor || 0) - anim.motor) * (1 - Math.exp(-dt * 1.5));
    const dcGoal = state.dclink === 'ramp' ? Math.min(0.95, 1 - Math.exp(-stateTime * 1.1)) : state.dclink;
    anim.dclink += (dcGoal - anim.dclink) * (state.dclink === 'ramp' ? 1 : k);
    anim.contactor += ((state.contactor || 0) - anim.contactor) * (1 - Math.exp(-dt * 10));
    if (state.charging) anim.soc = Math.min(0.96, anim.soc + dt * 0.035); else anim.soc += (0.62 - anim.soc) * dt * 0.2;
    if (live.rotor) live.rotor.rotation.z -= dt * anim.motor * 9;
    if (live.gauge) live.gauge.scale.y = Math.max(0.02, anim.dclink);
    if (live.plunger) live.plunger.position.y = cmp.K1.c.h + 0.14 - anim.contactor * 0.1;
    live.socBars.forEach((b, i) => {
      b.scale.x = Math.max(0.03, anim.soc - i * 0.015);
      b.material.color.copy(state.charging ? C.hv : C.can);
    });
    live.modules.forEach((m, i) => {
      const s = state.scan ? Math.max(0, 1 - Math.abs(((time * 1.6) % 4) - i) * 1.4) : 0;
      m.material.emissive.copy(C.can).multiplyScalar(s * 0.35);
    });

    // current dots on HV nets carrying it
    let di = 0;
    anim.flowPhase += dt;
    for (const id in nets) {
      const n = nets[id];
      const dir = flowOf(state, id);
      if (!dir || n.level < 0.5 || (n.n.kind !== 'hv' && n.n.kind !== 'phase' && n.n.kind !== 'ac')) continue;
      const speed = n.n.kind === 'phase' ? 0.6 + anim.motor * 1.2 : 0.9;
      const gap = 0.28;
      const off = ((anim.flowPhase * speed) % gap + gap) % gap;
      for (let d = dir > 0 ? off : n.len - off; d >= 0 && d <= n.len && di < MAX_DOTS; d += gap * (dir > 0 ? 1 : -1)) {
        const p = polyPoint(n.n.pts, d);
        tmp.position.set(p[0], n.y + 0.01, p[1]);
        tmp.scale.setScalar(n.level);
        tmp.updateMatrix();
        dots.setMatrixAt(di++, tmp.matrix);
      }
    }
    dots.count = di;
    dots.instanceMatrix.needsUpdate = true;

    // CAN frames
    const heads = bus ? bus.heads() : [];
    let fi = 0;
    for (const h of heads) {
      if (fi >= MAX_FRAMES) break;
      const onStub = Math.abs(h[1] - 1.6) > 0.01;
      tmp.position.set(h[0], 0.11, h[1]);
      tmp.rotation.set(0, onStub ? Math.PI / 2 : 0, 0);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      frames.setMatrixAt(fi++, tmp.matrix);
    }
    tmp.rotation.set(0, 0, 0);
    frames.count = fi;
    frames.instanceMatrix.needsUpdate = true;

    // receive flashes on stubs + data for screens
    const act = bus ? bus.activity() : {};
    for (const node in TAP_X) {
      const n = nets['can-' + node];
      if (n && act[node]) n.mat.emissive.copy(C.can).multiplyScalar(n.level * (0.28 + act[node] * 0.6));
    }
    if (time - screenAt > 0.08) {
      screenAt = time;
      trace.a.push(Math.min(1, anim.motor * (0.62 + 0.25 * Math.sin(time * 0.9)) + Math.random() * 0.04));
      trace.b.push(Math.min(1, anim.dclink * 0.88 + Math.random() * 0.02));
      trace.c.push(anim.soc);
      for (const a of [trace.a, trace.b, trace.c]) if (a.length > 120) a.shift();
      drawScreens(time, act);
    }

    // camera ease + parallax
    target.lerp(goal.target, 1 - Math.exp(-dt * 2.2));
    camera.zoom += (goal.zoom - camera.zoom) * (1 - Math.exp(-dt * 2.2));
    camera.updateProjectionMatrix();
    parallax += (parallaxGoal - parallax) * (1 - Math.exp(-dt * 3));
    root.rotation.y = parallax;
    placeCamera();

    renderer.render(scene, camera);

    // labels follow their parts
    root.updateMatrixWorld();
    for (const l of labels) {
      proj.copy(l.p).applyMatrix4(root.matrixWorld).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H;
      l.d.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  fit();
  const ro = new ResizeObserver(() => { fit(); if (state) frame(null, 0); });
  ro.observe(container);

  // Wait for the webfont so the screen textures don't flash a fallback face.
  try { await document.fonts.load('500 16px "IBM Plex Mono"'); } catch { /* fine */ }

  return {
    setState,
    frame,
    destroy() { ro.disconnect(); renderer.dispose(); canvas.remove(); labelsEl.remove(); tip.remove(); },
  };
}
