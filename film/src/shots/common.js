// Shared shot helpers: chrome, slams, subtitles, band pulses, cameras.
import * as D from "../lib/draw.js";
import { placeCard } from "../lib/homography.js";
import { BAR, BEAT, at, clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash } from "../lib/util.js";

export { D, placeCard, BAR, BEAT, at };

/** shot factory: s(id, bar, beat, lenBeats, render, opts) */
export function shot(id, start, end, render, o = {}) {
  return { id, start, end, render, samples: o.samples ?? 12, shutter: o.shutter ?? 0.5, cues: o.cues ?? [], tin: o.tin ?? null };
}

/** kick pulses on the ∞ band: one per beat since `from`, origins walking round the band */
export function pulses(t, from = BAR, every = 1, origin = (k) => 0.25 + (k % 4) * 0.25) {
  const out = [];
  const step = BEAT * every;
  const last = Math.floor((t - from) / step);
  for (let k = Math.max(0, last - 15); k <= last; ++k) out.push([from + k * step, origin(k)]);
  return out;
}

const ACTS = [
  [at(1), at(5), 0, "01 · ADD"], [at(5), at(9), 1, "02 · SUBTRACT"], [at(9), at(17), 2, "03 · EQUALS"],
  [at(17), at(23), 3, "04 · INFINITE"], [at(23), at(26), 4, "05 · LOCKDOWN"],
];
/** the film's persistent OS chrome */
export function chrome(f, a, o = {}) {
  return; // owned by the global HUD (src/hud.js)
  const col = o.color ?? D.C.ink;
  if (o.step !== false) {
    const act = ACTS.find(([t0, t1]) => a.t >= t0 && a.t < t1);
    if (act) D.steps(f, act[2], act[3], { textColor: col });
  }
  if (o.header !== false) D.header(f, 60, 112, 1, { p: o.headerP ?? 1, t: a.t, color: col });
  if (o.rail) D.leftRail(f, { marker: o.marker, color: col, p: o.railP ?? 1 });
  if (o.footer !== false) D.footer(f, { color: col, alpha: o.footerA ?? 1 });
}

/** slam-in transform for an fx layer: element rect drawn at its final place */
export function slam(rect, q, o = {}) {
  const e = outExpo(q / (o.len ?? 1));
  const sc = lerp(o.from ?? 5.5, 1, e);
  const rz = (o.rz ?? -18) * (1 - springy(q * (o.spring ?? 1.6), 16, 0.42));
  const cx = rect[0] + rect[2] / 2, cy = rect[1] + rect[3] / 2;
  const { H } = placeCard({ rect, cx: o.cx ?? cx, cy: o.cy ?? cy, scale: sc, rz, rx: (o.rx ?? 0) * (1 - e), ry: (o.ry ?? 0) * (1 - e), persp: 1800 });
  const pinch = (o.pinch ?? -0.55) * Math.pow(1 - e, 1.4);
  return { H, pinch: [cx / 1920, 1 - cy / 1080, pinch, 0.42] };
}

/** subtitle visible over [t0, t1): decodes in, retracts out */
export function sub(f, a, zh, en, t0, t1, o = {}) {
  return; // owned by the global HUD (src/hud.js)
  if (a.t < t0 || a.t >= t1) return;
  const pin = clamp((a.t - t0) / 0.42);
  const out = clamp((t1 - a.t) / 0.16);
  D.subtitle(f, zh, en, { p: pin, t: a.t, alpha: out, color: o.color, enColor: o.enColor, y: o.y });
}

/** camera on a sphere around target: yaw, pitch in degrees */
export function orbit(target, dist, yaw, pitch) {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  return [target[0] + dist * Math.sin(y) * Math.cos(p), target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(y) * Math.cos(p)];
}

export const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** beat-quantised value: steps on each beat with a fast ease into the new value */
export function beatSteps(lt, len = 0.18) {
  const k = Math.floor(lt / BEAT);
  const f = (lt - k * BEAT) / len;
  return k + outCubic(f) - 1 + (f >= 1 ? 0 : 0);
}

/** counter that ticks on landings: value after n landings */
export function landings(lt, every, t0 = 0) {
  return Math.max(0, Math.floor((lt - t0) / every) + 1);
}

