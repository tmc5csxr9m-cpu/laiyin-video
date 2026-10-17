// Canvas2D vocabulary of the Rhine Lab film: type, decode text, the ∞ mark,
// section codes, tiles, name bars, chips, callouts, subtitles, chrome.
import { clamp, hash, hash2, lerp, outCubic, smooth, inv } from "./util.js";

export const C = {
  paper: "#e7e5e1", ink: "#111214", inkInv: "#f2f0eb", mute: "#8b8882", faint: "#c9c6c0",
  card: "#f6f5f2", tab: "#e2e0dc", lime: "#b9e432", orange: "#ff7b00", orangeDeep: "#e35d00",
  plate: "#101112", slab: "#111214", white: "#ffffff",
};

export const F = {
  sans: "Montserrat", mono: "JetBrains Mono", cjk: "MiSans",
};

// ─────────────────────────── type ───────────────────────────

export function font(ctx, size, weight = 500, family = F.sans) {
  const fb = family === F.cjk ? ', "Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif' : ", sans-serif";
  ctx.font = `${weight} ${size}px "${family}"${fb}`;
}

/** width of a string with tracking, without the trailing letter-space */
export function measure(ctx, s, tracking = 0) {
  ctx.letterSpacing = `${tracking}px`;
  const w = ctx.measureText(s).width;
  return s.length ? w - tracking : 0;
}

/**
 * text(ctx, s, x, y, {size, weight, family, tracking, color, align, alpha})
 * align: left | center | right — computed without the trailing tracking.
 */
export function text(ctx, s, x, y, o = {}) {
  const size = o.size ?? 16, weight = o.weight ?? 500, family = o.family ?? F.sans;
  const tr = o.tracking ?? 0;
  font(ctx, size, weight, family);
  ctx.letterSpacing = `${tr}px`;
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.textAlign = "left";
  const w = measure(ctx, s, tr);
  let x0 = x;
  if (o.align === "center") x0 = x - w / 2;
  else if (o.align === "right") x0 = x - w;
  ctx.fillStyle = o.color ?? C.ink;
  const a = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = a * o.alpha;
  ctx.fillText(s, x0, y);
  ctx.globalAlpha = a;
  return w;
}

