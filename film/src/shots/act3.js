// ACT III "∞" — the sculpture, the thesis, the breach   (film bars 17–24, music D)
import {
  D, BAR, BEAT, at, shot, chrome, slam, sub, pulses, orbit, leader, frameTicks, projector, bandPoint, bandScene,
  clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash, placeCard, lerp3,
} from "./common.js";
import { inExpo, inCubic, inOutCubic, outQuart, outBack, inOutSine, hash2, noise1 } from "../lib/util.js";

import { TR } from "./act1.js";
import * as THREE from "three";

const C = D.C;
const INK_D = "#f2f0eb";

// ───────────── one continuous camera for bars 17–23 ─────────────
// The sculpture stays put (G0); the camera flies a C¹ Hermite spline through
// these keys, so the cuts inside this act are cuts of graphics, not of space.
const G0 = { pos: [-10, 0, 0], rot: [16, 0, -2] };
const _g = new THREE.Object3D();
_g.position.set(...G0.pos); _g.rotation.order = "YXZ";
_g.rotation.set(G0.rot[0] * Math.PI / 180, G0.rot[1] * Math.PI / 180, G0.rot[2] * Math.PI / 180);
_g.updateMatrixWorld();
const W = (p) => new THREE.Vector3(...p).applyMatrix4(_g.matrixWorld).toArray();
const addv = (p, o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
function K(t, pos, tgt, fov = 30, roll = 0, range = 520, bokeh = 1.2) {
  return { t, v: [...pos, ...tgt, fov, roll, dist3(pos, tgt), range, bokeh] };
}
const BRAND_T = [-300, 10, 0];
const KEYS = [
  K(at(18), [0, 60, 1080], [0, 3, 0]),
  K(at(18, 0.9), W(addv(bandPoint(0.12), [30, 120, 225])), W(bandPoint(0.155)), 38, -12, 80, 3.0),
  K(at(18, 2), W(addv(bandPoint(0.19), [20, 115, 220])), W(bandPoint(0.225)), 38, -6, 80, 3.0),
  K(at(18, 3), W(orbit([0, 0, 0], 440, -10, -52)), W([0, 10, 0]), 40, 12, 160, 2.6),
  K(at(19, 0.2), [0, 40, 1250], [0, 0, 0], 30, 0, 600, 1.0),
  K(at(20), [0, 40, 1130], [0, 0, 0], 30, 0, 600, 1.0),
  K(at(20, 2), orbit([0, 0, 0], 1180, -2, -6), [0, 20, 0], 30, 0, 560, 1.4),
  K(at(21), orbit([0, 0, 0], 1180, 10, -2), [0, 20, 0], 30, 0, 560, 1.4),
  K(at(21, 0.8), orbit(BRAND_T, 800, 34, 8), BRAND_T, 30, -4, 300, 1.8),
  K(at(22), orbit(BRAND_T, 740, 40, 8), BRAND_T, 30, -4, 300, 1.8),
  K(at(22, 0.9), [0, 60, 1080], [0, 3, 0], 30, 0, 520, 1.2),
  K(at(23), [0, 60, 850], [0, 3, 0], 30, 0, 520, 1.2),
];
function rig(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const h = k1.t - k0.t;
  const u = clamp((t - k0.t) / h);
  const tan = (j) => {
    if (j <= 0 || j >= KEYS.length - 1) return KEYS[j].v.map(() => 0);
    const a = KEYS[j - 1], b = KEYS[j + 1];
    return KEYS[j].v.map((_, c) => (b.v[c] - a.v[c]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const v = k0.v.map((x, c) => h00 * x + h10 * h * m0[c] + h01 * k1.v[c] + h11 * h * m1[c]);
  return {
    cam: { pos: v.slice(0, 3), target: v.slice(3, 6), fov: v[6], roll: v[7] },
    group: G0,
    dof: { focus: v[8], range: v[9], bokeh: v[10] },
  };
}
// the conveyor speeds up through the macro passes, as one continuous function
const flowAt = (t) => t * 1.6 + 8 * smooth((t - at(18)) / 1.8) + 22 * Math.pow(clamp((t - at(22)) / BAR), 3);

// ───────────────────────── assemble ─────────────────────────

const s17 = shot("assemble", at(17), at(18), (a) => {
  const x = clamp(a.lt / (BAR * 0.92));
  const asm = 0.5 - 0.5 * Math.cos(Math.PI * x);
  const intro = 1 - Math.pow(1 - asm, 3);
  const sc = bandScene(a, {
    assemble: asm,
    cam: { pos: [0, 60, 1080 + (1 - intro) * 300], target: [0, 3, 0], fov: 30 },
    group: { pos: G0.pos, rot: [16, -(1 - intro) * 32, -2] },
    pulses: pulses(a.t, at(17, 2), 1),
    // the 2D ∞ of the previous shot is still on screen and hands over to the band
  });
  a.scene = sc;
  const hand = 1 - smooth(a.lt / 0.7);
  if (hand > 0) {
    const bk = a.back();
    const wpx = lerp(1500, 860, outCubic(a.lt / 0.7));
    D.mark(bk, 960, 540, wpx, { draw: 1, glyphs: 0, color: `rgba(17,18,20,${hand.toFixed(3)})` });
  }
  const f = a.front();
  chrome(f, a, { headerP: clamp((a.lt - 0.4) / 0.9) });
  // RHINE LAB.LLC. bar at the band's crossing once it is drawn
  const P = projector(sc);
  const cr = P([0, 0, 0]);
  const q = (a.t - at(17, 2.6)) / 0.4;
  if (q > 0) {
    const w = 350 * outExpo(q);
    f.fillStyle = "rgba(246,245,242,0.92)"; f.fillRect(cr[0] + 60, cr[1] - 12, w, 24);
    D.decodeText(f, "RHINE LAB.LLC.", cr[0] + 80, cr[1] + 6, q * 1.2, a.t, { size: 16, weight: 600, tracking: 1, seed: 100 });
    f.strokeStyle = C.white; f.lineWidth = 2.5; f.beginPath(); f.arc(cr[0] + 60 + w + 26, cr[1], 9, 0, Math.PI * 2); f.stroke();
  }
}, { samples: 10, cues: [[at(17), "slam_big", 0.9], [at(17), "assemble", 0.9]] });

function crossingBar(a, f, sc, w) {
  if (w <= 1) return;
  const cr = projector(sc)([0, 0, 0]);
  f.fillStyle = "rgba(246,245,242,0.92)"; f.fillRect(cr[0] + 60, cr[1] - 12, w, 24);
  f.save(); f.beginPath(); f.rect(cr[0] + 60, cr[1] - 14, w, 28); f.clip();
  D.text(f, "RHINE LAB.LLC.", cr[0] + 80, cr[1] + 6, { size: 16, weight: 600, tracking: 1 });
  f.restore();
}

// ───────────────────────── macro ─────────────────────────

const s18a = shot("macroA", at(18), at(18, 2), (a) => {
  const R = rig(a.t);
  const sc = bandScene(a, { ...R, flow: flowAt(a.t) });
  a.scene = sc;
  const f = a.front();
  crossingBar(a, f, sc, 350 * (1 - smooth(a.lt / 0.3)));
  const lab = smooth((a.lt - 0.35) / 0.2) * (1 - smooth((a.t - at(18, 3.6)) / 0.2));
  D.text(f, `FIN ${String(Math.floor(flowAt(a.t) % 400)).padStart(3, "0")} / 400`, 1860, 130, { size: 13, family: D.F.mono, weight: 600, tracking: 2, align: "right", alpha: lab });
}, { samples: 10, shutter: 0.6, cues: [[at(18), "whoosh_in", 0.7]] });

const s18b = shot("macroB", at(18, 2), at(19), (a) => {
  const R = rig(a.t);
  a.scene = bandScene(a, { ...R, flow: flowAt(a.t) });
  const f = a.front();
  const lab = 1 - smooth((a.t - at(18, 3.6)) / 0.2);
  D.text(f, `FIN ${String(Math.floor(flowAt(a.t) % 400)).padStart(3, "0")} / 400`, 1860, 130, { size: 13, family: D.F.mono, weight: 600, tracking: 2, align: "right", alpha: lab });
}, { samples: 10, shutter: 0.6, cues: [[at(18, 2), "whoosh_out", 0.6]] });

// ───────────────────────── thesis ─────────────────────────

const s19 = shot("thesis", at(19), at(20), (a) => {
  const q = a.lt / a.dur;
  const sc = bandScene(a, {
    ...rig(a.t), flow: flowAt(a.t),
    pulses: pulses(a.t, at(17), 1, (k) => (k % 2 ? 0.0 : 0.5)),
  });
  a.scene = sc;
  const P = projector(sc);
  const L = P([-285 * 0.62, 0, 0]), R = P([285 * 0.62, 0, 0]), X = P([0, 0, 0]);
  const f = a.front();
  chrome(f, a, { header: false });
  const t1 = at(19), t2 = at(19, 1), t3 = at(19, 2);
  const big = (txt, x, y, t0, o = {}) => {
    const p = (a.t - t0) / 0.22;
    if (p <= 0) return;
    const s = lerp(1.35, 1, outExpo(p));
    f.save(); f.translate(x, y); f.scale(s, s);
    D.text(f, txt, 0, 0, { size: o.size ?? 120, weight: 800, align: "center", color: o.color ?? C.ink, alpha: clamp(p * 3), family: o.family });
    f.restore();
  };
  const gl = (which, x, y, t0) => {
    const p = (a.t - t0) / 0.22;
    if (p <= 0) return;
    D.glyph(f, which, x, y, 108 * lerp(1.45, 1, outExpo(p)));
  };
  f.save();
  const out = smooth((a.t - at(20, -0.2)) / 0.2);
  f.globalAlpha = 1 - out;
  gl("+", L[0], L[1], t1);
  gl("−", R[0], R[1], t2);
  const ty = 168;
  D.decodeText(f, "+ KNOWLEDGE", L[0], ty, (a.t - t1) / 0.3, a.t, { size: 30, weight: 700, tracking: 8, align: "center", seed: 110 });
  D.decodeCJK(f, "知识", L[0], ty - 46, (a.t - t1) / 0.3, a.t, { size: 30, weight: 600, tracking: 8 });
  D.decodeText(f, "− LIMITS", R[0], ty, (a.t - t2) / 0.3, a.t, { size: 30, weight: 700, tracking: 8, align: "center", seed: 111 });
  D.decodeCJK(f, "边界", R[0], ty - 46, (a.t - t2) / 0.3, a.t, { size: 30, weight: 600, tracking: 8 });
  const pe = (a.t - t3) / 0.3;
  if (pe > 0) {
    const e = outExpo(pe);
    f.fillStyle = C.ink;
    f.fillRect(X[0] - 70 * e, X[1] + 250, 140 * e, 16);
    f.fillRect(X[0] - 70 * e, X[1] + 280, 140 * e, 16);
    D.decodeText(f, "= INFINITE", X[0], X[1] + 350, pe, a.t, { size: 30, weight: 700, tracking: 8, align: "center", seed: 112 });
  }
  f.restore();
  sub(f, a, "加上知识，减去边界，", "ADD KNOWLEDGE. SUBTRACT LIMITS.", at(19) + 0.05, at(20) - 0.04);
}, { samples: 10, cues: [[at(19), "hit", 0.9], [at(19, 1), "hit", 0.9], [at(19, 2), "slam_big", 1.0]] });

// ───────────────────────── services callouts (low 3/4, tracked) ─────────────────────────

const SERV = [
  { title: "ENGINEERING SECTION", sub: "MECHANICAL DESIGN AND ROBOTICS OF R&D EQUIPMENT", u: 0.15, dx: 140, dy: -170, uw: 330, beat: 0 },
  { title: "BUSINESS SECTION", sub: "PUBLIC AFFAIRS AND COMMUNICATIONS", u: 0.62, dx: -170, dy: -40, uw: -300, beat: 1 },
  { title: "DEFENSE SECTION", sub: "R&D AND RELATED PERSONNEL SECURITY,", sub2: "INFORMATION DISCLOSURE, EMERGENCIES HANDLING", u: 0.4, dx: -150, dy: 150, uw: -340, beat: 2 },
  { title: "HUMAN RESOURCES", title2: "INVESTIGATION SECTION", sub: "HUMAN RESOURCES MANAGEMENT", u: 0.9, dx: 150, dy: 170, uw: 360, beat: 3 },
];

const s20 = shot("services", at(20), at(21), (a) => {
  const q = a.lt / a.dur;
  const sc = bandScene(a, { ...rig(a.t), flow: flowAt(a.t) });
  a.scene = sc;
  const P = projector(sc);
  const f = a.front();
  chrome(f, a, { header: false });
  const out = smooth((a.t - at(21, -0.25)) / 0.25);
  f.save(); f.globalAlpha = 1 - out; f.translate(0, -out * 30);
  for (const S of SERV) {
    const pt = P(bandPoint(S.u));
    const p = (a.t - at(20, S.beat)) / 0.55;
    D.callout(f, { ax: pt[0], ay: pt[1], ex: pt[0] + S.dx, ey: pt[1] + S.dy, uw: S.uw, title: S.title, title2: S.title2, sub: S.sub, sub2: S.sub2, p, t: a.t, seed: 120 + S.beat * 10 });
  }
  f.restore();
  sub(f, a, "等于无限。", "EQUALS INFINITE.", at(20) + 0.05, at(21) - 0.04);
}, { samples: 10, cues: [0, 1, 2, 3].map((k) => [at(20, k), "callout", 0.8]) });

// ───────────────────────── brand ─────────────────────────

const s21 = shot("brand", at(21), at(22), (a) => {
  const q = a.lt / a.dur;
  const sc = bandScene(a, { ...rig(a.t), flow: flowAt(a.t) });
  a.scene = sc;
  const f = a.fxA();
  const p = a.lt / 0.3;
  const ex = inCubic((a.t - at(21, 3.3)) / (BEAT * 0.7));
  f.translate(-ex * 1400, 0);
  D.decodeText(f, "RHINE LAB", 120, 560, p, a.t, { size: 190, weight: 800, tracking: -3, seed: 130 });
  D.decodeCJK(f, "莱茵生命", 124, 700, (a.t - at(21, 0.5)) / 0.4, a.t, { size: 112, weight: 700, tracking: 26, align: "left" });
  a.comp.fxA = slam([100, 380, 1000, 360], a.lt / 0.3, { from: 1.8, rz: 0, pinch: -0.2 });
  const fr = a.front();
  fr.translate(-ex * 1400, 0);
  const lq = (a.t - at(21, 2)) / 0.4;
  if (lq > 0) {
    fr.fillStyle = C.ink; fr.fillRect(124, 760, 640 * outExpo(lq), 3);
    D.decodeText(fr, "SYNTHESIZE INFORMATION · ANALYSIS OS", 124, 800, lq, a.t, { size: 18, weight: 600, tracking: 5, seed: 131 });
  }
  chrome(fr, a, { header: false });
  sub(fr, a, "生命，从无边界。", "LIFE, WITHOUT LIMITS.", at(21) + 0.3, at(22) - 0.04);
}, { samples: 10, cues: [[at(21), "slam_big", 1.0], [at(21, 2), "chime", 0.6]] });

// ───────────────────────── processing → breach ─────────────────────────

const s22 = shot("process", at(22), at(23), (a) => {
  const q = a.lt / a.dur;
  const v = smooth(q * 1.4);
  const sc = bandScene(a, {
    verify: v, align: v * 0.5,
    ...rig(a.t), flow: flowAt(a.t),
    spin: a.t * 0.05 + inCubic(q) * 1.2,
  });
  a.scene = sc;
  const f = a.front();
  chrome(f, a);
  // auth ring + PROCESSING bar
  const rin = smooth((a.lt - 0.35) / 0.3);
  f.globalAlpha = rin;
  D.ring(f, 960, 500, (150 + v * 20) * lerp(0.6, 1, rin), a.t * 1.8, { p: q * 1.1, lw: 2.2 });
  D.decodeText(f, "ACCESSING ARCHIVE · C-023", 960, 505, a.lt / 0.4, a.t, { size: 13, weight: 600, tracking: 3, align: "center", seed: 140 });
  const steps = Math.floor(q * 16) / 16;
  D.text(f, "PROCESSING", 960, 730, { size: 12, weight: 600, tracking: 3, align: "center" });
  D.bar(f, 860, 742, 200, 10, Math.min(0.97, steps * 1.05));
  D.text(f, `${Math.min(97, Math.floor(steps * 105))}%`, 1072, 752, { size: 12, family: D.F.mono, weight: 600 });
  sub(f, a, "正在比对授权口令……", "CROSS-CHECKING AUTHORIZATION KEY.", at(22) + 0.05, at(23) - 0.02);
  f.globalAlpha = 1;
  a.comp.split = inExpo(q) * 0.004;
  a.comp.glitch = 0.6 * inExpo((q - 0.9) / 0.1);
}, { samples: 10, shutter: 0.6, cues: [[at(22), "process", 0.8], [at(22), "riser", 0.9]] });

function classified(f, a, variant) {
  // collage: halftone photo block, orange slashes, file number, CONFIDENTIAL
  f.fillStyle = "#050506"; f.fillRect(0, 0, 1920, 1080);
  // grain blocks
  for (let i = 0; i < 9; i++) {
    const x = hash(i * 3.1 + variant) * 1800, y = hash(i * 7.7 + variant) * 1000, w = 80 + hash(i * 1.3) * 380, h = 30 + hash(i * 2.9) * 160;
    f.fillStyle = `rgba(242,240,235,${0.04 + hash(i * 5.5) * 0.08})`; f.fillRect(x, y, w, h);
  }
  // "photo" block: a microscope field of cells (film 4:36), halftoned
  const px = variant ? 220 : 330, py = 200, pw = 540, ph = 700;
  f.fillStyle = "#e9e7e2"; f.fillRect(px, py, pw, ph);
  f.save(); f.beginPath(); f.rect(px, py, pw, ph); f.clip();
  const cx0 = px + pw / 2, cy0 = py + ph / 2;
  f.fillStyle = "#0b0b0c";
  f.beginPath(); f.rect(px, py, pw, ph); f.arc(cx0, cy0, 250, 0, Math.PI * 2, true); f.fill();
  for (let i = 0; i < 46; i++) {
    const ang = hash(i * 1.7 + variant) * 6.283, rr = Math.sqrt(hash(i * 2.3 + 5)) * 230;
    const x = cx0 + Math.cos(ang) * rr, y = cy0 + Math.sin(ang) * rr, r = 14 + hash(i * 4.1) * 26;
    f.strokeStyle = "#111214"; f.lineWidth = 3 + hash(i) * 4;
    f.beginPath(); f.ellipse(x, y, r, r * (0.7 + hash(i * 9) * 0.3), ang, 0, Math.PI * 2); f.stroke();
    D.dot(f, x + r * 0.2, y - r * 0.1, r * 0.25, "#111214");
  }
  for (let j = 0; j < 70; j++) for (let i = 0; i < 54; i++) {
    const n = hash2(i + variant * 31, j);
    if (n > 0.9) { f.fillStyle = "rgba(17,18,20,0.5)"; f.fillRect(px + i * 10, py + j * 10, 3, 3); }
  }
  f.restore();
  D.text(f, "LAB-1 · ×400", px + 16, py + ph - 18, { size: 14, family: D.F.mono, weight: 600, tracking: 2, color: "#111214" });
  f.strokeStyle = C.orange; f.lineWidth = 9;
  f.beginPath(); f.moveTo(px + 30, py - 40); f.lineTo(px + 230, py + 330); f.stroke();
  f.beginPath(); f.moveTo(px + pw - 120, py + ph - 260); f.lineTo(px + pw - 220, py + ph + 40); f.stroke();
  // stripes
  for (let i = 0; i < 10; i++) { f.save(); f.translate(1820, 190 + i * 32); f.transform(1, 0.5, 0, 1, 0, 0); f.fillStyle = INK_D; f.fillRect(0, 0, 60, 14); f.restore(); }
  D.text(f, "NO.", 1180, 330, { size: 40, weight: 800, color: INK_D });
  D.text(f, "C-023", 1180, 420, { size: 96, weight: 800, color: INK_D, tracking: 1 });
  D.text(f, variant ? "HIGHLY" : "CONFIDENTIAL", 1180, 580, { size: 76, weight: 500, color: "rgba(242,240,235,0.25)", tracking: 2 });
  D.text(f, "CONFIDENTIAL", 1180, 650, { size: 76, weight: 500, color: INK_D, tracking: 2 });
  D.text(f, "LAB-1", 1680, 820, { size: 30, weight: 700, color: INK_D, align: "right" });
  D.text(f, "▪ EXPERIMENT", 1680, 852, { size: 30, weight: 700, color: INK_D, align: "right" });
  D.text(f, "INTERNAL ARCHIVE", 1180, 690, { size: 18, weight: 600, color: INK_D, tracking: 3 });
}

const s23a = shot("breachA", at(23), at(23, 1), (a) => {
  a.comp.dark = 1;
  const f = a.fxA();
  classified(f, a, 0);
  const z = 1 + a.lt * 0.12;
  a.comp.fxA = placeCard({ rect: [0, 0, 1920, 1080], cx: 960, cy: 540, scale: z, rz: -2 });
  a.comp.glitch = 0.9 * Math.exp(-a.lt * 5) + 0.15;
  a.comp.split = 0.006;
  a.comp.grain = 0.028;
  const fr = a.front();
}, { samples: 10, tin: TR.glitch(0.16), cues: [[at(23), "glitch_big", 1.0], [at(23), "slam_big", 0.8]] });

const s23b = shot("breachBand", at(23, 1), at(23, 2), (a) => {
  a.comp.dark = 1;
  const sc = bandScene(a, {
    denied: 1, disorder: 0.06,
    cam: { pos: orbit([0, 0, 0], 760, 30 + a.lt * 20, 12), target: [0, 0, 0], fov: 32, roll: 8 },
    group: { pos: [0, 0, 0], rot: [16, 0, -2] }, dof: { focus: 760, range: 260, bokeh: 1.8 },
    pulses: pulses(a.t, at(23), 0.5, (k) => (k * 0.37) % 1),
  });
  a.scene = sc;
  a.comp.glitch = 0.35 * Math.exp(-a.lt * 6);
  a.comp.grain = 0.028;
  a.comp.vignette = 0.57;
  const fr = a.front();
  chrome(fr, a, { color: INK_D, header: false });
}, { samples: 10, tin: TR.glitch(0.14), cues: [[at(23, 1), "glitch2", 0.8]] });

const s23c = shot("breachB", at(23, 2), at(23, 3), (a) => {
  a.comp.dark = 1;
  const f = a.fxA();
  classified(f, a, 1);
  a.comp.fxA = placeCard({ rect: [0, 0, 1920, 1080], cx: 1040, cy: 560, scale: 1.45 + a.lt * 0.2, rz: 3 });
  a.comp.glitch = 0.6 * Math.exp(-a.lt * 6) + 0.1;
  a.comp.split = 0.008;
  a.comp.grain = 0.03;
  const fr = a.front();
}, { samples: 10, tin: TR.glitch(0.14), cues: [[at(23, 2), "glitch_big", 0.9]] });

const s23d = shot("tear", at(23, 3), at(24), (a) => {
  a.comp.dark = 1;
  const q = a.lt / a.dur;
  const sc = bandScene(a, {
    denied: 1, disorder: 0.06,
    cam: { pos: orbit([0, 0, 0], 900, -20, 25), target: [0, 0, 0], fov: 30 },
    group: { pos: [0, 0, 0], rot: [16, 0, -2] },
  });
  a.scene = sc;
  // slit-scan tear into black (film 5:05)
  a.comp.tear = inCubic(clamp(q * 1.25));
  a.comp.tearY = 0.47;
  a.comp.fade = smooth((q - 0.7) / 0.3);
  a.comp.grain = 0.03;
}, { samples: 14, shutter: 0.7, tin: TR.glitch(0.12), cues: [[at(23, 3), "tear", 1.0]] });

// ───────────────────────── WARNING ─────────────────────────

export function warning(a, f, t0, o = {}) {
  const rows = ["AUTHENTICATION FAILED", "ILLICIT ACCESS DETECTED", "PERMISSION DENIED · ATTEMPT 01", "RETURNING TO ACCESS PORTAL"];
  D.warningPlate(f, 760, 470, 400, (a.t - t0) / 1.0, a.t, { rows });
}

const s24 = shot("warning", at(24), at(25), (a) => {
  a.comp.dark = 1;
  a.comp.vignette = 0.57;
  a.comp.grain = 0.028;
  const sc = bandScene(a, {
    denied: 1, disorder: 0.06,
    cam: { pos: [0, 60, 1300], target: [0, 3, 0], fov: 30 },
    group: { pos: [-10, 0, 0], rot: [16, Math.sin(a.t * 0.07) * 9, -2] },
    exposure: 0.7,
    pulses: pulses(a.t, at(24), 1, (k) => (k * 0.25) % 1),
  });
  a.scene = sc;
  const f = a.front();
  f.fillStyle = "rgba(5,5,6,0.55)"; f.fillRect(0, 0, 1920, 1080);
  chrome(f, a, { color: INK_D, headerP: clamp(a.lt / 0.4) });
  warning(a, f, at(24) + 0.06);
  sub(f, a, "检测到非法访问，权限已被拒绝。", "ILLICIT ACCESS DETECTED. PERMISSION DENIED.", at(24) + 0.2, at(25) - 0.02, { color: INK_D, enColor: "#6f6d68" });
  a.comp.glitch = 0.5 * Math.exp(-a.lt * 9);
}, { samples: 10, cues: [[at(24), "warning", 1.0]] });

export const act3 = [s17, s18a, s18b, s19, s20, s21, s22, s23a, s23b, s23c, s23d, s24];
