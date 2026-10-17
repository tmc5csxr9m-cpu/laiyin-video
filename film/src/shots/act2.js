// ACT II "＝" — the sections   (film bars 9–16, music section C)
import {
  D, BAR, BEAT, at, shot, chrome, slam, sub, pulses, orbit, leader, frameTicks,
  clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash, placeCard,
} from "./common.js";
import { eqSlabs, eqText, TR } from "./act1.js";
import { inExpo, inCubic, inOutCubic, outQuart, outBack, hash2, noise1, inOutSine } from "../lib/util.js";

const C = D.C;

// ───────────────────────── = ─────────────────────────

const s9a = shot("equals", at(9), at(9, 2), (a) => {
  const f = a.fxA();
  const g = eqSlabs(f, a.t, at(9));
  eqText(f, g, a.t, at(9));
  const b = a.back();
  const wm = 1 - smooth(a.lt / 0.5);
  if (wm > 0) D.mark(b, 960, 540, 1700, { draw: 1, glyphs: 0, color: `rgba(17,18,20,${(0.07 * wm).toFixed(3)})` });
  const imp = Math.exp(-a.lt * 16);
  a.comp.frame = { x: Math.sin(a.t * 97) * 16 * imp, y: Math.cos(a.t * 83) * 6 * imp, zoom: 1 + 0.02 * imp };
  const fr = a.front();
  chrome(fr, a, { header: false });
}, { samples: 12, cues: [[at(9), "slam_big", 1.0]] });

// the section constellation behind the "=" (film 1:01, own arrangement)
const CONST = [
  { code: "CMPT CTRL", x: 960, y: 560, w: 360, h: 360, dark: true, cap: "COMPONENTS CONTROL SECTION", d: 0 },
  { code: "STRU", x: 520, y: 330, w: 250, h: 170, dark: true, cap: "STRUCTURAL SECTION", d: 1 },
  { code: "NRG", x: 1420, y: 300, w: 230, h: 160, dark: false, cap: "ENERGY SECTION", d: 2 },
  { code: "ORIG", x: 1540, y: 590, w: 260, h: 170, dark: false, cap: "ORIGINIUM ART SECTION", d: 3 },
  { code: "ECO", x: 1330, y: 830, w: 220, h: 160, dark: true, cap: "ECOLOGICAL SECTION", d: 4 },
  { code: "SCIEN", x: 420, y: 640, w: 290, h: 160, dark: false, cap: "SCIENTIFIC INVESTIGATION SECTION", d: 5 },
  { code: "DEF", x: 660, y: 860, w: 200, h: 150, dark: false, cap: "DEFENSE SECTION", d: 6 },
  { code: "BSN", x: 1190, y: 190, w: 190, h: 140, dark: false, cap: "BUSINESS SECTION", d: 7, orange: true },
  { code: "ENG", x: 220, y: 880, w: 180, h: 130, dark: true, cap: "ENGINEERING SECTION", d: 8 },
  { code: "HRI", x: 1760, y: 880, w: 170, h: 130, dark: false, cap: "HUMAN RESOURCES", d: 9 },
];

function drawConstTile(f, T, s, assets, t) {
  const x = T.x - T.w / 2, y = T.y - T.h / 2;
  if (T.dark) {
    if (T.code === "CMPT CTRL") D.sectionTile(f, x, y, T.w, T.h, { lines: ["CMPT", "CTRL"], caption: T.cap, smoke: assets.smoke, t, tab: false });
    else D.sectionTile(f, x, y, T.w, T.h, { code: T.code, caption: T.cap, smoke: assets.smoke, t, tab: false, seed: T.d });
  } else {
    f.fillStyle = "rgba(246,245,242,0.92)";
    f.fillRect(x, y, T.w, T.h);
    f.strokeStyle = "rgba(17,18,20,0.12)"; f.lineWidth = 1; f.strokeRect(x + 0.5, y + 0.5, T.w - 1, T.h - 1);
    const px = Math.min(T.h * 0.42, T.w * 1.2 / T.code.length);
    D.sectionCode(f, T.code, T.x, T.y + px * 0.28, px, { color: C.ink, plate: "#f6f5f2", markColor: C.ink });
    D.text(f, T.cap, T.x, T.y + px * 0.28 + 26, { size: 11, weight: 500, tracking: 0.4, align: "center" });
    if (T.orange) { f.fillStyle = C.orange; f.fillRect(x + T.w - 34, y - 14, 46, 46); f.fillStyle = "#f6f5f2"; f.fillRect(x + T.w - 22, y - 2, 22, 22); }
  }
}