/** tracking that makes `s` exactly `width` wide at the given font */
export function fitTracking(ctx, s, width, size, weight, family = F.sans) {
  font(ctx, size, weight, family);
  ctx.letterSpacing = "0px";
  const w0 = ctx.measureText(s).width;
  return (width - w0) / Math.max(1, s.length - 1);
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";
/**
 * Decode reveal: letters resolve left→right behind a tail of scrambled glyphs.
 * p = 0..1 over the whole string; t drives the scramble (changes ~every 32 ms).
 */
export function decodeParts(s, p, t, seed = 0, tail = 3) {
  const n = s.length;
  const k = Math.floor(clamp(p) * (n + tail));
  const resolved = s.slice(0, Math.min(n, k));
  let scr = "";
  const tick = Math.floor(t / 0.032);
  for (let i = resolved.length; i < Math.min(n, k + 0); i++) scr += "";
  for (let j = 0; j < tail; j++) {
    const i = resolved.length + j;
    if (i >= n || i >= k) break;
    const ch = s[i];
    scr += ch === " " ? " " : GLYPHS[Math.floor(hash2(i + seed * 31, tick) * GLYPHS.length)];
  }
  return { resolved, scr, done: k >= n + tail };
}

export function decodeText(ctx, s, x, y, p, t, o = {}) {
  if (p <= 0) return 0;
  const { resolved, scr } = decodeParts(s, p, t, o.seed ?? 0, o.tail ?? 3);
  const tr = o.tracking ?? 0;
  const full = measure((font(ctx, o.size ?? 16, o.weight ?? 500, o.family ?? F.sans), ctx), s, tr);
  let x0 = x;
  if (o.align === "center") x0 = x - full / 2;
  else if (o.align === "right") x0 = x - full;
  const w = text(ctx, resolved, x0, y, { ...o, align: "left" });
  if (scr) text(ctx, scr, x0 + w + (resolved ? tr : 0), y, { ...o, align: "left", color: o.scrColor ?? C.mute });
  return full;
}

/** typewriter: shows the first floor(p·n) chars plus a block caret */
export function typeText(ctx, s, x, y, p, o = {}) {
  const n = Math.floor(clamp(p) * s.length + 1e-6);
  const w = text(ctx, s.slice(0, n), x, y, o);
  if (o.caret && p < 1.0001) {
    const size = o.size ?? 14;
    ctx.fillStyle = o.caretColor ?? C.lime;
    ctx.fillRect(x + w + 3, y - size * 0.78, size * 0.55, size * 0.95);
  }
  return w;
}

// ─────────────────────────── ∞ mark ───────────────────────────

export const MARK = {
  w: 1200, h: 570, stroke: 100, len: 2813.06,
  ring: new Path2D("M 691.70 199.36 L 431.75 442.13 A 215 215 0 1 1 431.75 127.87 L 768.25 442.13 A 215 215 0 1 0 768.25 127.87"),
  plus: new Path2D("M 258 187 h 64 v 66 h 66 v 64 h -66 v 66 h -64 v -66 h -66 v -64 h 66 Z"),
  minus: new Path2D("M 837 256 h 162 v 64 h -162 Z"),
  plusC: [290, 285], minusC: [918, 288],
};

/**
 * The ∞ mark centred at (x, y), width w.
 * o: {draw: 0..1 pen progress, glyphs: 0..1, color, plus: 1, minus: 1, caption: bool}
 */
export function mark(ctx, x, y, w, o = {}) {
  const s = w / MARK.w;
  ctx.save();
  ctx.translate(x - (MARK.w / 2) * s, y - (MARK.h / 2) * s);
  ctx.scale(s, s);
  const col = o.color ?? C.ink;
  const p = o.draw ?? 1;
  if (p > 0) {
    ctx.strokeStyle = col;
    ctx.lineWidth = MARK.stroke * (o.weight ?? 1);
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    if (p < 1) { ctx.setLineDash([MARK.len * p, MARK.len + 10]); ctx.lineDashOffset = 0; }
    ctx.stroke(MARK.ring);
    ctx.setLineDash([]);
  }
  const g = o.glyphs ?? (p >= 1 ? 1 : clamp((p - 0.55) / 0.45));
  if (g > 0) {
    ctx.fillStyle = col;
    const gp = o.plus ?? g, gm = o.minus ?? g;
    if (gp > 0) {
      ctx.save(); ctx.translate(...MARK.plusC); ctx.scale(gp, gp); ctx.translate(-MARK.plusC[0], -MARK.plusC[1]);
      ctx.fill(MARK.plus); ctx.restore();
    }
    if (gm > 0) {
      ctx.save(); ctx.translate(...MARK.minusC); ctx.scale(gm, 1); ctx.translate(-MARK.minusC[0], -MARK.minusC[1]);
      ctx.fill(MARK.minus); ctx.restore();
    }
  }
  ctx.restore();
}

/** RHINE·LAB caption under a mark of width w (size 0.062w, tracking 0.062w) */
export function markCaption(ctx, x, y, w, o = {}) {
  const size = w * 0.062;
  text(ctx, o.text ?? "RHINE·LAB", x, y, { size, weight: 700, tracking: w * 0.062 * (o.trackMul ?? 1), align: "center", color: o.color ?? C.ink, alpha: o.alpha });
}

/** draw a single glyph of the mark (+ or −) centred at x,y with height h */
export function glyph(ctx, which, x, y, h, color = C.ink) {
  const s = h / 196;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  if (which === "+") { ctx.translate(-290, -285); ctx.fill(MARK.plus); }
  else { ctx.scale(196 / 64 * 0.33, 1); ctx.translate(-918, -288); ctx.fill(MARK.minus); }
  ctx.restore();
}

// ─────────────────────────── section code / tile ───────────────────────────

/** index of the letter that carries the ∞ (4-letter codes: 3rd, others: 2nd) */
export function ligIndex(code) { return code.length === 4 ? 2 : Math.min(1, code.length - 1); }

/**
 * Section code (NRG, STRU, ORIG…) centred at x, baseline y, cap size px.
 * o: {color, plate (pill colour), lig (index or -1), tracking (em), markColor}
 */
export function sectionCode(ctx, code, x, y, px, o = {}) {
  const tr = (o.tracking ?? -0.045) * px;
  font(ctx, px, o.weight ?? 600);
  ctx.letterSpacing = "0px";
  const ws = [...code].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + tr * (code.length - 1);
  let cx = o.align === "left" ? x : x - total / 2;
  const lig = o.lig ?? ligIndex(code);
  ctx.fillStyle = o.color ?? C.white;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const pos = [];
  [...code].forEach((ch, i) => { pos.push(cx); ctx.fillText(ch, cx, y); cx += ws[i] + tr; });
  if (lig >= 0 && lig < code.length) {
    const mw = px * (o.markScale ?? 0.52);
    const mx = pos[lig] + ws[lig] / 2 + (o.markDx ?? 0) * px;
    const my = y - px * 0.36;
    const ph = mw * 0.5, pw = mw * 1.16;
    ctx.fillStyle = o.plate ?? C.plate;
    roundRect(ctx, mx - pw / 2, my - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    mark(ctx, mx, my, mw, { color: o.markColor ?? o.color ?? C.white });
  }
  return total;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Black smoky section tile (film 1:16).  Top-left at (x, y), size w×h.
 * o: {code, caption, tab, smoke (img), t, lines: ["CMPT","CTRL"], edge: lime 0..1}
 */
export function sectionTile(ctx, x, y, w, h, o = {}) {
  ctx.save();
  if (o.tab !== false) {
    const th = Math.max(14, h * 0.12);
    const fs = Math.max(9, h * 0.074);
    font(ctx, fs, 500);
    const tw = measure(ctx, o.tab ?? "SECTION", 0.5) + fs * 1.8;
    ctx.fillStyle = C.tab;
    ctx.fillRect(x + w * 0.14, y - th + 1, tw, th);
    text(ctx, o.tab ?? "SECTION", x + w * 0.14 + fs * 0.9, y - th * 0.28, { size: fs, weight: 500, tracking: 0.5, color: "#3c3c3c" });
  }
  ctx.fillStyle = C.plate;
  ctx.fillRect(x, y, w, h);
  if (o.smoke) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const t = o.t ?? 0;
    const sw = w * 1.12, sh = sw * (o.smoke.height / o.smoke.width);
    const dx = Math.sin(t * 0.17 + (o.seed ?? 0)) * w * 0.03, dy = Math.cos(t * 0.13) * h * 0.03;
    ctx.globalAlpha = o.smokeAlpha ?? 0.55;
    ctx.drawImage(o.smoke, x - (sw - w) / 2 + dx, y + h / 2 - sh / 2 + dy, sw, sh);
    ctx.globalAlpha = 1;
    // film grain on the plate
    ctx.restore();
  }
  // registration dot
  ctx.fillStyle = "#6c6c6c";
  ctx.beginPath(); ctx.arc(x + w * 0.935, y + h * 0.12, w * 0.021, 0, Math.PI * 2); ctx.fill();
  const lines = o.lines ?? [o.code ?? "SYS"];
  const maxLen = Math.max(...lines.map((l) => l.length));
  const px = Math.min(h * (lines.length > 1 ? 0.3 : 0.4), (w * 1.25) / Math.max(3, maxLen));
  const capY = y + h * 0.5 + (lines.length > 1 ? -px * 0.12 : px * 0.22);
  lines.forEach((ln, i) => {
    const by = capY + (i - (lines.length - 1) / 2) * px * 0.86;
    sectionCode(ctx, ln, x + w / 2, by, px, { lig: lines.length > 1 ? (i === 1 ? 0 : -1) : undefined, plate: C.plate, markDx: lines.length > 1 && i === 1 ? 0.06 : 0 });
  });
  if (o.caption) {
    let fs = Math.max(8, Math.round(h * 0.062));
    font(ctx, fs, 400);
    const cw = measure(ctx, o.caption, fs * 0.04);
    if (cw > w * 0.86) fs *= (w * 0.86) / cw;
    text(ctx, o.caption, x + w / 2, y + h * (lines.length > 1 ? 0.86 : 0.79), { size: fs, weight: 400, tracking: fs * 0.04, color: "#d9d9d9", align: "center" });
  }
  if (o.edge) {
    ctx.strokeStyle = C.lime; ctx.globalAlpha = o.edge; ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ─────────────────────────── chrome ───────────────────────────

/** RHINE LAB / SYNTHESIZE INFORMATION / ANALYSIS OS at (x, top y), scale k */
export function header(ctx, x, y, k = 1, o = {}) {
  const col = o.color ?? C.ink;
  const p = o.p ?? 1, t = o.t ?? 0;
  const W = 267 * k;
  const s1 = 46 * k;
  if (p >= 1) text(ctx, "RHINE LAB", x, y + 44 * k, { size: s1, weight: 700, tracking: 0.92 * k, color: col });
  else decodeText(ctx, "RHINE LAB", x, y + 44 * k, p * 1.6, t, { size: s1, weight: 700, tracking: 0.92 * k, color: col, seed: 1 });
  const s2 = 17.6 * k;
  const tr2 = fitTracking(ctx, "SYNTHESIZE INFORMATION", W, s2, 500);
  if (p > 0.25) decodeText(ctx, "SYNTHESIZE INFORMATION", x, y + 70 * k, (p - 0.25) * 1.8, t, { size: s2, weight: 500, tracking: tr2, color: col, seed: 2 });
  // ANALYSIS (light) + gap 0.42×46 + OS (bold), size fitted to line 1
  font(ctx, 100, 300); const wa = measure(ctx, "ANALYSIS", 0);
  font(ctx, 100, 700); const wo = measure(ctx, "OS", 0);
  const s3 = (W - 0.42 * s1) / ((wa + wo) / 100);
  if (p > 0.45) {
    const q = clamp((p - 0.45) * 2.2);
    text(ctx, "ANALYSIS", x, y + 107 * k, { size: s3, weight: 300, color: col, alpha: q });
    text(ctx, "OS", x + W, y + 107 * k, { size: s3, weight: 700, color: col, align: "right", alpha: q });
  }
}

export function footer(ctx, o = {}) {
  const col = o.color ?? C.ink;
  const a = o.alpha ?? 1;
  const y = o.y ?? 967, xr = o.x ?? 1860;
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.fillRect(xr - 24, y - 9, 24, 5);
  const w2 = text(ctx, "RHINE LAB", xr - 40, y, { size: 18.5, weight: 700, tracking: 1.3, color: col, align: "right" });
  text(ctx, "POWERED BY", xr - 40 - w2 - 8, y, { size: 18.5, weight: 500, tracking: 0.6, color: col, align: "right" });
  ctx.globalAlpha = 1;
}

/** bilingual burnt-in subtitle */
export function subtitle(ctx, zh, en, o = {}) {
  const a = o.alpha ?? 1;
  const y = o.y ?? 1006;
  const col = o.color ?? C.ink;
  ctx.save();
  ctx.globalAlpha = a;
  if (o.plate) {
    font(ctx, 23, 500, F.cjk);
    const w = Math.max(measure(ctx, zh, 2), en ? (font(ctx, 11, 600), measure(ctx, en, 3.2)) : 0);
    ctx.fillStyle = o.plate;
    ctx.fillRect(960 - w / 2 - 18, y - 30, w + 36, en ? 62 : 42);
  }
  if (zh) {
    if (o.p !== undefined && o.p < 1) decodeCJK(ctx, zh, 960, y, o.p, o.t ?? 0, { size: 23, color: col });
    else text(ctx, zh, 960, y, { size: 23, weight: 500, family: F.cjk, tracking: 2, color: col, align: "center" });
  }
  if (en) {
    const pe = o.p !== undefined ? clamp(o.p * 1.3 - 0.2) : 1;
    decodeText(ctx, en, 960, y + 25, pe, o.t ?? 0, { size: 11, weight: 600, tracking: 3.2, color: o.enColor ?? C.mute, align: "center", seed: 9 });
  }
  ctx.restore();
}

/** CJK reveal: characters fade/slide in left→right (no scramble for hanzi) */
export function decodeCJK(ctx, s, x, y, p, t, o = {}) {
  const size = o.size ?? 23, tr = o.tracking ?? 2;
  font(ctx, size, o.weight ?? 500, F.cjk);
  const w = measure(ctx, s, tr);
  let cx = o.align === "left" ? x : x - w / 2;
  const n = s.length;
  ctx.letterSpacing = "0px";
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    const cw = ctx.measureText(ch).width;
    const q = clamp(p * (n + 4) - i);
    if (q > 0) {
      ctx.globalAlpha = smooth(q) * (o.alpha ?? 1);
      ctx.fillStyle = q < 0.5 ? (o.hot ?? C.mute) : (o.color ?? C.ink);
      ctx.fillText(ch, cx, y + (1 - outCubic(q)) * size * 0.25);
    }
    cx += cw + tr;
  }
  ctx.globalAlpha = 1;
  return w;
}

/** black chip with white caps text (e.g. SERVICES SECT., RHINE LAB LLC DATABASE) */
export function chip(ctx, s, x, y, o = {}) {
  const size = o.size ?? 13;
  font(ctx, size, o.weight ?? 600, o.family ?? F.sans);
  const tr = o.tracking ?? 0.8;
  const w = o.w ?? measure(ctx, s, tr) + size * 1.2;
  const h = o.h ?? size * 1.45;
  ctx.fillStyle = o.bg ?? C.slab;
  ctx.fillRect(x, y, w * (o.p ?? 1), h);
  if ((o.p ?? 1) > 0.6) text(ctx, s, x + size * 0.6, y + h * 0.74, { size, weight: o.weight ?? 600, tracking: tr, color: o.color ?? C.white, family: o.family ?? F.sans });
  return w;
}

/** viewfinder corners around a rect */
export function corners(ctx, x, y, w, h, len = 18, lw = 2, color = C.ink) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
  ctx.stroke();
}

/** the film's bracket ⌐ in front of callout titles */
export function bracket(ctx, x, y, s = 34, lw = 7, color = C.white) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, lw);
  ctx.fillRect(x, y, lw, s);
}

