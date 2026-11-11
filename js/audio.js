/* LumeKids — tiny WebAudio sound kit (no assets, no dependencies). */
(function () {
  'use strict';

  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

  class LumeAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.ambient = null;
      this.muted = false;
      try {
        this.muted = localStorage.getItem('lumekids.muted') === '1';
      } catch (_) { /* private mode */ }
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.85;
        this.master.connect(this.ctx.destination);
        this.startAmbient();
      } catch (_) {
        this.ctx = null;
      }
    }

    startAmbient() {
      if (!this.ctx || this.ambient) return;
      const ctx = this.ctx;
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2.4);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.4;

      const notes = [146.83, 220, 293.66, 369.99];
      const gains = [0.5, 0.3, 0.18, 0.1];
      const oscs = notes.map((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1.5) * 3.5;
        const g = ctx.createGain();
        g.gain.value = gains[i];
        osc.connect(g);
        g.connect(filter);
        osc.start();
        return osc;
      });

      // Slow breathing motion on the pad level.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.055;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.014;
      lfo.connect(lfoGain);
      lfoGain.connect(bus.gain);
      lfo.start();

      filter.connect(bus);
      bus.connect(this.master);
      this.ambient = { bus, filter, oscs, lfo };
    }

    setMuted(muted, announce) {
      this.muted = muted;
      try { localStorage.setItem('lumekids.muted', muted ? '1' : '0'); } catch (_) { /* noop */ }
      if (this.master && this.ctx) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(muted ? 0 : 0.85, t, 0.08);
      }
      if (!muted && announce) this.init();
    }

    tone(freq, opts) {
      if (!this.ctx || this.muted) return;
      const o = opts || {};
      const ctx = this.ctx;
      const t = ctx.currentTime + (o.delay || 0);
      const dur = o.dur || 0.4;
      const gain = o.gain == null ? 0.08 : o.gain;

      const osc = ctx.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(24, o.slideTo), t + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + (o.attack || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      let node = g;
      if (o.lowpass) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lowpass;
        g.connect(f);
        node = f;
      }
      osc.connect(g);
      node.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.08);
    }

    click() {
      this.tone(660, { dur: 0.09, gain: 0.05, type: 'sine', slideTo: 880 });
    }

    collect(step) {
      const note = SCALE[step % SCALE.length];
      this.tone(note, { dur: 0.34, gain: 0.075, type: 'triangle' });
      this.tone(note * 2, { dur: 0.22, gain: 0.022, type: 'sine', delay: 0.01 });
      this.tone(2637, { dur: 0.1, gain: 0.012, type: 'sine', delay: 0.04 });
    }

    star() {
      [659.25, 880, 1108.73, 1318.51].forEach((f, i) => {
        this.tone(f, { dur: 0.5, gain: 0.06, type: 'triangle', delay: i * 0.07 });
        this.tone(f * 2, { dur: 0.35, gain: 0.014, type: 'sine', delay: i * 0.07 + 0.02 });
      });
    }

    hit() {
      this.tone(196, { dur: 0.36, gain: 0.1, type: 'sine', slideTo: 68, lowpass: 500 });
      this.tone(98, { dur: 0.3, gain: 0.07, type: 'triangle', slideTo: 55 });
    }

    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this.tone(f, { dur: 0.55, gain: 0.055, type: 'triangle', delay: i * 0.1 });
      });
      this.tone(2093, { dur: 0.5, gain: 0.012, type: 'sine', delay: 0.34 });
    }

    lightOut() {
      [392, 329.63, 261.63].forEach((f, i) => {
        this.tone(f, { dur: 0.6, gain: 0.06, type: 'sine', delay: i * 0.16, lowpass: 900 });
      });
    }

    victory() {
      const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
      melody.forEach((f, i) => {
        this.tone(f, { dur: 0.6, gain: 0.055, type: 'triangle', delay: i * 0.13 });
        this.tone(f / 2, { dur: 0.5, gain: 0.02, type: 'sine', delay: i * 0.13 });
      });
      this.tone(1567.98, { dur: 1.2, gain: 0.02, type: 'sine', delay: 0.95 });
    }
  }

  window.LumeAudio = LumeAudio;
})();
