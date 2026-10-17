// Timing grid, easing, deterministic noise.

export const BPM = 112;
export const BEAT = 60 / BPM;          // 0.535714 s
export const BAR = BEAT * 4;           // 2.142857 s
export const FPS = 30;
/** film time of bar n, beat k (k may be fractional) */
export const at = (n, k = 0) => n * BAR + k * BEAT;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const inCubic = (x) => Math.pow(clamp(x), 3);
export const inOutCubic = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const outQuart = (x) => 1 - Math.pow(1 - clamp(x), 4);
export const outQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
export const inQuart = (x) => Math.pow(clamp(x), 4);
export const outExpo = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const inExpo = (x) => { x = clamp(x); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); };
export const inOutExpo = (x) => {
  x = clamp(x);
  if (x <= 0) return 0; if (x >= 1) return 1;
  return x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
};
export const inOutSine = (x) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;
export const outBack = (x, s = 1.70158) => { x = clamp(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
/** critically damped step response (a follower that starts at rest), ω in 1/s */
export const spring = (t, w = 14) => (t <= 0 ? 0 : 1 - (1 + w * t) * Math.exp(-w * t));
/** under-damped settle: overshoots once, ζ≈0.45 */
export const springy = (t, w = 18, z = 0.45) => {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
};

export function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export const hash2 = (a, b) => hash(a * 157.31 + b * 113.97);
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}

/** Halton (2,3) sub-pixel jitter in [-0.5, 0.5] */
export function halton(i, b) {
  let f = 1, r = 0;
  i += 1;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

/** kick times (film seconds) at or before t, most recent last */
export function kicksBefore(t, from = BAR, count = 16) {
  const out = [];
  const last = Math.floor((t - from) / BEAT);
  for (let k = Math.max(0, last - count + 1); k <= last; ++k) out.push(from + k * BEAT);
  return out;
}

export const fmt = (n, w) => String(Math.floor(n)).padStart(w, "0");
export const commas = (n) => Math.floor(n).toLocaleString("en-US");