export function line(ctx, x1, y1, x2, y2, lw = 1, color = C.ink, p = 1) {
  if (p <= 0) return;
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.stroke();
}

export function dot(ctx, x, y, r, color = C.ink) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** hex lattice (film's glass panels), drawn in a rect */
export function hexGrid(ctx, x, y, w, h, r = 26, color = "rgba(17,18,20,0.08)", lw = 1) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  const dx = r * Math.sqrt(3), dy = r * 1.5;
  ctx.beginPath();
  for (let j = -1; j * dy < h + r; j++) {
    for (let i = -1; i * dx < w + dx; i++) {
      const cx = x + i * dx + (j % 2 ? dx / 2 : 0), cy = y + j * dy;
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** square grid lines */
export function grid(ctx, x, y, w, h, step, color = "rgba(17,18,20,0.06)", lw = 1, ox = 0, oy = 0) {
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let gx = x + (((ox % step) + step) % step); gx <= x + w; gx += step) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
  for (let gy = y + (((oy % step) + step) % step); gy <= y + h; gy += step) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
  ctx.stroke();
}

/** horizontal progress bar (PROCESSING) */
export function bar(ctx, x, y, w, h, p, o = {}) {
  ctx.strokeStyle = o.frame ?? C.ink; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = o.fill ?? C.ink;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clamp(p)), h - 4);
}

