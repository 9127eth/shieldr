import Phaser from 'phaser';
import { StorageManager } from '../storage';
import { AudioManager } from '../audio';

export class MenuScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private planetAngle = 0;
  private planetGfx!: Phaser.GameObjects.Graphics;
  private starField: { x: number; y: number; s: number; a: number }[] = [];
  private leaderboardContainer!: Phaser.GameObjects.Container;
  private showingLB = false;
  private audio!: AudioManager;

  constructor() {
    super('MenuScene');
  }

  create() {
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;
    this.audio = AudioManager.getInstance();
    this.audio.enabled = StorageManager.getVolume();

    this.generateStars();
    this.planetGfx = this.add.graphics();

    const title = this.add.text(this.cx, this.cy - 160, 'SHIELDR', {
      fontSize: '72px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#44aaff',
    
    }).setOrigin(0.5).setDepth(10);
    title.setShadow(0, 0, '#44aaff', 20, true, true);

    this.add.text(this.cx, this.cy - 95, 'PROTECT THE CORE', {
      fontSize: '16px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#667788',
    
    }).setOrigin(0.5).setDepth(10);

    this.createButton(this.cx, this.cy + 10, '▶  NORMAL', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'normal' });
    });

    this.createButton(this.cx, this.cy + 60, '◎  PRACTICE', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'practice' });
    });

    this.createButton(this.cx, this.cy + 110, '☰  LEADERBOARD', () => {
      this.audio.playClick();
      this.toggleLeaderboard();
    });

    const volText = this.add.text(this.cx, this.cy + 175, this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    volText.on('pointerdown', () => {
      this.audio.enabled = !this.audio.enabled;
      StorageManager.setVolume(this.audio.enabled);
      volText.setText(this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF');
      if (this.audio.enabled) this.audio.playClick();
    });
    volText.on('pointerover', () => volText.setColor('#aabbcc'));
    volText.on('pointerout', () => volText.setColor('#556677'));

    this.buildLeaderboard();

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.cx = gs.width / 2;
      this.cy = gs.height / 2;
    });
  }

  update(_time: number, delta: number) {
    this.planetAngle += delta * 0.0003;
    this.drawBackground();
  }

  private generateStars() {
    this.starField = [];
    for (let i = 0; i < 120; i++) {
      this.starField.push({
        x: Math.random() * 2000,
        y: Math.random() * 1200,
        s: Math.random() * 2 + 0.5,
        a: Math.random() * 0.6 + 0.2,
      });
    }
  }

  private drawBackground() {
    const g = this.planetGfx;
    g.clear();

    for (const s of this.starField) {
      g.fillStyle(0xffffff, s.a);
      g.fillCircle(s.x, s.y, s.s);
    }

    const px = this.cx;
    const py = this.cy + 40;

    g.fillStyle(0x2244aa, 0.06);
    g.fillCircle(px, py, 120);
    g.fillStyle(0x2244aa, 0.1);
    g.fillCircle(px, py, 80);
    g.fillStyle(0x1a3388, 1);
    g.fillCircle(px, py, 50);
    g.fillStyle(0x2952b8, 0.7);
    g.fillCircle(px - 8, py - 8, 40);
    g.fillStyle(0x4477dd, 0.3);
    g.fillCircle(px - 14, py - 14, 22);

    const ringTilt = Math.sin(this.planetAngle) * 0.3 + 0.35;
    g.lineStyle(2.5, 0x5599ff, 0.45);
    g.strokeEllipse(px, py, 140, 140 * ringTilt);
    g.lineStyle(1.5, 0x77bbff, 0.25);
    g.strokeEllipse(px, py, 170, 170 * ringTilt);
  }

  private createButton(x: number, y: number, label: string, cb: () => void) {
    const btn = this.add.text(x, y, label, {
      fontSize: '22px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4499cc',
      padding: { x: 24, y: 8 },
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => { btn.setColor('#ffffff'); btn.setScale(1.05); });
    btn.on('pointerout', () => { btn.setColor('#4499cc'); btn.setScale(1); });
    btn.on('pointerdown', cb);
    return btn;
  }

  private buildLeaderboard() {
    this.leaderboardContainer = this.add.container(this.cx, this.cy).setDepth(50).setVisible(false);

    const bg = this.add.rectangle(0, 0, 420, 380, 0x0a0a1a, 0.95).setStrokeStyle(2, 0x335577);
    this.leaderboardContainer.add(bg);

    const title = this.add.text(0, -160, 'LEADERBOARD', {
      fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4af', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.leaderboardContainer.add(title);

    const header = this.add.text(-180, -120, 'RANK   NAME             WAVE   SCORE', {
      fontSize: '12px', fontFamily: 'monospace', color: '#556677',
    });
    this.leaderboardContainer.add(header);

    const entries = StorageManager.getLeaderboard().slice(0, 10);
    entries.forEach((e, i) => {
      const rank = String(i + 1).padStart(2, ' ');
      const name = e.name.padEnd(16, ' ');
      const wave = String(e.wave).padStart(4, ' ');
      const score = String(e.score).padStart(7, ' ');
      const row = this.add.text(-180, -90 + i * 26, `${rank}     ${name} ${wave}   ${score}`, {
        fontSize: '14px', fontFamily: 'monospace',
        color: i === 0 ? '#ffcc44' : i < 3 ? '#44aaff' : '#8899aa',
      });
      this.leaderboardContainer.add(row);
    });

    const closeBtn = this.add.text(0, 160, '[ CLOSE ]', {
      fontSize: '14px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#556677'));
    closeBtn.on('pointerdown', () => this.toggleLeaderboard());
    this.leaderboardContainer.add(closeBtn);
  }

  private toggleLeaderboard() {
    this.showingLB = !this.showingLB;
    if (this.showingLB) {
      this.leaderboardContainer.destroy();
      this.buildLeaderboard();
      this.leaderboardContainer.setVisible(true);
    } else {
      this.leaderboardContainer.setVisible(false);
    }
  }
}
