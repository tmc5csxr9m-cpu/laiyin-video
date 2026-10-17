#!/usr/bin/env python3
"""Synthesise the promo's sound effects (48 kHz stereo float WAV, numpy only).

All designed to sit on top of "Rhine Lab.LLC" (112 BPM, F major): tonal
cues use F / A / C partials so they never clash with the track.
"""
import pathlib, wave, sys
import numpy as np

SR = 48000
OUT = pathlib.Path(__file__).resolve().parent.parent / "audio" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(112)


def T(sec):
    return np.arange(int(sec * SR)) / SR


def env_exp(n, tau, attack=0.0):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    if attack > 0:
        e *= np.clip(t / attack, 0, 1)
    return e


def sweep(f0, f1, sec, curve="exp"):
    t = T(sec)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def spec_filter(x, gain_fn):
    """static filter by spectral multiplication; gain_fn(freqs) -> gain"""
    n = len(x)
    N = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, N)
    f = np.fft.rfftfreq(N, 1 / SR)
    return np.fft.irfft(X * gain_fn(f), N)[:n]


def bp(lo, hi, order=2):
    def g(f):
        f = np.maximum(f, 1e-3)
        a = 1 / np.sqrt(1 + (lo / f) ** (2 * order))
        b = 1 / np.sqrt(1 + (f / hi) ** (2 * order))
        return a * b
    return g


def lp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (np.maximum(f, 0) / fc) ** (2 * order))


def hp(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def stft_sweep(x, lo_fn, hi_fn, frame=1024, hop=256):
    """time-varying band-pass: lo_fn/hi_fn map time (s) → edge frequency"""
    win = np.hanning(frame)
    out = np.zeros(len(x) + frame)
    norm = np.zeros(len(x) + frame)
    f = np.fft.rfftfreq(frame, 1 / SR)
    for i in range(0, len(x), hop):
        seg = x[i:i + frame]
        if len(seg) < frame:
            seg = np.pad(seg, (0, frame - len(seg)))
        t = (i + frame / 2) / SR
        g = bp(lo_fn(t), hi_fn(t))(f)
        y = np.fft.irfft(np.fft.rfft(seg * win) * g, frame)
        out[i:i + frame] += y * win
        norm[i:i + frame] += win ** 2
    return (out / np.maximum(norm, 1e-6))[:len(x)]


def reverb(x, sec=1.4, damp=4000, mix=0.3, pre=0.012, width=1.0):
    n = int(sec * SR)
    irs = []
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (sec / 6.9))
        ir = spec_filter(ir, lp(damp, 1))
        ir = np.concatenate([np.zeros(int(pre * SR)), ir])
        irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    L = len(x) + len(irs[0])
    N = 1 << int(np.ceil(np.log2(L)))
    wet = np.stack([np.fft.irfft(np.fft.rfft(x[:, c], N) * np.fft.rfft(irs[c], N), N)[:L] for c in range(2)], 1)
    dry = np.pad(x, ((0, L - len(x)), (0, 0)))
    mid = wet.mean(1, keepdims=True)
    wet = mid + (wet - mid) * width
    return dry * (1 - mix) + wet * mix * 3.0


def st(x, pan=0.0, haas=0.0):
    """mono → stereo with constant-power pan and optional Haas delay (s)"""
    a = (pan + 1) * np.pi / 4
    l, r = np.cos(a) * x, np.sin(a) * x
    d = int(abs(haas) * SR)
    if d:
        if haas > 0:
            r = np.concatenate([np.zeros(d), r[:-d]])
        else:
            l = np.concatenate([np.zeros(d), l[:-d]])
    return np.stack([l, r], 1) * np.sqrt(2)


def pad_to(x, n):
    return np.pad(x, ((0, max(0, n - len(x))),) + ((0, 0),) * (x.ndim - 1))[:n]


def mixdown(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros((n, 2))
    for p in parts:
        if p.ndim == 1:
            p = st(p)
        out[:len(p)] += p
    return out


def write(name, x, peak_db=-1.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = st(x)
    # 3 ms fade-in / 10 ms fade-out to avoid clicks
    n = len(x)
    fi, fo = min(n, int(0.003 * SR)), min(n, int(0.01 * SR))
    x[:fi] *= np.linspace(0, 1, fi)[:, None]
    x[n - fo:] *= np.linspace(1, 0, fo)[:, None]
    pk = np.max(np.abs(x)) + 1e-12
    x = x / pk * 10 ** (peak_db / 20)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"{name:12s} {n / SR:5.2f}s")


# ───────────────────────── building blocks ─────────────────────────

def sub_drop(f0=60, f1=36, sec=0.5, tau=0.16):
    t = T(sec)
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), tau, 0.002)


