/*
 * circuit.js — the hero's signature element.
 *
 * A live PCB: Manhattan-routed copper traces (45°-chamfered corners),
 * vias, SMD/through-hole pads, a handful of component footprints (IC,
 * passives, SOT/transistor) with faint silkscreen, and a subtle copper
 * pour texture on a dark solder-mask base.
 *
 * Current drifts along the traces on its own; the cursor pulls nearby
 * current toward it like an induced field. Clicking a pad/via fires a
 * bright pulse that cascades outward along connected traces —
 * "energizing the board."
 *
 * Respects prefers-reduced-motion: renders one static PCB frame (board,
 * traces, pads, components — no animation, no idle nudge, no pointer
 * reactivity) instead of running the loop.
 */
(function () {
  var canvas = document.getElementById('circuitCanvas');
  if (!canvas) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ctx = canvas.getContext('2d');
  var hint = document.getElementById('hint-text');
  var heroInner = document.querySelector('.hero-inner');
  var W, H, DPR;
  var nodes = [];
  var edges = [];
  var components = [];
  var pulses = []; // traveling energy packets: {edge, t, speed, life, color, amp, cascade}
  var mouse = { x: -9999, y: -9999, active: false };
  var hasEnergized = false;
  var textRect = null;

  var CYAN = [70, 228, 211];
  var AMBER = [255, 154, 77];
  var TRACE = [104, 189, 176];   // copper-teal base
  var TRACE_HI = [205, 255, 248]; // specular highlight

  var groundCanvas = document.createElement('canvas');
  var groundCtx = groundCanvas.getContext('2d');

  // ---------- geometry helpers ----------

  function roundRectPath(c, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // Cut 45° chamfers into every interior corner of a polyline.
  function chamferPolyline(pts, size) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var prev = pts[i - 1], cur = pts[i], next = pts[i + 1];
      var d1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      var d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
      var s = Math.min(size, d1 / 2, d2 / 2);
      if (s < 0.6 || d1 === 0 || d2 === 0) { out.push(cur); continue; }
      out.push(
        { x: cur.x - (cur.x - prev.x) / d1 * s, y: cur.y - (cur.y - prev.y) / d1 * s },
        { x: cur.x + (next.x - cur.x) / d2 * s, y: cur.y + (next.y - cur.y) / d2 * s }
      );
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function polylineLen(pts) {
    var l = 0;
    for (var i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return l;
  }

  function edgePoint(e, t) {
    t = Math.max(0, Math.min(1, t));
    var pts = e.points;
    if (pts.length === 2) {
      return { x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t };
    }
    var target = t * e.len, acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var segLen = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + segLen >= target || i === pts.length - 1) {
        var lt = segLen > 0 ? (target - acc) / segLen : 0;
        lt = Math.max(0, Math.min(1, lt));
        return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * lt, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * lt };
      }
      acc += segLen;
    }
    return pts[pts.length - 1];
  }

  function makeEdge(a, b, points, width) {
    var chamfered = chamferPolyline(points, 8);
    return { a: a, b: b, points: chamfered, len: polylineLen(chamfered), width: width };
  }

  // ---------- board construction ----------

  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    groundCanvas.width = W * DPR;
    groundCanvas.height = H * DPR;
    groundCtx.setTransform(DPR, 0, 0, DPR, 0, 0);

    updateTextRect();
    buildBoard();
    buildGroundLayer();
  }

  function updateTextRect() {
    if (!heroInner) return;
    var cRect = canvas.getBoundingClientRect();
    var tRect = heroInner.getBoundingClientRect();
    textRect = {
      cx: (tRect.left - cRect.left) + tRect.width * 0.42,
      cy: (tRect.top - cRect.top) + tRect.height * 0.5,
      r: Math.max(tRect.width, tRect.height) * 0.62
    };
  }

  function buildBoard() {
    nodes = [];
    edges = [];
    components = [];

    var cellSize = 96;
    var cols = Math.max(6, Math.min(18, Math.round(W / cellSize)));
    var rows = Math.max(4, Math.min(11, Math.round(H / cellSize)));
    var cellW = W / cols;
    var cellH = H / rows;
    var maxEdges = 260;

    var grid = [];
    for (var r = 0; r <= rows; r++) {
      grid[r] = [];
      for (var c = 0; c <= cols; c++) {
        var node = { x: c * cellW, y: r * cellH, r: 1.7, glow: 0, kind: 'pad' };
        grid[r][c] = node;
        nodes.push(node);
      }
    }

    // fine mesh: strict Manhattan grid, occasional gaps for irregularity
    for (var r2 = 0; r2 <= rows; r2++) {
      for (var c2 = 0; c2 <= cols; c2++) {
        if (edges.length >= maxEdges) break;
        if (c2 < cols && Math.random() > 0.18) {
          var a = grid[r2][c2], b = grid[r2][c2 + 1];
          edges.push(makeEdge(a, b, [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], 0.8 + Math.random() * 0.6));
        }
        if (r2 < rows && Math.random() > 0.18) {
          var a2 = grid[r2][c2], b2 = grid[r2 + 1][c2];
          edges.push(makeEdge(a2, b2, [{ x: a2.x, y: a2.y }, { x: b2.x, y: b2.y }], 0.8 + Math.random() * 0.6));
        }
      }
    }

    // assign node kinds: mostly small copper pads, some vias, some SMD pads
    nodes.forEach(function (n) {
      var roll = Math.random();
      if (roll < 0.09) { n.kind = 'via'; n.r = 3.6; }
      else if (roll < 0.24) { n.kind = 'smd'; n.r = 2.4; }
      else { n.kind = 'pad'; n.r = Math.random() < 0.5 ? 1.4 : 2.0; }
    });

    // bus bundles: parallel traces that turn together (the classic PCB tell)
    var bundleCount = Math.max(3, Math.min(6, Math.round(cols / 3)));
    for (var i = 0; i < bundleCount; i++) {
      var r0 = 1 + ((Math.random() * (rows - 1)) | 0);
      var c0 = 1 + ((Math.random() * (cols - 3)) | 0);
      var span = 2 + ((Math.random() * (cols - c0 - 1)) | 0);
      var c1 = Math.min(cols, c0 + span);
      var r1 = 1 + ((Math.random() * (rows - 1)) | 0);
      if (!grid[r0] || !grid[r0][c0] || !grid[r1] || !grid[r1][c1]) continue;
      var start = grid[r0][c0], end = grid[r1][c1];
      var n = 2 + ((Math.random() * 2) | 0);
      var offsets = n === 2 ? [-4, 4] : n === 3 ? [-6, 0, 6] : [-7.5, -2.5, 2.5, 7.5];
      offsets.forEach(function (k) {
        var pts = [
          { x: start.x, y: start.y + k },
          { x: end.x + k, y: start.y + k },
          { x: end.x + k, y: end.y }
        ];
        edges.push(makeEdge(start, end, pts, 1.0 + Math.random() * 0.5));
      });
    }

    // a few long single-bend jump traces for variety
    for (var j = 0; j < 4; j++) {
      var ra = (Math.random() * (rows + 1)) | 0, ca = (Math.random() * (cols + 1)) | 0;
      var rb = (Math.random() * (rows + 1)) | 0, cb = (Math.random() * (cols + 1)) | 0;
      if (!grid[ra] || !grid[ra][ca] || !grid[rb] || !grid[rb][cb]) continue;
      var A = grid[ra][ca], B = grid[rb][cb];
      if (Math.abs(A.x - B.x) < cellW * 1.5 && Math.abs(A.y - B.y) < cellH * 1.5) continue;
      edges.push(makeEdge(A, B, [{ x: A.x, y: A.y }, { x: B.x, y: A.y }, { x: B.x, y: B.y }], 1.2));
    }

    // component footprints on a handful of interior nodes
    var candidates = nodes.filter(function (n) {
      return n.x > W * 0.1 && n.x < W * 0.9 && n.y > H * 0.14 && n.y < H * 0.86;
    });
    var wanted = Math.max(3, Math.min(6, Math.round((cols * rows) / 22)));
    var used = [];
    var types = ['ic', 'passive', 'passive', 'sot', 'passive', 'ic'];
    var refCounters = { U: 0, R: 0, C: 0, Q: 0 };
    for (var k = 0; k < wanted && candidates.length; k++) {
      var idx = (Math.random() * candidates.length) | 0;
      var anchor = candidates[idx];
      var tooClose = used.some(function (u) { return Math.hypot(u.x - anchor.x, u.y - anchor.y) < Math.min(cellW, cellH) * 2.2; });
      candidates.splice(idx, 1);
      if (tooClose) { k--; continue; }
      used.push(anchor);
      var type = types[(Math.random() * types.length) | 0];
      var ref;
      if (type === 'ic') { refCounters.U++; ref = 'U' + refCounters.U; }
      else if (type === 'sot') { refCounters.Q++; ref = 'Q' + refCounters.Q; }
      else {
        var isCap = Math.random() < 0.5;
        if (isCap) { refCounters.C++; ref = 'C' + refCounters.C; }
        else { refCounters.R++; ref = 'R' + refCounters.R; }
        type = isCap ? 'cap' : 'res';
      }
      anchor.kind = 'component';
      anchor.r = type === 'ic' ? 2.2 : 1.6;
      components.push({ anchor: anchor, type: type, ref: ref, rot: Math.random() < 0.5 ? 0 : Math.PI / 2 });
    }
  }

  function buildGroundLayer() {
    groundCtx.clearRect(0, 0, W, H);

    // faint copper-pour hatch texture
    groundCtx.strokeStyle = 'rgba(70,228,211,0.022)';
    groundCtx.lineWidth = 1;
    var step = 15;
    groundCtx.beginPath();
    for (var d = -H; d < W + H; d += step) {
      groundCtx.moveTo(d, 0);
      groundCtx.lineTo(d + H, H);
    }
    groundCtx.stroke();

    // board outline (silkscreen)
    groundCtx.strokeStyle = 'rgba(233,237,243,0.05)';
    groundCtx.lineWidth = 1;
    roundRectPath(groundCtx, 9, 9, Math.max(0, W - 18), Math.max(0, H - 18), 18);
    groundCtx.stroke();

    // corner mounting holes
    [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(function (p) {
      groundCtx.beginPath();
      groundCtx.strokeStyle = 'rgba(233,237,243,0.1)';
      groundCtx.lineWidth = 1.4;
      groundCtx.arc(p[0], p[1], 5, 0, Math.PI * 2);
      groundCtx.stroke();
      groundCtx.beginPath();
      groundCtx.fillStyle = 'rgba(10,13,19,0.65)';
      groundCtx.arc(p[0], p[1], 2.8, 0, Math.PI * 2);
      groundCtx.fill();
    });

    // nameplate silkscreen
    groundCtx.font = '9px "JetBrains Mono", monospace';
    groundCtx.textAlign = 'right';
    groundCtx.fillStyle = 'rgba(233,237,243,0.13)';
    groundCtx.fillText('JMW · WE-01', W - 24, H - 22);
  }

  // ---------- interactive graph helpers ----------

  function spawnAmbientPulse() {
    if (!edges.length) return;
    var e = edges[(Math.random() * edges.length) | 0];
    pulses.push({
      edge: e,
      t: 0,
      speed: 0.006 + Math.random() * 0.01,
      life: 1,
      color: Math.random() < 0.75 ? CYAN : AMBER,
      amp: 0.5 + Math.random() * 0.5
    });
  }

  function energizeFrom(node) {
    hasEnergized = true;
    if (hint) hint.style.opacity = '0';
    var touched = edges.filter(function (e) { return e.a === node || e.b === node; });
    touched.forEach(function (e) {
      pulses.push({
        edge: e,
        t: e.a === node ? 0 : 1,
        speed: (e.a === node ? 1 : -1) * 0.02,
        life: 1,
        color: AMBER,
        amp: 1.4,
        cascade: 2
      });
    });
    node.glow = 1.6;
  }

  function findNearestNode(x, y, maxDist) {
    var best = null, bestD = maxDist * maxDist;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var dx = n.x - x, dy = n.y - y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  function onMove(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
    mouse.active = true;
  }

  function onTap(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    var node = findNearestNode(x, y, 90);
    if (node) energizeFrom(node);
  }

  // ---------- component footprint drawing ----------

  function drawIC(anchor, ref) {
    var w = 26, h = 46, pins = 4;
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 3);
    ctx.fillStyle = 'rgba(5,7,11,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,237,243,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    for (var i = 0; i < pins; i++) {
      var py = -h / 2 + (h / (pins + 1)) * (i + 1);
      ctx.fillStyle = 'rgba(200,168,120,0.55)';
      ctx.fillRect(-w / 2 - 4, py - 1.1, 4, 2.2);
      ctx.fillRect(w / 2, py - 1.1, 4, 2.2);
    }
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,154,77,0.6)';
    ctx.arc(-w / 2 + 4, -h / 2 + 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawLabel(anchor.x, anchor.y - h / 2 - 6, ref);
  }

  function drawPassive(anchor, ref, isCap) {
    var padW = 6, padH = 8, gap = 16;
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    ctx.fillStyle = 'rgba(70,228,211,0.42)';
    roundRectPath(ctx, -gap / 2 - padW, -padH / 2, padW, padH, 1.2);
    ctx.fill();
    roundRectPath(ctx, gap / 2, -padH / 2, padW, padH, 1.2);
    ctx.fill();
    ctx.fillStyle = isCap ? 'rgba(130,158,182,0.5)' : 'rgba(160,120,74,0.55)';
    roundRectPath(ctx, -gap / 2, -padH * 0.32, gap, padH * 0.64, 1);
    ctx.fill();
    ctx.restore();
    drawLabel(anchor.x, anchor.y - padH - 6, ref);
  }

  function drawSOT(anchor, ref) {
    ctx.save();
    ctx.translate(anchor.x, anchor.y);
    roundRectPath(ctx, -9, -7, 18, 13, 2);
    ctx.fillStyle = 'rgba(18,20,26,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,237,243,0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
    [-6, 0, 6].forEach(function (x) {
      ctx.fillStyle = 'rgba(200,168,120,0.55)';
      ctx.fillRect(x - 1.1, 6.5, 2.2, 4);
    });
    ctx.restore();
    drawLabel(anchor.x, anchor.y - 14, ref);
  }

  function drawLabel(x, y, text) {
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(233,237,243,0.22)';
    ctx.fillText(text, x, y);
  }

  function drawComponents() {
    components.forEach(function (comp) {
      var a = comp.anchor;
      if (comp.type === 'ic') drawIC(a, comp.ref);
      else if (comp.type === 'sot') drawSOT(a, comp.ref);
      else drawPassive(a, comp.ref, comp.type === 'cap');
    });
  }

  // ---------- render ----------

  function drawTraces() {
    edges.forEach(function (e) {
      var mid = edgePoint(e, 0.5);
      var dToMouse = mouse.active ? Math.hypot(mid.x - mouse.x, mid.y - mouse.y) : 9999;
      var attract = mouse.active ? Math.max(0, 1 - dToMouse / 170) : 0;
      var baseA = 0.16 + attract * 0.4;
      var hiA = 0.06 + attract * 0.28;
      var pts = e.points;

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = 'rgba(' + TRACE[0] + ',' + TRACE[1] + ',' + TRACE[2] + ',' + baseA.toFixed(3) + ')';
      ctx.lineWidth = e.width + attract * 1.2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(' + TRACE_HI[0] + ',' + TRACE_HI[1] + ',' + TRACE_HI[2] + ',' + hiA.toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.5, e.width * 0.35);
      ctx.stroke();
    });
  }

  function drawNodes() {
    nodes.forEach(function (n) {
      if (n.kind === 'component') {
        // still track glow for the feed-in feel, but footprint draws the visuals
        var d0 = mouse.active ? Math.hypot(n.x - mouse.x, n.y - mouse.y) : 9999;
        n.glow = Math.max(n.glow * 0.94, Math.max(0, 1 - d0 / 140));
        return;
      }
      var d = mouse.active ? Math.hypot(n.x - mouse.x, n.y - mouse.y) : 9999;
      var near = Math.max(0, 1 - d / 140);
      n.glow = Math.max(n.glow * 0.94, near);
      var rad = n.r + n.glow * 3.2;
      var alpha = 0.35 + n.glow * 0.65;

      if (n.kind === 'via') {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + TRACE[0] + ',' + TRACE[1] + ',' + TRACE[2] + ',' + alpha.toFixed(3) + ')';
        ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgba(10,13,19,0.92)';
        ctx.arc(n.x, n.y, rad * 0.42, 0, Math.PI * 2);
        ctx.fill();
      } else if (n.kind === 'smd') {
        ctx.fillStyle = 'rgba(70,228,211,' + alpha.toFixed(3) + ')';
        roundRectPath(ctx, n.x - rad, n.y - rad * 0.62, rad * 2, rad * 1.24, 1);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(70,228,211,' + alpha.toFixed(3) + ')';
        ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      if (n.glow > 0.05) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(70,228,211,' + (n.glow * 0.4).toFixed(3) + ')';
        ctx.arc(n.x, n.y, rad + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }

  function drawPulses() {
    pulses = pulses.filter(function (p) { return p.life > 0; });
    pulses.forEach(function (p) {
      var pos = edgePoint(p.edge, p.t);
      var c = p.color;
      var glowR = 3.2 * p.amp;
      var rg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR * 3);
      rg.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (0.9 * p.life).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + p.life.toFixed(3) + ')';
      ctx.arc(pos.x, pos.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      p.t += p.speed;
      p.life -= 0.012;

      if (p.t > 1 || p.t < 0) {
        var endNode = p.t >= 1 ? p.edge.b : p.edge.a;
        endNode.glow = Math.max(endNode.glow, 1);
        if (p.cascade && p.cascade > 0) {
          var next = edges.filter(function (e) { return (e !== p.edge) && (e.a === endNode || e.b === endNode); });
          next.slice(0, 2).forEach(function (ne) {
            pulses.push({
              edge: ne,
              t: ne.a === endNode ? 0 : 1,
              speed: (ne.a === endNode ? 1 : -1) * 0.02,
              life: 1,
              color: AMBER,
              amp: p.amp * 0.75,
              cascade: p.cascade - 1
            });
          });
        }
        p.life = 0;
      }
    });
  }

  function drawTextScrim() {
    if (!textRect) return;
    var rg = ctx.createRadialGradient(textRect.cx, textRect.cy, 0, textRect.cx, textRect.cy, textRect.r);
    rg.addColorStop(0, 'rgba(10,13,19,0.5)');
    rg.addColorStop(0.7, 'rgba(10,13,19,0.28)');
    rg.addColorStop(1, 'rgba(10,13,19,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  var lastAmbient = 0;

  function renderFrame(ts, animated) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(groundCanvas, 0, 0, W, H);

    var grad = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, Math.max(W, H) * 0.8);
    grad.addColorStop(0, 'rgba(70,228,211,0.05)');
    grad.addColorStop(1, 'rgba(10,13,19,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (animated && ts - lastAmbient > 260) {
      lastAmbient = ts;
      if (pulses.length < 40) spawnAmbientPulse();
    }

    drawTraces();
    drawComponents();
    drawNodes();
    if (animated) drawPulses();
    drawTextScrim();
  }

  function draw(ts) {
    renderFrame(ts, true);
    requestAnimationFrame(draw);
  }

  // ---------- boot ----------

  if (reduceMotion) {
    resize();
    renderFrame(0, false);
    window.addEventListener('resize', function () {
      resize();
      renderFrame(0, false);
    });
    return;
  }

  canvas.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY); });
  canvas.addEventListener('mouseleave', function () { mouse.active = false; });
  canvas.addEventListener('touchmove', function (e) {
    if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('click', function (e) { onTap(e.clientX, e.clientY); });
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches[0]) onTap(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);

  // gentle nudge: after a few seconds of no interaction, pulse a random node
  // so it's obvious the board is interactive.
  setTimeout(function nudge() {
    if (!hasEnergized && nodes.length) {
      energizeFrom(nodes[(Math.random() * nodes.length) | 0]);
      hasEnergized = false; // allow the hint to keep showing until a real click
    }
    setTimeout(nudge, 7000);
  }, 4000);
})();