function constellation(a, f, t0, o = {}) {
  const b = a.back();
  D.grid(b, 0, 0, 1920, 1080, 96, "rgba(17,18,20,0.05)");
  // diagonal X through the centre (film 1:01)
  const q = clamp((a.t - t0) / 0.5);
  D.line(b, 960, 560, 960 - 1200, 560 - 1200, 1.2, "rgba(17,18,20,0.5)", q);
  D.line(b, 960, 560, 960 + 1200, 560 - 1200, 1.2, "rgba(17,18,20,0.5)", q);
  D.line(b, 960, 560, 960 - 1200, 560 + 1200, 1.2, "rgba(17,18,20,0.5)", q);
  D.line(b, 960, 560, 960 + 1200, 560 + 1200, 1.2, "rgba(17,18,20,0.5)", q);
  for (const T of CONST) {
    if (T.d === 0 && a.t >= at(10, -0.25)) continue;   // the HUD's travelling tile takes over here
    const ti = t0 + T.d * 0.062;
    const age = a.t - ti;
    if (age < 0) continue;
    const e = outExpo(age / 0.28);
    const sc = lerp(3.4, 1, e) * (o.scale ?? 1);
    const rot = (hash(T.d * 7.1) - 0.5) * 0.9 * (1 - springy(age * 1.5, 16, 0.4));
    const cx = lerp(960, T.x, o.converge ?? 1), cy = lerp(560, T.y, o.converge ?? 1);
    f.save();
    f.globalAlpha = clamp(age / 0.06);
    f.translate(cx + (T.x - 960) * (sc - 1) * 0.35, cy + (T.y - 560) * (sc - 1) * 0.35);
    f.rotate(rot);
    f.scale(sc, sc);
    f.translate(-T.x, -T.y);
    drawConstTile(f, T, sc, a.assets, a.t);
    f.restore();
  }
  // "SEARCHING" chip
  const fr = a.front();
  const s = clamp((a.t - t0 - 0.2) / 0.3);
  if (s > 0) {
    fr.fillStyle = C.ink; fr.fillRect(780, 196, 16, 18);
    fr.strokeStyle = C.ink; fr.lineWidth = 1.5; fr.strokeRect(797, 193, 130 * outCubic(s), 26);
    D.decodeText(fr, "SEARCHING", 815, 212, s * 1.4, a.t, { size: 13, weight: 700, tracking: 0.6, seed: 43 });
  }
}

const s9b = shot("constellation", at(9, 2), at(10), (a) => {
  const f = a.fxA();
  constellation(a, f, at(9, 2) + 0.05);
  // slabs split away
  const fb = a.fxB();
  const sp = outExpo(a.lt / 0.5);
  if (sp < 0.999) { const g = eqSlabs(fb, a.t, at(9), { split: sp }); eqText(fb, g, a.t, at(9)); }
  const fr = a.front();
  chrome(fr, a, { header: false });
  sub(fr, a, "十大科室，一个莱茵。", "TEN SECTIONS. ONE RHINE LAB.", at(9, 2) + 0.1, at(10) - 0.04);
}, { samples: 14, shutter: 0.6, cues: [[at(9, 2), "whoosh_out", 0.9], [at(9, 2.1), "cascade", 0.8]] });

// ───────────────────────── CMPT CTRL ─────────────────────────

function isoPlate(f, cx, cy, w, h, fill, stroke, lw = 1.5) {
  f.beginPath();
  f.moveTo(cx, cy - h / 2); f.lineTo(cx + w / 2, cy); f.lineTo(cx, cy + h / 2); f.lineTo(cx - w / 2, cy); f.closePath();
  if (fill) { f.fillStyle = fill; f.fill(); }
  f.strokeStyle = stroke; f.lineWidth = lw; f.stroke();
}

