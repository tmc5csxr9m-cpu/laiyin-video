// Deterministic 3D stage: two instanced card meshes (ivory fins, frosted
// files) sharing one formation shader, studio lighting, N8AO + DOF + grade.
// Every frame is a pure function of the state object passed to render().
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import {
  BlendFunction, DepthOfFieldEffect, Effect, EffectAttribute, EffectComposer,
  EffectPass, RenderPass,
} from "postprocessing";
import { N8AOPostPass } from "n8ao";
import {
  cardCarveGlsl, cardEmissiveGlsl, cardSurfaceGlsl, cardUniformsGlsl,
  cardVertexGlsl, common, gradeFragment,
} from "./shaders.js";

const DEG = Math.PI / 180;

class GradeEffect extends Effect {
  constructor() {
    super("RhineGrade", gradeFragment, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ["uAberration", new THREE.Uniform(0.0016)],
        ["uExposure", new THREE.Uniform(1.5)],
        ["uSat", new THREE.Uniform(0.7)],
      ]),
    });
  }
  set(name, v) { this.uniforms.get(name).value = v; }
}

// Khronos PBR Neutral (mirror of the grade) and its inverse: the clear colour
// is chosen so the background lands exactly on the paper after grading.
function neutral(c) {
  const sc = 0.76, desat = 0.15;
  const x = Math.min(...c), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let v = c.map((k) => k - off);
  const peak = Math.max(...v);
  if (peak < sc) return v;
  const d = 1 - sc, np = 1 - (d * d) / (peak + d - sc);
  v = v.map((k) => (k * np) / peak);
  const g = 1 - 1 / (desat * (peak - np) + 1);
  return v.map((k) => k + (np - k) * g);
}
function forward(c, exposure, sat) {
  const t = neutral(c.map((x) => x * exposure));
  const l = 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2];
  return t.map((x) => l + (x - l) * sat);
}
function inverseForward(target, exposure, sat) {
  let x = target.slice();
  for (let i = 0; i < 60; ++i) {
    const y = forward(x, exposure, sat);
    x = x.map((k, j) => Math.max(0, k + (target[j] - y[j]) / exposure));
  }
  return x;
}
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function instanced(base, count) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute("position", base.getAttribute("position"));
  g.setAttribute("normal", base.getAttribute("normal"));
  g.setAttribute("uv", base.getAttribute("uv"));
  const idx = new Float32Array(count);
  for (let i = 0; i < count; ++i) idx[i] = i;
  g.setAttribute("aIndex", new THREE.InstancedBufferAttribute(idx, 1));
  g.instanceCount = count;
  return g;
}

function cardUniforms(count, cardTex) {
  return {
    uTime: { value: 0 }, uFlow: { value: 0 }, uCount: { value: count },
    uRadius: { value: 285 }, uAspect: { value: 0.95 }, uDepth: { value: 95 }, uTwist: { value: 1.5 },
    uSpin: { value: 0 }, uThickness: { value: 4.2 }, uLean: { value: 0.62 }, uCorner: { value: 0.14 },
    uWidth: { value: 84 }, uHeight: { value: 84 }, uAssemble: { value: 1 }, uVerify: { value: 0 },
    uDenied: { value: 0 }, uAlign: { value: 0 }, uDisorder: { value: 0 }, uDissolve: { value: 0 },
    uFormA: { value: 0 }, uFormB: { value: 0 }, uMorph: { value: 0 }, uMorphSpread: { value: 1.2 },
    uRows: { value: 8 }, uRowGap: { value: 130 }, uColGap: { value: 15 }, uRowFlow: { value: 0 },
    uRowWave: { value: 0 }, uRowWaveT: { value: 0 },
    uWallCols: { value: 20 }, uWallGap: { value: 92 }, uPeelX: { value: 0 }, uPeelY: { value: 0 },
    uHelixR: { value: 150 }, uHelixLen: { value: 900 }, uHelixTurns: { value: 2.2 },
    uStack: { value: 0 }, uStackGap: { value: 5.4 },
    uSelect: { value: -10 }, uSelectGlow: { value: 0 }, uTex: { value: 0 }, uLime: { value: 1 },
    uBody: { value: new THREE.Vector3(0.94, 0.86, 0.80) },
    uPulseT: { value: new Float32Array(16).fill(-99) },
    uPulseO: { value: new Float32Array(16).fill(0.25) },
    uCardTex: { value: cardTex },
  };
}

