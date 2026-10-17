import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { Engine } from "./engine/engine.js";
import { buildTimeline, DURATION, cues } from "./timeline.js";
import { FPS } from "./lib/util.js";
import { hud, hudFade } from "./hud.js";

const FONTS = [
  ["Montserrat", "Montserrat-Light.ttf", 300], ["Montserrat", "Montserrat-Regular.ttf", 400],
  ["Montserrat", "Montserrat-Medium.ttf", 500], ["Montserrat", "Montserrat-SemiBold.ttf", 600],
  ["Montserrat", "Montserrat-Bold.ttf", 700], ["Montserrat", "Montserrat-ExtraBold.ttf", 800],
  ["JetBrains Mono", "JetBrainsMono-Regular.ttf", 400], ["JetBrains Mono", "JetBrainsMono-Medium.ttf", 500],
  ["JetBrains Mono", "JetBrainsMono-SemiBold.ttf", 600], ["JetBrains Mono", "JetBrainsMono-Bold.ttf", 700],
  ["MiSans", "MiSans-Regular.ttf", 400], ["MiSans", "MiSans-Medium.ttf", 500],
  ["MiSans", "MiSans-Semibold.ttf", 600], ["MiSans", "MiSans-Bold.ttf", 700],
];

function img(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function boot() {
  // MiSans is optional (not redistributed): a missing face falls back to a system CJK font
  await Promise.all(FONTS.map(async ([fam, file, w]) => {
    try {
      const f = new FontFace(fam, `url(/fonts/${file})`, { weight: String(w) });
      await f.load();
      document.fonts.add(f);
    } catch { if (fam !== "MiSans") throw new Error(`font missing: ${file}`); console.warn(`optional font missing: ${file}`); }
  }));
  const [smoke, card, hex, hdr] = await Promise.all([
    img("/tex/smoke.jpg"), img("/tex/card.png"), img("/tex/hex.png"),
    new HDRLoader().loadAsync("/tex/studio.hdr"),
  ]);
  const cardTex = new THREE.Texture(card);
  cardTex.colorSpace = THREE.SRGBColorSpace;
  cardTex.anisotropy = 8;
  cardTex.needsUpdate = true;
  const assets = { smoke, card, hex, hdr, cardTex };

  const canvas = document.getElementById("c");
  const timeline = buildTimeline(assets);
  const engine = new Engine(canvas, assets, timeline);
  engine.hud = hud; engine.hudFade = hudFade;
  const q = new URLSearchParams(location.search);
  if (q.has("samples")) engine.samplesOverride = Number(q.get("samples"));
  if (q.has("sampleScale")) engine.sampleScale = Number(q.get("sampleScale"));

  window.film = {
    engine, fps: FPS, duration: DURATION,
    shots: timeline.map((s) => ({ id: s.id, start: s.start, end: s.end })),
    renderTime: (t) => { engine.renderFrame(t); return true; },
    renderFrame: (i) => { engine.renderFrame(i / FPS); return true; },
    read: () => engine.readBase64(),
    setSamples: (n) => { engine.samplesOverride = n; },
    cues: () => cues(),
  };
  // warm-up: compile every shader path once
  engine.renderFrame(0.001);
  window.film.ready = true;

  if (q.has("t")) engine.renderFrame(Number(q.get("t")));
  if (q.has("play")) {
    const t0 = performance.now() - Number(q.get("play") || 0) * 1000;
    const loop = () => { engine.renderFrame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
    loop();
  }
}
boot().catch((e) => { console.error(e); window.film = { error: String(e.stack || e) }; });