const s10 = shot("cmpt", at(10), at(11), (a) => {
  const f = a.front();
  chrome(f, a, { rail: true, marker: lerp(347, 700, outExpo((a.t - at(10, 2)) / 0.3)) });
  // exploded component stack
  const sep = outExpo((a.t - at(10, 1)) / 0.45) * 40 + outExpo((a.t - at(10, 2)) / 0.45) * 18 + outExpo((a.t - at(10, 3)) / 0.45) * 12;
  const cx = 1120, cy = 470, pw = 430, ph = 248;
  const labels = ["C-01 FRAME", "C-02 ACTUATOR", "C-03 CORE", "C-04 SENSOR", "C-05 SHELL"];
  const vis = clamp((a.lt - 0.12) / 0.2);
  f.globalAlpha = vis;
  for (let i = 4; i >= 0; i--) {
    const y = cy + (i - 2) * (18 + sep * 1.3);
    const core = i === 2;
    // thickness edge
    f.fillStyle = core ? C.ink : "#d9d6d0";
    f.beginPath(); f.moveTo(cx - pw / 2, y); f.lineTo(cx, y + ph / 2); f.lineTo(cx + pw / 2, y); f.lineTo(cx + pw / 2, y + 8); f.lineTo(cx, y + ph / 2 + 8); f.lineTo(cx - pw / 2, y + 8); f.closePath(); f.fill();
    isoPlate(f, cx, y, pw, ph, core ? "#1a1b1d" : "#f1efeb", C.ink, 1.4);
    if (core) {
      isoPlate(f, cx, y, pw * 0.55, ph * 0.55, null, C.lime, 2);
      D.mark(f, cx, y, 90, { color: C.white });
    } else {
      isoPlate(f, cx, y, pw * 0.7, ph * 0.7, null, "rgba(17,18,20,0.25)", 1);
    }
    // label
    const lq = clamp((a.t - at(10, 1) - i * 0.06) / 0.3);
    if (lq > 0) {
      D.line(f, cx + pw / 2, y, cx + pw / 2 + 60, y, 1, C.ink, lq);
      D.decodeText(f, labels[i], cx + pw / 2 + 68, y + 4, lq * 1.3, a.t, { size: 12, weight: 600, family: D.F.mono, tracking: 1.5, color: core ? C.ink : C.mute, seed: 50 + i });
    }
  }
  f.globalAlpha = 1;
  // dotted guides
  f.setLineDash([3, 5]); f.strokeStyle = "rgba(17,18,20,0.3)"; f.lineWidth = 1;
  const sp2 = 2 * (18 + sep * 1.3);
  f.beginPath(); f.moveTo(cx - pw / 2, cy - sp2); f.lineTo(cx - pw / 2, cy + sp2); f.moveTo(cx + pw / 2, cy - sp2); f.lineTo(cx + pw / 2, cy + sp2); f.stroke();
  f.setLineDash([]);
  D.identity(f, 1240, 790, { role: "CO-FOUNDER / CONTROL", name: "KRISTEN WRIGHT", deg: "PHD", field: "IN PARTICLE PHYSICS", p: (a.t - at(10, 0.5)) / 1.0, t: a.t, rule: 680 });
  sub(f, a, "总辖构件科，莱茵生命的中枢。", "COMPONENTS CONTROL — THE CENTRAL SECTION OF RHINE LAB", at(10) + 0.1, at(11) - 0.04);
}, { samples: 12, tin: TR.zoom(0.36, 1.9, 0.94), cues: [[at(10), "slam", 1.0], [at(10, 1), "mech", 0.7], [at(10, 2), "mech", 0.6], [at(10, 3), "mech", 0.5]] });

// ───────────────────────── STRU ─────────────────────────

const ATOMS = (() => {
  const A = [];
  for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; A.push([Math.cos(t) * 120, Math.sin(t) * 120 * 0.3, Math.sin(t) * 120, 30]); }
  A.push([0, -190, 40, 24], [0, 190, -40, 24], [250, -90, 60, 20], [-250, 90, -60, 20], [180, 170, 120, 18], [-180, -170, -120, 18], [330, 40, -80, 14]);
  return A;
})();
const BONDS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 8], [3, 9], [1, 6], [4, 7], [8, 12], [2, 10], [5, 11]];

function molecule(f, cx, cy, sc, rot, t, o = {}) {
  const pts = ATOMS.map(([x, y, z, r]) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const X = x * c + z * s, Z = -x * s + z * c;
    const c2 = Math.cos(0.35), s2 = Math.sin(0.35);
    const Y = y * c2 - Z * s2, Z2 = y * s2 + Z * c2;
    const k = 900 / (900 + Z2);
    return { x: cx + X * k * sc, y: cy + Y * k * sc, z: Z2, r: r * k * sc };
  });
  f.strokeStyle = "rgba(17,18,20,0.7)"; f.lineWidth = 2.2 * sc;
  for (const [i, j] of BONDS) { f.beginPath(); f.moveTo(pts[i].x, pts[i].y); f.lineTo(pts[j].x, pts[j].y); f.stroke(); }
  const order = pts.map((p, i) => [p, i]).sort((u, v) => v[0].z - u[0].z);
  for (const [p, i] of order) {
    const g = f.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, "#fbf8f2"); g.addColorStop(0.55, "#e9e0d2"); g.addColorStop(1, "#b9ad9b");
    f.fillStyle = g;
    f.beginPath(); f.arc(p.x, p.y, p.r, 0, Math.PI * 2); f.fill();
    f.strokeStyle = "rgba(17,18,20,0.35)"; f.lineWidth = 1; f.stroke();
    if (i === (o.hot ?? -1)) { f.strokeStyle = C.lime; f.lineWidth = 3; f.beginPath(); f.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2); f.stroke(); }
  }
  return pts;
}

