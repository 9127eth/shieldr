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

  playOverchargeDetonate(): void {
    this.noise(0.15, 0.2);
    this.osc('sine', 120, 0.3, 0.2, 40);
    this.osc('sawtooth', 200, 0.2, 0.12, 60);
  }

  playMultiKill(): void {
    this.osc('sine', 660, 0.1, 0.1);
    setTimeout(() => this.osc('sine', 880, 0.1, 0.12), 80);
    setTimeout(() => this.osc('sine', 1100, 0.15, 0.14), 160);
  }

  playCloseCall(): void {
    this.osc('triangle', 500, 0.1, 0.1, 800);
    setTimeout(() => this.osc('triangle', 700, 0.08, 0.08), 80);
  }

  playItemCollect(): void {
    this.osc('sine', 1200, 0.06, 0.1);
    setTimeout(() => this.osc('sine', 1400, 0.06, 0.1), 50);
  }

  playRouletteSpinTick(): void {
    this.osc('square', 900, 0.03, 0.06, 700);
  }

  playRouletteLand(): void {
    this.osc('sine', 600, 0.12, 0.1);
    setTimeout(() => this.osc('sine', 900, 0.12, 0.12), 100);
    setTimeout(() => this.osc('sine', 1200, 0.2, 0.14), 200);
  }

  playQueueFull(): void {
    this.osc('sawtooth', 150, 0.2, 0.1, 100);
  }

  playShieldBreak(): void {
    this.noise(0.12, 0.18);
    this.osc('square', 300, 0.15, 0.1, 80);
    this.osc('sawtooth', 200, 0.1, 0.08, 60);
  }

  playBossStagger(): void {
    this.noise(0.08, 0.1);
    this.osc('triangle', 250, 0.15, 0.12, 100);
  }

  playBossDeath(): void {
    this.noise(0.2, 0.2);
    this.osc('sine', 200, 0.4, 0.15, 50);
    setTimeout(() => this.osc('sine', 150, 0.3, 0.12, 40), 200);
    setTimeout(() => this.noise(0.15, 0.15), 350);
  }

  playRankUp(): void {
    this.osc('sine', 523, 0.15, 0.12);
    setTimeout(() => this.osc('sine', 659, 0.15, 0.12), 120);
    setTimeout(() => this.osc('sine', 784, 0.15, 0.12), 240);
    setTimeout(() => this.osc('sine', 1047, 0.3, 0.16), 360);
  }

  playGravityField(): void {
    this.osc('sine', 80, 0.4, 0.15, 40);
    this.osc('triangle', 120, 0.3, 0.1, 50);
  }

  playTimeBender(): void {
    this.osc('sine', 600, 0.4, 0.1, 200);
    this.osc('triangle', 400, 0.5, 0.08, 100);
  }

  playHealthSurge(): void {
    this.osc('sine', 400, 0.2, 0.1, 800);
    setTimeout(() => this.osc('sine', 600, 0.3, 0.12, 1000), 150);
  }

  playStarBomb(): void {
    this.noise(0.25, 0.25);
    this.osc('sine', 150, 0.4, 0.2, 30);
    this.osc('square', 100, 0.3, 0.15, 25);
  }

  playTimeFreeze(): void {
    this.osc('sine', 1200, 0.15, 0.1, 800);
    this.osc('square', 1000, 0.1, 0.06, 600);
  }

  playSanctuary(): void {
    this.osc('sine', 300, 0.3, 0.1, 500);
    this.osc('triangle', 400, 0.4, 0.08, 600);
  }

  playCardinalRift(): void {
    this.osc('sawtooth', 800, 0.12, 0.12, 400);
    this.noise(0.08, 0.1);
  }

  playSanctuaryHum(): void {
    this.osc('sine', 220, 0.5, 0.05);
    this.osc('sine', 330, 0.5, 0.03);
  }

  playSanctuaryEnd(): void {
    this.osc('sine', 500, 0.2, 0.08, 300);
  }
}