function cardMesh(count, U) {
  const mat = new THREE.MeshStandardMaterial({ metalness: 0, roughness: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${common}\n${cardUniformsGlsl}\n${cardVertexGlsl}`)
      .replace("#include <beginnormal_vertex>",
        `vec3 rlPos; vec3 rlNrm; rl_cardTransform(position, normal, rlPos, rlNrm);\nvec3 objectNormal = rlNrm;`)
      .replace("#include <begin_vertex>", "vec3 transformed = rlPos;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${common}\n${cardUniformsGlsl}\nuniform sampler2D uCardTex;`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${cardCarveGlsl}\n${cardSurfaceGlsl}`)
      .replace("#include <color_fragment>", "diffuseColor.rgb = rlBody;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(0.55, 0.36, bevel);")
      .replace("#include <emissivemap_fragment>", cardEmissiveGlsl);
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${common}\n${cardUniformsGlsl}\n${cardVertexGlsl}`)
      .replace("#include <begin_vertex>",
        `vec3 rlPos; vec3 rlNrm; rl_cardTransform(position, normal, rlPos, rlNrm);\nvec3 transformed = rlPos;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${cardUniformsGlsl}`)
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n${cardCarveGlsl}`);
  };
  const m = new THREE.Mesh(instanced(new THREE.BoxGeometry(1, 1, 1), count), mat);
  m.customDepthMaterial = depth;
  m.frustumCulled = false;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export const FIN_COUNT = 400;
export const FILE_COUNT = 480;

export class Stage3D {
  constructor(renderer, W, H, assets) {
    this.renderer = renderer;
    this.W = W; this.H = H;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, W / H, 20, 9000);
    this.camera.rotation.order = "YXZ";

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // key + fill (same rig as the lock screen)
    this.key = new THREE.DirectionalLight(0xfff6ea, 3.4);
    this.key.position.set(-0.379, 0.788, 0.485).multiplyScalar(1600);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(4096, 4096);
    const sc = this.key.shadow.camera;
    sc.left = -620; sc.right = 620; sc.top = 520; sc.bottom = -520; sc.near = 300; sc.far = 3600;
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.6;
    this.key.shadow.radius = 5;
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
    this.fill.position.set(0.853, 0.174, -0.4925).multiplyScalar(1200);
    this.scene.add(this.key, this.key.target, this.fill, this.fill.target);

    const pmrem = new THREE.PMREMGenerator(renderer);
    assets.hdr.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment = pmrem.fromEquirectangular(assets.hdr).texture;
    this.scene.environmentIntensity = 0.8;
    this.scene.environmentRotation.set(0, -25 * DEG, 0);
    pmrem.dispose();

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.finU = cardUniforms(FIN_COUNT, assets.cardTex);
    this.fins = cardMesh(FIN_COUNT, this.finU);
    this.group.add(this.fins);

    this.fileGroup = new THREE.Group();
    this.scene.add(this.fileGroup);
    this.fileU = cardUniforms(FILE_COUNT, assets.cardTex);
    Object.assign(this.fileU, {});
    this.fileU.uBody.value.set(0.95, 0.948, 0.94);
    this.fileU.uTex.value = 1;
    this.fileU.uWidth.value = 104; this.fileU.uHeight.value = 75; this.fileU.uThickness.value = 3.2;
    this.fileU.uCorner.value = 0.06;
    this.files = cardMesh(FILE_COUNT, this.fileU);
    this.fileGroup.add(this.files);

    // ── post ──
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.autoRenderToScreen = false;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new N8AOPostPass(this.scene, this.camera, W, H);
    this.ao.configuration.aoRadius = 26;
    this.ao.configuration.distanceFalloff = 1.2;
    this.ao.configuration.intensity = 2.6;
    this.ao.configuration.gammaCorrection = false;
    this.ao.configuration.screenSpaceRadius = false;
    this.ao.configuration.accumulate = false;
    this.ao.setQualityMode("High");
    this.composer.addPass(this.ao);
    this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 1060, focusRange: 520, bokehScale: 1.2, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(this.camera, this.dof);
    this.composer.addPass(this.dofPass);
    this.grade = new GradeEffect();
    this.composer.addPass(new EffectPass(this.camera, this.grade));
    this.composer.setSize(W, H);

    this.paperBase = [0.925, 0.918, 0.902];
    this._lastClear = "";
  }

  get output() { return (this.lastTarget ?? this.composer.inputBuffer).texture; }

  /** paper: display-space colour the background must land on after grading */
  setPaper(base, exposure, sat) {
    const key = base.join(",") + exposure + sat;
    if (key === this._lastClear) return;
    this._lastClear = key;
    const clear = inverseForward(base.map(srgbToLin), exposure, sat);
    this.clearColor = new THREE.Color().setRGB(clear[0], clear[1], clear[2], THREE.LinearSRGBColorSpace);
  }

  /**
   * s: {
   *   t, cam: {pos:[x,y,z], target:[x,y,z], fov, roll}, jitter:[x,y] (px),
   *   dof: {focus, range, bokeh} | null, exposure, sat, key, env, denied,
   *   group: {pos, rot:[x,y,z] deg}, fins: {...uniforms, visible}, files: {...}
   * }
   */
  render(s) {
    if (window.__patch) {
      const P = window.__patch;
      s = { ...s, ...P, fins: { ...s.fins, ...(P.fins ?? {}) } };
    }
    const cam = this.camera;
    cam.fov = s.cam.fov ?? 30;
    cam.aspect = this.W / this.H;
    cam.near = s.cam.near ?? 20;
    cam.far = s.cam.far ?? 9000;
    cam.position.set(...s.cam.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(new THREE.Vector3(...s.cam.target));
    if (s.cam.roll) cam.rotateZ(s.cam.roll * DEG);
    cam.updateProjectionMatrix();
    if (s.jitter) cam.setViewOffset(this.W, this.H, s.jitter[0], s.jitter[1], this.W, this.H);
    else cam.clearViewOffset();
    cam.updateMatrixWorld();

    const applyU = (U, o) => {
      if (!o) return;
      for (const k in o) {
        if (k === "visible" || k === "pulses") continue;
        if (!(k in U)) { console.warn("unknown uniform", k); continue; }
        const v = o[k];
        if (Array.isArray(v)) U[k].value.set(...v); else U[k].value = v;
      }
      if (o.pulses) {
        const T = U.uPulseT.value, O = U.uPulseO.value;
        T.fill(-99);
        o.pulses.slice(-16).forEach((p, i) => { T[i] = p[0]; O[i] = p[1]; });
      }
    };
    this.fins.visible = s.fins?.visible ?? false;
    this.files.visible = s.files?.visible ?? false;
    this.finU.uTime.value = s.t;
    this.fileU.uTime.value = s.t;
    applyU(this.finU, s.fins);
    applyU(this.fileU, s.files);

    const g = s.group ?? {};
    this.group.position.set(...(g.pos ?? [-10, 0, 0]));
    this.group.rotation.order = "YXZ";
    const r = g.rot ?? [16, 0, -2];
    this.group.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
    const fg = s.fileGroup ?? {};
    this.fileGroup.position.set(...(fg.pos ?? [0, 0, 0]));
    this.fileGroup.rotation.order = "YXZ";
    const fr = fg.rot ?? [0, 0, 0];
    this.fileGroup.rotation.set(fr[0] * DEG, fr[1] * DEG, fr[2] * DEG);

    const denied = s.denied ?? 0;
    this.key.intensity = (s.key ?? 2.3) * (1 - denied * 0.35);
    this.fill.intensity = (s.fill ?? 0.55);
    this.scene.environmentIntensity = (s.env ?? 1.05) * (1 - denied * 0.72);
    if (s.shadowBox) {
      const sc = this.key.shadow.camera;
      [sc.left, sc.right, sc.bottom, sc.top] = s.shadowBox;
      sc.updateProjectionMatrix();
    }
    if (s.keyDir) this.key.position.set(...s.keyDir).normalize().multiplyScalar(1600);

    const exposure = s.exposure ?? 1.95, sat = s.sat ?? 1.0;
    this.grade.set("uExposure", exposure);
    this.grade.set("uSat", sat);
    this.grade.set("uAberration", s.aberration ?? 0.0016);
    this.setPaper(s.paperBase ?? this.paperBase, exposure, sat);

    if (s.dof) {
      this.dofPass.enabled = true;
      this.dof.cocMaterial.focusDistance = s.dof.focus;
      this.dof.cocMaterial.focusRange = s.dof.range;
      this.dof.bokehScale = s.dof.bokeh ?? 1.2;
    } else this.dofPass.enabled = false;
    this.ao.configuration.intensity = s.ao ?? 2.6;

    this.renderer.setClearColor(this.clearColor, 0);
    this.composer.render(1 / 60);
    // the last pass leaves its output target bound (buffer parity is not
    // reliable once N8AO is in the chain)
    this.lastTarget = this.renderer.getRenderTarget();
    return this.lastTarget.texture;
  }
}