/** monospace data rows: [[label, value], …] */
export function dataRows(ctx, rows, x, y, o = {}) {
  const lh = o.lh ?? 20, size = o.size ?? 12;
  rows.forEach((r, i) => {
    const q = o.p === undefined ? 1 : clamp(o.p * (rows.length + 2) - i);
    if (q <= 0) return;
    text(ctx, r[0], x, y + i * lh, { size, weight: 500, family: F.mono, tracking: 0.6, color: o.labelColor ?? C.mute, alpha: q });
    if (r[1] !== undefined) {
      const v = q < 1 ? decodeParts(String(r[1]), q, o.t ?? 0, i).resolved : String(r[1]);
      text(ctx, v, x + (o.col ?? 120), y + i * lh, { size, weight: 600, family: F.mono, tracking: 0.6, color: o.valueColor ?? C.ink, alpha: q });
    }
  });
}

/** halftone silhouette placeholder with PHOTO CLASSIFIED tag */
export function classifiedPhoto(ctx, x, y, w, h, o = {}) {
  ctx.save();
  ctx.fillStyle = o.bg ?? "#d9d6d0";
  ctx.fillRect(x, y, w, h);
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  // dotted bust silhouette
  const cx = x + w * 0.5, cy = y + h * 0.42;
  const step = Math.max(5, w / 34);
  for (let gy = y; gy < y + h; gy += step) {
    for (let gx = x; gx < x + w; gx += step) {
      const ox = (gx + step / 2 - cx) / w, oy = (gy + step / 2 - cy) / h;
      const head = Math.hypot(ox / 0.2, oy / 0.17) < 1;
      const body = oy > 0.16 && Math.abs(ox) < 0.12 + (oy - 0.16) * 1.6;
      if (head || body) {
        const r = step * 0.36 * (0.75 + 0.25 * hash2(gx, gy));
        ctx.fillStyle = o.ink ?? "#2b2b2d";
        ctx.beginPath(); ctx.arc(gx + step / 2, gy + step / 2, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.strokeStyle = o.frame ?? "rgba(17,18,20,0.35)"; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const tag = "PHOTO CLASSIFIED";
  font(ctx, 11, 700);
  const tw = measure(ctx, tag, 1.5) + 18;
  ctx.fillStyle = C.orange;
  ctx.fillRect(x + w / 2 - tw / 2, y + h * 0.8, tw, 19);
  text(ctx, tag, x + w / 2, y + h * 0.8 + 13.5, { size: 11, weight: 700, tracking: 1.5, color: C.ink, align: "center" });
}

/** rotating permission ring (film 0:20) */
export function ring(ctx, x, y, r, t, o = {}) {
  const col = o.color ?? C.ink;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = col;
  ctx.lineWidth = o.lw ?? 2;
  const p = o.p ?? 1;
  ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2 + t * 0.6, -Math.PI / 2 + t * 0.6 + Math.PI * 2 * 0.86 * p); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.34, Math.PI * 0.15 - t * 1.4, Math.PI * 0.85 - t * 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.34, Math.PI * 1.15 - t * 1.4, Math.PI * 1.85 - t * 1.4); ctx.stroke();
  for (let i = 0; i < 2; i++) {
    const a = t * 0.9 + i * Math.PI;
    dot(ctx, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, 3, o.dots ?? C.orange);
  }
  const a = -Math.PI / 2 + t * 0.6 + Math.PI * 2 * 0.86 * p;
  dot(ctx, Math.cos(a) * r, Math.sin(a) * r, o.head ?? 7, col);
  ctx.restore();
}

/** WARNING plate (film 5:07): orange bracketed bar + triangle + log rows */
export function warningPlate(ctx, x, y, w, p, t, o = {}) {
  const h = 46;
  const q = outCubic(clamp(p * 2.2));
  const bw = w * q;
  const x0 = x + (w - bw) / 2;
  ctx.fillStyle = C.orange;
  ctx.fillRect(x0, y, 9, h);
  ctx.fillRect(x0 + bw - 9, y, 9, h);
  ctx.strokeStyle = C.orange; ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 9, y + 1, Math.max(0, bw - 18), h - 2);
  if (p > 0.25) {
    // triangle
    const tx = x + w / 2, ty = y - 30;
    ctx.lineWidth = 2.4; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(tx, ty - 17); ctx.lineTo(tx + 17, ty + 12); ctx.lineTo(tx - 17, ty + 12); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.fillRect(tx - 1.2, ty - 6, 2.4, 10); ctx.fillRect(tx - 1.2, ty + 6, 2.4, 2.6);
    const s = "WARNING";
    const n = Math.min(s.length, Math.floor((p - 0.25) * 2.4 * (s.length + 1)));
    text(ctx, s.slice(0, n), x + w / 2, y + 33, { size: 30, weight: 500, tracking: 6, color: C.orange, align: "center" });
  }
  const rows = o.rows ?? [];
  rows.forEach((r, i) => {
    const q2 = clamp((p - 0.45) * 3 - i * 0.55);
    if (q2 <= 0) return;
    const yy = y + h + 30 + i * 24;
    const hot = i === rows.length - 1;
    decodeText(ctx, r, x, yy, q2, t, { size: 13, weight: 500, tracking: 2, color: hot ? C.orange : (o.textColor ?? "#e8e6e1"), seed: i + 20 });
    ctx.strokeStyle = hot ? C.orange : (o.textColor ?? "#e8e6e1"); ctx.lineWidth = 1.5;
    ctx.strokeRect(x + w - 12, yy - 10, 10, 10);
    if (hot && Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = C.orange; ctx.fillRect(x + w - 12, yy - 10, 10, 10); }
  });
}

/** label + leader line + dot (film 3:42 SERVICES SECT callouts) */
export function callout(ctx, o) {
  const p = o.p ?? 1, t = o.t ?? 0;
  const col = o.color ?? C.ink;
  // leader from anchor (ax, ay) to elbow (ex, ey) to label underline end
  const pl = clamp(p * 2.2);
  dot(ctx, o.ax, o.ay, 5, col);
  const seg1 = Math.hypot(o.ex - o.ax, o.ey - o.ay), seg2 = Math.abs(o.uw);
  const L = seg1 + seg2, d = pl * L;
  ctx.strokeStyle = col; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(o.ax, o.ay);
  if (d <= seg1) ctx.lineTo(lerp(o.ax, o.ex, d / seg1), lerp(o.ay, o.ey, d / seg1));
  else { ctx.lineTo(o.ex, o.ey); ctx.lineTo(o.ex + Math.sign(o.uw) * (d - seg1), o.ey); }
  ctx.stroke();
  const lx = o.uw > 0 ? o.ex : o.ex + o.uw;
  const q = clamp(p * 2.2 - 0.6);
  if (q > 0) {
    bracket(ctx, lx - 22, o.ey - 92, 34, 7, o.bracketColor ?? C.white);
    chip(ctx, o.chip ?? "SERVICES SECT.", lx, o.ey - 82, { size: 13, w: 152, h: 18, p: outCubic(q) });
    decodeText(ctx, o.title, lx, o.ey - 13 - (o.title2 ? 28 : 0), q * 1.2, t, { size: 29, weight: 700, tracking: -0.3, color: col, seed: o.seed ?? 3 });
    if (o.title2) decodeText(ctx, o.title2, lx, o.ey - 13, q * 1.2 - 0.15, t, { size: 29, weight: 700, tracking: -0.3, color: col, seed: (o.seed ?? 3) + 1 });
    if (o.sub) decodeText(ctx, o.sub, lx, o.ey + 22, clamp(q * 1.3 - 0.3), t, { size: 13, weight: 500, tracking: 0.4, color: col, seed: (o.seed ?? 3) + 5 });
    if (o.sub2) decodeText(ctx, o.sub2, lx, o.ey + 43, clamp(q * 1.3 - 0.4), t, { size: 13, weight: 500, tracking: 0.4, color: col, seed: (o.seed ?? 3) + 6 });
  }
}

/** a mono log column with a lime "live" square on the newest row */
export function log(ctx, rows, x, y, p, t, o = {}) {
  const lh = o.lh ?? 17;
  const n = Math.floor(p * rows.length + 1e-6);
  for (let i = 0; i < Math.min(rows.length, n + 1); i++) {
    const q = i < n ? 1 : (p * rows.length - n);
    const yy = y + i * lh;
    text(ctx, "·", x - 10, yy, { size: 11, family: F.mono, color: o.color ?? C.mute });
    decodeText(ctx, rows[i], x, yy, q, t, { size: o.size ?? 10.5, weight: 500, family: F.mono, tracking: 0.5, color: o.color ?? C.mute, seed: i + 40 });
  }
}

/** the film's left column: rule, lime marker, database chip */
export function leftRail(ctx, o = {}) {
  const col = o.color ?? C.ink;
  const ruleX = o.ruleX ?? 429;
  const p = o.p ?? 1;
  ctx.fillStyle = col;
  ctx.fillRect(ruleX, 0, 2, 1080 * p);
  if (o.marker !== undefined) {
    ctx.fillStyle = o.markerColor ?? C.lime;
    ctx.fillRect(ruleX - 18, o.marker, 38, 22);
  }
}

/**
 * Odometer number (Montserrat Light), right edge at x, baseline y.
 * Each place rolls only while the places below it wrap, like a real counter.
 */
export function odometer(ctx, v, x, y, size, o = {}) {
  font(ctx, size, o.weight ?? 300, o.family ?? F.sans);
  ctx.letterSpacing = "0px";
  const cw = ctx.measureText("0").width * (o.cell ?? 0.98);
  const comma = ctx.measureText(",").width * 0.9;
  const n = Math.max(1, Math.floor(Math.log10(Math.max(1, v))) + 1);
  const lh = size * 1.0;
  let cx = x;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - (n * cw + Math.floor((n - 1) / 3) * comma) - 20, y - size * 0.82, n * cw + Math.floor((n - 1) / 3) * comma + 40, size * 0.9); ctx.clip();
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textBaseline = "alphabetic";
  for (let p = 0; p < n; p++) {
    if (p > 0 && p % 3 === 0) { cx -= comma; ctx.fillText(",", cx, y); }
    cx -= cw;
    const unit = Math.pow(10, p);
    const r = (v / unit) % 10;
    const d0 = Math.floor(r);
    const lower = v % unit;
    const roll = p === 0 ? r - d0 : clamp(lower - (unit - 1));
    for (let k = 0; k < 2; k++) {
      const dd = (d0 + k) % 10;
      const dy = (k - roll) * lh;
      ctx.fillText(String(dd), cx + (cw - ctx.measureText(String(dd)).width) / 2, y + dy);
    }
  }
  ctx.restore();
  return x - cx;
}