const s11 = shot("stru", at(11), at(12), (a) => {
  // glass panel on the left in perspective, tile on the right
  const g = a.fxA();
  const panel = [140, 170, 1000, 700];
  g.fillStyle = "rgba(246,245,242,0.62)";
  g.fillRect(...panel);
  D.hexGrid(g, panel[0], panel[1], panel[2], panel[3], 30, "rgba(17,18,20,0.07)");
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; g.strokeRect(panel[0] + 1.5, panel[1] + 1.5, panel[2] - 3, panel[3] - 3);
  D.text(g, "SECTION PROFILE", panel[0] + 60, panel[1] + 70, { size: 15, weight: 500, tracking: 1 });
  g.fillStyle = "rgba(17,18,20,0.12)"; g.fillRect(panel[0] + 60, panel[1] + 80, 300, 3);
  const k = Math.min(2, Math.floor((a.t - at(11)) / (BEAT * 1.33)));
  const labels = [["BASIC", "PARTICLES"], ["STRUCTURAL", "STUDIES"], ["BIOLOGICAL", "MOLECULES"]];
  const pts = molecule(g, panel[0] + 560, panel[1] + 360, 1.15, a.t * 0.9 + 0.6, a.t, { hot: [6, 0, 11][k] });
  const lk = (a.t - at(11) - k * BEAT * 1.33) / 0.18;
  const lx = panel[0] + 70, ly = panel[1] + 470;
  g.fillStyle = C.slab;
  D.font(g, 30, 600);
  const lw = Math.max(D.measure(g, labels[k][0], 1), D.measure(g, labels[k][1], 1)) + 40;
  g.fillRect(lx, ly, lw * outExpo(lk), 82);
  if (lk > 0.4) {
    D.text(g, labels[k][0], lx + 16, ly + 36, { size: 30, weight: 600, tracking: 1, color: C.white });
    D.text(g, labels[k][1], lx + 16, ly + 70, { size: 30, weight: 600, tracking: 1, color: C.white });
  }
  D.dataRows(g, [["SAMPLE", "STRU-0412"], ["BONDS", String(BONDS.length)], ["STATE", "STABLE"]], panel[0] + 70, panel[1] + 610, { p: a.lt / 0.8, t: a.t, size: 12, col: 90 });
  const swing = 1 - outExpo(a.lt / 0.45);
  a.comp.fxA = placeCard({ rect: panel, cx: 640 - swing * 300, cy: 520, ry: 10 + swing * 25, rx: -2, persp: 1600, scale: 0.98 });
  // tile + name on the right
  const f = a.front();
  D.nameBar(f, 1300, 600, { name: "AHRENS PARVIS", code: "STRU", file: "STRU-001", p: (a.t - at(11, 1)) / 1.0, t: a.t, scale: 0.84 });
  chrome(f, a, { header: false });
  sub(f, a, "结构科：从基本粒子，到生物分子。", "STRUCTURAL SECTION — FROM BASIC PARTICLES TO BIOLOGICAL MOLECULES", at(11) + 0.1, at(12) - 0.04);
}, { samples: 12, tin: TR.push(0.34, [1, 0]), cues: [[at(11), "whoosh_out", 0.7], [at(11, 0.3), "slam", 0.7], [at(11, 1.33), "blip", 0.6], [at(11, 2.66), "blip", 0.6]] });

// ───────────────────────── NRG ─────────────────────────

