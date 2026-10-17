// GLSL for the instanced card system.  The ∞ fin band is ported from the
// lock screen (the author's Rhine Lab lock screen, scene/shaders.ts); the other
// formations (archive rows, wall, helix, stack) share its card, so any
// formation can morph into any other per card, staggered along the band.

export const common = /* glsl */ `
float rl_hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}
vec3 rl_rotateAxis(vec3 v, vec3 axis, float a) {
    float s = sin(a), c = cos(a);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
vec3 rl_toLinear(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
`;

export const cardUniformsGlsl = /* glsl */ `
uniform float uTime, uFlow, uCount, uRadius, uAspect, uDepth, uTwist, uSpin;
uniform float uThickness, uLean, uCorner, uWidth, uHeight;
uniform float uAssemble, uVerify, uDenied, uAlign, uDisorder, uDissolve;
uniform float uFormA, uFormB, uMorph, uMorphSpread;
uniform float uRows, uRowGap, uColGap, uRowFlow, uRowWave, uRowWaveT;
uniform float uWallCols, uWallGap, uPeelX, uPeelY;
uniform float uHelixR, uHelixLen, uHelixTurns;
uniform float uStack, uStackGap;
uniform float uSelect, uSelectGlow, uTex, uLime;
uniform vec3 uBody;
uniform float uPulseT[16];
uniform float uPulseO[16];
varying vec3 vLocal;
varying float vSeed;
varying float vPulse;
varying float vParam;
varying float vTip;
varying float vSel;
varying vec2 vCardUv;
`;