def click(sec=0.006, lo=1500, hi=9000):
    x = rng.standard_normal(int(sec * SR)) * env_exp(int(sec * SR), sec / 4)
    return spec_filter(x, bp(lo, hi))


def body(sec=0.12, lo=180, hi=2200, tau=0.035):
    x = rng.standard_normal(int(sec * SR)) * env_exp(int(sec * SR), tau, 0.001)
    return spec_filter(x, bp(lo, hi))


def partials(freqs, amps, sec, tau, attack=0.002, detune=0.0):
    t = T(sec)
    y = np.zeros(len(t))
    for f, a in zip(freqs, amps):
        y += a * np.sin(2 * np.pi * f * (1 + detune * rng.uniform(-1, 1)) * t + rng.uniform(0, 6.28))
    return y * env_exp(len(t), tau, attack)


def whoosh(sec, f0, f1, swell="in"):
    n = int(sec * SR)
    x = rng.standard_normal(n)
    lo = lambda t: max(80.0, (f0 * (f1 / f0) ** (t / sec)) * 0.55)
    hi = lambda t: (f0 * (f1 / f0) ** (t / sec)) * 1.8
    y = stft_sweep(x, lo, hi)
    t = np.arange(n) / SR
    if swell == "in":
        e = (t / sec) ** 2.2 * (1 - np.clip((t - sec * 0.96) / (sec * 0.04), 0, 1))
    else:
        e = np.exp(-t / (sec * 0.28)) * np.clip(t / 0.01, 0, 1)
    return y * e


# ───────────────────────── cues ─────────────────────────