const s12 = shot("nrg", at(12), at(13), (a) => {
  const f = a.fxA();
  // giant code, type as image
  const px = 560;
  const q = outExpo(a.lt / 0.35);
  f.save();
  f.translate(960, 560);
  f.scale(lerp(1.5, 1, q), lerp(1.5, 1, q));
  f.translate(-960, -560);
  D.sectionCode(f, "NRG", 960, 760, px, { color: C.ink, plate: C.paper, markColor: C.ink, tracking: -0.05 });
  f.restore();
  // energy core: a disc that grows on each beat, XOR-inverted against the letters
  const fr = a.front();
  const beat = Math.floor((a.t - at(12)) / BEAT);
  const age = a.t - at(12, beat);
  const R0 = 150 + beat * 34;
  f.save();
  f.globalCompositeOperation = "xor";
  f.fillStyle = C.ink;
  f.beginPath(); f.arc(960, 560, (R0 + outExpo(age / 0.25) * 34) * outBack(clamp(a.lt / 0.3), 1.8), 0, Math.PI * 2); f.fill();
  f.restore();
  for (let i = 0; i < 5; i++) {
    const ri = (a.t - at(12) - i * BEAT / 2) / 1.2;
    if (ri <= 0 || ri >= 1) continue;
    fr.strokeStyle = `rgba(17,18,20,${0.5 * (1 - ri)})`; fr.lineWidth = 1.5;
    fr.beginPath(); fr.arc(960, 560, 200 + outCubic(ri) * 560, 0, Math.PI * 2); fr.stroke();
  }
  // a lime sun-dot orbiting
  const ang = a.t * 2.2;
  D.dot(fr, 960 + Math.cos(ang) * 330, 560 + Math.sin(ang) * 330, 7, C.lime);
  const kinds = ["GEOTHERM", "BIOTHERM", "ENERGY", "SUNLIGHT"];
  const k = Math.min(3, beat);
  D.chip(fr, "THERMAL RESOURCES", 1480, 760, { size: 12, w: 200, h: 20 });
  D.decodeText(fr, kinds[k], 1480, 820, age / 0.18, a.t, { size: 44, weight: 700, tracking: 1, seed: 60 + k });
  D.decodeText(fr, `OUTPUT ${(12.4 + beat * 3.7).toFixed(1)} GW · FIELD ${String(beat + 1).padStart(2, "0")}`, 1480, 850, age / 0.25, a.t, { size: 12, weight: 500, family: D.F.mono, tracking: 1.5, color: C.mute, seed: 70 + k });
  D.identity(fr, 120, 840, { role: "DIRECTOR / ENERGY", name: "FERDINAND CLOONEY", deg: "NRG-001", field: "· PERSONAL INFORMATION LOADED", p: (a.t - at(12, 0.5)) / 0.9, t: a.t, rule: 560 });
  chrome(fr, a, { header: false });
  sub(fr, a, "能源科：地热、生物热，与更多可能。", "ENERGY SECTION — GEOTHERM · BIOTHERM · AND MORE", at(12) + 0.1, at(13) - 0.04);
}, { samples: 12, tin: TR.blinds(0.38, [1, 0]), cues: [[at(12), "slam_big", 0.9], [at(12, 1), "pulse", 0.6], [at(12, 2), "pulse", 0.6], [at(12, 3), "pulse", 0.6]] });

// ───────────────────────── ORIG ─────────────────────────

const SHARDS = (() => {
  // a tall low-poly crystal: two rings of vertices around a spine, triangulated
  const out = [];
  const H = 520, R = 150;
  const ring = (y, r, n, off) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2 + off; return [Math.cos(t) * r * (0.8 + 0.4 * hash(i * 3.3 + y)), y, Math.sin(t) * r]; });
  const top = [0, -H / 2 - 40, 0], bot = [0, H / 2 + 30, 0];
  const r1 = ring(-120, R * 0.8, 6, 0.2), r2 = ring(60, R, 6, 0.6), r3 = ring(200, R * 0.55, 5, 0.1);
  const rings = [[top], r1, r2, r3, [bot]];
  for (let L = 0; L < rings.length - 1; L++) {
    const A = rings[L], B = rings[L + 1];
    const n = Math.max(A.length, B.length);
    for (let i = 0; i < n; i++) {
      const a0 = A[i % A.length], a1 = A[(i + 1) % A.length], b0 = B[i % B.length], b1 = B[(i + 1) % B.length];
      if (A.length > 1) out.push([a0, a1, b0]);
      if (B.length > 1) out.push([a1, b1, b0]);
      else out.push([a0, a1, b0]);
    }
  }
  return out.map((tri, i) => ({ tri, seed: hash(i * 9.7 + 1.3) }));
})();

function crystal(f, cx, cy, sc, rot, asm, t) {
  const proj = ([x, y, z]) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const X = x * c + z * s, Z = -x * s + z * c;
    const k = 1000 / (1000 + Z);
    return [cx + X * k * sc, cy + y * k * sc, Z];
  };
  const L = [-0.5, -0.7, 0.5];
  const items = SHARDS.map(({ tri, seed }) => {
    const q = clamp((asm - seed * 0.5) / 0.5);
    const e = outExpo(q);
    const cen = tri.reduce((m, p) => [m[0] + p[0] / 3, m[1] + p[1] / 3, m[2] + p[2] / 3], [0, 0, 0]);
    const dir = [cen[0] + (seed - 0.5) * 80, cen[1] * 0.6, cen[2] + 200];
    const off = (1 - e) * 4.5;
    const pts = tri.map((p) => proj([p[0] + dir[0] * off, p[1] + dir[1] * off, p[2] + dir[2] * off]));
    // facet normal (world, rotated) for shading
    const P = tri.map((p) => { const c = Math.cos(rot), s = Math.sin(rot); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; });
    const u = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], v = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(...n) || 1; n = n.map((x) => x / nl);
    if (n[2] > 0) n = n.map((x) => -x);
    const lam = Math.max(0, -(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]));
    return { pts, z: pts.reduce((m, p) => m + p[2], 0) / 3, lam, q, seed };
  }).sort((a2, b2) => b2.z - a2.z);
  for (const it of items) {
    if (it.q <= 0) continue;
    const g = Math.round(14 + it.lam * 70 + it.seed * 14);
    f.fillStyle = `rgb(${g},${g},${g + 2})`;
    f.globalAlpha = clamp(it.q * 3);
    f.beginPath(); f.moveTo(it.pts[0][0], it.pts[0][1]); f.lineTo(it.pts[1][0], it.pts[1][1]); f.lineTo(it.pts[2][0], it.pts[2][1]); f.closePath(); f.fill();
    f.strokeStyle = `rgba(255,255,255,${0.12 + it.lam * 0.3})`; f.lineWidth = 1; f.stroke();
  }
  f.globalAlpha = 1;
}

