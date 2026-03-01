// SoundManager.js — Havenwood (animal sanctuary management)
// Procedural sound effects using Web Audio API (no audio files).
// Constructor creates AudioContext with master gain node; osc() and noise() are the core synthesis methods.

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.enabled = true;
        this.ambientTimer = 0;
        this.initialized = false;
    }

    // Create AudioContext and master gain node.
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.25;
            this.master.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            this.enabled = false;
        }
    }

    // Resume suspended AudioContext on user interaction (handles browser autoplay policy).
    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    // Core method: create an oscillator with type, frequency, duration, volume, optional detune.
    osc(type, freq, duration, volume = 0.3, detune = 0) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.master);
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        o.start(this.ctx.currentTime);
        o.stop(this.ctx.currentTime + duration);
    }

    // Generate filtered white noise burst (bandpass).
    noise(duration, volume = 0.1) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const bufSize = this.ctx.sampleRate * duration;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 2000;
        filt.Q.value = 0.5;
        src.connect(filt);
        filt.connect(g);
        g.connect(this.master);
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        src.start();
    }

    coin() { // Coin pickup: two-tone chime.
        this.osc('square', 880, 0.08, 0.2);
        setTimeout(() => this.osc('square', 1320, 0.12, 0.15), 60);
    }

    build() { // Building placement: low thud + noise.
        this.osc('sine', 150, 0.15, 0.3);
        this.osc('triangle', 200, 0.1, 0.2);
        this.noise(0.08, 0.15);
    }

    feed() { // Feeding animals: soft crunches + tone.
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.noise(0.04, 0.12), i * 50);
        }
        setTimeout(() => this.osc('sine', 600, 0.1, 0.1), 150);
    }

    pet() { // Petting: ascending gentle tones.
        this.osc('sine', 523, 0.2, 0.12);
        this.osc('sine', 659, 0.2, 0.1, 5);
        setTimeout(() => this.osc('sine', 784, 0.25, 0.08), 80);
    }

    treat() { // Treating: ascending arpeggio.
        const notes = [784, 988, 1175, 1318];
        notes.forEach((f, i) => {
            setTimeout(() => this.osc('sine', f, 0.15, 0.08), i * 50);
        });
    }

    rescue() { // Rescuing animal: triumphant chord progression.
        const notes = [440, 554, 659, 880];
        notes.forEach((f, i) => {
            setTimeout(() => {
                this.osc('triangle', f, 0.2, 0.15);
                this.osc('sine', f * 2, 0.15, 0.05);
            }, i * 120);
        });
    }

    notify() { // Notification: soft two-tone alert.
        this.osc('sine', 880, 0.3, 0.08);
        setTimeout(() => this.osc('sine', 1100, 0.4, 0.06), 100);
    }

    error() { // Error: low descending buzz.
        this.osc('sawtooth', 180, 0.2, 0.1);
        setTimeout(() => this.osc('sawtooth', 140, 0.25, 0.08), 100);
    }

    click() { // UI click: short beep.
        this.osc('square', 1000, 0.03, 0.1);
    }

    upgrade() { // Upgrade: ascending fanfare.
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            setTimeout(() => this.osc('sine', f, 0.25, 0.12), i * 80);
        });
    }

    seasonal() { // Seasonal transition: gentle chord.
        this.osc('sine', 440, 0.4, 0.1);
        setTimeout(() => this.osc('sine', 554, 0.4, 0.08), 200);
        setTimeout(() => this.osc('sine', 659, 0.5, 0.06), 400);
        setTimeout(() => this.osc('sine', 880, 0.6, 0.1), 600);
    }

    newDay() { // New day: soft triangle-wave arpeggio.
        this.osc('triangle', 330, 0.3, 0.08);
        setTimeout(() => this.osc('triangle', 440, 0.3, 0.06), 200);
        setTimeout(() => this.osc('triangle', 554, 0.4, 0.06), 400);
    }

    chirp() { // Single bird chirp: random-frequency sine with pitch bend.
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const freq = 1800 + Math.random() * 1400;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g);
        g.connect(this.master);
        o.type = 'sine';
        const t = this.ctx.currentTime;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.linearRampToValueAtTime(freq * 0.7, t + 0.08);
        o.frequency.linearRampToValueAtTime(freq * 1.1, t + 0.12);
        o.frequency.linearRampToValueAtTime(freq * 0.5, t + 0.2);
        g.gain.setValueAtTime(0.04, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.start(t);
        o.stop(t + 0.22);
    }

    // Play ambient bird chirps at intervals; more frequent during day, sparse at night.
    updateAmbient(delta, timeOfDay) {
        if (!this.enabled) return;
        this.ambientTimer += delta;
        const isDaytime = timeOfDay >= 360 && timeOfDay < 1140;
        const interval = isDaytime ? 4000 : 12000;
        if (this.ambientTimer >= interval) {
            this.ambientTimer = 0;
            if (Math.random() < 0.6) this.chirp();
            if (isDaytime && Math.random() < 0.3) {
                setTimeout(() => this.chirp(), 200 + Math.random() * 300);
            }
        }
    }
}
