// ACT 0 (cold open) + ACT I "＋" + ACT I.b "−"   — film bars 0–8
import {
  D, BAR, BEAT, at, shot, chrome, slam, sub, pulses, orbit, lerp3, leader, frameTicks,
  clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash, placeCard,
} from "./common.js";
import { inExpo, inCubic, inOutCubic, outQuart, inQuart, outBack, spring, smoother, commas, noise1 } from "../lib/util.js";

// transitions into a shot (engine: types 1 slab · 2 push · 3 blinds · 4 plus · 5 zoom · 6 glitch · 7 split · 8 dissolve)
export const TR = {
  slab: (d = 0.4, dir = [1, 0]) => ({ type: 1, dur: d, dir, p: [0.14, 0, 0, 0] }),
  push: (d = 0.32, dir = [1, 0]) => ({ type: 2, dur: d, dir }),
  blinds: (d = 0.38, dir = [1, 0]) => ({ type: 3, dur: d, dir, p: [0, 10, 1.7, 0], ease: "linear" }),
  plus: (d = 0.42) => ({ type: 4, dur: d, ease: "in" }),
  zoom: (d = 0.34, zin = 2.2, zb = 0.88) => ({ type: 5, dur: d, p: [zin, zb, 0, 0] }),
  glitch: (d = 0.16) => ({ type: 6, dur: d, ease: "linear" }),
  split: (d = 0.3, pre = 0.4) => ({ type: 7, dur: d, pre, ease: "out" }),
};

const C = D.C;
const MARK_C = [960, 500], MARK_W = 720;
const ms = MARK_W / 1200;
const PLUS_AT = [MARK_C[0] + (290 - 600) * ms, MARK_C[1] + (285 - 285) * ms];
const MINUS_AT = [MARK_C[0] + (918 - 600) * ms, MARK_C[1] + (288 - 285) * ms];

// ───────────────────────── ACT 0 — cold open ─────────────────────────

const s0a = shot("signal", 0, at(0, 1), (a) => {
  a.comp.dark = 1;
  a.comp.grain = 0.022;
  const f = a.front();
  const msg = "RHINE LAB.LLC  //  PUBLIC CHANNEL";
  const p = clamp(a.lt / 0.40);
  D.decodeText(f, msg, 960, 548, p, a.t, { size: 17, weight: 500, family: D.F.mono, tracking: 4, color: "#f2f0eb", align: "center", scrColor: "#6f6d68" });
  // caret
  D.font(f, 17, 500, D.F.mono);
  const w = D.measure(f, msg, 4);
  const n = Math.floor(p * (msg.length + 3));
  const cx = 960 - w / 2 + Math.min(1, n / msg.length) * (w + 8);
  if (Math.floor(a.t / 0.09) % 2 === 0 || p < 1) { f.fillStyle = C.lime; f.fillRect(cx + 2, 533, 10, 19); }
  D.text(f, "SIGNAL 01 · 1920 × 1080 · 30P", 960, 1016, { size: 10, family: D.F.mono, tracking: 3, color: "#6f6d68", align: "center", alpha: clamp(a.lt / 0.2) });
  frameTicks(f, { color: "rgba(242,240,235,0.35)" });
}, { samples: 6, cues: [[0.0, "access", 0.7]] });

function glyphSlam(a, which, x, y, h, t0, layer, comp) {
  const q = (a.t - t0) / 0.24;
  if (q < 0) return;
  layer.save();
  D.glyph(layer, which, x, y, h);
  layer.restore();
  const rect = which === "+" ? [x - h / 2, y - h / 2, h, h] : [x - h * 0.83, y - h * 0.17, h * 1.66, h * 0.34];
  comp.fx = slam(rect, q, { from: 4.2, rz: which === "+" ? -26 : 18, pinch: -0.6 });
}

const s0b = shot("plus", at(0, 1), at(0, 3), (a) => {
  const b = a.back();
  D.grid(b, 0, 0, 1920, 1080, 120, `rgba(17,18,20,${0.05 * clamp(a.lt / 0.3)})`, 1);
  const fa = a.fxA(), fb = a.fxB();
  const hA = 300;
  const tA = at(0, 1), tB = at(0, 2);
  const A = {}, B = {};
  glyphSlam(a, "+", 770, 540, hA, tA, fa, A);
  a.comp.fxA = A.fx;
  if (a.t >= tB) { glyphSlam(a, "−", 1170, 540, hA * 0.92, tB, fb, B); a.comp.fxB = B.fx; }
  const f = a.front();
  const la = clamp((a.t - tA - 0.18) / 0.3), lb = clamp((a.t - tB - 0.18) / 0.3);
  D.decodeText(f, "ADD", 770, 760, la, a.t, { size: 14, weight: 600, family: D.F.mono, tracking: 6, align: "center", seed: 2 });
  D.decodeText(f, "SUBTRACT", 1170, 760, lb, a.t, { size: 14, weight: 600, family: D.F.mono, tracking: 6, align: "center", seed: 3 });
  // shake on impact
  const imp = Math.max(Math.exp(-(a.t - tA) * 22) * (a.t >= tA ? 1 : 0), a.t >= tB ? Math.exp(-(a.t - tB) * 22) : 0);
  a.comp.frame = { x: Math.sin(a.t * 91) * 9 * imp, y: Math.cos(a.t * 77) * 7 * imp, zoom: 1 + imp * 0.015 };
  frameTicks(f);
}, { samples: 14, tin: TR.split(0.2, 0.55), cues: [[at(0, 1), "hit", 1.0], [at(0, 2), "hit", 0.95]] });

