#!/usr/bin/env python3
"""Build the promo soundtrack: music edit (A → C/D/E) + timed SFX + master.

  RHINE_BGM=/path/to/779491.wav python3 tools/mix.py ../out/cues.json ../out/mix.wav

The score ("Rhine Lab.LLC", © Hypergryph / Monster Siren Records) is not part
of this repository; point RHINE_BGM at your own copy (48 kHz WAV/FLAC/…).
"""
import json, os, pathlib, subprocess, sys, wave
import numpy as np

SR = 48000
HERE = pathlib.Path(__file__).resolve().parent.parent
SFX = HERE / "audio" / "sfx"
REUSE = HERE / "audio" / "reuse"
MUSIC = pathlib.Path(os.environ.get("RHINE_BGM", HERE / "audio" / "bgm" / "779491.wav"))

BEAT = 60 / 112
BAR = BEAT * 4
K0 = 0.012                       # first kick of the track (music seconds)


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def db(x):
    return 10 ** (x / 20)


def onepole_lp_varying(x, fc):
    """per-sample cutoff one-pole low-pass (stereo), fc array in Hz"""
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = np.zeros(2)
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def main(cue_path, out_path):
    meta = json.load(open(cue_path))
    dur = meta["duration"]
    N = int((dur + 0.5) * SR)
    if not MUSIC.exists():
        sys.exit(f"score not found: {MUSIC}\nset RHINE_BGM to your copy of \"Rhine Lab.LLC\" (see README)")
    music = load(MUSIC)
    mus = np.zeros((N, 2))

    # ── music edit ──
    def place(film0, m0, m1):
        a, b = int(round(film0 * SR)), int(round(m0 * SR))
        n = min(int(round((m1 - m0) * SR)), N - a, len(music) - b)
        mus[a:a + n] += music[b:b + n]
        return a, n

    xf = int(0.006 * SR)
    # section A: film bar 1 … 9  ←  music bars 0 … 8
    splice_f = 9 * BAR - 0.004
    a0, nA = place(1 * BAR, K0 - 0.002, K0 + 8 * BAR - 0.004 + 0.003)
    # section C→: film bar 9 →  ←  music bar 16 →
    offC = (K0 + 16 * BAR) - 9 * BAR              # music = film + offC
    b0 = int(round((splice_f - 0.003) * SR))
    mb = int(round((splice_f - 0.003 + offC) * SR))
    n = min(N - b0, len(music) - mb)
    seg = music[mb:mb + n].copy()
    # equal-power crossfade over xf samples
    fade = np.linspace(0, 1, xf)
    seg[:xf] *= np.sin(fade * np.pi / 2)[:, None]
    mus[b0:b0 + xf] *= np.cos(fade * np.pi / 2)[:, None]
    mus[b0 + xf:] = 0
    mus[b0:b0 + n] += seg
    # 4 ms fade-in at the very first sample of music
    fi = int(0.004 * SR)
    mus[a0:a0 + fi] *= np.linspace(0, 1, fi)[:, None]

    # ── lockdown: duck + muffle music during WARNING / lockdown (bars 24–26) ──
    t = np.arange(N) / SR
    def ramp(t0, t1):
        return np.clip((t - t0) / max(1e-6, t1 - t0), 0, 1)
    dark = ramp(24 * BAR - 0.02, 24 * BAR + 0.08) * (1 - ramp(26 * BAR - 0.01, 26 * BAR + 0.03))
    s0, s1 = int((24 * BAR - 0.5) * SR), int((26 * BAR + 0.5) * SR)
    fc = 18000 * (1 - dark[s0:s1]) + 650 * dark[s0:s1]
    mus[s0:s1] = onepole_lp_varying(mus[s0:s1], fc) * (1 - dark[s0:s1, None]) + onepole_lp_varying(onepole_lp_varying(mus[s0:s1], fc), fc) * dark[s0:s1, None]
    mus *= (1 - 0.55 * dark)[:, None]
    # end: let the track's last bar ring, then fade under the final sting
    mus *= (1 - ramp(28 * BAR + 0.9, 28 * BAR + 2.3))[:, None]

    # ── sfx ──
    base = {  # per-cue base gains (dB), balanced against the (very dense) track
        "hit": -6, "hit_soft": -5, "slam": -5, "slam_big": -4, "whoosh_in": -6, "whoosh_out": -5,
        "riser": 4, "riser_short": -9, "tick_hard": -4, "blip": -8, "select": -3, "callout": -2,
        "chime": -2, "pulse": -8, "pin": -7, "tap": -5, "riffle": -5, "peel": -4, "cascade": -7,
        "counter": -9, "redact": -8, "mech": 0, "shards": -8, "glitch_big": -6, "tear": -4,
        "final": -2, "access": -9, "assemble": -4, "draw": -10, "draw_long": 1, "glitch1": -6,
        "glitch2": -4, "process": 6, "recover": 2, "warning": -4,
    }
    reuse = {"access": "access", "assemble": "assemble", "draw": "draw", "draw_long": "draw",
             "glitch1": "glitch1", "glitch2": "glitch2", "process": "process", "recover": "recover", "warning": "warning"}
    cache = {}
    def get(name):
        if name not in cache:
            p = SFX / f"{name}.wav"
            if not p.exists():
                p = REUSE / f"{reuse[name]}.wav"
            x = load(p)
            if name == "draw":            # the cold-open pen stroke is half a beat
                n = int(0.62 * SR); x = x[:n].copy(); x[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))[:, None]
            cache[name] = x
        return cache[name]

    fx = np.zeros((N, 2))
    duck = np.zeros(N)
    for c in meta["cues"]:
        x = get(c["name"])
        g = db(base.get(c["name"], -12)) * c["gain"]
        # anticipatory sounds land their peak on the cue
        lead = {"whoosh_in": 0.5, "riser": 2.14, "riser_short": 1.07}.get(c["name"], 0.0)
        lead = min(lead, c["t"])
        if c["name"] in ("slam", "slam_big"):
            lead = {"slam": 0.09, "slam_big": 0.16}[c["name"]]
        i = int(round((c["t"] - lead) * SR))
        if c["name"] in ("riser", "riser_short") and c["shot"] in ("drawmark", "approach", "process"):
            i = int(round(c["t"] * SR))      # these play forward from the cue
        if i < 0:
            x = x[-i:]; i = 0
        n = min(len(x), N - i)
        fx[i:i + n] += x[:n] * g
        if c["name"] in ("hit", "slam", "slam_big", "final", "warning", "glitch_big", "tear"):
            k = int(round(c["t"] * SR))
            L = int(0.32 * SR)
            if k < N:
                e = np.exp(-np.arange(min(L, N - k)) / (0.12 * SR))
                duck[k:k + len(e)] = np.maximum(duck[k:k + len(e)], e * {"final": 1.0, "slam_big": 0.8}.get(c["name"], 0.55))

    # smooth duck attack (3 ms) and apply −5 dB max to the music
    a = int(0.003 * SR)
    kern = np.ones(a) / a
    duck = np.convolve(duck, kern, "same")
    mus *= (1 - (1 - db(-5)) * np.clip(duck, 0, 1))[:, None]

    mix = mus * db(-2.5) + fx
    if "--stems" in sys.argv:
        for nm, st_ in (("music", mus * db(-2.5)), ("sfx", fx)):
            d = (np.clip(st_, -1, 1) * 32767).astype("<i2")
            with wave.open(str(pathlib.Path(out_path).with_name(f"stem_{nm}.wav")), "wb") as w:
                w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())
    # fade the very end
    mix *= (1 - ramp(dur - 0.25, dur))[:, None]

    # soft-knee peak limiter (look-ahead 2 ms)
    thr = db(-1.5)
    pk = np.max(np.abs(mix), 1)
    la = int(0.002 * SR)
    pk = np.concatenate([pk[la:], np.zeros(la)])
    pk = np.maximum.accumulate(pk[::-1].reshape(-1, 1), axis=0)[::-1, 0] if False else pk
    g = np.minimum(1, thr / np.maximum(pk, 1e-9))
    # release smoothing
    rel = np.exp(-1 / (0.08 * SR))
    gs = np.empty_like(g); acc = 1.0
    for i in range(len(g)):
        acc = g[i] if g[i] < acc else rel * acc + (1 - rel) * g[i]
        gs[i] = acc
    mix *= gs[:, None]

    tmp = pathlib.Path(out_path).with_suffix(".pre.wav")
    data = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
    # loudness: two-pass loudnorm to −14 LUFS, −1 dBTP
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    js = json.loads(r[r.rindex("{"):r.rindex("}") + 1])
    print("measured", {k: js[k] for k in ("input_i", "input_tp", "input_lra")})
    af = (f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
          f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", str(out_path)], check=True)
    print("wrote", out_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
