// CAN traffic for the hero drawing. CAN is a broadcast bus: a frame leaves
// its sender's stub, reaches the trunk, and propagates both ways to every
// node and to both terminators. This module only does the bookkeeping; the
// renderers decide how a frame looks.
import { NETS, TAP_X, BUS_X0, BUS_X1, BUS_Z, MESSAGES, pointAt, polyLength } from './graph.js';

const SPEED = 7;          // drawing units per second (slowed down to be visible)
const STUB = {};
for (const n of NETS) if (n.kind === 'can' && n.node) STUB[n.node] = n;

export class Bus {
  constructor({ onFrame } = {}) {
    this.frames = [];
    this.talkers = {};
    this.next = {};
    this.time = 0;
    this.onFrame = onFrame;
  }

  setTalkers(talkers) {
    this.talkers = talkers || {};
    for (const id in this.talkers) if (this.next[id] == null) this.next[id] = this.time + Math.random() * 0.4;
  }

  update(dt) {
    this.time += dt;
    for (const id in this.talkers) {
      const rate = this.talkers[id];
      if (!rate) continue;
      if (this.time >= this.next[id]) {
        const names = MESSAGES[id] || ['FRAME'];
        const name = names[Math.floor(Math.random() * names.length)];
        const stub = STUB[id];
        this.frames.push({ src: id, name, t0: this.time, stubLen: polyLength(stub.pts) });
        if (this.onFrame) this.onFrame({ time: this.time, src: id, name });
        // jitter so senders don't fall into lockstep
        this.next[id] = this.time + (1 / rate) * (0.6 + Math.random() * 0.8);
      }
    }
    for (const id in this.next) if (!this.talkers[id]) delete this.next[id];
    const maxAge = (BUS_X1 - BUS_X0) / SPEED + 1.2;
    this.frames = this.frames.filter(f => this.time - f.t0 < maxAge);
  }

  // Positions of every visible frame head, in plan coordinates.
  // Each entry: [x, z, fade]
  heads() {
    const out = [];
    for (const f of this.frames) {
      const age = this.time - f.t0;
      const stubT = f.stubLen / SPEED;
      if (age < stubT) {
        const p = pointAt(STUB[f.src].pts, age / stubT);
        out.push([p[0], p[1], 1]);
        continue;
      }
      const run = (age - stubT) * SPEED;
      const tap = TAP_X[f.src];
      const left = tap - run, right = tap + run;
      if (left >= BUS_X0) out.push([left, BUS_Z, 1]);
      if (right <= BUS_X1) out.push([right, BUS_Z, 1]);
    }
    return out;
  }

  // How recently each node received something: 0..1 (1 = this instant).
  // Receivers include the sender's own stub, which lights while sending.
  activity() {
    const act = {};
    for (const node in TAP_X) act[node] = 0;
    for (const f of this.frames) {
      const age = this.time - f.t0;
      const stubT = f.stubLen / SPEED;
      act[f.src] = Math.max(act[f.src], age < stubT + 0.25 ? 1 : 0);
      for (const node in TAP_X) {
        if (node === f.src) continue;
        const arrive = stubT + Math.abs(TAP_X[node] - TAP_X[f.src]) / SPEED + (STUB[node] ? polyLength(STUB[node].pts) / SPEED : 0);
        const since = age - arrive;
        if (since >= 0 && since < 0.35) act[node] = Math.max(act[node], 1 - since / 0.35);
      }
    }
    return act;
  }
}