const s0c = shot("drawmark", at(0, 3), at(1), (a) => {
  const p = inOutCubic(a.lt / (BEAT * 0.94));
  const b = a.back();
  D.grid(b, 0, 0, 1920, 1080, 120, "rgba(17,18,20,0.05)", 1);
  const f = a.fxA();
  // glyphs travel from their slam positions into the mark's loops
  const hP = lerp(300, 196 * ms, p), hM = lerp(276, 196 * ms, p);
  const px = lerp(770, PLUS_AT[0], p), py = lerp(540, PLUS_AT[1], p);
  const mx = lerp(1170, MINUS_AT[0], p), my = lerp(540, MINUS_AT[1], p);
  D.glyph(f, "+", px, py, hP);
  D.glyph(f, "−", mx, my, hM);
  D.mark(f, MARK_C[0], MARK_C[1], MARK_W, { draw: p, glyphs: 0 });
  const fr = a.front();
  D.decodeText(fr, "ADD", lerp(770, PLUS_AT[0], p), lerp(760, 690, p), 1 - p * 1.4, a.t, { size: 14, weight: 600, family: D.F.mono, tracking: 6, align: "center", seed: 2 });
  D.decodeText(fr, "SUBTRACT", lerp(1170, MINUS_AT[0], p), lerp(760, 690, p), 1 - p * 1.4, a.t, { size: 14, weight: 600, family: D.F.mono, tracking: 6, align: "center", seed: 3 });
  frameTicks(fr);
}, { samples: 14, cues: [[at(0, 3), "draw", 0.9], [at(0, 2.2), "riser_short", 0.6]] });

// ───────────────────────── ACT I — ＋ ─────────────────────────

function markLeaders(f, a, q) {
  leader(f, a, PLUS_AT[0] - 30, PLUS_AT[1] - 70, PLUS_AT[0] - 180, 300, "+ ADDITION", q, { seed: 11 });
  leader(f, a, MINUS_AT[0] + 40, MINUS_AT[1] - 70, MINUS_AT[0] + 190, 300, "− SUBTRACTION", q - 0.15, { seed: 12 });
}

const s1a = shot("markhold", at(1), at(1, 2), (a) => {
  const thump = Math.exp(-a.lt * 9);
  const b = a.back();
  // a huge faint watermark ∞ breathes in behind
  D.mark(b, 960, 520, 2400, { color: `rgba(17,18,20,${0.03 * clamp(a.lt / 0.4)})`, draw: 1, glyphs: 0 });
  const f = a.fxA();
  D.mark(f, MARK_C[0], MARK_C[1], MARK_W * (1 + 0.035 * thump));
  const fr = a.front();
  D.markCaption(fr, MARK_C[0], 690, MARK_W * 0.62, { alpha: clamp(a.lt / 0.25) });
  chrome(fr, a, { headerP: clamp(a.lt / 0.6) });
  markLeaders(fr, a, (a.t - at(1, 0.35)) / 0.45);
}, { samples: 10, cues: [[at(1), "hit_soft", 0.8]] });

const s1b = shot("dive", at(1, 2), at(2), (a) => {
  // the camera dives through the plus: exponential zoom about its centre
  const q = a.lt / a.dur;
  const z = Math.exp(inCubic(q) * 5.2);
  const f = a.fxA();
  // drift the plus to screen centre as it grows
  const dx = (960 - PLUS_AT[0]) * smooth(q * 1.4), dy = (540 - PLUS_AT[1]) * smooth(q * 1.4);
  f.save();
  f.translate(PLUS_AT[0] + dx, PLUS_AT[1] + dy);
  f.scale(z, z);
  f.translate(-PLUS_AT[0], -PLUS_AT[1]);
  D.mark(f, MARK_C[0], MARK_C[1], MARK_W);
  D.markCaption(f, MARK_C[0], 690, MARK_W * 0.62);
  markLeaders(f, a, 1);
  f.restore();
  const fr = a.front();
  chrome(fr, a, { footerA: 1 - q * 2, headerP: 1 });
}, { samples: 16, shutter: 0.6, cues: [[at(1, 2), "whoosh_in", 0.9]] });

// stack of files dropping on the beat
function stackScene(a, bar0, o = {}) {
  const x = (a.t - at(bar0)) / BEAT;
  const rate = o.rate ?? 1;
  let n;
  if (o.accel) {
    // beats → 8ths → 16ths
    const xs = x;
    const k1 = Math.min(xs, 4);
    const k2 = clamp(xs - 4, 0, 2) * 2;
    const k3 = Math.max(0, xs - 6) * 4;
    n = k1 + k2 + k3;
  } else n = x * rate;
  const whole = Math.floor(n), fr = n - whole;
  const st = (o.base ?? 30) + whole + inv(0.45, 1, fr);
  return st;
}

