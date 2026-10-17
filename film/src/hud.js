// The persistent layer: everything that must NOT restart at a cut lives
// here and is a function of global time only — header, step indicator,
// footer, frame ticks, subtitles, the travelling section tile and rail.
// It is laid over the (possibly transitioning) picture.
import * as D from "./lib/draw.js";
import { at, BEAT, clamp, lerp, smooth, outCubic, inOutCubic, outExpo } from "./lib/util.js";

const C = D.C;
const INK_D = "#f2f0eb";
const END = at(28) + 2.5;

/** 1 inside the dark (lockdown) part of the film */
export function darkAt(t) {
  return t < at(0, 1) || (t >= at(23) && t < at(26)) ? 1 : 0;
}
const inkAt = (t) => (darkAt(t) ? INK_D : C.ink);

/** visibility with retract-don't-fade edges: returns 0..1 (1 = fully out) */
function presence(t, ranges, dur = 0.32) {
  let v = 0;
  for (const [a, b] of ranges) {
    const i = smooth((t - a) / dur), o = smooth((t - (b - dur)) / dur);
    v = Math.max(v, Math.min(i, 1 - o));
  }
  return v;
}

// ───────────── subtitles (one track, independent of shots) ─────────────
const SUBS = [
  [at(2) + 0.1, at(3), "每一次实验，", "EVERY EXPERIMENT"],
  [at(3) + 0.05, at(4) - 0.05, "都是一次加法。", "IS AN ADDITION."],
  [at(5) + 0.08, at(6) - 0.02, "每一次突破，", "EVERY BREAKTHROUGH"],
  [at(6) + 0.05, at(7) - 0.05, "都减去一道边界。", "SUBTRACTS A LIMIT."],
  [at(9, 2) + 0.1, at(10) - 0.04, "十大科室，一个莱茵。", "TEN SECTIONS. ONE RHINE LAB."],
  [at(10) + 0.1, at(11) - 0.04, "总辖构件科，莱茵生命的中枢。", "COMPONENTS CONTROL — THE CENTRAL SECTION OF RHINE LAB"],
  [at(11) + 0.1, at(12) - 0.04, "结构科：从基本粒子，到生物分子。", "STRUCTURAL SECTION — FROM BASIC PARTICLES TO BIOLOGICAL MOLECULES"],
  [at(12) + 0.1, at(13) - 0.04, "能源科：地热、生物热，与更多可能。", "ENERGY SECTION — GEOTHERM · BIOTHERM · AND MORE"],
  [at(13) + 0.1, at(14) - 0.04, "源石技艺科：源石技艺的基础原理与应用。", "ORIGINIUM ART SECTION — PRINCIPLES & APPLICATION"],
  [at(14) + 0.1, at(15) - 0.04, "生态科：环境，与演化。", "ECOLOGICAL SECTION — ENVIRONMENT & EVOLUTION"],
  [at(15) + 0.1, at(16) - 0.04, "科学调查科：去往地图上的空白处。", "SCIENTIFIC INVESTIGATION — INTO THE BLANKS ON THE MAP"],
  [at(18) + 0.05, at(19) - 0.04, "四百片鳍，一条回路。", "FOUR HUNDRED FINS. ONE LOOP."],
  [at(19) + 0.05, at(20) - 0.04, "加上知识，减去边界，", "ADD KNOWLEDGE. SUBTRACT LIMITS."],
  [at(20) + 0.05, at(21) - 0.04, "等于无限。", "EQUALS INFINITE."],
  [at(21) + 0.3, at(22) - 0.04, "生命，从无边界。", "LIFE, WITHOUT LIMITS."],
  [at(22) + 0.05, at(23) - 0.02, "正在比对授权口令……", "CROSS-CHECKING AUTHORIZATION KEY."],
  [at(23) + 0.02, at(23, 3), "档案 C-023 · 绝密", "FILE C-023 · HIGHLY CONFIDENTIAL"],
  [at(24) + 0.2, at(25) - 0.02, "检测到非法访问，权限已被拒绝。", "ILLICIT ACCESS DETECTED. PERMISSION DENIED."],
  [at(25) + 0.1, at(26) - 0.02, "正在返回公共频道……", "RETURNING TO PUBLIC CHANNEL."],
  [at(26) + 0.35, at(27) - 0.02, "莱茵生命，", "RHINE LAB —"],
  [at(27) + 0.05, at(28) - 0.05, "为生命，减去边界。", "SUBTRACTING THE LIMITS OF LIFE."],
];

