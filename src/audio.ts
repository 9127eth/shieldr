export class AudioManager {
  private static instance: AudioManager;
  private ctx!: AudioContext;
  private master!: GainNode;
  private _enabled = true;
  private initialized = false;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  private ensureCtx() {
    if (this.initialized) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.initialized = true;
  }

  get enabled() { return this._enabled; }

  set enabled(v: boolean) {
    this._enabled = v;
    if (this.initialized) {
      this.master.gain.value = v ? 1 : 0;
    }
  }

  private osc(type: OscillatorType, freq: number, duration: number, vol: number, freqEnd?: number): void {
    if (!this._enabled) return;
    this.ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + duration);
  }

  private noise(duration: number, vol: number): void {
    if (!this._enabled) return;
    this.ensureCtx();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const bufSize = this.ctx.sampleRate * duration;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(g).connect(this.master);
    src.start(t);
  }

  playZap(): void {
    this.osc('sawtooth', 900, 0.08, 0.15, 300);
    this.osc('square', 600, 0.06, 0.08, 200);
  }

  playEnemyDestroy(): void {
    this.noise(0.1, 0.12);
    this.osc('square', 400, 0.08, 0.1, 100);
  }

  playCoreHit(): void {
    this.osc('sine', 80, 0.3, 0.25, 30);
    this.osc('triangle', 60, 0.25, 0.15, 20);
  }

  playWaveClear(): void {
    this.osc('sine', 440, 0.15, 0.12);
    setTimeout(() => this.osc('sine', 554, 0.15, 0.12), 100);
    setTimeout(() => this.osc('sine', 659, 0.15, 0.12), 200);
    setTimeout(() => this.osc('sine', 880, 0.25, 0.15), 300);
  }

  playUpgrade(): void {
    this.osc('sine', 800, 0.08, 0.1);
    setTimeout(() => this.osc('sine', 1000, 0.08, 0.1), 60);
    setTimeout(() => this.osc('sine', 1200, 0.08, 0.1), 120);
    setTimeout(() => this.osc('sine', 1600, 0.15, 0.12), 180);
  }

  playGameOver(): void {
    this.osc('sine', 440, 0.3, 0.15, 220);
    setTimeout(() => this.osc('sine', 330, 0.3, 0.12, 165), 250);
    setTimeout(() => this.osc('sine', 220, 0.5, 0.15, 55), 500);
  }

  playClick(): void {
    this.osc('sine', 600, 0.04, 0.08, 400);
  }
}