function filesStack(a, st, cam, o = {}) {
  a.scene = {
    cam,
    dof: o.dof ?? { focus: 760, range: 260, bokeh: 1.6 },
    key: 3.8, env: 0.42, exposure: 1.18, sat: 0.9,
    keyDir: [-0.8, 0.55, 0.25],
    group: { pos: [0, 0, 0], rot: [0, 0, 0] },
    fileGroup: { pos: [0, 0, 0], rot: [0, 0, 0] },
    shadowBox: [-400, 400, -400, 400],
    files: { visible: true, uFormA: 4, uMorph: 0, uStack: st, uStackGap: 4.6, uTex: 1, uLime: 0 },
  };
}

const s2 = shot("stack", at(2), at(3), (a) => {
  const st = stackScene(a, 2);
  const top = -120 + st * 4.6;
  // one continuous crane: low and close on the landings → up and over the pile
  const e = inOutCubic((a.lt - 0.55) / 1.45);
  const dist = lerp(462, 720, e), yaw = lerp(26, 150, e) + a.lt * 6, pitch = lerp(5, 34, e);
  const ty = top - lerp(46, 70, e);
  filesStack(a, st, { pos: orbit([0, ty + 6, 0], dist, yaw, pitch), target: [0, ty, 0], fov: lerp(27, 24, e) },
    { dof: { focus: dist, range: 420, bokeh: lerp(1.5, 1.3, e) } });
  const f = a.front();
  const landed = Math.floor(st) - 29;
  for (let i = 1; i <= landed; i++) {
    const tl = at(2) + i * BEAT - BEAT;
    const age = a.t - tl;
    if (age < 0 || age > 0.9) continue;
    const yy = 400 - outCubic(age / 0.9) * 70;
    D.text(f, "+1", 1290 + (i % 2) * 70, yy, { size: 64, weight: 700, color: C.ink, alpha: (1 - age / 0.9) * outCubic(age / 0.06) });
    f.fillStyle = C.lime; f.globalAlpha = 1 - age / 0.9; f.fillRect(1290 + (i % 2) * 70 - 22, yy - 44, 12, 12); f.globalAlpha = 1;
  }
  D.chip(f, "RECORDS INDEXED", 1480, 126, { size: 12, w: 176, h: 20, p: outCubic(a.lt / 0.3) });
  D.text(f, commas(4811902 + landed), 1860, 200, { size: 54, weight: 300, align: "right", tracking: -1, alpha: clamp(a.lt / 0.2) });
  const m = smooth((a.lt - 1.1) / 0.4);
  if (m > 0) {
    const h = (st - 30) * 4.6 + 138;
    D.line(f, 1500, 300, 1500, 300 + 480 * m, 1, C.ink);
    D.text(f, `H ${h.toFixed(1)} MM`, 1516, 548, { size: 13, family: D.F.mono, weight: 600, tracking: 1, alpha: m });
    D.text(f, `N ${String(Math.floor(st)).padStart(4, "0")}`, 1516, 568, { size: 13, family: D.F.mono, weight: 500, tracking: 1, color: C.mute, alpha: m });
  }
}, { samples: 10, tin: TR.plus(0.42), cues: [1, 2, 3, 4, 5, 6, 7].map((k) => [at(2, k), "tap", 0.8]).concat([[at(2), "hit", 0.9]]) });

const s3a = shot("plusfield", at(3), at(3, 2), (a) => {
  // the field multiplies on every 8th note: 1 → 3 rows → 9 rows → 27 rows, full frame
  const L = Math.min(3, Math.floor(a.lt / (BEAT / 2)));
  const age = a.lt - L * BEAT / 2;
  const f = a.fxA();
  const cell = [0, 360, 120, 40][L];
  const gh = [380, 150, 52, 17][L];
  const rows = L === 0 ? 1 : Math.round(1080 / cell), cols = L === 0 ? 1 : Math.ceil(1920 / cell / 2) * 2 + 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = 960 + (i - (cols - 1) / 2) * cell, y = 540 + (j - (rows - 1) / 2) * cell;
    const d = Math.hypot(x - 960, y - 540) / 1100;
    const q = clamp((age - d * 0.07) / 0.07);
    if (q <= 0) continue;
    const s = outBack(q, 2.4);
    const centre = Math.abs(x - 960) < 1 && Math.abs(y - 540) < 1;
    D.glyph(f, "+", x, y, gh * s, centre && L >= 1 ? C.lime : C.ink);
  }
  const fr = a.front();
  chrome(fr, a, { header: false });
  D.text(fr, ["× 1", "× 15", "× 153", "× 1,323"][L], 1860, 130, { size: 13, family: D.F.mono, weight: 600, tracking: 2, align: "right" });
  sub(fr, a, "都是一次加法。", "IS AN ADDITION.", at(3) + 0.05, at(4) - 0.05, { y: 1006 });
}, { samples: 10, tin: TR.push(0.3, [0, -1]), cues: [0, 0.5, 1, 1.5].map((k, i) => [at(3, k), i === 0 ? "hit" : "blip", 0.8]) });