function subtitles(f, t) {
  for (const [t0, t1, zh, en] of SUBS) {
    if (t < t0 || t >= t1) continue;
    const pin = clamp((t - t0) / 0.42);
    const out = clamp((t1 - t) / 0.16);
    const dark = darkAt(t);
    D.subtitle(f, zh, en, { p: pin, t, alpha: out, color: dark ? INK_D : C.ink, enColor: dark ? "#6f6d68" : C.mute });
  }
}

// ───────────── step indicator: the live ring travels between nodes ─────────────
const ACTS = [[at(1), 0, "01 · ADD"], [at(5), 1, "02 · SUBTRACT"], [at(9), 2, "03 · EQUALS"], [at(17), 3, "04 · INFINITE"], [at(23), 4, "05 · LOCKDOWN"]];
function steps(f, t) {
  const vis = presence(t, [[at(1), at(26)]], 0.3);
  if (vis <= 0) return;
  let k = 0, tk = ACTS[0][0];
  for (const [ta, i] of ACTS) if (t >= ta) { k = i; tk = ta; }
  const mv = outCubic((t - tk) / 0.35);
  const from = Math.max(0, k - 1);
  const col = C.orange, y = 58, xr = 1860, gap = 44;
  f.save();
  f.globalAlpha = vis;
  f.translate((1 - vis) * 260, 0);
  for (let i = 0; i < 5; i++) D.dot(f, xr - (4 - i) * gap, y, 4, col);
  const pos = lerp(from, k, k === 0 ? 1 : mv);
  const x = xr - (4 - pos) * gap;
  f.strokeStyle = col; f.lineWidth = 2.4;
  f.fillStyle = darkAt(t) ? "#0b0b0c" : C.paper;
  f.beginPath(); f.arc(x, y, 9, 0, Math.PI * 2); f.fill(); f.stroke();
  if (pos > 0) { f.beginPath(); f.moveTo(xr - 4 * gap + 4, y); f.lineTo(x - 9, y); f.stroke(); }
  D.dot(f, x, y, 3.2, col);
  const label = ACTS.find(([, i]) => i === k)[2];
  D.decodeText(f, label, xr + 9, y + 32, k === 0 ? (t - at(1)) / 0.5 : (t - tk) / 0.4, t, { size: 11, weight: 600, family: D.F.mono, tracking: 2.4, color: inkAt(t), align: "right", seed: 7 + k });
  f.restore();
}

// ───────────── the travelling section tile + rail ─────────────
const SECT = [
  { t: at(10, -0.25), rect: [780, 380, 360, 360], lines: ["CMPT", "CTRL"], cap: "COMPONENTS CONTROL SECTION", tab: false },
  { t: at(10), rect: [300, 330, 440, 308], lines: ["CMPT", "CTRL"], cap: "COMPONENTS CONTROL SECTION" },
  { t: at(11), rect: [1300, 220, 420, 294], code: "STRU", cap: "STRUCTURAL SECTION" },
  { t: at(12), rect: [1480, 150, 320, 224], code: "NRG", cap: "ENERGY SECTION" },
  { t: at(13), rect: [1110, 250, 330, 230], code: "ORIG", cap: "ORIGINIUM ART SECTION" },
  { t: at(14), rect: [140, 640, 340, 238], code: "ECO", cap: "ECOLOGICAL SECTION" },
  { t: at(15), rect: [140, 300, 420, 260], code: "SCIEN", cap: "SCIENTIFIC INVESTIGATION SECTION" },
  { t: at(16), rect: [-560, 300, 420, 260], code: "SCIEN", cap: "SCIENTIFIC INVESTIGATION SECTION", exit: true },
];
const PRE = 0.1, TRAVEL = 0.42;