/** stepped odometer: rolls each changed digit from a → b with progress r (0..1) */
export function odometerStep(ctx, va, vb, r, x, y, size, o = {}) {
  font(ctx, size, o.weight ?? 300, o.family ?? F.sans);
  ctx.letterSpacing = "0px";
  const cw = ctx.measureText("0").width * (o.cell ?? 0.96);
  const comma = ctx.measureText(",").width * 0.85;
  const sa = String(Math.floor(va)), sb = String(Math.floor(vb));
  const n = Math.max(sa.length, sb.length);
  const A = sa.padStart(n, " "), B = sb.padStart(n, " ");
  const lh = size * 0.95;
  const e = outCubic(clamp(r));
  ctx.save();
  const totalW = n * cw + Math.floor((n - 1) / 3) * comma;
  ctx.beginPath(); ctx.rect(x - totalW - 20, y - size * 0.8, totalW + 40, size * 0.9); ctx.clip();
  ctx.fillStyle = o.color ?? C.ink;
  ctx.textBaseline = "alphabetic";
  let cx = x;
  for (let p = 0; p < n; p++) {
    const i = n - 1 - p;
    if (p > 0 && p % 3 === 0) { cx -= comma; if (B[i] !== " ") ctx.fillText(",", cx, y); }
    cx -= cw;
    const da = A[i], db = B[i];
    const draw = (ch, dy) => { if (ch !== " ") ctx.fillText(ch, cx + (cw - ctx.measureText(ch).width) / 2, y + dy); };
    if (da === db) draw(db, 0);
    else { draw(da, -e * lh); draw(db, (1 - e) * lh); }
  }
  ctx.restore();
  return totalW;
}