const s3b = shot("counter", at(3, 2), at(4), (a) => {
  const step = BEAT / 4;
  const k = Math.floor(a.lt / step);
  const sched = (i) => Math.round(4811903 + (13926511 - 4811903) * Math.pow(i / 7, 3.2) + (i ? 37 * i * i : 0));
  const va = sched(Math.max(0, k - 1)), vb = sched(Math.min(7, k));
  const r = (a.lt - k * step) / 0.075;
  const b = a.back();
  // the plus field, now a fine texture
  for (let j = 0; j < 27; j++) for (let i = 0; i < 49; i++) {
    const x = 960 + (i - 24) * 40, y = 540 + (j - 13) * 40;
    const d = Math.hypot((x - 960) / 820, (y - 520) / 300);
    const clr = smooth(a.lt / 0.32);
    const al = lerp(1, 0.85 * clamp(d - 0.55), clr);
    const lime = i === 24 && j === 13;
    D.glyph(b, "+", x, y, 17, lime ? `rgba(185,228,50,${(1 - clr).toFixed(3)})` : `rgba(17,18,20,${al.toFixed(3)})`);
  }
  const f = a.front();
  f.globalAlpha = smooth(a.lt / 0.16);
  const totalW = D.odometerStep(f, va, vb, r, 1560, 610 + (1 - outCubic(a.lt / 0.25)) * 40, 210);
  f.globalAlpha = 1;
  D.text(f, "+", 1560 - totalW - 34, 590, { size: 150, weight: 300, align: "right" });
  D.chip(f, "RECORDS INDEXED", 1560 - totalW - 130, 380, { size: 13, w: 190, h: 21 });
  const copy = "COLUMBIA'S LARGEST DIGITAL COLLECTION OF CLINICAL RECORDS, BIOLOGICAL INFORMATION AND UP-TO-DATE RESEARCH PROJECTS.";
  D.decodeText(f, copy, 960, 720, a.lt / 0.6, a.t, { size: 12, weight: 500, family: D.F.mono, tracking: 1.2, align: "center", color: C.mute, seed: 7 });
  chrome(f, a, { header: false });
  sub(f, a, "都是一次加法。", "IS AN ADDITION.", at(3) + 0.05, at(4) - 0.05);
}, { samples: 12, cues: [[at(3, 2), "hit_soft", 0.7], [at(3, 2), "counter", 0.6]] });

// archive rows
function rowsScene(a, cam, o = {}) {
  a.scene = {
    cam,
    dof: o.dof,
    key: 3.0, env: 0.6, exposure: 1.3, sat: 0.9,
    keyDir: [-0.5, 0.75, 0.42],
    fileGroup: { pos: [0, 0, 0], rot: [0, 0, 0] },
    shadowBox: [-700, 700, -700, 700],
    files: { visible: true, uFormA: 1, uMorph: 0, uRows: 8, uRowGap: 128, uColGap: 15, uRowFlow: 0, uRowWave: o.wave ?? 0, uRowWaveT: o.waveT ?? 0, uTex: 1, uSelect: o.sel ?? -10, uSelectGlow: o.glow ?? 0, uLime: 1, pulses: o.pulses ?? [] },
  };
}
const SEL = 3 * 60 + 34;
const selPos = () => { const k = SEL % 60, r = Math.floor(SEL / 60); return [(k / 60 - 0.5) * 60 * 15, 75 / 2 * Math.cos(0.3) - 40, (r - 3.5) * 128]; };

const s4a = shot("archive", at(4), at(4, 2), (a) => {
  const q = a.lt / a.dur;
  const sp = selPos();
  const camX = lerp(sp[0] - 520, sp[0] - 260, inOutCubic(q));
  const target = [lerp(sp[0] - 120, sp[0], outCubic(q)), sp[1] + 6, sp[2]];
  rowsScene(a, { pos: [camX, 150, sp[2] + 330], target, fov: 34 }, { dof: { focus: 420, range: 150, bokeh: 2.0 }, sel: SEL, glow: smooth((a.t - at(4, 1)) / 0.2) });
  const f = a.front();
  chrome(f, a, { header: false });
  const p = (a.t - at(4, 1)) / 0.45;
  if (p > 0) {
    D.chip(f, "SELECTING FILES", 1180, 330, { size: 13, w: 196, h: 22, p: outCubic(p) });
    D.line(f, 1000, 470, 1180, 352, 1.2, C.ink, clamp(p * 2));
    D.dot(f, 1000, 470, 5);
    D.decodeText(f, "FILE NUMBER : X-0412", 1180, 384, p * 1.3 - 0.3, a.t, { size: 13, weight: 600, family: D.F.mono, tracking: 1.4, seed: 4 });
    D.decodeText(f, "CONFIDENTIALITY : RESEARCH USE", 1180, 404, p * 1.3 - 0.5, a.t, { size: 13, weight: 500, family: D.F.mono, tracking: 1.4, color: C.mute, seed: 5 });
  }
}, { samples: 10, tin: TR.blinds(0.38), cues: [[at(4), "hit_soft", 0.7], [at(4, 1), "select", 0.8]] });

