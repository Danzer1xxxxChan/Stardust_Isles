"""Synthesises the promo soundtrack, section by section, aligned to the video timeline.

Usage: python3 tools/promo/music.py tools/out/promo/timeline.json tools/out/promo/music.wav
Pure numpy/scipy: pads, plucks, bells, bass and drums, plus a convolution reverb.
"""
import json
import sys

import numpy as np
from scipy.signal import fftconvolve, lfilter

SR = 48000
rng = np.random.default_rng(7)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, d, s, r, sustain_len):
    """ADSR envelope (seconds) of total length n samples."""
    t = np.arange(n) / SR
    e = np.zeros(n)
    a = max(a, 1e-4)
    e = np.where(t < a, t / a, e)
    m = (t >= a) & (t < a + d)
    e = np.where(m, 1 - (1 - s) * (t - a) / max(d, 1e-4), e)
    m = (t >= a + d) & (t < sustain_len)
    e = np.where(m, s, e)
    m = t >= sustain_len
    e = np.where(m, s * np.exp(-(t - sustain_len) / max(r, 1e-4) * 4), e)
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR) + SR * 4
        self.dry = np.zeros((self.n, 2))
        self.wet = np.zeros((self.n, 2))

    def add(self, t0, sig, gain=1.0, pan=0.0, rev=0.3):
        i = int(t0 * SR)
        if i >= self.n:
            return
        sig = sig[: self.n - i]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        st = np.stack([sig * l, sig * r], axis=1) * gain
        self.dry[i:i + len(sig)] += st * (1 - rev * 0.5)
        self.wet[i:i + len(sig)] += st * rev


# ---------------- Instruments ----------------
def pad(freqs, dur, bright=1200, attack=1.2):
    n = int((dur + 2.5) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ph = rng.random() * 2 * np.pi
            fr = f * 2 ** (det / 12)
            saw = 2 * ((t * fr + ph / (2 * np.pi)) % 1) - 1
            out += saw
    out = lowpass(lowpass(out, bright), bright * 1.5)
    out *= env(n, attack, 0.5, 0.85, 1.6, dur)
    return out / (len(freqs) * 3)


def pluck(f, dur=0.9, bright=1.0):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9) * bright + 0.25 * np.sin(6 * np.pi * f * t) * np.exp(-t * 14) * bright
    return s * np.exp(-t * 4.5 / dur) * np.minimum(1, t / 0.003)


def bell(f, dur=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.6), (2.76, 0.45, 3.5), (5.4, 0.25, 6), (8.93, 0.12, 9)):
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return s * np.minimum(1, t / 0.002) * 0.5


def bass(f, dur):
    n = int((dur + 0.2) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.15 * np.sign(np.sin(2 * np.pi * f * t))
    s = lowpass(s, 700)
    return s * env(n, 0.01, 0.15, 0.7, 0.15, dur)


def kick(strength=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * strength + rng.standard_normal(n) * np.exp(-t * 120) * 0.15


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = highpass(rng.standard_normal(n), 1500) * np.exp(-t * 16)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 22)
    return noise * 0.6 + tone * 0.5


def hat(open_=False):
    n = int((0.35 if open_ else 0.08) * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 7000) * np.exp(-t * (9 if open_ else 55)) * 0.35


def shaker():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 5000) * np.sin(np.pi * t / 0.12) ** 2 * 0.18


def tom(f):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    fr = f * (1 + 0.6 * np.exp(-t * 20))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 6)


def swell(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 3000) * (t / dur) ** 3 * 0.5


def crash():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 4000) * np.exp(-t * 1.6) * 0.45


# ---------------- Arrangement ----------------
def chord(root, kind):
    iv = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'min7': [0, 3, 7, 10], 'sus': [0, 5, 7], 'add9': [0, 4, 7, 14]}[kind]
    return [root + i for i in iv]


def section_intro(T, t0, dur):
    prog = [(48, 'maj7'), (45, 'min7'), (41, 'maj7')]
    span = dur / len(prog)
    for i, (r, k) in enumerate(prog):
        T.add(t0 + i * span, pad([midi(m) for m in chord(r + 12, k)], span + 0.4, 1600, 1.5), 0.55, 0, 0.6)
    arp = [72, 76, 79, 83, 84, 83, 79, 76]
    for i in range(int(dur / 0.3125)):
        m = arp[i % len(arp)] + (0 if i < 8 else 2 if i < 16 else 0)
        T.add(t0 + 0.6 + i * 0.3125, bell(midi(m), 1.8), 0.16 * min(1, i / 6 + 0.2), (i % 2) * 0.6 - 0.3, 0.7)
    T.add(t0 + dur - 2.0, swell(2.0), 0.4, 0, 0.6)