/**
 * Personnel name bar (film 1:53): role tag, black name slab, white file card
 * with section code + PERSONAL INFORMATION LOADED, file number.
 * o: {role, name, code, file, p (0..1 reveal), t, scale}
 */
export function nameBar(ctx, x, y, o = {}) {
  const k = o.scale ?? 1, p = o.p ?? 1, t = o.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const q1 = outCubic(clamp(p * 3)), q2 = outCubic(clamp(p * 3 - 0.5)), q3 = clamp(p * 3 - 1.1);
  // role tag
  font(ctx, 20, 600);
  const rw = measure(ctx, o.role ?? "DIRECTOR", 1) + 28;
  ctx.fillStyle = C.slab;
  ctx.fillRect(28, 0, rw * q1, 30);
  if (q1 > 0.6) text(ctx, o.role ?? "DIRECTOR", 42, 22, { size: 20, weight: 600, tracking: 1, color: C.white });
  // name slab
  font(ctx, 50, 600);
  const nw = Math.max(420, measure(ctx, o.name, 2) + 56);
  ctx.fillStyle = C.slab;
  ctx.fillRect(0, 42, nw * q2, 80);
  if (o.redacted) { if (q2 > 0.3) { ctx.fillStyle = C.orange; ctx.fillRect(28, 64, (nw - 56) * clamp((q2 - 0.3) * 2), 36); } }
  else if (q2 > 0.3) decodeText(ctx, o.name, 28, 100, (q2 - 0.3) * 1.6, t, { size: 50, weight: 600, tracking: 2, color: C.white, seed: 30, scrColor: "#77746e" });
  // file card
  if (q3 > 0) {
    ctx.globalAlpha = smooth(q3);
    ctx.fillStyle = C.card;
    ctx.fillRect(0, 122, nw, 96);
    ctx.globalAlpha = 1;
    sectionCode(ctx, o.code ?? "SYS", 26, 186, 50, { color: C.ink, plate: C.card, markColor: C.ink, align: "left" });
    decodeText(ctx, "PERSONAL INFORMATION LOADED", 190, 176, q3 * 1.3, t, { size: 15, weight: 500, tracking: 0.6, color: C.ink, seed: 31 });
    if (q3 > 0.7) { ctx.fillStyle = C.ink; ctx.fillRect(190 + 278, 165, 9, 9); }
    decodeText(ctx, "■ " + (o.file ?? ""), 4, 262, q3 * 1.3 - 0.2, t, { size: 20, weight: 600, family: F.mono, tracking: 2, color: C.ink, seed: 32 });
  }
  ctx.restore();
}

