/*
 * circuit.js — the hero's signature element.
 *
 * A live "PCB" of nodes and traces. Current drifts along the traces on its
 * own; the cursor pulls nearby current toward it like an induced field.
 * Clicking a node fires a bright pulse that cascades outward along
 * connected traces — "energizing the board."
 *
 * Respects prefers-reduced-motion: the canvas never mounts (see CSS,
 * .hero-canvas is hidden and .hero-fallback shown instead), and this
 * script no-ops immediately in that case.
 */
(function () {
  var canvas = document.getElementById('circuitCanvas');
  if (!canvas) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  var ctx = canvas.getContext('2d');
  var hint = document.getElementById('hint-text');
  var W, H, DPR;
  var nodes = [];
  var edges = [];
  var pulses = []; // traveling energy packets: {edge, t, speed, life, hue}
  var mouse = { x: -9999, y: -9999, active: false };
  var hasEnergized = false;

  var CYAN = [70, 228, 211];
  var AMBER = [255, 154, 77];

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
    buildGrid();
  }

  // Build an irregular grid of nodes (jittered lattice) + connect neighbors.
  function buildGrid() {
    nodes = [];
    edges = [];
    var cols = Math.max(6, Math.round(W / 130));
    var rows = Math.max(4, Math.round(H / 130));
    var cellW = W / cols;
    var cellH = H / rows;

    var grid = [];
    for (var r = 0; r <= rows; r++) {
      grid[r] = [];
      for (var c = 0; c <= cols; c++) {
        var jitterX = (Math.random() - 0.5) * cellW * 0.5;
        var jitterY = (Math.random() - 0.5) * cellH * 0.5;
        var node = {
          x: c * cellW + jitterX,
          y: r * cellH + jitterY,
          r: Math.random() < 0.14 ? 3.4 : 1.8,
          glow: 0
        };
        grid[r][c] = node;
        nodes.push(node);
      }
    }

    // connect horizontally and vertically, skip some for irregularity
    for (var r2 = 0; r2 <= rows; r2++) {
      for (var c2 = 0; c2 <= cols; c2++) {
        if (c2 < cols && Math.random() > 0.15) {
          edges.push(makeEdge(grid[r2][c2], grid[r2][c2 + 1]));
        }
        if (r2 < rows && Math.random() > 0.15) {
          edges.push(makeEdge(grid[r2][c2], grid[r2 + 1][c2]));
        }
      }
    }
  }

  function makeEdge(a, b) {
    // orthogonal "PCB trace" path: either straight or one right-angle bend
    var bend = Math.random() < 0.5;
    return { a: a, b: b, bend: bend, glow: 0 };
  }

  function edgePoint(e, t) {
    // t in [0,1] along the trace (accounting for the bend)
    if (!e.bend) {
      return { x: e.a.x + (e.b.x - e.a.x) * t, y: e.a.y + (e.b.y - e.a.y) * t };
    }
    var midX = e.b.x, midY = e.a.y; // simple L bend
    if (t < 0.5) {
      var tt = t / 0.5;
      return { x: e.a.x + (midX - e.a.x) * tt, y: e.a.y + (midY - e.a.y) * tt };
    } else {
      var tt2 = (t - 0.5) / 0.5;
      return { x: midX + (e.b.x - midX) * tt2, y: midY + (e.b.y - midY) * tt2 };
    }
  }

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
    // find edges touching this node, fire a bright cascade
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

  canvas.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY); });
  canvas.addEventListener('mouseleave', function () { mouse.active = false; });
  canvas.addEventListener('touchmove', function (e) {
    if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  function onTap(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left, y = clientY - rect.top;
    var node = findNearestNode(x, y, 90);
    if (node) energizeFrom(node);
  }
  canvas.addEventListener('click', function (e) { onTap(e.clientX, e.clientY); });
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches[0]) onTap(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  var lastAmbient = 0;

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    // background vignette
    var grad = ctx.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, Math.max(W, H) * 0.8);
    grad.addColorStop(0, 'rgba(70,228,211,0.05)');
    grad.addColorStop(1, 'rgba(10,13,19,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ambient pulses spawn periodically
    if (ts - lastAmbient > 260) {
      lastAmbient = ts;
      if (pulses.length < 40) spawnAmbientPulse();
    }

    // draw traces
    ctx.lineWidth = 1;
    edges.forEach(function (e) {
      var mid = edgePoint(e, 0.5);
      var dToMouse = mouse.active ? Math.hypot(mid.x - mouse.x, mid.y - mouse.y) : 9999;
      var attract = mouse.active ? Math.max(0, 1 - dToMouse / 170) : 0;
      var alpha = 0.10 + attract * 0.35;
      ctx.strokeStyle = 'rgba(70,228,211,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      if (e.bend) {
        var midX = e.b.x, midY = e.a.y;
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(midX, midY);
        ctx.lineTo(e.b.x, e.b.y);
      } else {
        ctx.moveTo(e.a.x, e.a.y);
        ctx.lineTo(e.b.x, e.b.y);
      }
      ctx.stroke();
    });

    // draw nodes
    nodes.forEach(function (n) {
      var d = mouse.active ? Math.hypot(n.x - mouse.x, n.y - mouse.y) : 9999;
      var near = Math.max(0, 1 - d / 140);
      n.glow = Math.max(n.glow * 0.94, near);
      var rad = n.r + n.glow * 3.2;
      var alpha = 0.35 + n.glow * 0.65;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(70,228,211,' + alpha.toFixed(3) + ')';
      ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
      ctx.fill();
      if (n.glow > 0.05) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(70,228,211,' + (n.glow * 0.4).toFixed(3) + ')';
        ctx.arc(n.x, n.y, rad + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // draw + update pulses
    pulses = pulses.filter(function (p) { return p.life > 0; });
    pulses.forEach(function (p) {
      var pos = edgePoint(p.edge, Math.max(0, Math.min(1, p.t)));
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
        // reached a node — cascade if this was an energized pulse
        var endNode = p.t >= 1 ? p.edge.b : p.edge.a;
        endNode.glow = Math.max(endNode.glow, 1);
        if (p.cascade && p.cascade > 0) {
          var next = edges.filter(function (e) {
            return (e !== p.edge) && (e.a === endNode || e.b === endNode);
          });
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

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);

  // gentle nudge: after 6s of no interaction, pulse a random node so it's
  // obvious the board is interactive.
  setTimeout(function nudge() {
    if (!hasEnergized && nodes.length) {
      energizeFrom(nodes[(Math.random() * nodes.length) | 0]);
      hasEnergized = false; // allow the hint to keep showing until a real click
    }
    setTimeout(nudge, 7000);
  }, 4000);
})();