def groove(T, t0, dur, prog, bpm=100, drums='light', melody=None, bassline=True, plk=True, gain=1.0):
    beat = 60 / bpm
    bar = beat * 4
    bars = int(np.ceil(dur / bar))
    for b in range(bars):
        tb = t0 + b * bar
        if tb >= t0 + dur:
            break
        r, k = prog[b % len(prog)]
        notes = chord(r, k)
        T.add(tb, pad([midi(m + 12) for m in notes], bar, 1100, 0.4), 0.32 * gain, 0, 0.45)
        if bassline:
            for q in range(4):
                if tb + q * beat < t0 + dur:
                    T.add(tb + q * beat, bass(midi(r - 12 + (7 if q == 2 else 0)), beat * 0.9), 0.38 * gain, 0, 0.05)
        if plk:
            pattern = [0, 2, 1, 2, 0, 2, 1, 3]
            ext = notes + [notes[0] + 12]
            for e in range(8):
                te = tb + e * beat / 2
                if te < t0 + dur:
                    T.add(te, pluck(midi(ext[pattern[e] % len(ext)] + 24), 0.6), 0.13 * gain, -0.4 + 0.8 * (e % 2), 0.35)
        for q in range(4):
            tq = tb + q * beat
            if tq >= t0 + dur:
                break
            if drums == 'light':
                if q in (0, 2):
                    T.add(tq, kick(0.6), 0.45 * gain, 0, 0.05)
                T.add(tq + beat / 2, shaker(), 0.6 * gain, 0.3, 0.1)
                T.add(tq, shaker(), 0.35 * gain, -0.3, 0.1)
            elif drums == 'drive':
                T.add(tq, kick(1.0), 0.6 * gain, 0, 0.05)
                if q in (1, 3):
                    T.add(tq, snare(), 0.42 * gain, 0, 0.25)
                for h in range(4):
                    T.add(tq + h * beat / 4, hat(h == 2 and q == 3), (0.32 if h % 2 == 0 else 0.2) * gain, 0.35, 0.05)
    if melody:
        for (pos, m, ln) in melody:
            tm = t0 + pos * beat
            if tm < t0 + dur:
                T.add(tm, pluck(midi(m), ln * beat + 0.4, 0.6), 0.22 * gain, 0.15, 0.45)
                T.add(tm, bell(midi(m + 12), 1.4), 0.05 * gain, -0.2, 0.6)


def section_build(T, t0, dur):
    prog = [(45, 'min'), (41, 'maj'), (48, 'maj'), (43, 'sus')]
    span = dur / len(prog)
    for i, (r, k) in enumerate(prog):
        T.add(t0 + i * span, pad([midi(m) for m in chord(r + 12, k)] + [midi(r + 24)], span + 0.3, 900 + i * 500, 0.8), 0.5, 0, 0.55)
        T.add(t0 + i * span, bass(midi(r - 12), span), 0.35, 0, 0.1)
    beat = 0.6
    nb = int(dur / beat)
    for i in range(nb):
        k = i / nb
        if i % 2 == 0 or k > 0.5:
            T.add(t0 + i * beat, kick(0.5 + 0.5 * k), 0.4 + 0.3 * k, 0, 0.1)
        if k > 0.6:
            T.add(t0 + i * beat + beat / 2, tom(120 + 60 * (i % 3)), 0.25 * k, (i % 3 - 1) * 0.4, 0.3)
    # rising arpeggio
    arp = [69, 72, 76, 79, 81, 84]
    for i in range(int(dur / 0.3)):
        T.add(t0 + i * 0.3, bell(midi(arp[i % 6] + (12 if i > dur / 0.3 * 0.6 else 0)), 1.2), 0.08 + 0.1 * i / (dur / 0.3), 0.5 - (i % 2), 0.6)
    T.add(t0 + dur - 2.5, swell(2.5), 0.7, 0, 0.5)


