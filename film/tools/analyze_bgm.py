# Energy / onset profile of the BGM on a 112 BPM grid (numpy only).
import numpy as np, subprocess, sys
src = sys.argv[1]
sr = 24000
raw = subprocess.run(["ffmpeg","-v","error","-i",src,"-ac","1","-ar",str(sr),"-f","f32le","-"],capture_output=True).stdout
x = np.frombuffer(raw, np.float32)
print("dur", len(x)/sr)
hop = 240  # 10 ms
n = len(x)//hop
frames = x[:n*hop].reshape(n,hop)
rms = np.sqrt((frames**2).mean(1)+1e-12)
# spectral flux onset
win = 1024
S=[]
for i in range(0, len(x)-win, hop):
    S.append(np.abs(np.fft.rfft(x[i:i+win]*np.hanning(win))))
S=np.array(S); S=np.log1p(S*10)
flux=np.maximum(0,np.diff(S,axis=0)).sum(1); flux=np.concatenate([[0],flux])
# low band (kick) flux
lowbins = int(150/(sr/win))
lflux=np.maximum(0,np.diff(S[:,1:lowbins],axis=0)).sum(1); lflux=np.concatenate([[0],lflux])
bpm=112; beat=60/bpm
# find phase offset maximizing flux on beat grid
best=None
for off in np.arange(0,beat,0.005):
    idx=((np.arange(off, len(flux)*0.01, beat))/0.01).astype(int)
    idx=idx[idx<len(flux)]
    s=flux[idx].mean()
    if best is None or s>best[0]: best=(s,off)
print("beat phase offset", round(best[1],3), "score", best[0], "mean flux", flux.mean())
off=best[1]
bar=beat*4
nb=int((len(x)/sr-off)/bar)+1
for b in range(nb):
    t0=off+b*bar; t1=t0+bar
    a=int(t0/0.01); c=int(t1/0.01)
    seg=rms[a:c]; lf=lflux[a:c]; fl=flux[a:c]
    db=20*np.log10(seg.mean()+1e-9)
    print(f"bar {b:2d} t={t0:6.2f}  rms {db:6.1f} dB  flux {fl.mean():6.2f}  low {lf.mean():6.2f}  " + "#"*int(max(0,(db+40))))
