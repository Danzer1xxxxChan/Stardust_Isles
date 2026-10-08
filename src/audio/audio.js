// Fully synthesized audio: SFX, generative music, and ambience (wind, waves, birds, crickets, rain).
export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.5;
    this.sfxVol = 0.8;
    this.mood = 'day';
    this.ambience = { sea: 0, wind: 0.2, rain: 0, night: 0, birds: 0 };
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 1; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    // echo for music
    this.delay = ctx.createDelay(1.0); this.delay.delayTime.value = 0.42;
    this.fb = ctx.createGain(); this.fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay); dl.connect(this.music);
    this.noiseBuf = this._noise(2);
    this._ambienceInit();
    this._musicStart();
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    this.sfx.gain.value = sfx;
    this.music.gain.value = music * 0.5;
    this.ambGain.gain.value = sfx * 0.9;
  }

  _noise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  tone(freq, dur = 0.15, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const g = ctx.createGain();
    const v = (o.vol ?? 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.dest || this.sfx);
    if (o.echo) g.connect(this.delay);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  noise(dur = 0.2, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  play(name, arg) {
    if (!this.ctx) return;
    const n = (m) => 440 * Math.pow(2, (m - 69) / 12);
    switch (name) {
      case 'coin': this.tone(n(88), 0.08, { type: 'square', vol: 0.06 }); this.tone(n(95), 0.18, { type: 'square', vol: 0.06, delay: 0.06 }); break;
      case 'shard': [72, 76, 79, 84, 88].forEach((m, i) => { this.tone(n(m), 0.6, { type: 'triangle', vol: 0.16, delay: i * 0.09, echo: true }); this.tone(n(m + 12), 0.4, { vol: 0.05, delay: i * 0.09 }); }); break;
      case 'feather': for (let i = 0; i < 8; i++) this.tone(n(79 + i * 2), 0.25, { vol: 0.07, delay: i * 0.035, echo: true }); break;
      case 'jump': this.tone(330, 0.12, { type: 'square', vol: 0.04, slide: 620 }); break;
      case 'djump': this.tone(440, 0.14, { type: 'square', vol: 0.04, slide: 880 }); this.noise(0.15, { freq: 3000, filter: 'highpass', vol: 0.05 }); break;
      case 'land': this.noise(0.12, { freq: 400, vol: Math.min(0.35, 0.06 + (arg || 0) * 0.012) }); break;
      case 'step': this.noise(0.05, { freq: arg === 'water' ? 1800 : 700, vol: 0.035, rate: 0.8 + Math.random() * 0.4 }); break;
      case 'climbstep': this.noise(0.06, { freq: 1000, vol: 0.05 }); break;
      case 'stroke': this.noise(0.3, { freq: 900, sweep: 300, vol: 0.06 }); break;
      case 'glide': this.noise(0.5, { freq: 400, sweep: 1600, filter: 'bandpass', vol: 0.12, q: 2 }); break;
      case 'grab': this.noise(0.08, { freq: 1200, vol: 0.06 }); break;
      case 'splash': this.noise(0.5, { freq: 3000, sweep: 300, vol: 0.2 }); break;
      case 'exhausted': this.tone(300, 0.3, { type: 'sawtooth', vol: 0.04, slide: 150 }); break;
      case 'click': this.tone(1200, 0.04, { type: 'square', vol: 0.03 }); break;
      case 'open': this.tone(n(76), 0.1, { vol: 0.08 }); this.tone(n(83), 0.15, { vol: 0.08, delay: 0.06 }); break;
      case 'close': this.tone(n(83), 0.1, { vol: 0.08 }); this.tone(n(76), 0.15, { vol: 0.08, delay: 0.06 }); break;
      case 'blip': this.tone((arg || 500) * (0.9 + Math.random() * 0.25), 0.05, { type: 'triangle', vol: 0.05 }); break;
      case 'chest': [67, 71, 74, 79].forEach((m, i) => this.tone(n(m), 0.4, { type: 'triangle', vol: 0.12, delay: i * 0.07 })); break;
      case 'fanfare': [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.54], [84, 0.66]].forEach(([m, d]) => { this.tone(n(m), 0.45, { type: 'square', vol: 0.06, delay: d }); this.tone(n(m - 12), 0.45, { type: 'triangle', vol: 0.1, delay: d }); }); break;
      case 'fail': [67, 63, 60].forEach((m, i) => this.tone(n(m), 0.25, { type: 'triangle', vol: 0.1, delay: i * 0.12 })); break;
      case 'shutter': this.noise(0.04, { freq: 5000, filter: 'highpass', vol: 0.2 }); this.noise(0.05, { freq: 3000, filter: 'highpass', vol: 0.15, delay: 0.07 }); break;
      case 'bite': this.tone(n(84), 0.12, { type: 'square', vol: 0.08 }); this.tone(n(91), 0.15, { type: 'square', vol: 0.08, delay: 0.1 }); this.noise(0.2, { freq: 2000, vol: 0.1 }); break;
      case 'reel': this.tone(n(79 + (arg || 0) * 3), 0.1, { type: 'triangle', vol: 0.1 }); break;
      case 'dig': this.noise(0.15, { freq: 600, vol: 0.2 }); this.noise(0.12, { freq: 900, vol: 0.15, delay: 0.18 }); break;
      case 'ring': this.tone(n(84), 0.3, { vol: 0.12, echo: true }); this.tone(n(91), 0.3, { vol: 0.08, delay: 0.05 }); break;
      case 'fire': this.noise(0.8, { freq: 300, sweep: 2000, vol: 0.2 }); break;
      case 'sheep': this.tone(420, 0.35, { type: 'sawtooth', vol: 0.04, slide: 380 }); this.tone(424, 0.35, { type: 'sawtooth', vol: 0.03 }); break;
      case 'meow': this.tone(700, 0.3, { type: 'triangle', vol: 0.06, slide: 500 }); break;
      case 'mirror': this.tone(n(77), 0.2, { type: 'triangle', vol: 0.08 }); break;
      case 'tick': this.tone(n(81), 0.1, { type: 'square', vol: 0.05 }); break;
      case 'go': this.tone(n(88), 0.4, { type: 'square', vol: 0.07 }); break;
      case 'push': this.noise(0.25, { freq: 250, vol: 0.18 }); break;
      case 'plate': this.tone(n(64), 0.3, { type: 'triangle', vol: 0.12 }); this.tone(n(71), 0.3, { type: 'triangle', vol: 0.1, delay: 0.1 }); break;
      case 'star': [84, 88, 91, 96].forEach((m, i) => this.tone(n(m), 0.8, { vol: 0.08, delay: i * 0.15, echo: true })); break;
      case 'ability': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(n(m), 0.5, { type: 'triangle', vol: 0.11, delay: i * 0.08, echo: true })); break;
      default: break;
    }
  }

  // ---------- Ambience ----------
  _ambienceInit() {
    const ctx = this.ctx;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = this.sfxVol * 0.9; this.ambGain.connect(this.master);
    const loop = (freq, type, q = 0.7) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.ambGain); src.start();
      return { g, f };
    };
    this.windL = loop(500, 'lowpass');
    this.seaL = loop(700, 'lowpass');
    this.rainL = loop(4000, 'highpass');
    this._chirpT = 0;
  }

  updateAmbience(dt, a) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sm = (node, v) => node.g.gain.setTargetAtTime(v, t, 0.5);
    sm(this.windL, 0.03 + a.wind * 0.12);
    this.windL.f.frequency.setTargetAtTime(350 + Math.sin(t * 0.3) * 150 + a.wind * 300, t, 0.5);
    sm(this.seaL, a.sea * (0.08 + Math.max(0, Math.sin(t * 0.7)) * 0.08));
    sm(this.rainL, a.rain * 0.1);
    this._chirpT -= dt;
    if (this._chirpT <= 0) {
      this._chirpT = 0.4 + Math.random() * 2.5;
      if (a.night > 0.5 && a.rain < 0.3) {
        for (let i = 0; i < 3; i++) this.tone(4200 + Math.random() * 300, 0.04, { vol: 0.012, delay: i * 0.07, dest: this.ambGain });
      } else if (a.birds > 0.2 && a.rain < 0.3 && Math.random() < a.birds) {
        const base = 2200 + Math.random() * 1500;
        const k = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < k; i++) this.tone(base * (1 + (Math.random() - 0.5) * 0.2), 0.09, { vol: 0.02, delay: i * 0.12, slide: base * 1.3, dest: this.ambGain });
      }
    }
  }

  // ---------- Generative music ----------
  setMood(m) { this.mood = m; }

  _musicStart() {
    const ctx = this.ctx;
    const n = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const prog = {
      day: { chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], scale: [72, 74, 76, 79, 81, 84, 86], bpm: 76, density: 0.55 },
      night: { chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], scale: [69, 72, 74, 76, 79, 81], bpm: 60, density: 0.3 },
      rain: { chords: [[57, 60, 64], [55, 59, 62], [53, 57, 60], [53, 57, 60]], scale: [69, 72, 74, 76, 79], bpm: 64, density: 0.25 },
      tense: { chords: [[57, 60, 64], [57, 60, 64], [55, 58, 62], [55, 58, 62]], scale: [69, 71, 72, 74, 76, 77], bpm: 120, density: 0.9 },
      ending: { chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], scale: [72, 76, 79, 83, 84, 88], bpm: 70, density: 0.8 },
    };
    let beat = 0, next = ctx.currentTime + 0.5;
    const pad = (notes, t, dur) => {
      for (const m of notes) {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = n(m - 12); o.detune.value = det;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
          o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
        }
      }
    };
    const pluck = (m, t, v = 0.07) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = n(m);
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = n(m) * 2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      const g2 = ctx.createGain(); g2.gain.value = 0.15;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.music); g.connect(this.delay);
      o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
    };
    const tick = () => {
      if (!this.ctx) return;
      const P = prog[this.mood] || prog.day;
      const spb = 60 / P.bpm;
      while (next < ctx.currentTime + 0.3) {
        const bar = Math.floor(beat / 4) % P.chords.length;
        if (beat % 4 === 0) {
          pad(P.chords[bar], next, spb * 4.2);
          pluck(P.chords[bar][0] - 12, next, 0.05);
        }
        if (Math.random() < P.density) {
          const s = P.scale[Math.floor(Math.random() * P.scale.length)];
          pluck(s, next + (Math.random() < 0.3 ? spb / 2 : 0), 0.045);
        }
        beat++;
        next += spb;
      }
    };
    this._musicTimer = setInterval(tick, 100);
  }
}
