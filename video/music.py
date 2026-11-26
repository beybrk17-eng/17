"""Procedural dark cinematic underscore for Bölüm 1 (no samples). Writes out/music.wav.
Structure follows the story: calm night -> missiles -> crisis -> choice."""
import sys, wave
import numpy as np

SR = 44100
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 93.0
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/music.wav'
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)


def env(points):
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def hz(note):  # midi -> Hz
    return 440.0 * 2 ** ((note - 69) / 12)


def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x))


def add(sig, start=0.0, gain=1.0, pan=0.0):
    i = int(start * SR); sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i:i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def pad_voice(f, d, bright=6):
    n = int(d * SR); tt = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.12, 0.0, 0.13):            # detuned "strings"
        ff = f * 2 ** (det / 12)
        for k in range(1, bright + 1):
            s += np.sin(2 * np.pi * ff * k * tt + rng.random() * 6) / (k ** 1.3)
    a = np.minimum(1, tt / 2.5) * np.minimum(1, (d - tt) / 2.5)
    return s * a / 6


# chord plan (A minor world): (start, dur, midi notes)
CH = [
    (0.0, 8.8, [45, 52, 57, 60]),        # Am
    (8.8, 8.0, [41, 48, 57, 60]),        # F
    (16.8, 6.4, [43, 50, 55, 62]),       # G sus
    (23.2, 7.0, [45, 52, 57, 63]),       # A(b5) unsettled
    (30.2, 6.5, [41, 48, 56, 60]),       # Fm
    (36.7, 6.7, [44, 51, 56, 63]),       # Ab
    (43.4, 9.0, [45, 52, 57, 60, 64]),   # Am add
    (52.4, 8.0, [41, 48, 57, 60, 65]),   # F
    (60.4, 10.0, [40, 47, 56, 59, 64]),  # E (dominant, tension)
    (70.4, 23.0, [45, 52, 57, 60, 71]),  # Am + high B (unresolved)
]
for st, d, notes in CH:
    for i, nt in enumerate(notes):
        v = pad_voice(hz(nt), d + 2.4, bright=5 if nt < 55 else 3)
        add(v, max(0, st - 1.2), 0.9 if nt < 50 else 0.55, pan=(-0.5 + i / max(1, len(notes) - 1)) * 0.8)

# sub drone
drone = np.sin(2 * np.pi * hz(33) * t) * 0.6 + np.sin(2 * np.pi * hz(40) * t) * 0.3
add(drone * env([(0, 0), (4, 0.25), (20, 0.35), (43, 0.5), (70, 0.6), (90, 0.55), (93, 0)]))


# heartbeat-like pulse (two thumps), tempo rises with tension
def thump(f0=58, d=0.35):
    n = int(d * SR); tt = np.arange(n) / SR
    f = 38 + (f0 - 38) * np.exp(-tt * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 11)


tm = 16.8
while tm < DUR - 1:
    bpm = 62 if tm < 43.4 else (82 if tm < 63.3 else 96)
    g = 0.5 if tm < 43.4 else 0.75
    add(thump(), tm, g); add(thump(52), tm + 0.2, g * 0.6)
    tm += 60 / bpm

# ostinato (filtered pluck arpeggio) from the crisis on
def pluck(f, d=0.5):
    n = int(d * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, 6))
    return s * np.exp(-tt * 7)


arp = [57, 60, 64, 60, 57, 64, 60, 65]
tm, i = 43.4, 0
while tm < 70.4:
    st = 0.25 if tm < 56.3 else 0.2
    add(pluck(hz(arp[i % len(arp)] + (0 if tm < 60.4 else -1 if arp[i % len(arp)] == 60 else 0))), tm, 0.16, pan=0.35 if i % 2 else -0.35)
    tm += st; i += 1

# sparse piano-ish notes in the calm intro
for st, nt in [(0.4, 69), (2.5, 72), (4.6, 71), (6.8, 67), (9.0, 69), (11.2, 65), (13.4, 64)]:
    n = int(3 * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * hz(nt) * tt) + 0.3 * np.sin(2 * np.pi * hz(nt) * 2 * tt) + 0.1 * np.sin(2 * np.pi * hz(nt) * 3 * tt)) * np.exp(-tt * 1.6)
    add(s, st, 0.22, pan=0.2)

# choice section: high shimmer
sh = sum(np.sin(2 * np.pi * hz(83) * (1 + d) * t) for d in (-0.003, 0.004)) * 0.5
add(sh * env([(0, 0), (70.4, 0), (74, 0.05), (90, 0.07), (93, 0)]))

# master envelope: quiet start, bigger in crisis, fade out
master = env([(0, 0), (1.5, 0.55), (16.8, 0.6), (26, 0.8), (43.4, 0.85), (60, 1.0), (70.4, 0.9), (84, 1.0), (91.5, 0.8), (93, 0)])
L *= master; R *= master
L = lowpass(L, 5200); R = lowpass(R, 5200)

# simple reverb: convolve with decaying noise IR
ir_n = int(2.2 * SR); it = np.arange(ir_n) / SR
for ch_i, ch in enumerate((L, R)):
    ir = rng.standard_normal(ir_n) * np.exp(-it * 2.6); ir[0] = 0
    wet = np.fft.irfft(np.fft.rfft(ch, N + ir_n) * np.fft.rfft(ir, N + ir_n), N + ir_n)[:N]
    wet *= np.abs(ch).max() / (np.abs(wet).max() + 1e-9)
    if ch_i == 0: L = ch * 0.7 + wet * 0.45
    else: R = ch * 0.7 + wet * 0.45

mix = np.stack([L, R], 1)
mix /= np.abs(mix).max() / 0.8
pcm = (np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', OUT)