export const cardVertexGlsl = /* glsl */ `
attribute float aIndex;

vec3 rl_curve(float t) {
    float s = sin(t), c = cos(t);
    return vec3(uRadius * c, uRadius * uAspect * s * c, uDepth * s);
}
float rl_easeOutBack(float x) {
    float c1 = 1.70158, c3 = c1 + 1.0;
    return 1.0 + c3 * pow(x - 1.0, 3.0) + c1 * pow(x - 1.0, 2.0);
}
float rl_pulseAt(float u) {
    float pulse = 0.0;
    for (int i = 0; i < 16; ++i) {
        float age = uTime - uPulseT[i];
        if (age >= 0.0 && age < 2.6) {
            float front = fract(uPulseO[i] + age * 0.32);
            float d = abs(fract(u - front + 0.5) - 0.5);
            float life = smoothstep(0.0, 0.08, age) * exp(-age * 1.5) * (1.0 - smoothstep(2.0, 2.6, age));
            pulse += exp(-d * d * 900.0) * life;
        }
    }
    return min(pulse, 1.4);
}

// every formation returns: centre, the card's thin axis T, width axis W,
// height axis H (orthonormal), size (thickness, width, height), and a
// stagger parameter "along" in 0..1 used by morphs / assembly / peel.
struct Card { vec3 p; vec3 T; vec3 W; vec3 H; vec3 size; float along; float pulse; float tip; };

Card rl_band(float idx, float seed) {
    Card c;
    float t = 6.2831853 * fract((idx + uFlow) / uCount);
    vec3 p = rl_curve(t);
    vec3 T = normalize(rl_curve(t + 0.002) - rl_curve(t - 0.002));
    vec3 ref = vec3(0.0, 0.0, 1.0);
    vec3 N0 = normalize(ref - dot(ref, T) * T);
    vec3 B0 = cross(T, N0);
    float u = t / 6.2831853;
    float pulse = rl_pulseAt(u);

    float wave = sin(2.0 * t - uTime * 0.55) * 0.55 + sin(5.0 * t + uTime * 0.31) * 0.12;
    float phi = uTwist * t + wave + uSpin + pulse * 1.3;
    phi = mix(phi, 1.5707963, uAlign);
    phi += (seed - 0.5) * uDisorder * 3.0 + sin(uTime * 9.0 + seed * 40.0) * uDisorder * 0.2;

    vec3 W = cos(phi) * N0 + sin(phi) * B0;
    vec3 H = cross(T, W);
    float lean = uLean + sin(t * 3.0 + uTime * 0.4) * 0.12;
    vec3 Tl = cos(lean) * T + sin(lean) * H;
    H = cross(Tl, W);
    T = Tl;

    float along = fract(u - 0.25);
    float window = 0.085;
    float local = clamp((uAssemble * (1.0 + window) - along) / window, 0.0, 1.0);
    float settle = 1.0 - pow(1.0 - local, 3.0);
    float grow = local > 0.0 ? rl_easeOutBack(local) : 0.0;
    float swing = (1.0 - settle) * 1.1;
    W = rl_rotateAxis(W, T, swing);
    H = rl_rotateAxis(H, T, swing);

    c.p = p + H * (pulse * 7.0 + (1.0 - settle) * 16.0);
    c.T = normalize(cross(W, H));
    c.W = W; c.H = H;
    c.size = vec3(uThickness, uWidth * (1.0 + pulse * 0.35), uHeight * (1.0 + pulse * 0.9)) * grow;
    c.along = along;
    c.pulse = pulse;
    float dt = along - uAssemble * (1.0 + window) + window * 0.5;
    c.tip = exp(-dt * dt * 2600.0) * (1.0 - smoothstep(0.9, 1.0, uAssemble));
    return c;
}

// archive: rows of upright cards like files in a drawer, faces along the row
Card rl_rows(float idx, float seed) {
    Card c;
    float perRow = floor(uCount / uRows);
    float r = floor(idx / perRow);
    float k = mod(idx, perRow);
    float x = (fract((k + uRowFlow) / perRow) - 0.5) * perRow * uColGap;
    float z = (r - (uRows - 1.0) * 0.5) * uRowGap;
    float u = (x / (perRow * uColGap)) + 0.5;
    // a travelling lean wave (files riffled by a finger)
    float wv = exp(-pow((u - uRowWaveT + r * 0.035) * 9.0, 2.0)) * uRowWave;
    float lean = 0.30 + wv * 0.55 + (seed - 0.5) * 0.04;
    vec3 T = vec3(1.0, 0.0, 0.0);
    vec3 W = vec3(0.0, 0.0, 1.0);
    vec3 H = vec3(0.0, 1.0, 0.0);
    T = rl_rotateAxis(T, W, -lean);
    H = rl_rotateAxis(H, W, -lean);
    float pulse = rl_pulseAt(fract(u * 0.5 + r * 0.13));
    c.p = vec3(x, uHeight * 0.5 * cos(lean) - 40.0 + wv * 6.0 + pulse * 5.0, z);
    c.T = T; c.W = W; c.H = H;
    c.size = vec3(uThickness, uWidth, uHeight) * (1.0 + pulse * vec3(0.0, 0.08, 0.15));
    c.along = fract(u + r * 0.07);
    c.pulse = pulse;
    c.tip = 0.0;
    return c;
}

// wall: a flat grid of cards facing the camera; uDissolve peels it from (uPeelX, uPeelY)
Card rl_wall(float idx, float seed) {
    Card c;
    float cols = uWallCols;
    float rows = floor(uCount / cols);
    float cx = mod(idx, cols), cy = floor(idx / cols);
    vec3 p = vec3((cx - (cols - 1.0) * 0.5) * uWallGap, ((rows - 1.0) * 0.5 - cy) * uWallGap, 0.0);
    vec3 T = vec3(0.0, 0.0, 1.0);
    vec3 W = vec3(1.0, 0.0, 0.0);
    vec3 H = vec3(0.0, 1.0, 0.0);
    float d = length(vec2(p.x - uPeelX, (p.y - uPeelY) * 1.2)) / (cols * uWallGap);
    float pulse = rl_pulseAt(fract(d));
    float tilt = 0.08 * sin(cx * 0.7 + uTime * 0.8) + 0.06 * sin(cy * 0.9 - uTime * 0.6) + (seed - 0.5) * 0.22;
    float nod = 0.07 * sin(cy * 0.6 + cx * 0.3 + uTime * 0.7) + (rl_hash11(idx * 7.7) - 0.5) * 0.16;
    W = rl_rotateAxis(W, H, tilt);
    T = rl_rotateAxis(T, H, tilt);
    H = rl_rotateAxis(H, W, nod);
    T = rl_rotateAxis(T, W, nod);
    c.p = p + T * pulse * 10.0;
    c.T = T; c.W = W; c.H = H;
    c.size = vec3(uThickness, uWidth, uHeight);
    c.along = clamp(d * 1.6, 0.0, 1.0);
    c.pulse = pulse;
    c.tip = 0.0;
    return c;
}

// helix: a single twisting ribbon of fins climbing a cylinder
Card rl_helix(float idx, float seed) {
    Card c;
    float s = fract((idx + uFlow) / uCount);
    float a = s * uHelixTurns * 6.2831853;
    vec3 p = vec3(uHelixR * cos(a), (s - 0.5) * uHelixLen, uHelixR * sin(a));
    vec3 Tc = normalize(vec3(-uHelixR * sin(a) * uHelixTurns * 6.2831853, uHelixLen, uHelixR * cos(a) * uHelixTurns * 6.2831853));
    vec3 R = normalize(vec3(cos(a), 0.0, sin(a)));
    vec3 W = normalize(R - dot(R, Tc) * Tc);
    float pulse = rl_pulseAt(s);
    float phi = 0.55 * sin(a * 0.5 - uTime * 0.7) + pulse * 1.2;
    vec3 B = cross(Tc, W);
    W = cos(phi) * W + sin(phi) * B;
    vec3 H = cross(Tc, W);
    float lean = uLean;
    vec3 Tl = cos(lean) * Tc + sin(lean) * H;
    H = cross(Tl, W);
    c.p = p + H * pulse * 6.0;
    c.T = normalize(cross(W, H)); c.W = W; c.H = H;
    c.size = vec3(uThickness, uWidth * (1.0 + pulse * 0.3), uHeight * (1.0 + pulse * 0.6));
    c.along = s;
    c.pulse = pulse;
    c.tip = 0.0;
    return c;
}

// stack: files dropping one by one onto a pile (uStack = cards landed, fractional = falling)
Card rl_stack(float idx, float seed) {
    Card c;
    float k = idx;
    float land = clamp(uStack - k, 0.0, 1.0);
    float fall = 1.0 - land;
    float e = land * land;                          // accelerate into the pile
    float h = k * uStackGap;
    float rot = (seed - 0.5) * 0.5 + (rl_hash11(k * 3.1) - 0.5) * 0.25;
    vec3 T = vec3(0.0, 1.0, 0.0);
    vec3 W = rl_rotateAxis(vec3(1.0, 0.0, 0.0), T, rot + fall * 1.2);
    vec3 H = cross(T, W);
    vec3 off = vec3((rl_hash11(k * 7.3) - 0.5) * 22.0, 0.0, (rl_hash11(k * 5.1) - 0.5) * 16.0);
    c.p = vec3(0.0, -120.0 + h + (1.0 - e) * 420.0, 0.0) + off + vec3(0.0, 0.0, 1.0) * fall * 60.0;
    c.T = T; c.W = W; c.H = H;
    float vis = step(k, uStack + 1.0);
    c.size = vec3(uThickness, uWidth, uHeight) * vis;
    c.along = k / uCount;
    c.pulse = 0.0;
    c.tip = 0.0;
    return c;
}

Card rl_form(float f, float idx, float seed) {
    if (f < 0.5) return rl_band(idx, seed);
    if (f < 1.5) return rl_rows(idx, seed);
    if (f < 2.5) return rl_wall(idx, seed);
    if (f < 3.5) return rl_helix(idx, seed);
    return rl_stack(idx, seed);
}

void rl_cardTransform(in vec3 lp, in vec3 nrm, out vec3 worldPos, out vec3 worldNrm) {
    float idx = aIndex;
    float seed = rl_hash11(idx * 1.618 + 4.7);
    Card a = rl_form(uFormA, idx, seed);
    Card c = a;
    if (uMorph > 0.0001) {
        Card b = rl_form(uFormB, idx, seed);
        float m = clamp((uMorph * (1.0 + uMorphSpread) - a.along * uMorphSpread - seed * 0.08), 0.0, 1.0);
        m = m * m * (3.0 - 2.0 * m);
        // arc the card through space while it reorients (a swoop, not a lerp)
        vec3 mid = (a.p + b.p) * 0.5 + vec3(0.0, 0.0, 160.0 + seed * 120.0);
        vec3 p0 = mix(a.p, mid, m), p1 = mix(mid, b.p, m);
        c.p = mix(p0, p1, m);
        vec3 W = normalize(mix(a.W, b.W, m) + 1e-4);
        vec3 H = mix(a.H, b.H, m);
        H = normalize(H - dot(H, W) * W);
        c.W = W; c.H = H; c.T = cross(W, H);
        c.size = mix(a.size, b.size, m);
        c.pulse = mix(a.pulse, b.pulse, m);
        c.tip = mix(a.tip, b.tip, m);
        c.along = mix(a.along, b.along, m);
    }

    // peel / dissolve: cards leave in a wave, tumbling toward the camera
    float peel = clamp(uDissolve * 1.6 - c.along * 0.6 - seed * 0.25, 0.0, 1.0);
    float peelE = peel * peel * (3.0 - 2.0 * peel);
    vec3 axis = normalize(vec3(seed - 0.5, 0.6, 0.3 + seed));
    vec3 W = rl_rotateAxis(c.W, axis, peelE * (2.0 + seed * 4.0));
    vec3 H = rl_rotateAxis(c.H, axis, peelE * (2.0 + seed * 4.0));
    vec3 Tt = cross(W, H);
    vec3 size = c.size * (1.0 - peelE * 0.85);
    vec3 radial = normalize(vec3(c.p.x, c.p.y * 1.4, c.p.z + 120.0));
    vec3 centre = c.p + (radial * 520.0 + vec3(0.0, 0.0, 380.0)) * peelE * (0.6 + seed);

    worldPos = centre + Tt * lp.x * size.x + W * lp.y * size.y + H * lp.z * size.z;
    worldNrm = normalize(Tt * nrm.x + W * nrm.y + H * nrm.z);

    vLocal = lp;
    vSeed = seed;
    vPulse = c.pulse;
    vParam = c.along;
    vTip = c.tip;
    vSel = 1.0 - smoothstep(0.0, 1.0, abs(idx - uSelect));
    vCardUv = vec2(0.5 + lp.y, 0.5 - lp.z);
}
`;