def make_all():
    # impacts
    hit = mixdown(st(sub_drop(62, 38, 0.6, 0.15)) * 1.0, st(click(0.005)) * 0.5, st(body(0.14, 160, 2400, 0.03)) * 0.55)
    write("hit", reverb(hit, 0.9, 3000, 0.12), -1.5)
    soft = mixdown(st(sub_drop(70, 45, 0.4, 0.09)) * 0.7, st(body(0.1, 300, 3000, 0.02)) * 0.4, st(click(0.004, 3000, 12000)) * 0.25)
    write("hit_soft", reverb(soft, 0.7, 4000, 0.15), -6)
    ring = partials([698.5, 1046.5, 1396.9, 2093], [0.5, 0.35, 0.22, 0.12], 0.9, 0.22, 0.001, 0.002)
    pre = whoosh(0.09, 900, 5000, "in") * 0.4
    slam = mixdown(np.concatenate([st(pre), np.zeros((0, 2))]), pad_to(np.concatenate([np.zeros((len(pre), 2)), hit]), 0) if False else np.zeros((1, 2)))
    slam = np.zeros((int(1.4 * SR), 2))
    slam[:len(pre)] += st(pre)
    o = len(pre)
    h = mixdown(st(sub_drop(58, 36, 0.7, 0.18)), st(click(0.006)) * 0.6, st(body(0.16, 140, 2600, 0.04)) * 0.6, st(ring, 0.0, 0.004) * 0.18)
    slam[o:o + len(h)] += h[: len(slam) - o]
    write("slam", reverb(slam, 1.1, 3500, 0.18), -1.0)
    big = np.zeros((int(2.6 * SR), 2))
    pre2 = whoosh(0.16, 600, 7000, "in") * 0.5
    big[:len(pre2)] += st(pre2)
    o = len(pre2)
    h = mixdown(st(sub_drop(52, 30, 1.6, 0.42)) * 1.1, st(click(0.008, 800, 10000)) * 0.7,
                st(body(0.35, 90, 3200, 0.08)) * 0.7, st(partials([349.2, 523.3, 698.5], [0.4, 0.25, 0.2], 1.6, 0.5), 0, 0.006) * 0.12)
    big[o:o + len(h)] += h[: len(big) - o]
    write("slam_big", reverb(big, 2.2, 2500, 0.22, width=1.4), -0.5)

    # air
    write("whoosh_in", st(whoosh(0.5, 250, 5200, "in"), 0, 0.0008), -4)
    write("whoosh_out", st(whoosh(0.6, 5000, 300, "out"), 0, 0.0008), -5)
    r = whoosh(BAR := 60 / 112 * 4, 160, 6500, "in")
    r = r + sweep(220, 1760, BAR) * (np.arange(len(r)) / len(r)) ** 3 * 0.06
    write("riser", st(r, 0, 0.001), -5)
    rs = whoosh(BAR / 2, 300, 7000, "in")
    write("riser_short", st(rs, 0, 0.001), -6)

    # ui
    def tickf(f, sec=0.02, tau=0.004):
        y = partials([f, f * 2.01], [1, 0.3], sec, tau, 0.0005)
        c = click(0.003, 4000, 14000)
        y[:len(c)] += c[:len(y)] * 0.4
        return y
    write("tick_hard", reverb(mixdown(st(tickf(2093, 0.03, 0.006)), st(sub_drop(110, 70, 0.08, 0.02)) * 0.5), 0.5, 6000, 0.12), -7)
    bl = sweep(1396.9, 2093, 0.07, "lin") * env_exp(int(0.07 * SR), 0.025, 0.001)
    write("blip", reverb(st(bl), 0.6, 7000, 0.18), -10)
    sel = np.concatenate([partials([1046.5], [1], 0.06, 0.02, 0.001), partials([1568], [1], 0.18, 0.05, 0.001)])
    write("select", reverb(st(sel), 0.8, 7000, 0.2), -9)
    co = sweep(1174.7, 1760, 0.05, "lin") * env_exp(int(0.05 * SR), 0.02)
    cc = click(0.003, 3000, 12000); co[:len(cc)] += cc * 0.5
    write("callout", reverb(st(co, 0.0, 0.002), 0.7, 6000, 0.2), -9)
    ch = partials([880, 1046.5, 1396.9, 1760, 2793.8], [0.5, 0.45, 0.35, 0.2, 0.08], 2.0, 0.55, 0.004, 0.0015)
    write("chime", reverb(st(ch, 0, 0.003), 2.4, 6000, 0.35, width=1.5), -9)
    pu = mixdown(st(sub_drop(80, 55, 0.35, 0.08)) * 0.6, st(partials([1760], [1], 0.4, 0.09, 0.002)) * 0.25)
    write("pulse", reverb(pu, 0.9, 5000, 0.2), -9)
    pin = mixdown(st(sub_drop(90, 50, 0.3, 0.05)) * 0.6, st(partials([1760, 3520], [1, 0.2], 0.6, 0.12, 0.001)) * 0.4, st(click(0.004)) * 0.4)
    write("pin", reverb(pin, 1.0, 6000, 0.22), -5)

    # paper / cards
    def tapf(f=180):
        return mixdown(st(partials([f, f * 2.3], [1, 0.4], 0.08, 0.018, 0.0005)) * 0.8, st(body(0.05, 1800, 7000, 0.008)) * 0.6, st(click(0.002, 3000, 12000)) * 0.4)
    write("tap", reverb(tapf(170), 0.6, 5000, 0.12), -6)
    rf = np.zeros((int(0.8 * SR), 2))
    for i in range(46):
        tt = 0.6 * (i / 46) ** 0.8
        c = tapf(200 + rng.uniform(-30, 60)) * rng.uniform(0.35, 0.8)
        o = int(tt * SR); rf[o:o + len(c)] += c[: len(rf) - o] * np.array([1 + 0.3 * np.sin(i), 1 - 0.3 * np.sin(i)])
    write("riffle", reverb(rf, 0.6, 5000, 0.12), -6)
    pe = np.zeros((int(1.8 * SR), 2))
    for i in range(90):
        tt = rng.uniform(0, 1.0) ** 1.6 * 1.1
        c = (tapf(220 + rng.uniform(-40, 140)) * rng.uniform(0.15, 0.5))
        pan = rng.uniform(-0.9, 0.9)
        o = int(tt * SR); pe[o:o + len(c)] += c[: len(pe) - o] * np.array([1 - pan, 1 + pan]) * 0.7
    pe += pad_to(st(whoosh(1.2, 4000, 400, "out")) * 0.5, len(pe))
    write("peel", reverb(pe, 1.2, 5000, 0.2, width=1.6), -3)
    cas = np.zeros((int(1.4 * SR), 2))
    for i in range(10):
        c = mixdown(st(sub_drop(80, 50, 0.2, 0.05)) * 0.5, st(body(0.06, 400, 4000, 0.012)) * 0.6, st(click(0.003)) * 0.4)
        pan = np.sin(i * 1.9) * 0.7
        o = int(i * 0.062 * SR); cas[o:o + len(c)] += c[: len(cas) - o] * np.array([1 - pan, 1 + pan]) * (1 - i * 0.05)
    write("cascade", reverb(cas, 0.9, 4500, 0.18), -4)
    cn = np.zeros((int(1.1 * SR), 2))
    k = 0
    tt = 0.0
    while tt < 1.0:
        c = st(tickf(1760 + 300 * tt, 0.015, 0.003)) * (0.35 + 0.4 * tt)
        o = int(tt * SR); cn[o:o + len(c)] += c[: len(cn) - o]
        tt += 0.134 / 1.0 if k < 1 else max(0.03, 0.134 * (1 - tt) ** 1.2)
        k += 1
    write("counter", reverb(cn, 0.5, 6000, 0.1), -9)
    rd = mixdown(st(whoosh(0.12, 600, 3000, "in")) * 0.6, st(sub_drop(90, 60, 0.12, 0.03)) * 0.6, st(body(0.08, 200, 1500, 0.02)) * 0.5)
    write("redact", reverb(rd, 0.5, 4000, 0.1), -6)
    mech = np.zeros((int(0.35 * SR), 2))
    for o_s, f in [(0, 2600), (0.055, 3100)]:
        c = mixdown(st(click(0.004, 1500, 9000)), st(partials([f], [1], 0.02, 0.004)) * 0.3)
        o = int(o_s * SR); mech[o:o + len(c)] += c
    tt = T(0.22)
    whir = spec_filter(rng.standard_normal(len(tt)), bp(500, 1100)) * (0.5 + 0.5 * np.sin(2 * np.pi * 38 * tt)) * np.sin(np.pi * tt / 0.22) * 0.25
    mech[int(0.06 * SR):int(0.06 * SR) + len(tt)] += st(whir)
    write("mech", reverb(mech, 0.5, 6000, 0.12), -9)
    sh = np.zeros((int(1.6 * SR), 2))
    for i in range(28):
        tt = rng.uniform(0, 0.6) ** 1.3
        f = rng.choice([2793.8, 3520, 4186, 5587.7, 4698.6]) * rng.uniform(0.99, 1.01)
        c = partials([f, f * 1.51], [1, 0.3], 0.5, rng.uniform(0.04, 0.12), 0.0005) * rng.uniform(0.2, 0.6)
        pan = rng.uniform(-0.8, 0.8)
        o = int(tt * SR); sh[o:o + len(c)] += st(c, pan)[: len(sh) - o]
    sh += pad_to(st(sub_drop(70, 40, 0.5, 0.12)) * 0.5, len(sh))
    write("shards", reverb(sh, 1.3, 7000, 0.25, width=1.5), -5)

    # digital
    def crush(x, hold):
        idx = (np.arange(len(x)) // hold) * hold
        return np.round(x[idx] * 8) / 8
    gb = np.zeros((int(0.7 * SR), 2))
    for i in range(9):
        L = int(rng.uniform(0.02, 0.09) * SR)
        seg = crush(rng.standard_normal(L) * 0.6 + np.sin(2 * np.pi * rng.uniform(80, 1400) * np.arange(L) / SR), int(rng.integers(4, 40)))
        o = int(rng.uniform(0, 0.5) * SR)
        gb[o:o + L] += st(seg * rng.uniform(0.3, 0.8), rng.uniform(-0.7, 0.7))[: len(gb) - o]
    gb += pad_to(st(sub_drop(70, 30, 0.6, 0.15)) * 0.8, len(gb))
    write("glitch_big", gb, -2)
    n = int(0.62 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-t * 5) + 40) / SR)
    tear = crush(tone * 0.6 + rng.standard_normal(n) * 0.4 * np.exp(-t * 3), 24) * np.clip(1 - t / 0.62, 0, 1)
    tear = mixdown(st(tear, 0, 0.004), st(sub_drop(60, 25, 0.62, 0.2)) * 0.9)
    write("tear", tear, -2)

    # final: impact + F major sting with a long tail
    fin = np.zeros((int(4.5 * SR), 2))
    h = mixdown(st(sub_drop(50, 28, 2.0, 0.6)) * 1.1, st(click(0.01, 600, 12000)) * 0.6, st(body(0.5, 80, 2500, 0.12)) * 0.6)
    fin[:len(h)] += h
    chord = partials([174.6, 261.6, 349.2, 440, 523.3, 698.5], [0.5, 0.4, 0.35, 0.3, 0.2, 0.12], 4.0, 1.4, 0.01, 0.002)
    fin[:len(chord)] += st(chord, 0, 0.006) * 0.35
    write("final", reverb(fin, 3.5, 3000, 0.3, width=1.6), -0.3)


if __name__ == "__main__":
    make_all()
