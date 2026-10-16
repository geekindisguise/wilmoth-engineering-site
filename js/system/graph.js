// The system drawn in the hero: a single-line diagram of a typical EV
// conversion. Both renderers (svg.js for phones / reduced motion, scene.js
// for three.js) draw from this one description, so the 2D and 3D versions
// always agree.
//
// Coordinates are plan view in drawing units: x to the right, z toward the
// viewer. Heights (h) are only used by the 3D scene.

export const MODULE_X = [-2.5, -1.43, -0.37, 0.7];

export const COMPONENTS = [
  { id: 'J1', name: 'J1772 inlet', type: 'inlet', x: -6.3, z: -1.9, w: 0.9, d: 0.9, h: 0.45,
    note: 'Where the station plugs in: AC power plus the control-pilot signal.' },
  { id: 'U3', name: 'On-board charger', type: 'box', x: -4.5, z: -1.9, w: 1.3, d: 1.0, h: 0.55, hv: true,
    note: 'Turns AC from the station into DC for the pack.' },
  { id: 'BT1', name: 'Battery pack', type: 'pack', x: -0.9, z: -1.9, w: 4.3, d: 1.3, h: 0.7, hv: true,
    note: 'Modules in series. The high-voltage source for everything else.' },
  { id: 'U1', name: 'BMS', type: 'board', x: -0.9, z: -0.35, w: 2.8, d: 0.55, h: 0.1,
    note: 'Battery management: reads every module and guards the pack.' },
  { id: 'K1', name: 'Main contactor', type: 'contactor', x: 2.2, z: -1.9, w: 0.8, d: 0.9, h: 0.55, hv: true,
    note: 'Connects the pack to the rest of the car, after precharge.' },
  { id: 'R3', name: 'Precharge resistor', type: 'powerres', x: 2.2, z: -0.95, w: 0.75, d: 0.3, h: 0.22, hv: true,
    note: 'Limits inrush while the controller capacitors charge.' },
  { id: 'U2', name: 'Motor controller', type: 'inverter', x: 4.1, z: -1.9, w: 1.4, d: 1.2, h: 0.65, hv: true,
    note: 'Inverter: DC from the pack in, three-phase AC to the motor out.' },
  { id: 'M1', name: 'Traction motor', type: 'motor', x: 6.2, z: -1.9, w: 1.2, d: 1.1, h: 1.1,
    note: 'Three-phase AC motor.' },
  { id: 'U4', name: 'DC-DC converter', type: 'box', x: 3.55, z: 0.5, w: 0.9, d: 0.7, h: 0.38, hv: true,
    note: 'Steps pack voltage down to keep the 12 V system charged.' },
  { id: 'B2', name: '12 V battery', type: 'battery12', x: 5.6, z: 0.5, w: 0.85, d: 0.6, h: 0.5,
    note: 'Runs the controllers before high voltage is on.' },
  { id: 'R1', name: '120 Ω terminator', type: 'resistor', x: -6.9, z: 1.6, w: 0.5, d: 0.16, h: 0.16, vertical: true,
    note: 'Terminates one end of the bus.' },
  { id: 'R2', name: '120 Ω terminator', type: 'resistor', x: 6.9, z: 1.6, w: 0.5, d: 0.16, h: 0.16, vertical: true,
    note: 'Terminates the other end.' },
  { id: 'U6', name: 'CANnery', type: 'laptop', x: -3.6, z: 2.85, w: 1.8, d: 1.15, h: 0.06,
    note: 'Opens every frame on the bus: decoded, charted, logged.' },
  { id: 'U5', name: 'Dash & telemetry', type: 'screen', x: 3.2, z: 2.85, w: 1.6, d: 0.9, h: 0.5,
    note: 'Custom dashboard; shows what the controllers report.' },
];

// kind: hv (pack DC), ac (station AC), phase (motor AC), lv (12 V),
//       sense (BMS module leads), pilot (J1772 CP), can (bus + stubs)
export const NETS = [
  { id: 'ac', kind: 'ac', pts: [[-5.85, -2.15], [-5.15, -2.15]] },
  { id: 'pilot', kind: 'pilot', pts: [[-5.85, -1.65], [-5.15, -1.65]] },
  { id: 'hv-charge', kind: 'hv', pts: [[-3.85, -1.9], [-3.05, -1.9]] },
  { id: 'hv-pack', kind: 'hv', pts: [[1.25, -1.9], [1.8, -1.9]] },
  { id: 'hv-pre', kind: 'hv', pts: [[1.5, -1.9], [1.5, -0.95], [2.9, -0.95], [2.9, -1.9]] },
  { id: 'hv-main', kind: 'hv', pts: [[2.6, -1.9], [3.4, -1.9]] },
  { id: 'hv-dcdc', kind: 'hv', pts: [[3.55, -1.3], [3.55, 0.15]] },
  { id: 'phase-a', kind: 'phase', pts: [[4.8, -2.2], [5.6, -2.2]] },
  { id: 'phase-b', kind: 'phase', pts: [[4.8, -1.9], [5.6, -1.9]] },
  { id: 'phase-c', kind: 'phase', pts: [[4.8, -1.6], [5.6, -1.6]] },
  { id: 'lv', kind: 'lv', pts: [[4.0, 0.5], [5.17, 0.5]] },
  { id: 'lv-rail', kind: 'lv', pts: [[5.6, 0.8], [5.6, 1.05], [-4.8, 1.05], [-4.8, -1.4]] },
  { id: 'lv-bms', kind: 'lv', pts: [[-1.6, 1.05], [-1.6, -0.08]] },
  { id: 'lv-mcu', kind: 'lv', pts: [[4.6, 1.05], [4.6, -1.3]] },
  ...MODULE_X.map((x, i) => ({ id: 'sense-' + i, kind: 'sense', pts: [[x, -0.62], [x, -1.25]] })),
  { id: 'can-bus', kind: 'can', pts: [[-6.9, 1.6], [6.9, 1.6]] },
  { id: 'can-U3', kind: 'can', node: 'U3', pts: [[-4.2, -1.4], [-4.2, 1.6]] },
  { id: 'can-U1', kind: 'can', node: 'U1', pts: [[-0.2, -0.08], [-0.2, 1.6]] },
  { id: 'can-U2', kind: 'can', node: 'U2', pts: [[4.15, -1.3], [4.15, 1.6]] },
  { id: 'can-U6', kind: 'can', node: 'U6', pts: [[-3.6, 2.27], [-3.6, 1.6]] },
  { id: 'can-U5', kind: 'can', node: 'U5', pts: [[3.2, 2.4], [3.2, 1.6]] },
];

