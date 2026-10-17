// Per-subframe compositor + accumulation + resolve.
//
//   paper (procedural, light ⇄ dark)  ← back layer (2D, behind the sculpture)
//   3D (graded, coverage in alpha)    ← fxA / fxB (2D cards with homography + pinch)
//   front layer (2D)                  ← whole-frame fx (glitch, tear, flash, iris…)
//
// Each subframe is converted to linear light and added into a float target
// with weight 1/N; the resolve pass encodes to sRGB and adds grain.
import * as THREE from "three";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const compositeFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc3D, uBack, uFront, uFxA, uFxB;
uniform float uUse3D, uUseBack, uUseFront, uUseFxA, uUseFxB;
uniform mat3 uFxAH, uFxBH;           // output uv → layer uv
uniform vec4 uFxAPinch, uFxBPinch;   // cx, cy (uv), amount, radius
uniform float uFxAZoomBlur, uFxBZoomBlur;
uniform float uWeight, uTime, uDark, uVignette;
uniform vec3 uPaperBase;
uniform vec2 uRes;
uniform float uGlitch, uTick, uTear, uTearY, uSplit;
uniform mat3 uFrame;                 // whole-frame transform (punch-in, shake)
uniform vec4 uFlash;                 // rgb (display), amount
uniform float uInvert;
uniform vec4 uIris;                  // cx, cy (px), radius (px), feather (px); radius<0 = off
uniform float uIrisDark;
uniform float uFade;                 // 1 = black
uniform float uWatermark;

float g_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float g_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(g_hash(i), g_hash(i + vec2(1, 0)), u.x), mix(g_hash(i + vec2(0, 1)), g_hash(i + vec2(1, 1)), u.x), u.y);
}
float g_fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; ++i) { v += a * g_noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
}
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }

vec3 paper(vec2 uv) {
    float aspect = uRes.x / uRes.y;
    vec2 p = (uv - vec2(0.45, 0.47)) * vec2(aspect, 1.0);
    float rr = length(p * vec2(0.82, 1.0));
    vec3 light = mix(vec3(0.925, 0.918, 0.902), vec3(0.842, 0.826, 0.800), smoothstep(0.18, 1.3, rr));
    vec2 q = p - vec2(0.62, -0.52);
    light += vec3(0.030, 0.028, 0.024) * exp(-dot(q, q) * 2.6);
    light += (g_fbm(uv * vec2(7.0, 4.0) + uTime * 0.004) - 0.5) * 0.016;
    vec3 dark = mix(vec3(0.043, 0.043, 0.047), vec3(0.008, 0.008, 0.010), smoothstep(0.15, 1.15, rr));
    dark += (g_fbm(uv * vec2(3.0, 2.0) - uTime * 0.02) - 0.5) * 0.02;
    return mix(light, dark, uDark);
}

vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

vec4 sampleFx(sampler2D tex, mat3 H, vec4 pinch, float zb, vec2 uv) {
    vec3 h = H * vec3(uv, 1.0);
    vec2 luv = h.xy / h.z;
    if (h.z <= 0.0) return vec4(0.0);
    // pinch: a squash toward the centre that grows with distance (the film's
    // star-shaped warp on section tiles slamming in)
    if (pinch.z != 0.0) {
        vec2 d = (luv - pinch.xy) * vec2(uRes.x / uRes.y, 1.0);
        float r = length(d);
        float ang = atan(d.y, d.x);
        float star = 0.35 + 0.65 * pow(abs(sin(2.0 * ang)), 2.0);
        float k = 1.0 + pinch.z * pow(r / pinch.w, 2.0) * star;
        luv = pinch.xy + (luv - pinch.xy) * k;
    }
    if (luv.x < 0.0 || luv.y < 0.0 || luv.x > 1.0 || luv.y > 1.0) return vec4(0.0);
    if (zb > 0.0) {
        vec4 acc = vec4(0.0);
        vec2 c = pinch.xy;
        for (int i = 0; i < 12; ++i) {
            float f = 1.0 - zb * float(i) / 11.0;
            acc += texture2D(tex, c + (luv - c) * f);
        }
        return acc / 12.0;
    }
    return texture2D(tex, luv);
}

