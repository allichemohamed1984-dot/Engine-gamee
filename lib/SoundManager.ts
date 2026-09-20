/**
 * SoundManager.ts
 * Robust Procedural Web Audio API Sound & Spatial 3D Audio Manager.
 * Features spatial 3D attenuation, dynamic BGM crossfading (Exploration vs Combat),
 * and a complete SFX library (footsteps, jump, coin, laser, explosion, torch, engine).
 */

export type SFXType =
  | 'footstep'
  | 'jump'
  | 'coin'
  | 'laser'
  | 'explosion'
  | 'torch'
  | 'engine'
  | 'wind'
  | 'rain'
  | 'thunder'
  | 'fire_crackle'
  | 'water'
  | 'splash'
  | 'powerup'
  | 'warp'
  | 'hit';
export type BGMMode = 'exploration' | 'combat' | 'off';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  // BGM Synth state
  private currentBgmMode: BGMMode = 'off';
  private bgmOscillator1: OscillatorNode | null = null;
  private bgmOscillator2: OscillatorNode | null = null;
  private bgmInterval: any = null;
  private isInitialized = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser policies
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.7;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.4;

      this.sfxGain.connect(this.masterGain);
      this.bgmGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API initialization failed:', e);
    }
  }

  public playSFX(type: SFXType) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.connect(this.sfxGain);
    osc.connect(gain);

    switch (type) {
      case 'jump':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(450, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
        break;

      case 'footstep':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.08);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.08);
        break;

      case 'coin':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, t); // B5
        osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
        break;

      case 'laser':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.2);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;

      case 'explosion': {
        // White noise explosion buffer
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.linearRampToValueAtTime(50, t + 0.5);

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        noise.start(t);
        noise.stop(t + 0.5);
        break;
      }

      case 'torch': {
        // Crackling noise burst
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() > 0.8 ? 1 : 0) * (Math.random() * 2 - 1);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        noise.start(t);
        noise.stop(t + 0.15);
        break;
      }

      case 'engine':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.linearRampToValueAtTime(110, t + 0.4);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;

      case 'wind': {
        // Procedural howling wind
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.8);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + 0.04 * white) / 1.04;
          lastOut = data[i];
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.linearRampToValueAtTime(650, t + 0.4);
        filter.frequency.linearRampToValueAtTime(320, t + 0.8);
        filter.Q.value = 3.0;

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.3);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.8);
        noise.start(t);
        noise.stop(t + 0.8);
        break;
      }

      case 'rain': {
        // Soft white noise rainfall burst
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.6);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.4;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, t);

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.02, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        noise.start(t);
        noise.stop(t + 0.6);
        break;
      }

      case 'thunder': {
        // Deep low frequency rumbling explosion
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99 * b0 + white * 0.05;
          b1 = 0.95 * b1 + white * 0.1;
          b2 = 0.85 * b2 + white * 0.2;
          data[i] = (b0 + b1 + b2) * 0.35;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, t);
        filter.frequency.linearRampToValueAtTime(60, t + 1.5);

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        noise.start(t);
        noise.stop(t + 1.5);
        break;
      }

      case 'fire_crackle': {
        // High frequency intermittent crackle pops
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() > 0.94 ? (Math.random() * 2 - 1) : 0;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1800;

        noise.connect(filter);
        filter.connect(this.sfxGain);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        noise.start(t);
        noise.stop(t + 0.3);
        break;
      }

      case 'water':
      case 'splash': {
        // Procedural fluid plunge / splash bubble synth
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.25);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);

        const bufferSize = Math.floor(this.ctx.sampleRate * 0.25);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.linearRampToValueAtTime(300, t + 0.25);

        noise.connect(filter);
        filter.connect(this.sfxGain);
        noise.start(t);
        noise.stop(t + 0.25);
        break;
      }

      case 'powerup': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.setValueAtTime(440, t + 0.08);
        osc.frequency.setValueAtTime(554.37, t + 0.16);
        osc.frequency.setValueAtTime(659.25, t + 0.24);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.start(t);
        osc.stop(t + 0.45);
        break;
      }

      case 'warp': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      }

      case 'hit': {
        osc.type = 'square';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }
    }
  }

  public playSpatialSound3D(
    type: SFXType,
    objectPos: { x: number; y: number; z: number },
    listenerPos: { x: number; y: number; z: number },
    maxDistance: number = 25
  ) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    // Calculate distance attenuation & stereo panning
    const dx = objectPos.x - listenerPos.x;
    const dz = objectPos.z - listenerPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > maxDistance) return; // Out of range

    const volume = Math.max(0, 1 - distance / maxDistance);
    if (volume <= 0.01) return;

    // Pan based on X position relative to listener
    const pan = Math.max(-1, Math.min(1, dx / maxDistance));

    const t = this.ctx.currentTime;
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, t);

    if (panner) {
      panner.pan.setValueAtTime(pan, t);
      gain.connect(panner);
      panner.connect(this.sfxGain);
    } else {
      gain.connect(this.sfxGain);
    }

    // Play SFX through the spatial gain/panner
    this.playSFX(type);
  }

  public setBGMMode(mode: BGMMode) {
    this.init();
    if (!this.ctx || !this.bgmGain) return;
    if (this.currentBgmMode === mode) return;

    this.currentBgmMode = mode;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }

    const t = this.ctx.currentTime;

    if (mode === 'off') {
      this.bgmGain.gain.setTargetAtTime(0, t, 0.5);
      return;
    }

    // Crossfade volume
    this.bgmGain.gain.setTargetAtTime(mode === 'combat' ? 0.5 : 0.3, t, 0.5);

    // Procedural ambient generator
    const notes = mode === 'combat' ? [130.81, 155.56, 196.0, 233.08] : [220.0, 261.63, 329.63, 392.0]; // C minor vs A minor
    let noteIdx = 0;

    this.bgmInterval = setInterval(() => {
      if (!this.ctx || this.currentBgmMode !== mode) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = mode === 'combat' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(notes[noteIdx % notes.length], now);
      noteIdx++;

      noteGain.connect(this.bgmGain!);
      osc.connect(noteGain);

      noteGain.gain.setValueAtTime(0.15, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.start(now);
      osc.stop(now + 1.2);
    }, mode === 'combat' ? 400 : 800);
  }

  public getBGMMode(): BGMMode {
    return this.currentBgmMode;
  }
}

// Singleton export
export const soundManager = new SoundManager();