const s13 = shot("orig", at(13), at(14), (a) => {
  const f = a.fxA();
  const asm = clamp(a.lt / (BEAT * 2.2));
  // debris orbiting
  for (let i = 0; i < 18; i++) {
    const ang = i * 2.4 + a.t * (0.4 + hash(i) * 0.5);
    const r = 260 + hash(i * 3) * 140;
    const x = 760 + Math.cos(ang) * r, y = 560 + Math.sin(ang) * r * 0.55 - 40;
    const s = 6 + hash(i * 5) * 16;
    f.fillStyle = C.ink; f.globalAlpha = clamp(asm * 2);
    f.save(); f.translate(x, y); f.rotate(ang * 2); f.beginPath(); f.moveTo(0, -s); f.lineTo(s * 0.6, s * 0.4); f.lineTo(-s * 0.5, s * 0.7); f.closePath(); f.fill(); f.restore();
  }
  f.globalAlpha = 1;
  crystal(f, 760, 560, 1.0, a.t * 0.55 + 0.4, asm, a.t);
  // orange core
  const cq = outBack(clamp((a.t - at(13, 2)) / 0.3), 2);
  if (cq > 0) {
    f.save(); f.translate(760, 520); f.rotate(Math.PI / 4); f.scale(cq, cq);
    f.strokeStyle = C.orange; f.lineWidth = 7; f.strokeRect(-34, -34, 68, 68);
    f.strokeStyle = "rgba(255,123,0,0.35)"; f.lineWidth = 2; f.strokeRect(-50, -50, 100, 100);
    f.restore();
  }
  const fr = a.front();
  D.decodeText(fr, "ORIGINIUM", 1080, 600, (a.t - at(13, 0.5)) / 0.4, a.t, { size: 110, weight: 800, tracking: -1, seed: 80 });
  D.decodeText(fr, "ARTS", 1080 + 600, 680, (a.t - at(13, 0.8)) / 0.3, a.t, { size: 64, weight: 800, tracking: 0, align: "right", seed: 81 });
  D.decodeText(fr, "PRINCIPLES & APPLICATION", 1080, 720, (a.t - at(13, 1.2)) / 0.4, a.t, { size: 14, weight: 600, tracking: 2, seed: 82 });
  D.nameBar(fr, 1530, 250, { name: "DOROTHY FRANKS", code: "ORIG", file: "ORIG-001", p: (a.t - at(13, 1.5)) / 0.9, t: a.t, scale: 0.6 });
  chrome(fr, a, { header: false });
  sub(fr, a, "源石技艺科：源石技艺的基础原理与应用。", "ORIGINIUM ART SECTION — PRINCIPLES & APPLICATION", at(13) + 0.1, at(14) - 0.04);
}, { samples: 12, tin: TR.slab(0.4, [-1, 0]), cues: [[at(13), "slam", 0.8], [at(13), "shards", 0.8], [at(13, 2), "chime", 0.6]] });

// ───────────────────────── ECO (3D helix) ─────────────────────────

const s14 = shot("eco", at(14), at(15), (a) => {
  const q = a.lt / a.dur;
  const yaw = lerp(-30, 40, inOutSine(q));
  a.scene = {
    cam: { pos: orbit([0, 0, 0], 1250, yaw, lerp(8, -6, q)), target: [80, lerp(-60, 60, q), 0], fov: 32, roll: -8 },
    dof: { focus: 1230, range: 380, bokeh: 1.6 },
    group: { pos: [0, 0, 0], rot: [0, 0, -18] },
    shadowBox: [-700, 700, -700, 700],
    fins: { visible: true, uFormA: 3, uMorph: 0, uHelixR: 170, uHelixLen: 1200, uHelixTurns: 2.4, uFlow: a.t * 3, uLean: 0.5, pulses: pulses(a.t, at(14), 1, (k) => 0.15 + k * 0.22) },
  };
  const f = a.front();
  // ENVIRONMENT ⟷ EVOLUTION
  const p1 = (a.t - at(14, 0.6)) / 0.5, p2 = (a.t - at(14, 1.6)) / 0.5;
  leader(f, a, 860, 380, 640, 300, "ENVIRONMENT", p1, { size: 22, seed: 90 });
  leader(f, a, 1080, 700, 1300, 780, "EVOLUTION", p2, { size: 22, seed: 91 });
  if (p1 > 0) { f.fillStyle = C.orange; f.beginPath(); f.arc(860, 380, 13 * outBack(clamp(p1), 2), 0, Math.PI * 2); f.fill(); }
  D.nameBar(f, 1460, 160, { name: "MUELSYSE", code: "ECO", file: "ECO-001", p: (a.t - at(14, 1)) / 0.9, t: a.t, scale: 0.66 });
  chrome(f, a, { header: false });
  sub(f, a, "生态科：环境，与演化。", "ECOLOGICAL SECTION — ENVIRONMENT & EVOLUTION", at(14) + 0.1, at(15) - 0.04);
}, { samples: 10, tin: TR.zoom(0.36, 2.0, 0.9), cues: [[at(14), "slam", 0.8], [at(14), "whoosh_in", 0.5]] });