const s4b = shot("riffle", at(4, 2), at(5), (a) => {
  const q = a.lt / a.dur;
  const e = inOutCubic(q);
  const sp = selPos();
  const p0 = [sp[0] - 260, 150, sp[2] + 330], t0 = [sp[0], sp[1] + 6, sp[2]];
  rowsScene(a, { pos: lerp3(p0, [120, 820, 900], e), target: lerp3(t0, [60, -40, 0], e), fov: 34, roll: lerp(0, 6, e) },
    { dof: { focus: lerp(420, 1100, e), range: lerp(150, 420, e), bokeh: lerp(2.0, 1.4, e) }, wave: 1, waveT: lerp(-0.2, 1.3, q), sel: SEL, glow: 1 - q });
  const f = a.front();
  const rc = 1 - smooth(a.lt / 0.3);
  if (rc > 0) {
    f.save(); f.translate((1 - rc) * 300, 0); f.globalAlpha = rc;
    D.chip(f, "SELECTING FILES", 1180, 330, { size: 13, w: 196, h: 22 });
    D.text(f, "FILE NUMBER : X-0412", 1180, 384, { size: 13, weight: 600, family: D.F.mono, tracking: 1.4 });
    D.text(f, "CONFIDENTIALITY : RESEARCH USE", 1180, 404, { size: 13, weight: 500, family: D.F.mono, tracking: 1.4, color: C.mute });
    f.restore();
  }
  // the minus arrives: a black bar grows from the centre and swallows the frame
  const m = clamp((a.lt - BEAT * 1.0) / (BEAT * 0.97));
  if (m > 0) {
    const w = lerp(120, 2100, outExpo(m * 1.2)), h = lerp(40, 1200, inQuart(m));
    f.fillStyle = C.ink;
    f.fillRect(960 - w / 2, 540 - h / 2, w, h);
  }
}, { samples: 12, cues: [[at(4, 2), "riffle", 0.8], [at(4, 3.25), "whoosh_in", 0.7]] });

// ───────────────────────── ACT I.b — − ─────────────────────────

function wallScene(a, o = {}) {
  a.scene = {
    cam: o.cam ?? { pos: orbit([0, 0, 0], 1380 - a.lt * 60, -38 + a.lt * 4, 8), target: [-120, -20, 0], fov: 30, roll: -3 },
    dof: { focus: 1420, range: 700, bokeh: 1.3 },
    key: 3.8, env: 0.38, exposure: 1.2, sat: 0.85,
    group: { pos: [0, 0, 0], rot: [0, 0, 0] },
    shadowBox: [-1000, 1000, -800, 800],
    keyDir: [-0.85, 0.35, 0.4],
    fins: { visible: true, uBody: [0.95, 0.935, 0.91], uFormA: 2, uMorph: 0, uWallCols: 20, uWallGap: 92, uDissolve: o.dissolve ?? 0, uPeelX: 0, uPeelY: 0, pulses: o.pulses ?? [], uLime: 1 },
  };
}

function wallChip(f, a, out) {
  f.save(); f.translate(-out * 520, 0);
  D.chip(f, "BOUNDARY CONDITION", 120, 290, { size: 13, w: 220, h: 22, p: out > 0 ? 1 : outCubic(a.lt / 0.25) });
  if (out > 0) D.text(f, "LIMIT · 01", 120, 346, { size: 40, weight: 700, tracking: 1 });
  else D.decodeText(f, "LIMIT · 01", 120, 346, a.lt / 0.4, a.t, { size: 40, weight: 700, tracking: 1, seed: 8 });
  f.restore();
}

const s5a = shot("wall", at(5), at(5, 2), (a) => {
  wallScene(a, { pulses: [[at(5, 1), 0.0]] });
  const f = a.front();
  chrome(f, a, { header: false });
  wallChip(f, a, 0);
  sub(f, a, "每一次突破，", "EVERY BREAKTHROUGH", at(5) + 0.08, at(6));
}, { samples: 10, tin: TR.split(0.3, 0.25), cues: [[at(5), "hit", 0.9], [at(5, 1), "pulse", 0.6]] });

const s5b = shot("peel", at(5, 2), at(6), (a) => {
  const d = smooth(a.lt / (a.dur * 0.95)) * 0.95 + 0.05 * clamp(a.lt / a.dur);
  wallScene(a, { dissolve: inOutCubic(a.lt / a.dur) * 1.05, cam: { pos: orbit([0, 0, 0], 1316 - a.lt * 120, -33.7 + a.lt * 8, 8), target: [-120, -20, 0], fov: 30, roll: -3 } });
  const b = a.back();
  const g = smooth((a.lt - 0.1) / 0.5);
  D.glyph(b, "−", 960, 540, 620, `rgba(17,18,20,${g})`);
  D.decodeText(b, "LIMIT · 01 · REMOVED", 960, 720, (a.lt - 0.35) / 0.4, a.t, { size: 15, weight: 600, family: D.F.mono, tracking: 5, align: "center", seed: 9 });
  const f = a.front();
  wallChip(f, a, smooth((a.lt - 0.15) / 0.35));
}, { samples: 14, shutter: 0.6, cues: [[at(5, 2), "peel", 1.0]] });

