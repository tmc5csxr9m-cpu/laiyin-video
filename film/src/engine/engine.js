// Offline film engine: every output frame is the average of N sub-frames
// spread over the shutter (motion blur) with Halton sub-pixel jitter (AA).
// A shot owns the frame; sub-frames never cross a cut.
import * as THREE from "three";
import { Stage3D } from "./stage3d.js";
import { Compositor, defaultComp } from "./compositor.js";
import { halton, FPS } from "../lib/util.js";

class Layer {
  constructor(W, H) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext("2d", { alpha: true, willReadFrequently: false });
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.premultiplyAlpha = true;
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.used = false;
    this.W = W; this.H = H;
  }
  begin(jx, jy) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.filter = "none";
    c.clearRect(0, 0, this.W, this.H);
    c.setTransform(1, 0, 0, 1, jx, jy);
    c.letterSpacing = "0px";
    this.used = false;
  }
  get() { this.used = true; return this.ctx; }
}

export class Engine {
  constructor(canvas, assets, timeline, W = 1920, H = 1080) {
    this.W = W; this.H = H;
    this.assets = assets;
    this.timeline = timeline;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, premultipliedAlpha: false, depth: true, stencil: false,
      preserveDrawingBuffer: true, powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = true;
    this.stage = new Stage3D(this.renderer, W, H, assets);
    this.comp = new Compositor(this.renderer, W, H);
    this.layers = { back: new Layer(W, H), front: new Layer(W, H), fxA: new Layer(W, H), fxB: new Layer(W, H), hud: new Layer(W, H) };
    this.hud = null; this.hudFade = null;
    this.samplesOverride = null;
    this.pixels = new Uint8Array(W * H * 4);
  }

  shotAt(t) {
    const L = this.timeline;
    for (const s of L) if (t >= s.start && t < s.end) return s;
    return L[L.length - 1];
  }

  /** transition window around a cut: shot B declares tin = {type, dur, pre, ease, dir, p} */
  transitionAt(t) {
    const L = this.timeline;
    for (let i = 1; i < L.length; i++) {
      const B = L[i], tr = B.tin;
      if (!tr) continue;
      const w0 = B.start - tr.dur * (tr.pre ?? 0.5), w1 = w0 + tr.dur;
      if (t >= w0 && t < w1) return { A: L[i - 1], B, w0, w1, tr };
    }
    return null;
  }

  /** render one shot at time ts into a target; returns its comp settings */
  renderShot(shot, ts, target, jx, jy, N) {
    for (const k of ["back", "front", "fxA", "fxB"]) this.layers[k].begin(jx, jy);
    const comp = defaultComp();
    const api = {
      t: ts, lt: ts - shot.start, dur: shot.end - shot.start, p: (ts - shot.start) / (shot.end - shot.start),
      shot, assets: this.assets, W: this.W, H: this.H,
      back: () => this.layers.back.get(), front: () => this.layers.front.get(),
      fxA: () => this.layers.fxA.get(), fxB: () => this.layers.fxB.get(),
      comp, scene: null,
    };
    shot.render(api);
    let src3D = null;
    let paperBase = [0.925, 0.918, 0.902];
    if (api.scene) {
      const sc = api.scene;
      const dark = comp.dark;
      paperBase = sc.paperBase ?? [0.925 + (0.043 - 0.925) * dark, 0.918 + (0.043 - 0.918) * dark, 0.902 + (0.047 - 0.902) * dark];
      sc.paperBase = paperBase;
      src3D = this.stage.render({ ...sc, t: sc.time ?? ts, jitter: N > 1 ? [-jx, -jy] : null });
    }
    const tex = {};
    for (const k of ["back", "front", "fxA", "fxB"]) {
      const L = this.layers[k];
      if (L.used) { L.tex.needsUpdate = true; tex[k] = L.tex; } else tex[k] = null;
    }
    this.comp.composite(target, ts, comp, tex, src3D, paperBase);
    return comp;
  }

  renderFrame(t, fps = FPS) {
    const T = this.transitionAt(t);
    const shot = T ? T.B : this.shotAt(t);
    const base = T ? Math.max(T.A.samples ?? 10, T.B.samples ?? 10) : (shot.samples ?? 10);
    const N = this.samplesOverride ?? Math.round(base * (this.sampleScale ?? 1));
    const shutter = T ? 0.6 : (shot.shutter ?? 0.5);
    this.comp.begin();
    let grain = 0.014;
    for (let s = 0; s < N; s++) {
      const off = N > 1 ? ((s + 0.5) / N - 0.5) * shutter / fps : 0;
      const jx = N > 1 ? halton(s, 2) - 0.5 : 0, jy = N > 1 ? halton(s, 3) - 0.5 : 0;
      let comp, tr = null, ts;
      if (T) {
        ts = Math.min(Math.max(t + off, T.w0), T.w1 - 1e-5);
        // outgoing shot keeps running past its cut; incoming one holds its first frame until it starts
        try { this.renderShot(T.A, ts, this.comp.rtA, jx, jy, N); }
        catch (e) { this.renderShot(T.A, Math.min(ts, T.A.end - 1e-4), this.comp.rtA, jx, jy, N); }
        comp = this.renderShot(T.B, Math.max(ts, T.B.start), this.comp.rtB, jx, jy, N);
        let q = (ts - T.w0) / (T.w1 - T.w0);
        const ease = T.tr.ease ?? "inOut";
        q = ease === "linear" ? q : ease === "out" ? 1 - Math.pow(1 - q, 3) : ease === "in" ? q * q * q
          : (q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2);
        tr = { q, type: T.tr.type, dir: T.tr.dir, p: T.tr.p };
      } else {
        ts = Math.min(Math.max(t + off, shot.start), shot.end - 1e-5);
        comp = this.renderShot(shot, ts, this.comp.rtA, jx, jy, N);
      }
      let hudTex = null;
      if (this.hud) {
        const L = this.layers.hud;
        L.begin(jx, jy);
        this.hud(L.ctx, ts, { assets: this.assets });
        L.tex.needsUpdate = true;
        hudTex = L.tex;
      }
      this.comp.mix(1 / N, ts, tr, hudTex, this.hudFade ? this.hudFade(ts) : 0);
      grain = comp.grain;
    }
    this.comp.resolve(grain, (Math.floor(t * fps) % 97) / 97);
  }

  readPixels() {
    const gl = this.renderer.getContext();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    return this.pixels;
  }

  /** base64 of the RGBA frame (bottom-up rows) */
  readBase64() {
    const px = this.readPixels();
    let s = "";
    const CH = 0x8000;
    for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    return btoa(s);
  }
}