export const BUS_Z = 1.6;
export const BUS_X0 = -6.9;
export const BUS_X1 = 6.9;
// Where each node's stub meets the bus.
export const TAP_X = { U3: -4.2, U1: -0.2, U2: 4.15, U6: -3.6, U5: 3.2 };

// Illustrative message names only; not a real vehicle's DBC.
export const MESSAGES = {
  U1: ['PACK_STATUS', 'CELL_VOLTAGES', 'CELL_TEMPS', 'STATE_OF_CHARGE'],
  U2: ['MOTOR_SPEED', 'INVERTER_TEMP', 'DC_LINK_VOLTAGE', 'TORQUE_ACTUAL'],
  U3: ['CHARGER_STATUS', 'PILOT_DUTY', 'AC_INPUT'],
  U5: ['DASH_HEARTBEAT', 'TORQUE_REQUEST'],
};

// One entry per step in index.html (data-state).
//   live     nets carrying power or signal
//   flow     HV nets with visible current; value is direction (+1 / -1)
//   talkers  CAN senders and their frames per second
//   focus    components to emphasize; camera eases toward them in 3D
export const STATES = {
  running: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'sense-*', 'can-*', 'hv-pack', 'hv-main', 'hv-dcdc', 'phase-*'],
    flow: { 'hv-pack': 1, 'hv-main': 1, 'hv-dcdc': 1, 'phase-*': 1 },
    talkers: { U1: 2.5, U2: 4, U5: 1 }, motor: 1, dclink: 1, contactor: 1, focus: [],
  },
  wake: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*'],
    flow: {}, talkers: { U1: 1, U2: 1, U5: 1, U3: 0.5 }, motor: 0, dclink: 0, contactor: 0,
    focus: ['B2', 'U1', 'U2', 'U5', 'R1', 'R2'],
  },
  bms: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*', 'sense-*'],
    flow: {}, talkers: { U1: 5, U2: 0.6, U5: 0.6 }, motor: 0, dclink: 0, contactor: 0, scan: true,
    focus: ['BT1', 'U1'],
  },
  precharge: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*', 'sense-*', 'hv-pack', 'hv-pre'],
    flow: { 'hv-pack': 1, 'hv-pre': 1 }, talkers: { U1: 2, U2: 3, U5: 0.6 },
    motor: 0, dclink: 'ramp', contactor: 0, focus: ['R3', 'K1', 'U2'],
  },
  contactors: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*', 'sense-*', 'hv-pack', 'hv-main', 'hv-dcdc'],
    flow: { 'hv-pack': 1, 'hv-main': 1, 'hv-dcdc': 1 }, talkers: { U1: 2, U2: 2, U5: 0.6 },
    motor: 0, dclink: 1, contactor: 1, focus: ['K1', 'U2', 'U4'],
  },
  drive: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*', 'sense-*', 'hv-pack', 'hv-main', 'hv-dcdc', 'phase-*'],
    flow: { 'hv-pack': 1, 'hv-main': 1, 'hv-dcdc': 1, 'phase-*': 1 }, talkers: { U1: 2, U2: 6, U5: 2 },
    motor: 1, dclink: 1, contactor: 1, focus: ['U2', 'M1', 'U5'],
  },
  charge: {
    live: ['ac', 'pilot', 'hv-charge', 'lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'can-*', 'sense-*'],
    flow: { 'hv-charge': 1, ac: 1 }, talkers: { U3: 4, U1: 3, U5: 0.5 },
    motor: 0, dclink: 0, contactor: 0, charging: true, focus: ['J1', 'U3', 'BT1'],
  },
  cannery: {
    live: ['lv', 'lv-rail', 'lv-bms', 'lv-mcu', 'sense-*', 'can-*', 'hv-pack', 'hv-main', 'hv-dcdc', 'phase-*'],
    flow: { 'hv-pack': 1, 'hv-main': 1, 'hv-dcdc': 1, 'phase-*': 1 },
    talkers: { U1: 3, U2: 5, U5: 1.5 }, motor: 1, dclink: 1, contactor: 1, focus: ['U6'],
  },
};

// Expand 'phase-*' style patterns against net ids.
export function matches(pattern, id) {
  return pattern.endsWith('*') ? id.startsWith(pattern.slice(0, -1)) : pattern === id;
}
export function isLive(state, id) {
  return state.live.some(p => matches(p, id));
}
export function flowOf(state, id) {
  for (const k in state.flow) if (matches(k, id)) return state.flow[k];
  return 0;
}

// A polyline helper both renderers use.
export function polyLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
export function pointAt(pts, t) {
  const total = polyLength(pts);
  let target = t * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (target <= seg || i === pts.length - 1) {
      const f = seg ? Math.min(1, target / seg) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}