// fragment: corner carve (shared by colour and depth passes)
export const cardCarveGlsl = /* glsl */ `
    {
        vec2 rc = max(abs(vLocal.yz) - vec2(0.5 - uCorner), 0.0);
        if (length(rc) > uCorner) discard;
    }
`;

export const cardSurfaceGlsl = /* glsl */ `
    vec2 rq = abs(vLocal.yz) * 2.0;
    float rm = max(rq.x, rq.y);
    float onFace = step(0.49, abs(vLocal.x));
    float bevel = smoothstep(0.86, 1.0, rm);
    float rim = onFace * smoothstep(0.90, 0.94, rm) * (1.0 - smoothstep(0.97, 0.995, rm));

    vec3 rlPaper = rl_toLinear(uBody);
    vec3 rlGraphite = rl_toLinear(vec3(0.06, 0.062, 0.068));
    vec3 rlBody = mix(rlPaper, rlGraphite, uDenied) * (0.95 + vSeed * 0.07);
    if (uTex > 0.001 && onFace > 0.5) {
        vec3 tc = texture2D(uCardTex, vCardUv).rgb;
        rlBody = mix(rlBody, mix(tc, rlGraphite + (tc - rl_toLinear(vec3(0.94))) * 0.25, uDenied), uTex);
    }
`;