const s6a = shot("strike", at(6), at(6, 2), (a) => {
  const bk = a.back();
  const gone = inCubic(a.lt / 0.3);
  if (gone < 1) {
    D.glyph(bk, "−", 960, 540, 620 * (1 - gone));
    D.text(bk, "LIMIT · 01 · REMOVED", 960, 720, { size: 15, weight: 600, family: D.F.mono, tracking: 5, align: "center", alpha: 1 - smooth(a.lt / 0.15) });
  }
  const f = a.fxA();
  const tHit = at(6, 1);
  const hit = a.t >= tHit;
  const age = a.t - tHit;
  const q = clamp(a.lt / 0.22);
  // LIMIT
  const word = "LIMIT";
  D.font(f, 330, 800);
  const ww = D.measure(f, word, -6);
  const x0 = 960 - ww / 2, base = 660;
  if (!hit) {
    D.decodeText(f, word, 960, base, q, a.t, { size: 330, weight: 800, tracking: -6, align: "center", seed: 13 });
  } else {
    // sliced: the half below the bar shears right, the top half left
    const sh = outCubic(clamp(age / 0.18)) * 1;
    f.save(); f.beginPath(); f.rect(0, 0, 1920, 520); f.clip();
    D.text(f, word, x0 - 14 * sh, base - 6 * sh, { size: 330, weight: 800, tracking: -6 });
    f.restore();
    f.save(); f.beginPath(); f.rect(0, 560, 1920, 600); f.clip();
    D.text(f, word, x0 + 22 * sh, base + 8 * sh, { size: 330, weight: 800, tracking: -6 });
    f.restore();
  }
  const fb = a.fxB();
  if (hit) {
    fb.fillStyle = C.ink;
    fb.fillRect(960 - 640, 540 - 34, 1280, 68);
    D.text(fb, "− REMOVED", 960 + 600, 540 + 7, { size: 18, weight: 700, family: D.F.mono, tracking: 4, color: C.white, align: "right", alpha: clamp(age / 0.15) });
    a.comp.fxB = slam([320, 506, 1280, 68], age / 0.2, { from: 2.4, rz: 6, pinch: -0.3 });
    const imp = Math.exp(-age * 20);
    a.comp.frame = { x: Math.sin(a.t * 97) * 14 * imp, y: Math.cos(a.t * 83) * 10 * imp };
    a.comp.split = 0.004 * imp;
  }
  const fr = a.front();
  chrome(fr, a, { header: false });
  sub(fr, a, "都减去一道边界。", "SUBTRACTS A LIMIT.", at(6) + 0.05, at(7) - 0.05);
}, { samples: 12, cues: [[at(6), "hit_soft", 0.7], [at(6, 1), "hit", 1.0], [at(6, 1), "glitch1", 0.6]] });

const ROWS = [
  ["THERMAL CEILING", "1,800 K"], ["CELL LIFESPAN", "52 CYCLES"], ["SIGNAL RANGE", "4.0 KM"],
  ["ARTS OUTPUT", "0.82 MW"], ["MATERIAL FATIGUE", "10^6 LOADS"], ["ENERGY DENSITY", "1.4 GJ/M3"],
  ["SAMPLE STABILITY", "72 H"], ["RESEARCH CYCLE", "12 YEARS"],
];
const s6b = shot("redact", at(6, 2), at(7), (a) => {
  const f = a.front();
  const x = 360, y0 = 290, lh = 74;
  D.chip(f, "CONSTRAINT REGISTER", x, y0 - 90, { size: 13, w: 230, h: 22 });
  ROWS.forEach(([k, v], i) => {
    const y = y0 + i * lh;
    const appear = clamp((a.lt - i * 0.02) / 0.12);
    D.text(f, `${String(i + 1).padStart(2, "0")}`, x, y, { size: 28, family: D.F.mono, weight: 500, color: C.mute, alpha: appear });
    D.text(f, k, x + 76, y, { size: 28, family: D.F.mono, weight: 600, tracking: 1, alpha: appear });
    D.text(f, ".".repeat(24 - k.length + 8), x + 76 + 17.8 * (k.length + 1), y, { size: 28, family: D.F.mono, color: C.faint, alpha: appear });
    D.text(f, v, x + 1200, y, { size: 28, family: D.F.mono, weight: 600, align: "right", alpha: appear });
    // redaction on 8th notes (first four), then the rest at once on beat 3.5
    const tr = i < 4 ? i * BEAT / 2 + 0.02 : BEAT * 1.5 + (i - 4) * 0.035;
    const r = (a.lt - tr) / 0.1;
    if (r > 0) {
      const w = 420 * outExpo(r);
      f.fillStyle = C.ink;
      f.fillRect(x + 1200 + 14 - w, y - 32, w, 44);
      if (r > 0.6) D.text(f, "− REMOVED", x + 1200, y - 2, { size: 17, family: D.F.mono, weight: 700, tracking: 3, color: C.white, align: "right" });
    }
  });
  chrome(f, a, { header: false });
  frameTicks(f);
  sub(f, a, "都减去一道边界。", "SUBTRACTS A LIMIT.", at(6) + 0.05, at(7) - 0.05);
}, { samples: 10, tin: TR.push(0.32, [1, 0]), cues: [0, 0.5, 1, 1.5].map((k) => [at(6, 2 + k), "redact", 0.8]).concat([[at(6, 2), "whoosh_out", 0.6]]) });

