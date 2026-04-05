import Phaser from 'phaser';
import { StorageManager } from '../storage';
import { AudioManager } from '../audio';

export class GameOverScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private score = 0;
  private wave = 0;
  private mode = 'normal';
  private particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: number }[] = [];
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameOverScene');
  }

  init(data: any) {
    this.score = data?.score || 0;
    this.wave = data?.wave || 0;
    this.mode = data?.mode || 'normal';
  }

  create() {
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;

    const audio = AudioManager.getInstance();
    audio.playGameOver();

    if (this.mode === 'normal') {
      const name = StorageManager.getGuardianName();
      StorageManager.saveScore(name, this.wave, this.score);
    }

    this.gfx = this.add.graphics();
    this.createShatterParticles();

    this.add.rectangle(this.cx, this.cy, this.scale.width, this.scale.height, 0x000000, 0.6).setDepth(0);

    const title = this.add.text(this.cx, this.cy - 120, 'THE CORE HAS FALLEN', {
      fontSize: '42px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#ff4466',
    }).setOrigin(0.5).setDepth(10);
    title.setShadow(0, 0, '#ff4466', 16, true, true);

    const bestScore = StorageManager.getPersonalBest(StorageManager.getGuardianName());

    this.add.text(this.cx, this.cy - 40, [
      `SCORE: ${this.score}`,
      `WAVE REACHED: ${this.wave}`,
      `PERSONAL BEST: ${bestScore}`,
    ].join('\n'), {
      fontSize: '20px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#8899aa',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setDepth(10);

    if (this.score >= bestScore && this.score > 0 && this.mode === 'normal') {
      const newBest = this.add.text(this.cx, this.cy + 50, '★ NEW PERSONAL BEST! ★', {
        fontSize: '18px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#ffcc44',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: newBest, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }

    this.createBtn(this.cx, this.cy + 110, '▶ TRY AGAIN', () => {
      audio.playClick();
      this.scene.start('GameScene', { mode: this.mode });
    });

    this.createBtn(this.cx, this.cy + 160, '◀ MAIN MENU', () => {
      audio.playClick();
      this.scene.start('MenuScene');
    });
  }

  update(_time: number, delta: number) {
    this.gfx.clear();
    const dt = delta / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 0.15;
      if (p.alpha < 0) p.alpha = 0;
      this.gfx.fillStyle(p.color, p.alpha);
      this.gfx.fillCircle(p.x, p.y, p.size);
    }
    this.particles = this.particles.filter(p => p.alpha > 0);
  }

  private createShatterParticles() {
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 160;
      this.particles.push({
        x: this.cx,
        y: this.cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 5,
        alpha: 0.8 + Math.random() * 0.2,
        color: [0x4488ff, 0x2255cc, 0x88bbff, 0xff4466, 0xffffff][Math.floor(Math.random() * 5)],
      });
    }
  }

  private createBtn(x: number, y: number, label: string, cb: () => void) {
    const btn = this.add.text(x, y, label, {
      fontSize: '20px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4499cc',
      padding: { x: 20, y: 6 },
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => { btn.setColor('#ffffff'); btn.setScale(1.05); });
    btn.on('pointerout', () => { btn.setColor('#4499cc'); btn.setScale(1); });
    btn.on('pointerdown', cb);
  }
}