/** small mono annotation with a leader line from (x0,y0) to (x1,y1) */
export function leader(f, a, x0, y0, x1, y1, label, p, o = {}) {
  if (p <= 0) return;
  D.dot(f, x0, y0, 4, o.color ?? D.C.ink);
  D.line(f, x0, y0, x1, y1, 1.2, o.color ?? D.C.ink, clamp(p * 1.6));
  if (p > 0.45) {
    const right = x1 >= x0;
    D.line(f, x1, y1, x1 + (right ? 120 : -120), y1, 1.2, o.color ?? D.C.ink, clamp((p - 0.45) * 3));
    D.decodeText(f, label, right ? x1 + 4 : x1 - 4, y1 - 8, (p - 0.5) * 2.2, a.t, { size: o.size ?? 12, weight: 600, tracking: 1.6, color: o.color ?? D.C.ink, align: right ? "left" : "right", seed: o.seed ?? 5 });
  }
}

/** viewfinder ticks in the frame corners */
export function frameTicks(f, o = {}) {
  return; // owned by the global HUD (src/hud.js)
  const col = o.color ?? "rgba(17,18,20,0.55)";
  const m = o.margin ?? 40, L = o.len ?? 22;
  D.corners(f, m, m, 1920 - 2 * m, 1080 - 2 * m, L, 1.5, col);
}

/** a dark-mode (WARNING act) palette helper */
export const DARK = { ink: "#f2f0eb", mute: "#6f6d68", faint: "#2b2b2d" };

export { clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash };

// ───────────── 3D helpers: band scene + projection of band points ─────────────
import * as THREE from "three";
const DEG = Math.PI / 180;
const _cam = new THREE.PerspectiveCamera(30, 16 / 9, 20, 9000);
const _grp = new THREE.Object3D();

/** returns p → [x, y] screen px for a scene state (group-local points) */
export function projector(sc) {
  _cam.fov = sc.cam.fov ?? 30; _cam.aspect = 16 / 9;
  _cam.position.set(...sc.cam.pos); _cam.up.set(0, 1, 0);
  _cam.lookAt(new THREE.Vector3(...sc.cam.target));
  if (sc.cam.roll) _cam.rotateZ(sc.cam.roll * DEG);
  _cam.updateProjectionMatrix(); _cam.updateMatrixWorld();
  _grp.position.set(...(sc.group?.pos ?? [-10, 0, 0]));
  _grp.rotation.order = "YXZ";
  const r = sc.group?.rot ?? [16, 0, -2];
  _grp.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
  _grp.updateMatrixWorld();
  const m = _grp.matrixWorld.clone();
  return (p) => {
    const v = new THREE.Vector3(...p).applyMatrix4(m).project(_cam);
    return [(v.x * 0.5 + 0.5) * 1920, (-v.y * 0.5 + 0.5) * 1080, v.z];
  };
}

export function bandPoint(u, R = 285, A = 0.95, Dp = 95) {
  const t = u * Math.PI * 2;
  return [R * Math.cos(t), R * A * Math.sin(t) * Math.cos(t), Dp * Math.sin(t)];
}

/** default ∞ band scene; o overrides cam/group/fins */
export function bandScene(a, o = {}) {
  const t = a.t;
  return {
    cam: o.cam ?? { pos: [0, 60, 1080], target: [0, 3, 0], fov: 30 },
    dof: o.dof === undefined ? { focus: 1060, range: 520, bokeh: 1.2 } : o.dof,
    group: o.group ?? { pos: [-10, 0, 0], rot: [16 + Math.sin(t * 0.11) * 3, Math.sin(t * 0.07) * 9, -2] },
    key: o.key ?? (o.denied ? 3.2 : undefined), env: o.env ?? (o.denied ? 0.6 : undefined),
    exposure: o.exposure ?? (o.denied ? 1.3 : undefined), sat: o.sat ?? (o.denied ? 0.9 : undefined), denied: o.denied ?? 0,
    shadowBox: o.shadowBox ?? [-620, 620, -520, 520],
    fins: { visible: true, uFormA: 0, uMorph: 0, uFlow: o.flow ?? t * 1.6, uSpin: o.spin ?? t * 0.05, uAssemble: o.assemble ?? 1,
      uDenied: o.denied ?? 0, uVerify: o.verify ?? 0, uAlign: o.align ?? 0, uDisorder: o.disorder ?? 0, uDissolve: o.dissolve ?? 0,
      uTwist: o.twist ?? 1.5, uLean: o.lean ?? 0.62, uLime: o.lime ?? 0.45,
      pulses: o.pulses ?? pulses(t, at(17), 1, (k) => [0.25, 0.75, 0.5, 0.0][k % 4]), ...(o.fins ?? {}) },
  };
}