// 不可能 − 不 = 可能
const s7 = shot("possible", at(7), at(8), (a) => {
  const f = a.fxA();
  const b1 = at(7, 1), b2 = at(7, 2), b3 = at(7, 3);
  const size = 250;
  D.font(f, size, 700, D.F.cjk);
  f.letterSpacing = "0px";
  const cw = f.measureText("可").width;
  const gap = 10;
  const yb = 560;
  const fall = clamp((a.t - b2) / 0.42);
  // positions: 不 可 能 → 可 能 recentred
  const shift = outQuart(clamp((a.t - b2 - 0.08) / 0.35));
  const x3 = 960 - (3 * cw + 2 * gap) / 2, x2 = 960 - (2 * cw + gap) / 2;
  const base = lerp(x3, x2 - (cw + gap), shift);
  const q0 = clamp(a.lt / 0.16);
  f.globalAlpha = q0;
  // 不 (falls away after b2)
  if (fall < 1) {
    f.save();
    f.translate(base + cw / 2, yb - size * 0.35 + inCubic(fall) * 700);
    f.rotate(inCubic(fall) * 0.6);
    f.fillStyle = C.ink;
    D.font(f, size, 700, D.F.cjk);
    f.fillText("不", -cw / 2, size * 0.35);
    if (a.t >= b1) { f.fillStyle = C.ink; const bw = cw * 1.08; f.fillRect(-bw / 2, -size * 0.13, bw, size * 0.26); }
    f.restore();
  }
  f.fillStyle = C.ink;
  D.font(f, size, 700, D.F.cjk);
  f.fillText("可", base + cw + gap, yb);
  f.fillText("能", base + 2 * (cw + gap), yb);
  f.globalAlpha = 1;
  // English
  const en1 = "IM", en2 = "POSSIBLE";
  D.font(f, 58, 700);
  const tr = 16;
  const wIm = D.measure(f, en1, tr) + tr, wP = D.measure(f, en2, tr);
  const ex3 = 960 - (wIm + wP) / 2, ex2 = 960 - wP / 2;
  const exb = lerp(ex3, ex2 - wIm, shift);
  const ey = 690;
  if (fall < 1) {
    f.save();
    f.translate(0, inCubic(fall) * 500);
    D.text(f, en1, exb, ey, { size: 58, weight: 700, tracking: tr, alpha: q0 });
    if (a.t >= b1) { f.fillStyle = C.ink; f.fillRect(exb - 6, ey - 34, wIm + 2, 22); }
    f.restore();
  }
  D.text(f, en2, exb + wIm, ey, { size: 58, weight: 700, tracking: tr, alpha: q0 });
  if (a.t < b1) a.comp.fxA = slam([x3, yb - size, 3 * cw + 2 * gap, size + 160], a.lt / 0.2, { from: 1.6, rz: 0, pinch: -0.25 });
  // lime underline + equation
  const fr = a.front();
  const u = outExpo((a.t - b3) / 0.3);
  if (u > 0) {
    fr.fillStyle = C.lime;
    fr.fillRect(960 - (2 * cw + gap) / 2, 735, (2 * cw + gap) * u, 8);
    D.decodeText(fr, "不可能  −  不  =  可能", 960, 300, (a.t - b3) / 0.25, a.t, { size: 22, weight: 500, family: D.F.cjk, tracking: 4, align: "center", seed: 3 });
    D.decodeText(fr, "IMPOSSIBLE − IM = POSSIBLE", 960, 330, (a.t - b3 - 0.05) / 0.3, a.t, { size: 12, weight: 600, family: D.F.mono, tracking: 4, align: "center", color: C.mute, seed: 4 });
  }
  if (a.t >= b1 && a.t < b1 + 0.2) {
    const imp = Math.exp(-(a.t - b1) * 24);
    a.comp.frame = { x: Math.sin(a.t * 97) * 10 * imp, y: Math.cos(a.t * 83) * 8 * imp };
  }
  chrome(fr, a, { header: false });
}, { samples: 14, tin: TR.slab(0.4, [1, 0]), cues: [[at(7), "hit", 0.9], [at(7, 1), "hit", 1.0], [at(7, 2), "whoosh_out", 0.8], [at(7, 3), "chime", 0.7]] });

