"""Procedural sound design for Bölüm 1 (no samples). Writes out/sfx.wav (stereo, 44.1 kHz)."""
import sys, wave
import numpy as np

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 93.0
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/sfx.wav'
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def band(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1e-3)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    mix[i:i + len(sig), 0] += sig * gain * l
    mix[i:i + len(sig), 1] += sig * gain * r


def env_lin(points):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


# --- 1. cabin/engine bed (whole video) ---
brown = np.cumsum(rng.standard_normal(N)); brown -= np.convolve(brown, np.ones(4000) / 4000, 'same')
bed = band(brown, 30, 220); bed /= np.abs(bed).max()
bed += 0.25 * np.sin(2 * np.pi * 96 * t) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * t))
bed_env = env_lin([(0, 0.0), (0.3, 0.16), (43, 0.16), (44, 0.22), (90, 0.22), (93, 0.0)])
add(bed * bed_env, 0, 1.0)

# --- 2. dark drone building tension ---
drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.4 * t + 1) + 0.3 * np.sin(2 * np.pi * 110.3 * t)) / 1.9
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.17 * t)
d_env = env_lin([(0, 0), (16, 0), (21, 0.1), (27, 0.16), (43, 0.16), (46, 0.24), (70, 0.3), (84, 0.34), (91, 0.3), (93, 0)])
add(drone * d_env, 0, 1.0)

# --- 3. seatbelt chime ---
def chime(f, d=1.2):
    n = int(d * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 3.5)
add(chime(1318.5), 11.42, 0.22); add(chime(1046.5), 11.72, 0.22)

# --- 4. PA crackle before captain speaks ---
def crackle(d=0.5):
    n = int(d * SR); x = band(rng.standard_normal(n), 900, 4000)
    x *= (rng.random(n) > 0.92) * 1.5 + 0.25; x *= np.minimum(1, np.arange(n) / 500) * np.exp(-np.arange(n) / SR * 4)
    return x / np.abs(x).max()
add(crackle(), 11.95, 0.12); add(crackle(), 43.5, 0.14)

# --- 5. impacts ---
def boom(d=3.0, f0=62, f1=28, noise=0.6):
    n = int(d * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 1.6)
    nz = band(rng.standard_normal(n), 20, 600) * np.exp(-tt * 5); nz /= np.abs(nz).max()
    x = s + noise * nz
    x[: 200] *= np.linspace(0, 1, 200)
    return x / np.abs(x).max()
for at, g in [(26.36, 0.55), (31.62, 0.4), (39.78, 0.35), (47.45, 0.75), (54.47, 0.35), (70.42, 0.6)]:
    add(boom(), at, g)

# --- 6. distant missile rumble ---
rum = band(rng.standard_normal(N), 25, 140); rum /= np.abs(rum).max()
add(rum * env_lin([(0, 0), (18.6, 0), (21, 0.15), (24, 0.3), (27, 0.35), (30, 0.12), (34, 0.05), (36, 0)]), 0, 1.0)

# --- 7. jet flyby / peel away ---
def whoosh(d, lo, hi, peak=0.5):
    n = int(d * SR); tt = np.arange(n) / SR
    x = band(rng.standard_normal(n), lo, hi); x /= np.abs(x).max()
    e = np.exp(-((tt / d - peak) ** 2) / 0.04)
    return x * e
add(whoosh(2.6, 200, 3000, 0.6), 31.7, 0.35, -0.6)
add(whoosh(2.4, 150, 2500, 0.35), 41.15, 0.45, -0.4)

# --- 8. master caution beeps (quiet, under VO) ---
def beep(f=740, d=0.12):
    n = int(d * SR); tt = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 * np.minimum(1, (d - tt) * 80) * np.minimum(1, tt * 400)
for k in np.arange(43.6, 70.0, 1.6):
    add(band(beep(), None, 3000), k, 0.035); add(band(beep(), None, 3000), k + 0.18, 0.035)

# --- 9. riser into the choice ---
n = int(2.3 * SR); tt = np.arange(n) / SR
riser = band(rng.standard_normal(n), 400, 6000); riser /= np.abs(riser).max()
riser *= (tt / 2.3) ** 2.5
add(riser, 68.12, 0.22)

# --- 10. clock ticks during the choice ---
def tick(f=2200):
    n = int(0.04 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 160)
for k in np.arange(70.42, DUR - 0.2, 1.0):
    add(tick(2400 if int(k) % 2 else 1900), k, 0.25)

# --- 11. pulse on the outro ---
for k in np.arange(84.3, DUR - 0.5, 0.94):
    add(boom(0.9, 70, 40, 0.1), k, 0.22)

peak = np.abs(mix).max()
mix = mix / peak * 0.7 if peak > 0.7 else mix
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', OUT, f'{DUR}s')