def section_end(T, t0, dur):
    T.add(t0, crash(), 0.6, 0, 0.6)
    T.add(t0, kick(1.0), 0.6, 0, 0.3)
    prog = [(48, 'add9'), (41, 'maj7'), (43, 'sus'), (48, 'maj')]
    span = (dur - 1.5) / len(prog)
    for i, (r, k) in enumerate(prog):
        T.add(t0 + i * span, pad([midi(m) for m in chord(r + 12, k)] + [midi(r)], span + (2.5 if i == 3 else 0.3), 1500, 0.6 if i else 0.05), 0.6, 0, 0.6)
        T.add(t0 + i * span, bass(midi(r - 12), span), 0.3, 0, 0.2)
    mel = [84, 83, 79, 76, 79, 81, 79, 76, 72]
    for i, m in enumerate(mel):
        T.add(t0 + 1.2 + i * 0.85, bell(midi(m), 2.6), 0.2, 0.25 * np.sin(i), 0.7)


def build(timeline, out):
    shots = {s['name']: s for s in timeline['timeline']}
    total = sum(s['dur'] for s in timeline['timeline'])
    T = Track(total)

    def span(a, b):
        return shots[a]['start'], shots[b]['start'] + shots[b]['dur'] - shots[a]['start']

    s0, d0 = span('title', 'title')
    section_intro(T, s0, d0)
    s1, d1 = span('dialog', 'travel')
    explore = [(48, 'maj'), (45, 'min'), (41, 'maj'), (43, 'maj')]
    mel = []
    motif = [(0, 76, 1), (1, 79, 1), (2, 81, 1.5), (3.5, 79, 0.5), (4, 76, 2), (6, 74, 1), (7, 72, 1),
             (8, 72, 1), (9, 74, 1), (10, 76, 1.5), (11.5, 79, 0.5), (12, 74, 3)]
    for rep in range(int(d1 / (16 * 0.6)) + 1):
        mel += [(p + rep * 16, m, ln) for (p, m, ln) in motif]
    groove(T, s1, d1, explore, bpm=100, drums='light', melody=mel, gain=0.62)
    s2, d2 = span('timelapse', 'timelapse')
    groove(T, s2, d2, [(41, 'maj7'), (43, 'sus'), (45, 'min7'), (43, 'maj')], bpm=100, drums=None, bassline=True, plk=True, gain=0.55,
           melody=[(0, 84, 2), (2, 83, 2), (4, 79, 4), (8, 81, 2), (10, 79, 2), (12, 76, 4)])
    s3, d3 = span('far', 'canyon')
    section_build(T, s3, d3)
    s4, d4 = span('combo', 'chest')
    T.add(s4, crash(), 0.55, 0, 0.5)
    combat = [(45, 'min'), (41, 'maj'), (43, 'maj'), (40, 'maj')]
    cm = []
    riff = [(0, 69, 0.5), (0.5, 72, 0.5), (1, 76, 0.5), (1.5, 72, 0.5), (2, 77, 1), (3, 76, 0.5), (3.5, 74, 0.5)]
    for rep in range(int(d4 / 2.4) + 1):
        cm += [(p + rep * 4, m + (0 if rep % 4 < 2 else -2), ln) for (p, m, ln) in riff]
    groove(T, s4, d4, combat, bpm=100, drums='drive', melody=cm, gain=1.0)
    s5, d5 = span('ending', 'ending')
    section_end(T, s5, d5)

    # Reverb: exponentially decaying stereo noise IR.
    ir_len = int(2.4 * SR)
    t = np.arange(ir_len) / SR
    irs = [lowpass(rng.standard_normal(ir_len), 5000) * np.exp(-t * 2.8) for _ in range(2)]
    wet = np.stack([fftconvolve(T.wet[:, c], irs[c])[: T.n] for c in range(2)], axis=1) * 0.12
    mix = T.dry + wet
    n = int(total * SR)
    mix = mix[:n]
    # gentle master: soft clip + normalise, fade out the last 2.5 s
    mix = np.tanh(mix * 1.4) / np.tanh(1.4)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.89
    fade = int(2.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))[:, None]
    pcm = (mix * 32767).astype(np.int16)
    import wave
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print('wrote', out, f'{total:.1f}s')


if __name__ == '__main__':
    build(json.load(open(sys.argv[1])), sys.argv[2])