/** CMPT CTRL style identity block: ∞ badge + role + name on paper + rule */
export function identity(ctx, x, y, o = {}) {
  const p = o.p ?? 1, t = o.t ?? 0;
  const q1 = outCubic(clamp(p * 2.5)), q2 = clamp(p * 2.5 - 0.4), q3 = clamp(p * 2.5 - 0.9);
  ctx.fillStyle = C.slab;
  ctx.fillRect(x, y, 112 * q1, 78);
  if (q1 > 0.7) {
    mark(ctx, x + 56, y + 33, 74, { color: C.white });
    text(ctx, "RHINE·LAB", x + 56, y + 66, { size: 6, weight: 700, tracking: 3, color: C.white, align: "center" });
  }
  decodeText(ctx, o.role ?? "", x + 126, y + 18, q2, t, { size: 24, weight: 500, tracking: 1, seed: 33 });
  decodeText(ctx, o.name ?? "", x + 124, y + 68, q2 * 1.1 - 0.1, t, { size: 46, weight: 800, tracking: -0.5, seed: 34 });
  ctx.fillStyle = C.ink;
  ctx.fillRect(x, y + 78, (o.rule ?? 620) * outCubic(q2), 3);
  if (q3 > 0) {
    const w = text(ctx, o.deg ?? "", x + 126, y + 110, { size: 17, weight: 700, tracking: 0.6, alpha: q3 });
    text(ctx, o.field ?? "", x + 126 + w + 7, y + 110, { size: 17, weight: 500, tracking: 0.6, alpha: q3 });
  }
}

/** the film's orange step indicator (top right): 5 nodes, live one ringed */
export function steps(ctx, k, label, o = {}) {
  const y = o.y ?? 58, xr = o.x ?? 1860, gap = 44;
  const col = o.color ?? C.orange;
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  for (let i = 0; i < 5; i++) {
    const x = xr - (4 - i) * gap;
    if (i === k) {
      ctx.strokeStyle = col; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
      if (i > 0) { ctx.beginPath(); ctx.moveTo(x - gap + 6, y); ctx.lineTo(x - 9, y); ctx.stroke(); }
      dot(ctx, x, y, 3.2, col);
    } else dot(ctx, x, y, 4, col);
  }
  if (label) text(ctx, label, xr + 9, y + 32, { size: 11, weight: 600, family: F.mono, tracking: 2.4, color: o.textColor ?? C.ink, align: "right" });
  ctx.restore();
}