function sectionTile(f, t, assets) {
  if (t < SECT[0].t || t > SECT[SECT.length - 1].t + TRAVEL) return;
  let i = 0;
  for (let k = 1; k < SECT.length; k++) if (t >= SECT[k].t - PRE) i = k;
  const cur = SECT[i], prev = SECT[Math.max(0, i - 1)];
  let q = i === 0 ? 1 : (t - (cur.t - PRE)) / TRAVEL;
  q = clamp(q);
  const e = inOutCubic(q);
  const r = prev.rect.map((v, j) => lerp(v, cur.rect[j], e));
  const show = q < 0.5 && i > 0 ? prev : cur;
  const id = show.exit ? prev : show;
  // a slight squash while travelling reads as speed, not as a jump
  const sq = 1 - 0.08 * Math.sin(Math.PI * q) * (i > 0 ? 1 : 0);
  f.save();
  f.translate(r[0] + r[2] / 2, r[1] + r[3] / 2);
  f.scale(1 / sq, sq);
  f.translate(-(r[0] + r[2] / 2), -(r[1] + r[3] / 2));
  const tabA = id.tab === false ? 0 : (i === 1 ? smooth(q * 2 - 0.6) : 1);
  D.sectionTile(f, r[0], r[1], r[2], r[3], {
    lines: id.lines, code: id.code, caption: id.cap, smoke: assets.smoke, t, tab: tabA > 0.01 ? "SECTION" : false, seed: 0,
  });
  f.restore();
}

function rail(f, t) {
  const v = presence(t, [[at(10), at(12) + 0.15]], 0.35);
  if (v <= 0) return;
  const down = t < at(11) ? 1 : 0;
  f.fillStyle = C.ink;
  // draws down from the top on entry, retracts upward on exit
  f.fillRect(429, 0, 2, 1080 * v);
  const my = lerp(347, 520, outCubic((t - at(11)) / 0.35) * (1 - down));
  if (v > 0.6) { f.fillStyle = C.lime; f.fillRect(411, my, 38, 22); }
}

// ───────────── header / footer / ticks / chips ─────────────
function header(f, t) {
  const v = presence(t, [[at(1), at(21)], [at(22), at(28)]], 0.34);
  if (v <= 0) return;
  const first = t < at(1) + 1.2;
  f.save();
  f.translate(first ? 0 : -(1 - v) * 420, 0);
  D.header(f, 60, 112, 1, { p: first ? clamp((t - at(1)) / 0.9) : 1, t, color: inkAt(t) });
  f.restore();
}

function footer(f, t) {
  const v = presence(t, [[at(0, 1), END - 0.4]], 0.3);
  if (v <= 0) return;
  f.save();
  f.translate((1 - v) * 460, 0);
  D.footer(f, { color: inkAt(t) });
  f.restore();
}

function ticks(f, t) {
  // viewfinder corners for the cold open; they spring outward and leave at the downbeat
  if (t >= at(1) + 0.3) return;
  const o = smooth((t - at(1)) / 0.3);
  const m = 40 - o * 60;
  D.corners(f, m, m, 1920 - 2 * m, 1080 - 2 * m, 22, 1.5, darkAt(t) ? "rgba(242,240,235,0.35)" : "rgba(17,18,20,0.55)");
}

function channelChip(f, t) {
  const v = presence(t, [[at(26), at(27, 2)]], 0.3);
  if (v <= 0) return;
  f.save();
  f.translate((1 - v) * 320, 0);
  D.chip(f, "PUBLIC CHANNEL · RESTORED", 1600, 110, { size: 12, w: 260, h: 20, bg: C.ink });
  f.fillStyle = C.lime; f.fillRect(1584, 114, 10, 12);
  f.restore();
}

export function hud(f, t, info) {
  ticks(f, t);
  rail(f, t);
  sectionTile(f, t, info.assets);
  header(f, t);
  steps(f, t);
  channelChip(f, t);
  footer(f, t);
  subtitles(f, t);
}

/** the end fade applies to everything, HUD included */
export function hudFade(t) {
  return smooth((t - (END - 0.25)) / 0.2);
}