// build: 8th-note flash cards, then the "=" slabs race in under the fill
const s8a = shot("flash", at(8), at(8, 2), (a) => {
  const k = Math.min(3, Math.floor(a.lt / (BEAT / 2)));
  const glyphs = ["+", "−", "+", "−"];
  const f = a.fxA();
  const age = a.lt - k * BEAT / 2;
  // 可能 from the previous shot is swallowed into the centre
  const sw = inCubic(a.lt / 0.16);
  if (sw < 1) {
    f.save(); f.translate(960, 500); f.scale(1 - sw, 1 - sw);
    D.text(f, "可能", 0, 60, { size: 250, weight: 700, family: D.F.cjk, align: "center" });
    f.restore();
  }
  const s = lerp(1.3, 1, outExpo(age / 0.12)) * (k === 0 ? smooth(a.lt / 0.1) : 1);
  D.glyph(f, glyphs[k], 960, 540, 380 * s * (k >= 2 ? 1.25 : 1));
  const fr = a.front();
  D.text(fr, ["ADD", "SUBTRACT", "ADD", "SUBTRACT"][k], 960, 860, { size: 15, weight: 600, family: D.F.mono, tracking: 8, color: C.ink, align: "center" });
  D.text(fr, `0${k + 1} / 04`, 1860, 130, { size: 12, family: D.F.mono, tracking: 2, color: C.mute, align: "right" });
}, { samples: 10, shutter: 0.45, cues: [0, 0.5, 1, 1.5].map((k) => [at(8, k), "tick_hard", 0.9]) });

export function eqSlabs(f, t, tHit, o = {}) {
  const W = 1500, H = 118, gapY = 70;
  const u = t - (tHit - BEAT * 2);
  const yTopF = 540 - gapY / 2 - H, yBotF = 540 + gapY / 2;
  const split = o.split ?? 0;
  f.fillStyle = C.ink;
  if (u < 0.3) {
    // the "−" card (393 × 155 at the centre) stretches into one long slab
    const e = outExpo(u / 0.3);
    const w = lerp(393, W, e), h = lerp(155, H, e);
    f.fillRect(960 - w / 2, 540 - h / 2, w, h);
    return { yTop: 540 - h / 2, yBot: 540 - h / 2, H: h, W: w, single: true };
  }
  // …then splits in two and accelerates into the "=" exactly on the downbeat
  const s2 = t >= tHit ? 1 : inCubic((u - 0.3) / (BEAT * 2 - 0.3));
  const yTop = lerp(540 - H / 2, yTopF, s2) - split * 700, yBot = lerp(540 - H / 2, yBotF, s2) + split * 700;
  f.fillRect(960 - W / 2, yTop, W, H);
  f.fillRect(960 - W / 2, yBot, W, H);
  return { yTop, yBot, H, W };
}

/** the words inside the "=" slabs (shared by the slam and the split) */
export function eqText(f, g, t, t0) {
  const x0 = 960 - g.W / 2, lt = t - t0;
  D.decodeText(f, "RHINE LAB.LLC.", x0 + 44, g.yTop + 82, (lt - 0.05) / 0.35, t, { size: 64, weight: 700, tracking: 10, color: C.white, scrColor: "#77746e", seed: 40 });
  D.decodeText(f, "SECTION INDEX · 10", x0 + g.W - 44, g.yTop + 74, (lt - 0.25) / 0.3, t, { size: 16, weight: 600, family: D.F.mono, tracking: 4, color: "#b5b2ac", align: "right", seed: 41 });
  D.decodeCJK(f, "莱茵生命 · 科室总览", x0 + 44, g.yBot + 80, (lt - 0.12) / 0.4, t, { size: 54, weight: 700, tracking: 10, color: C.white, align: "left", hot: "#77746e" });
  D.decodeText(f, "ALL SECTIONS ONLINE", x0 + g.W - 44, g.yBot + 74, (lt - 0.3) / 0.3, t, { size: 16, weight: 600, family: D.F.mono, tracking: 4, color: C.lime, align: "right", seed: 42 });
}

const s8b = shot("approach", at(8, 2), at(9), (a) => {
  const f = a.fxA();
  eqSlabs(f, a.t, at(9));
  const b = a.back();
  D.mark(b, 960, 540, 1700, { draw: inOutCubic(a.lt / a.dur), glyphs: 0, color: "rgba(17,18,20,0.07)" });
  const fr = a.front();
  chrome(fr, a, { header: false });
  frameTicks(fr);
  D.text(fr, "SUBTRACT", 960, 860, { size: 15, weight: 600, family: D.F.mono, tracking: 8, color: C.ink, align: "center", alpha: 1 - smooth(a.lt / 0.2) });
}, { samples: 16, shutter: 0.7, cues: [[at(8, 2), "riser_short", 0.8]] });

export const act1 = [s0a, s0b, s0c, s1a, s1b, s2, s3a, s3b, s4a, s4b, s5a, s5b, s6a, s6b, s7, s8a, s8b];