export const cardEmissiveGlsl = /* glsl */ `
    {
        vec3 orange = rl_toLinear(vec3(1.0, 0.482, 0.0));
        vec3 lime = rl_toLinear(vec3(0.725, 0.894, 0.196));
        vec3 glow = vec3(0.0);
        float scan = smoothstep(0.82, 1.0, sin(vParam * 6.2831853 * 3.0 - uTime * 2.4));
        glow += rim * orange * (0.025 + 1.6 * scan) * uDenied;
        glow += vPulse * rim * mix(lime * 0.9 * uLime, orange * 0.9, uDenied);
        glow += uVerify * rim * orange * 0.8 * step(0.55, fract(vParam * 18.0 - uTime * 1.2));
        glow += vTip * rim * vec3(1.0, 0.92, 0.8) * 1.4;
        glow += vSel * uSelectGlow * mix(lime, orange, uDenied) * (rim * 2.2 + bevel * onFace * 0.35);
        totalEmissiveRadiance = glow;
    }
`;

// ───────────────────────────── 3D grade ─────────────────────────────
// Tone curve + CA + sculpture-only post.  Outputs display values in rgb and
// the object coverage in alpha; the compositor lays the paper (and anything
// drawn behind the sculpture) underneath using that coverage.
export const gradeFragment = /* glsl */ `
uniform float uAberration;
uniform float uExposure;
uniform float uSat;

vec3 g_neutral(vec3 color) {
    const float startCompression = 0.8 - 0.04;
    const float desaturation = 0.15;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < startCompression) return color;
    const float d = 1.0 - startCompression;
    float newPeak = 1.0 - d * d / (peak + d - startCompression);
    color *= newPeak / peak;
    float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3(newPeak), g);
}
vec3 g_toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 d = uv - 0.5;
    float ca = uAberration * dot(d, d);
    vec4 base = texture2D(inputBuffer, uv);
    vec4 r = texture2D(inputBuffer, uv + d * ca);
    vec4 b = texture2D(inputBuffer, uv - d * ca);
    vec3 hdr = vec3(r.r, base.g, b.b) * uExposure;
    vec3 tm = g_neutral(hdr);
    tm = mix(vec3(dot(tm, vec3(0.2126, 0.7152, 0.0722))), tm, uSat);
    outputColor = vec4(g_toSrgb(clamp(tm, 0.0, 1.0)), clamp(base.a, 0.0, 1.0));
}
`;