// ───────────────────────── SCIEN (contour map) ─────────────────────────

let MAP = null;
function buildMap() {
  const GW = 160, GH = 100, cell = 9;
  const f = (x, y) => {
    let v = 0, a = 1, fx = x * 0.035, fy = y * 0.035;
    for (let o = 0; o < 5; o++) { v += a * (noise1(fx + o * 17.1) * noise1(fy * 1.3 + o * 7.7) + 0.5 * noise1(fx * 0.7 + fy * 0.9 + o * 3.3)); fx *= 2.03; fy *= 2.03; a *= 0.5; }
    const dx = (x - GW * 0.55) / GW, dy = (y - GH * 0.5) / GH;
    return v + 0.9 * Math.exp(-(dx * dx + dy * dy) * 6);
  };
  const V = [];
  for (let j = 0; j <= GH; j++) { V.push([]); for (let i = 0; i <= GW; i++) V[j].push(f(i, j)); }
  const levels = [];
  for (let L = -0.2; L <= 1.4; L += 0.12) levels.push(L);
  const segs = levels.map(() => []);
  levels.forEach((L, li) => {
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const c = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
      const P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const pts = [];
      for (let e = 0; e < 4; e++) {
        const a0 = c[e], a1 = c[(e + 1) % 4];
        if ((a0 - L) * (a1 - L) < 0) {
          const t = (L - a0) / (a1 - a0);
          pts.push([(P[e][0] + (P[(e + 1) % 4][0] - P[e][0]) * t) * cell, (P[e][1] + (P[(e + 1) % 4][1] - P[e][1]) * t) * cell]);
        }
      }
      if (pts.length >= 2) segs[li].push([pts[0], pts[1]]);
      if (pts.length === 4) segs[li].push([pts[2], pts[3]]);
    }
  });
  MAP = { segs, W: GW * cell, H: GH * cell, levels };
}

const s15 = shot("scien", at(15), at(16), (a) => {
  if (!MAP) buildMap();
  const g = a.fxA();
  const ox = 960 - MAP.W / 2, oy = 540 - MAP.H / 2;
  const pin = [ox + MAP.W * 0.55, oy + MAP.H * 0.5];
  const rev = outCubic(a.lt / (BEAT * 2.2)) * 1100;
  g.save();
  g.beginPath(); g.arc(pin[0], pin[1], rev, 0, Math.PI * 2); g.clip();
  g.fillStyle = "rgba(246,245,242,0.55)"; g.fillRect(ox - 40, oy - 40, MAP.W + 80, MAP.H + 80);
  D.grid(g, ox - 40, oy - 40, MAP.W + 80, MAP.H + 80, 60, "rgba(17,18,20,0.07)");
  MAP.segs.forEach((segs, li) => {
    const major = li % 4 === 0;
    g.strokeStyle = major ? "rgba(17,18,20,0.75)" : "rgba(17,18,20,0.32)";
    g.lineWidth = major ? 1.6 : 1;
    g.beginPath();
    for (const [p, q] of segs) { g.moveTo(ox + p[0], oy + p[1]); g.lineTo(ox + q[0], oy + q[1]); }
    g.stroke();
  });
  g.restore();
  // ring around the survey site
  const rq = clamp((a.t - at(15, 1.5)) / 0.4);
  if (rq > 0) {
    g.strokeStyle = C.ink; g.lineWidth = 2;
    g.beginPath(); g.ellipse(pin[0], pin[1], 300 * outCubic(rq), 300 * outCubic(rq), 0, 0, Math.PI * 2); g.stroke();
  }
  a.comp.fxA = placeCard({ rect: [ox - 40, oy - 40, MAP.W + 80, MAP.H + 80], cx: 1000, cy: 600 + (1 - outExpo(a.lt / 0.6)) * 80, rx: 52, rz: -12 + a.lt * 2, persp: 1500, scale: 1.05 });
  // pin (screen space, drops on beat 2)
  const f = a.front();
  const pq = (a.t - at(15, 2)) / 0.22;
  const pinScreen = [1028, 588];
  if (pq > 0) {
    const y = pinScreen[1] - (1 - outCubic(clamp(pq))) * 120;
    f.fillStyle = C.ink;
    f.beginPath(); f.arc(pinScreen[0], y - 46, 22, Math.PI, 0); f.lineTo(pinScreen[0], y); f.closePath(); f.fill();
    D.dot(f, pinScreen[0], y - 46, 8, C.paper);
    D.dot(f, pinScreen[0], pinScreen[1], 4 + 10 * clamp(1 - (pq - 1) * 2), C.lime);
  }
  const nq = (a.t - at(15, 2.2)) / 0.5;
  if (nq > 0) {
    D.decodeText(f, "NORTHERN SAMI", 1090, 470, nq, a.t, { size: 58, weight: 800, tracking: -0.5, seed: 95 });
    f.fillStyle = C.ink;
    for (let i = 0; i < 14; i++) { f.save(); f.translate(1094 + i * 22, 492); f.transform(1, 0, -0.6, 1, 0, 0); f.fillRect(0, 0, 9 * clamp(nq * 2 - i * 0.05), 18); f.restore(); }
    D.decodeText(f, "FIELD SURVEY · ACTIVE", 1094, 540, nq - 0.2, a.t, { size: 13, weight: 600, family: D.F.mono, tracking: 2, color: C.mute, seed: 96 });
  }
  chrome(f, a, { header: false });
  sub(f, a, "科学调查科：去往地图上的空白处。", "SCIENTIFIC INVESTIGATION — INTO THE BLANKS ON THE MAP", at(15) + 0.1, at(16) - 0.04);
}, { samples: 12, tin: TR.push(0.34, [0, -1]), cues: [[at(15), "slam", 0.8], [at(15, 2), "pin", 0.9]] });

