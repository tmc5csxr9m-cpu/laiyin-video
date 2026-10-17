// ACT IV — lockdown → public channel → end card   (film bars 25–28 + tail)
import {
  D, BAR, BEAT, at, shot, chrome, slam, sub, pulses, orbit, frameTicks, projector, bandPoint, bandScene, lerp3,
  clamp, inv, lerp, outExpo, outCubic, springy, smooth, hash, placeCard,
} from "./common.js";
import { inExpo, inCubic, inOutCubic, outQuart, outBack, inOutSine } from "../lib/util.js";

import { TR } from "./act1.js";
import { warning } from "./act3.js";

const C = D.C;
const INK_D = "#f2f0eb";
export const END = at(28) + 2.5;

const s25 = shot("lockdown", at(25), at(26), (a) => {
  a.comp.dark = 1;
  a.comp.vignette = 0.57;
  a.comp.grain = 0.028;
  const q = a.lt / a.dur;
  const e = inOutCubic(a.lt / 1.2);
  const sc = bandScene(a, {
    denied: 1, disorder: 0.06 * (1 - q * 0.5),
    cam: { pos: lerp3([0, 60, 1300], orbit([0, 0, 0], 1150 - q * 80, lerp(-25, -10, q), 8), e), target: lerp3([0, 3, 0], [0, 0, 0], e), fov: 30 },
    group: { pos: [lerp(-10, 0, e), 0, 0], rot: [16, Math.sin(a.t * 0.07) * 9 + (a.t - at(25)) * 6, -2] },
    exposure: lerp(0.7, 1.3, smooth(a.lt / 0.6)),
    pulses: pulses(a.t, at(25), 1, (k) => (k * 0.25) % 1),
  });
  a.scene = sc;
  const f = a.front();
  const ov = 1 - smooth(a.lt / 0.5);
  if (ov > 0) { f.fillStyle = `rgba(5,5,6,${(0.55 * ov).toFixed(3)})`; f.fillRect(0, 0, 1920, 1080); }
  const wo = smooth(a.lt / 0.3);
  if (wo < 1) { f.save(); f.globalAlpha = 1 - wo; f.translate(0, -50 * wo); warning(a, f, at(24) + 0.06); f.restore(); }
  chrome(f, a, { color: INK_D });
  // left: section lock caption (film rail)
  f.fillStyle = INK_D; f.fillRect(0, 951, 46, 14);
  D.decodeText(f, "DEFENSE SECTION · LOCKDOWN", 73, 965, a.lt / 0.5, a.t, { size: 19, weight: 600, tracking: 1.5, color: INK_D, seed: 150 });
  // centre: returning bar
  const pr = clamp((a.lt - 0.3) / 1.6);
  D.decodeText(f, "RETURNING TO PUBLIC CHANNEL", 960, 520, (a.lt - 0.1) / 0.4, a.t, { size: 14, weight: 600, tracking: 4, color: INK_D, align: "center", seed: 151 });
  D.bar(f, 810, 540, 300, 10, Math.floor(pr * 20) / 20, { frame: INK_D, fill: C.orange });
  sub(f, a, "正在返回公共频道……", "RETURNING TO PUBLIC CHANNEL.", at(25) + 0.1, at(26) - 0.02, { color: INK_D, enColor: "#6f6d68" });
  a.comp.glitch = 0.4 * smooth((a.lt - BEAT * 3.4) / (BEAT * 0.6));
}, { samples: 10, cues: [[at(25), "process", 0.6], [at(25, 3.4), "glitch1", 0.7]] });

const s26 = shot("recover", at(26), at(27), (a) => {
  const q = a.lt / a.dur;
  const d = smooth((a.lt - BEAT * 1.0) / (BEAT * 3.2));
  const sc = bandScene(a, {
    dissolve: d,
    cam: { pos: [0, 60 - q * 20, 1180 - q * 260], target: [0, 3, 0], fov: 30 },
    dof: { focus: 1100 - q * 200, range: 600, bokeh: 1.2 },
    pulses: pulses(a.t, at(26), 1),
  });
  a.scene = sc;
  // recovery burst (smaller, 260 ms)
  a.comp.glitch = 0.45 * clamp(1 - a.lt / 0.26);
  const f = a.front();
  chrome(f, a, { headerP: 1 });
  sub(f, a, "莱茵生命，", "RHINE LAB —", at(26) + 0.35, at(27) - 0.02);
}, { samples: 12, shutter: 0.6, tin: TR.glitch(0.22), cues: [[at(26), "recover", 0.9], [at(26, 1), "peel", 0.9]] });

const MC = [960, 470], MW = 560;
const s27 = shot("markdraw", at(27), at(28), (a) => {
  // the last cards fly past; the mark draws itself on the paper behind them
  const d = lerp(0.9946, 1.35, smooth(a.lt / (BEAT * 1.6)));
  const sc = bandScene(a, {
    dissolve: d,
    cam: { pos: [0, 40, 920 - a.lt * 120], target: [0, 3, 0], fov: 30 },
    dof: { focus: 900, range: 500, bokeh: 1.2 },
    pulses: [],
  });
  a.scene = sc;
  const b = a.back();
  const p = inOutCubic((a.lt - 0.15) / (BEAT * 2.6));
  D.mark(b, MC[0], MC[1], MW, { draw: p });
  const cq = (a.t - at(27, 2.6)) / 0.4;
  D.decodeText(b, "RHINE·LAB", MC[0], MC[1] + 180, cq, a.t, { size: MW * 0.062, weight: 700, tracking: MW * 0.062, align: "center", seed: 160 });
  const f = a.front();
  chrome(f, a, { header: false });
  sub(f, a, "为生命，减去边界。", "SUBTRACTING THE LIMITS OF LIFE.", at(27) + 0.05, at(28) - 0.05);
}, { samples: 12, cues: [[at(27), "draw_long", 0.9]] });

const s28 = shot("endcard", at(28), END, (a) => {
  const lt = a.lt;
  const f = a.fxA();
  const pop = 1;
  f.save(); f.translate(MC[0], MC[1]); f.scale(pop, pop); f.translate(-MC[0], -MC[1]);
  D.mark(f, MC[0], MC[1], MW);
  D.markCaption(f, MC[0], MC[1] + 180, MW);
  f.restore();
  const fr = a.front();
  const out = smooth((lt - 2.0) / 0.25);           // retract everything but the mark
  const r = (lt - 0.12) / 0.5;
  fr.save();
  fr.translate(0, out * 30);
  fr.globalAlpha = 1 - out;
  D.decodeCJK(fr, "莱茵生命", MC[0], MC[1] + 270, r, a.t, { size: 40, weight: 700, tracking: 22 });
  // + − = ∞ signature
  const sig = [["+", "KNOWLEDGE"], ["−", "LIMITS"], ["=", "INFINITE"]];
  sig.forEach(([g, w], i) => {
    const x = MC[0] - 330 + i * 330;
    const qi = (lt - 0.3 - i * 0.12) / 0.3;
    D.decodeText(fr, `${g}  ${w}`, x, MC[1] + 336, qi, a.t, { size: 14, weight: 600, family: D.F.mono, tracking: 5, align: "center", seed: 170 + i });
  });
  fr.restore();
  chrome(fr, a, { header: false, footerA: 1 - out });
  // final: lime cursor blinks once, then black
  
  a.comp.fade = smooth((lt - 2.25) / 0.2);
}, { samples: 10, cues: [[at(28), "final", 1.0]] });

export const act4 = [s25, s26, s27, s28];