vec4 layers(vec2 uv) {
    vec3 pap = paper(uv);
    vec4 col = vec4(pap, 1.0);
    if (uUseBack > 0.5) col = over(texture2D(uBack, uv), col);
    if (uUse3D > 0.5) {
        vec4 s = texture2D(uSrc3D, uv);
        // s.rgb already contains the flat paper base where uncovered; swap in the
        // real background (paper variation + back layer) by coverage
        col.rgb = s.rgb + (col.rgb - uPaperBase) * (1.0 - s.a);
    }
    if (uUseFxA > 0.5) col = over(sampleFx(uFxA, uFxAH, uFxAPinch, uFxAZoomBlur, uv), col);
    if (uUseFxB > 0.5) col = over(sampleFx(uFxB, uFxBH, uFxBPinch, uFxBZoomBlur, uv), col);
    if (uUseFront > 0.5) col = over(texture2D(uFront, uv), col);
    return col;
}

void main() {
    vec3 fu = uFrame * vec3(vUv, 1.0);
    vec2 uv = fu.xy;
    float g = clamp(uGlitch, 0.0, 1.0);
    float tick = uTick;
    if (g > 0.001) {
        float band = floor(uv.y * 46.0);
        float on = step(1.0 - g * 0.55, g_hash(vec2(band, tick)));
        uv.x += (g_hash(vec2(band * 1.7, tick + 3.0)) - 0.5) * 0.11 * g * on;
        float br = floor(uv.y * 12.0), bc = floor(uv.x * 9.0);
        float block = step(1.0 - g * 0.18, g_hash(vec2(br + bc * 13.0, tick)));
        uv += (vec2(g_hash(vec2(bc, tick)), g_hash(vec2(br, tick))) - 0.5) * 0.04 * block;
    }
    // slit-scan tear: rows smear horizontally out of a band (film 5:05)
    if (uTear > 0.001) {
        float dy = abs(uv.y - uTearY);
        float row = floor(uv.y * uRes.y / 3.0);
        float stretch = uTear * (0.6 + 0.4 * g_hash(vec2(row, floor(uTime * 30.0))));
        uv.x = mix(uv.x, 0.5 + (uv.x - 0.5) * 0.04, stretch * smoothstep(0.5, 0.0, dy));
        uv.y = mix(uv.y, uTearY + (uv.y - uTearY) * (1.0 - uTear * 0.85), uTear);
    }
    float ca = uSplit + g * 0.012;
    vec4 c;
    if (ca > 0.0001) {
        vec2 d = (uv - 0.5);
        vec4 r = layers(uv + vec2(ca, 0.0) + d * ca);
        vec4 m = layers(uv);
        vec4 b = layers(uv - vec2(ca, 0.0) - d * ca);
        c = vec4(r.r, m.g, b.b, 1.0);
    } else c = layers(uv);
    vec3 col = c.rgb;

    if (g > 0.001) {
        float scan = step(0.5, fract(vUv.y * uRes.y * 0.5));
        col *= 1.0 - g * 0.18 * scan;
        col += g * 0.06 * (g_hash(vec2(floor(vUv.y * uRes.y), tick)) - 0.5);
    }
    col = mix(col, 1.0 - col, uInvert);
    if (uIris.z >= 0.0) {
        float d = length(vUv * uRes - uIris.xy);
        float m = smoothstep(uIris.z + uIris.w, uIris.z, d);
        col = mix(vec3(uIrisDark), col, m);
    }
    vec2 dv = vUv - 0.5;
    float v = smoothstep(1.05, 0.28, length(dv * vec2(1.0, 0.9)));
    col *= mix(1.0, v, uVignette);
    col = mix(col, uFlash.rgb, uFlash.a);
    col *= 1.0 - uFade;
    gl_FragColor = vec4(toLin(clamp(col, 0.0, 1.0)) * uWeight, uWeight);
}
`;

const mixFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB, uHud;
uniform float uUseB, uUseHud, uQ, uType, uWeight, uTime, uFade;
uniform vec2 uDir, uRes;
uniform vec4 uP;
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 A(vec2 uv) { return texture2D(uA, clamp(uv, 0.0, 1.0)).rgb; }
vec3 B(vec2 uv) { return texture2D(uB, clamp(uv, 0.0, 1.0)).rgb; }
bool inside(vec2 uv) { return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0; }
void main() {
    vec2 uv = vUv;
    vec3 ink = toLin(vec3(0.067, 0.071, 0.078));
    vec3 col;
    float q = clamp(uQ, 0.0, 1.0);
    int T = int(uType + 0.5);
    if (uUseB < 0.5) col = A(uv);
    else if (T == 1) {                       // black slab sweeps along uDir; B behind it
        vec2 d = normalize(uDir);
        float s = dot(uv - 0.5, d) / (abs(d.x) * 0.5 + abs(d.y) * 0.5) * 0.5 + 0.5;
        float w = uP.x;
        float e = q * (1.0 + 2.0 * w) - w;
        col = s < e - w * 0.5 ? B(uv) : (s > e + w * 0.5 ? A(uv) : ink);
    } else if (T == 2) {                     // push: both frames travel along -uDir
        vec2 ua = uv + uDir * q, ub = uv + uDir * (q - 1.0);
        col = inside(ua) ? A(ua) : B(ub);
    } else if (T == 3) {                     // staggered blinds, each strip wiped by a slab edge
        float N = uP.y;
        float i = floor((1.0 - uv.y) * N);
        float l = clamp(q * uP.z - i / N * (uP.z - 1.0), 0.0, 1.0);
        l = l * l * (3.0 - 2.0 * l);
        float s = uDir.x >= 0.0 ? uv.x : 1.0 - uv.x;
        float e = l * 1.08 - 0.04;
        col = s < e - 0.035 ? B(uv) : (s < e ? ink : A(uv));
    } else if (T == 4) {                     // the mark's plus opens and B shows through it
        vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float sz = q * q * 1.9, th = sz * 0.34;
        bool inP = (abs(p.x) < sz && abs(p.y) < th) || (abs(p.y) < sz && abs(p.x) < th);
        col = inP ? B(uv) : A(uv);
    } else if (T == 5) {                     // zoom-through: A flies past the camera, B settles in
        float za = mix(1.0, uP.x, q * q);
        float zb = mix(uP.y, 1.0, 1.0 - (1.0 - q) * (1.0 - q));
        vec3 a = A((uv - 0.5) / za + 0.5);
        vec3 b = B((uv - 0.5) / zb + 0.5);
        col = mix(a, b, smoothstep(0.15, 0.85, q));
    } else if (T == 6) {                     // digital tear between frames (alarms)
        float tick = floor(uTime * 30.0);
        vec2 cell = floor(uv * vec2(16.0, 9.0));
        float row = floor(uv.y * 54.0);
        float amp = sin(q * 3.14159);
        vec2 u2 = uv + vec2((h21(vec2(row, tick)) - 0.5) * 0.09 * amp * step(0.6, h21(vec2(row * 3.1, tick))), 0.0);
        bool useB = h21(cell + tick * 0.37) < q;
        float ca = 0.007 * amp;
        col = useB ? vec3(B(u2 + vec2(ca, 0.0)).r, B(u2).g, B(u2 - vec2(ca, 0.0)).b)
                   : vec3(A(u2 + vec2(ca, 0.0)).r, A(u2).g, A(u2 - vec2(ca, 0.0)).b);
    } else if (T == 7) {                     // B opens from a horizontal centre seam
        float d = abs(uv.y - 0.5);
        float e = q * 0.56;
        col = d < e - 0.004 ? B(uv) : (d < e ? ink : A(uv));
    } else col = mix(A(uv), B(uv), q);       // 8: dissolve
    vec3 disp = toSrgb(col);
    if (uUseHud > 0.5) { vec4 h = texture2D(uHud, uv); disp = h.rgb + disp * (1.0 - h.a); }
    disp *= 1.0 - uFade;
    gl_FragColor = vec4(toLin(clamp(disp, 0.0, 1.0)) * uWeight, uWeight);
}
`;

const resolveFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uAccum;
uniform vec2 uRes;
uniform float uGrain, uSeed;
float g_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
    vec4 a = texture2D(uAccum, vUv);
    vec3 col = toSrgb(max(a.rgb / max(a.a, 1e-5), 0.0));
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float amt = uGrain * mix(2.0, 1.0, smoothstep(0.1, 0.6, l));
    float n = g_hash(vUv * uRes + uSeed * 1000.0) + g_hash(vUv * uRes * 1.37 + uSeed * 517.0) - 1.0;
    col += n * amt;
    // ordered dither against 8-bit banding on the paper falloff
    col += (g_hash(vUv * uRes + 0.5) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function defaultComp() {
  return {
    dark: 0, vignette: 0.32, glitch: 0, tear: 0, tearY: 0.5, split: 0,
    frame: null,         // {zoom, x, y, rot} applied around centre
    flash: [1, 1, 1, 0], invert: 0, iris: null, irisDark: 0, fade: 0,
    fxA: null, fxB: null, // {H: mat3 (uv→uv), pinch:[cx,cy,amt,rad], zoomBlur}
    grain: 0.014,
  };
}

export class Compositor {
  constructor(renderer, W, H) {
    this.renderer = renderer;
    this.W = W; this.H = H;
    this.accum = new THREE.WebGLRenderTarget(W, H, {
      type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    });
    const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    black.needsUpdate = true;
    this.black = black;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: compositeFrag,
      uniforms: {
        uSrc3D: { value: black }, uBack: { value: black }, uFront: { value: black },
        uFxA: { value: black }, uFxB: { value: black },
        uUse3D: { value: 0 }, uUseBack: { value: 0 }, uUseFront: { value: 0 }, uUseFxA: { value: 0 }, uUseFxB: { value: 0 },
        uFxAH: { value: new THREE.Matrix3() }, uFxBH: { value: new THREE.Matrix3() },
        uFxAPinch: { value: new THREE.Vector4() }, uFxBPinch: { value: new THREE.Vector4() },
        uFxAZoomBlur: { value: 0 }, uFxBZoomBlur: { value: 0 },
        uWeight: { value: 1 }, uTime: { value: 0 }, uDark: { value: 0 }, uVignette: { value: 0.32 },
        uPaperBase: { value: new THREE.Vector3(0.925, 0.918, 0.902) },
        uRes: { value: new THREE.Vector2(W, H) },
        uGlitch: { value: 0 }, uTick: { value: 0 }, uTear: { value: 0 }, uTearY: { value: 0.5 }, uSplit: { value: 0 },
        uFrame: { value: new THREE.Matrix3() },
        uFlash: { value: new THREE.Vector4() }, uInvert: { value: 0 },
        uIris: { value: new THREE.Vector4(0, 0, -1, 1) }, uIrisDark: { value: 0 },
        uFade: { value: 0 }, uWatermark: { value: 0 },
      },
      blending: THREE.NoBlending,
      depthTest: false, depthWrite: false,
    });
    const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtA = new THREE.WebGLRenderTarget(W, H, rtOpts);
    this.rtB = new THREE.WebGLRenderTarget(W, H, rtOpts);
    this.mixMat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: mixFrag,
      uniforms: {
        uA: { value: this.rtA.texture }, uB: { value: this.rtB.texture }, uHud: { value: black },
        uUseB: { value: 0 }, uUseHud: { value: 0 }, uQ: { value: 0 }, uType: { value: 0 },
        uDir: { value: new THREE.Vector2(1, 0) }, uP: { value: new THREE.Vector4(0.12, 12, 0, 0) },
        uWeight: { value: 1 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uFade: { value: 0 },
      },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      depthTest: false, depthWrite: false,
    });
    this.resolveMat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: resolveFrag,
      uniforms: { uAccum: { value: this.accum.texture }, uRes: { value: new THREE.Vector2(W, H) }, uGrain: { value: 0.014 }, uSeed: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geo, this.mat);
    this.rquad = new THREE.Mesh(geo, this.resolveMat);
    this.mquad = new THREE.Mesh(geo, this.mixMat);
    this.mscene = new THREE.Scene(); this.mscene.add(this.mquad);
    this.scene = new THREE.Scene(); this.scene.add(this.quad);
    this.rscene = new THREE.Scene(); this.rscene.add(this.rquad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  begin() {
    const r = this.renderer;
    r.setRenderTarget(this.accum);
    r.setClearColor(0x000000, 0);
    r.clear(true, false, false);
  }

  static frameMatrix(f, W, H) {
    // uv' = centre + R·S⁻¹·(uv − centre) − offset, in aspect-correct space
    const m = new THREE.Matrix3();
    if (!f) return m;
    const a = W / H, z = f.zoom ?? 1, r = (f.rot ?? 0) * Math.PI / 180;
    const c = Math.cos(r), s = Math.sin(r);
    const ox = (f.x ?? 0) / W, oy = -(f.y ?? 0) / H;
    // uv → aspect space
    const T1 = new THREE.Matrix3().set(1, 0, -0.5, 0, 1, -0.5, 0, 0, 1);
    const A = new THREE.Matrix3().set(a, 0, 0, 0, 1, 0, 0, 0, 1);
    const R = new THREE.Matrix3().set(c / z, s / z, 0, -s / z, c / z, 0, 0, 0, 1);
    const Ai = new THREE.Matrix3().set(1 / a, 0, 0, 0, 1, 0, 0, 0, 1);
    const T2 = new THREE.Matrix3().set(1, 0, 0.5 - ox, 0, 1, 0.5 - oy, 0, 0, 1);
    return m.copy(T2).multiply(Ai).multiply(R).multiply(A).multiply(T1);
  }

  /** layers: {back, front, fxA, fxB} textures or null; src3D texture or null */
  composite(target, t, comp, tex, src3D, paperBase) {
    const U = this.mat.uniforms;
    U.uWeight.value = 1;
    U.uTime.value = t;
    U.uTick.value = Math.floor(t * 28);
    U.uDark.value = comp.dark;
    U.uVignette.value = comp.vignette;
    U.uGlitch.value = comp.glitch;
    U.uTear.value = comp.tear;
    U.uTearY.value = comp.tearY;
    U.uSplit.value = comp.split;
    U.uInvert.value = comp.invert;
    U.uFlash.value.set(...comp.flash);
    U.uFade.value = comp.fade;
    if (comp.iris) U.uIris.value.set(comp.iris[0], this.H - comp.iris[1], comp.iris[2], comp.iris[3] ?? 2);
    else U.uIris.value.set(0, 0, -1, 1);
    U.uIrisDark.value = comp.irisDark;
    U.uFrame.value.copy(Compositor.frameMatrix(comp.frame, this.W, this.H));
    U.uPaperBase.value.set(...paperBase);

    const set = (name, texv) => {
      U["u" + name].value = texv || this.black;
      U["uUse" + name].value = texv ? 1 : 0;
    };
    set("Back", tex.back); set("Front", tex.front); set("FxA", tex.fxA); set("FxB", tex.fxB);
    U.uSrc3D.value = src3D || this.black;
    U.uUse3D.value = src3D ? 1 : 0;
    for (const k of ["A", "B"]) {
      const fx = comp["fx" + k];
      U[`uFx${k}H`].value.copy(fx?.H ?? new THREE.Matrix3());
      const p = fx?.pinch ?? [0.5, 0.5, 0, 1];
      U[`uFx${k}Pinch`].value.set(p[0], p[1], p[2], p[3]);
      U[`uFx${k}ZoomBlur`].value = fx?.zoomBlur ?? 0;
    }
    const r = this.renderer;
    r.setRenderTarget(target);
    r.render(this.scene, this.cam);
  }

  /** transition A→B (or A alone), lay the HUD on top, accumulate with weight */
  mix(weight, t, tr, hudTex, fade) {
    const U = this.mixMat.uniforms;
    U.uWeight.value = weight;
    U.uTime.value = t;
    U.uUseB.value = tr ? 1 : 0;
    U.uQ.value = tr ? tr.q : 0;
    U.uType.value = tr ? tr.type : 0;
    if (tr) { U.uDir.value.set(...(tr.dir ?? [1, 0])); U.uP.value.set(...(tr.p ?? [0.12, 12, 1.6, 0.9])); }
    U.uHud.value = hudTex || this.black;
    U.uUseHud.value = hudTex ? 1 : 0;
    U.uFade.value = fade;
    const r = this.renderer;
    r.setRenderTarget(this.accum);
    r.render(this.mscene, this.cam);
  }

  resolve(grain, seed) {
    const r = this.renderer;
    this.resolveMat.uniforms.uGrain.value = grain;
    this.resolveMat.uniforms.uSeed.value = seed;
    r.setRenderTarget(null);
    r.render(this.rscene, this.cam);
  }
}