// ───────────────────────── personnel strobe → ∞ ─────────────────────────

const PEOPLE = [
  ["KRISTEN WRIGHT", "CO-FOUNDER", "CMPT", "CMPT-001"], ["AHRENS PARVIS", "DIRECTOR", "STRU", "STRU-001"],
  ["FERDINAND CLOONEY", "DIRECTOR", "NRG", "NRG-001"], ["DOROTHY FRANKS", "DIRECTOR", "ORIG", "ORIG-001"],
  ["MUELSYSE", "DIRECTOR", "ECO", "ECO-001"], ["REDACTED·REDACTED", "DIRECTOR", "SCIEN", "SCIEN-???"],
];

const s16a = shot("personnel", at(16), at(16, 3), (a) => {
  const k = Math.min(5, Math.floor(a.lt / (BEAT / 2)));
  const age = a.lt - k * BEAT / 2;
  const [name, role, code, file] = PEOPLE[k];
  const f = a.fxA();
  const dx = (1 - outExpo(age / 0.16)) * (k % 2 ? -140 : 140);
  f.save(); f.translate(dx, 0);
  D.classifiedPhoto(f, 300, 250, 330, 420, { });
  D.nameBar(f, 700, 330, { name, role, code, file, p: 0.55 + age * 3, t: a.t, scale: 1.25, redacted: k === 5 });
  f.restore();
  const fr = a.front();
  D.text(fr, `PERSONNEL ${String(k + 1).padStart(2, "0")} / 06`, 1860, 130, { size: 13, family: D.F.mono, weight: 600, tracking: 2, align: "right" });
  if (k === 5) { fr.fillStyle = C.orange; fr.fillRect(700, 800, 380, 30); D.text(fr, "FILE SEALED · LEVEL-A", 716, 821, { size: 15, weight: 700, tracking: 2, color: C.ink }); }
  chrome(fr, a, { header: false });
  frameTicks(fr);
}, { samples: 10, shutter: 0.45, tin: TR.blinds(0.36, [-1, 0]), cues: [0, 0.5, 1, 1.5, 2, 2.5].map((k) => [at(16, k), "tick_hard", 0.8]) });

const s16b = shot("collapse", at(16, 3), at(17), (a) => {
  // the ∞ is drawn across the whole frame in one stroke: the sculpture's path
  const p = inOutCubic(a.lt / (BEAT * 0.95));
  const f = a.fxA();
  D.mark(f, 960, 540, 1500, { draw: p, glyphs: 0 });
  const fr = a.front();
  chrome(fr, a, { header: false });
}, { samples: 16, shutter: 0.6, tin: TR.zoom(0.3, 0.55, 1.12), cues: [[at(16, 3), "draw", 0.9]] });

export const act2 = [s9a, s9b, s10, s11, s12, s13, s14, s15, s16a, s16b];
