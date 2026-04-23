import Phaser from 'phaser';
import { StorageManager, type RunStats } from '../storage';
import { AudioManager } from '../audio';

export class GameOverScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private score = 0;
  private wave = 0;
  private mode = 'competitive';
  private runStats: RunStats | null = null;
  private totalEnemiesDestroyed = 0;
  private particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: number }[] = [];
  private gfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('GameOverScene');
  }

  init(data: any) {
    this.score = data?.score || 0;
    this.wave = data?.wave || 0;
    this.mode = data?.mode || 'competitive';
    this.runStats = data?.runStats || null;
    this.totalEnemiesDestroyed = data?.totalEnemiesDestroyed || 0;
  }

  create() {
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;

    const audio = AudioManager.getInstance();
    audio.playGameOver();

    if (this.mode === 'competitive') {
      const name = StorageManager.getGuardianName();
      StorageManager.saveScore(name, this.wave, this.score);
      if (this.runStats) {
        StorageManager.updateLifetimeStats(this.runStats, this.wave, this.totalEnemiesDestroyed);
      }
    }

    this.gfx = this.add.graphics();
    this.createShatterParticles();

    this.add.rectangle(this.cx, this.cy, this.scale.width, this.scale.height, 0x000000, 0.6).setDepth(0);

    const m = !this.sys.game.device.os.desktop;
    const hasStats = !!this.runStats;
    const bestScore = StorageManager.getPersonalBest(StorageManager.getGuardianName());
    const playerTitle = StorageManager.getPlayerTitle(StorageManager.getGuardianName());
    const isNewBest = this.score >= bestScore && this.score > 0 && this.mode === 'competitive';

    // -- Title --
    // On mobile, pre-estimate total content height so we can vertically center it.
    let yPos: number;
    if (m) {
      const subLineCount = playerTitle ? 3 : 2;
      const subH = subLineCount * 16;   // ~12px font at ~1.3 line-height
      const newBestH = isNewBest ? 22 : 0;
      const statsH = hasStats ? (12 + 18 + 3 * 17) : 0;
      const totalH = 34         // title
        + 48                    // gap to score
        + 22                    // score
        + 30                    // gap to sub-stats
        + subH + 6              // sub-stats + gap
        + newBestH              // optional new-best row
        + 5                     // divider
        + statsH                // run stats block
        + 14                    // gap to buttons
        + 25 + 36 + 25;         // two buttons + gap
      yPos = Math.max(16, this.cy - totalH / 2);
    } else {
      yPos = this.cy - 220;
    }

    const title = this.add.text(this.cx, yPos, 'YOUR PLANET HAS FALLEN', {
      fontSize: m ? '28px' : '42px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#ff4466',
    }).setOrigin(0.5).setDepth(10);
    title.setShadow(0, 0, '#ff4466', m ? 8 : 16, true, true);

    // -- Main score info --
    yPos += m ? 48 : 70;

    this.add.text(this.cx, yPos, `SCORE: ${this.score}`, {
      fontSize: m ? '18px' : '22px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#ccddee',
    }).setOrigin(0.5).setDepth(10);

    yPos += m ? 30 : 32;

    const subStats = [`WAVE REACHED: ${this.wave}`, `PERSONAL BEST: ${bestScore}`];
    if (playerTitle) subStats.push(`RANK: ${playerTitle}`);

    const subText = this.add.text(this.cx, yPos, subStats.join(m ? '\n' : '    ·    '), {
      fontSize: m ? '12px' : '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#667788',
      align: 'center',
    }).setOrigin(0.5).setDepth(10);

    yPos += m ? subText.height + 6 : 28;

    if (isNewBest) {
      const newBest = this.add.text(this.cx, yPos, '★ NEW PERSONAL BEST! ★', {
        fontSize: m ? '13px' : '16px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#ffcc44',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: newBest, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
      yPos += m ? 20 : 30;
    }

    // -- Divider --
    yPos += m ? 4 : 8;
    const divGfx = this.add.graphics().setDepth(10);
    divGfx.lineStyle(1, 0x334455, 0.6);
    const divW = m ? 100 : 140;
    divGfx.lineBetween(this.cx - divW, yPos, this.cx + divW, yPos);

    // -- Run Stats --
    if (hasStats) {
      yPos += m ? 12 : 18;

      this.add.text(this.cx, yPos, 'R U N   S T A T S', {
        fontSize: m ? '10px' : '11px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#556677',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(10);

      yPos += m ? 18 : 24;

      const leftCol = [
        `Shields Placed:  ${this.runStats!.totalShieldsPlaced}`,
        `Best Multi-Kill:  ${this.runStats!.bestMultiKill}`,
        `Perfect Streak:  ${this.runStats!.longestPerfectStreak}`,
      ];
      const rightCol = [
        `${this.runStats!.favoriteSector}`,
        `Items Used:  ${this.runStats!.itemsUsed}`,
        `Close Calls:  ${this.runStats!.closeCalls}`,
      ];

      const colStyle: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: m ? '11px' : '13px',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#778899',
        lineSpacing: m ? 4 : 7,
      };

      this.add.text(this.cx - 10, yPos, leftCol.join('\n'), {
        ...colStyle, align: 'right',
      }).setOrigin(1, 0).setDepth(10);

      this.add.text(this.cx + 10, yPos, rightCol.join('\n'), {
        ...colStyle, align: 'left',
      }).setOrigin(0, 0).setDepth(10);

      yPos += leftCol.length * (m ? 17 : 22);
    }

    // -- Buttons --
    yPos += m ? 14 : 20;
    const btnGap = m ? 36 : 45;

    this.createBtn(this.cx, yPos, '▶ TRY AGAIN', () => {
      audio.playClick();
      this.scene.start('GameScene', { mode: this.mode });
    }, m);

    this.createBtn(this.cx, yPos + btnGap, '◀ MAIN MENU', () => {
      audio.playClick();
      this.scene.start('MenuScene');
    }, m);
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

  private createBtn(x: number, y: number, label: string, cb: () => void, mobile = false) {
    const btn = this.add.text(x, y, label, {
      fontSize: mobile ? '17px' : '20px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4499cc',
      padding: { x: mobile ? 14 : 20, y: mobile ? 4 : 6 },
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => { btn.setColor('#ffffff'); btn.setScale(1.05); });
    btn.on('pointerout', () => { btn.setColor('#4499cc'); btn.setScale(1); });
    btn.on('pointerdown', cb);
  }
}
