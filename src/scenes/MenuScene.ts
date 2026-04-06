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
  private aboutContainer!: Phaser.GameObjects.Container;
  private showingLB = false;
  private showingAbout = false;
  private aboutScrollY = 0;
  private aboutContent!: Phaser.GameObjects.Container;
  private aboutMask!: Phaser.Display.Masks.GeometryMask;
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

    const title = this.add.text(this.cx, this.cy - 10, 'SHIELDR', {
      fontSize: '72px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#44aaff',
    }).setOrigin(0.5).setDepth(10);
    title.setShadow(0, 0, '#44aaff', 20, true, true);

    this.add.text(this.cx, this.cy + 48, 'PROTECT THE CORE', {
      fontSize: '16px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#667788',
    }).setOrigin(0.5).setDepth(10);

    const menuX = this.cx - 100;

    this.createButton(menuX, this.cy + 100, '▶  NORMAL', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'normal' });
    });

    this.createButton(menuX, this.cy + 145, '◎  PRACTICE', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'practice' });
    });

    this.createButton(menuX, this.cy + 190, '☰  LEADERBOARD', () => {
      this.audio.playClick();
      this.toggleLeaderboard();
    });

    this.createButton(menuX, this.cy + 235, 'ⓘ  HOW TO PLAY', () => {
      this.audio.playClick();
      this.toggleAbout();
    });

    const volText = this.add.text(menuX, this.cy + 290, this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0, 0.5).setDepth(10).setInteractive({ useHandCursor: true });

    volText.on('pointerdown', () => {
      this.audio.enabled = !this.audio.enabled;
      StorageManager.setVolume(this.audio.enabled);
      volText.setText(this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF');
      if (this.audio.enabled) this.audio.playClick();
    });
    volText.on('pointerover', () => volText.setColor('#aabbcc'));
    volText.on('pointerout', () => volText.setColor('#556677'));

    this.buildLeaderboard();
    this.buildAbout();

    this.input.on('wheel', (_p: any, _gos: any, _dx: number, dy: number) => {
      if (this.showingAbout) {
        this.aboutScrollY = Math.max(0, this.aboutScrollY + dy * 0.5);
        this.aboutContent.setY(-this.aboutScrollY);
      }
    });

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
    const py = this.cy - 120;

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
    }).setOrigin(0, 0.5).setDepth(10).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => { btn.setColor('#ffffff'); btn.setScale(1.05); });
    btn.on('pointerout', () => { btn.setColor('#4499cc'); btn.setScale(1); });
    btn.on('pointerdown', cb);
    return btn;
  }

  /* ===== LEADERBOARD ===== */

  private buildLeaderboard() {
    this.leaderboardContainer = this.add.container(this.cx, this.cy).setDepth(50).setVisible(false);

    const bg = this.add.rectangle(0, 0, 500, 400, 0x0a0a1a, 0.95).setStrokeStyle(2, 0x335577);
    this.leaderboardContainer.add(bg);

    const title = this.add.text(0, -170, 'LEADERBOARD', {
      fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4af', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.leaderboardContainer.add(title);

    const header = this.add.text(-220, -130, 'RANK   NAME             RANK        WAVE   SCORE', {
      fontSize: '11px', fontFamily: 'monospace', color: '#556677',
    });
    this.leaderboardContainer.add(header);

    const entries = StorageManager.getLeaderboard().slice(0, 10);
    entries.forEach((e, i) => {
      const rank = String(i + 1).padStart(2, ' ');
      const name = e.name.padEnd(16, ' ');
      const titleStr = (e.title || '').padEnd(10, ' ');
      const wave = String(e.wave).padStart(4, ' ');
      const score = String(e.score).padStart(7, ' ');
      const row = this.add.text(-220, -100 + i * 26, `${rank}     ${name} ${titleStr} ${wave}   ${score}`, {
        fontSize: '13px', fontFamily: 'monospace',
        color: i === 0 ? '#ffcc44' : i < 3 ? '#44aaff' : '#8899aa',
      });
      this.leaderboardContainer.add(row);
    });

    const closeBtn = this.add.text(0, 170, '[ CLOSE ]', {
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

  /* ===== ABOUT / HOW TO PLAY ===== */

  private buildAbout() {
    const panelW = 560;
    const panelH = 520;

    this.aboutContainer = this.add.container(this.cx, this.cy).setDepth(60).setVisible(false);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a1a, 0.97).setStrokeStyle(2, 0x335577);
    this.aboutContainer.add(bg);

    const panelTitle = this.add.text(0, -panelH / 2 + 20, 'HOW TO PLAY', {
      fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#44aaff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.aboutContainer.add(panelTitle);

    // Scrollable content area
    const contentX = -panelW / 2 + 30;
    const contentTop = -panelH / 2 + 50;
    const contentW = panelW - 60;
    const contentH = panelH - 90;

    // Mask for scrolling
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(this.cx + contentX, this.cy + contentTop, contentW, contentH);
    this.aboutMask = maskShape.createGeometryMask();

    this.aboutContent = this.add.container(0, 0);
    this.aboutContent.setMask(this.aboutMask);
    this.aboutContainer.add(this.aboutContent);

    const h = this.addAboutText(contentX, contentTop, contentW);

    // Scroll hint
    if (h > contentH) {
      const hint = this.add.text(0, panelH / 2 - 35, '↕ Scroll for more', {
        fontSize: '11px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#445566',
      }).setOrigin(0.5);
      this.aboutContainer.add(hint);
    }

    const closeBtn = this.add.text(0, panelH / 2 - 18, '[ CLOSE ]', {
      fontSize: '14px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#556677'));
    closeBtn.on('pointerdown', () => this.toggleAbout());
    this.aboutContainer.add(closeBtn);
  }

  private addAboutText(x: number, startY: number, maxW: number): number {
    const hdr = (txt: string, y: number, color = '#44aaff') => {
      const t = this.add.text(x, y, txt, {
        fontSize: '14px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + 6;
    };

    const body = (txt: string, y: number, color = '#8899aa') => {
      const t = this.add.text(x, y, txt, {
        fontSize: '12px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, lineSpacing: 4,
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + 8;
    };

    const item = (name: string, color: string, desc: string, y: number) => {
      const nameText = this.add.text(x, y, `● ${name}`, {
        fontSize: '12px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      });
      this.aboutContent.add(nameText);
      const descText = this.add.text(x + 12, y + 16, desc, {
        fontSize: '11px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#778899', lineSpacing: 3,
      }).setWordWrapWidth(maxW - 12);
      this.aboutContent.add(descText);
      return 16 + descText.height + 6;
    };

    let y = startY;

    // THE GAME
    y += hdr('THE GAME', y);
    y += body(
      'Defend your planet core from endless waves of enemies. ' +
      'Left-click to place force field walls that destroy anything they touch. ' +
      'Survive as long as you can — there is no final wave.',
      y,
    );

    y += 6;
    y += hdr('CONTROLS', y);
    y += body(
      'Left-click — Place a force field (perpendicular to planet)\n' +
      'Right-click — Use item in Slot 1 of the item queue\n' +
      'Space — Emergency clear all active force fields\n' +
      'ESC — Pause the game',
      y,
    );

    y += 6;
    y += hdr('ENEMIES', y, '#ff8866');

    y += item('Drone', '#44ff88',
      'Fast triangle. 3 damage. Appears from Wave 1.', y);
    y += item('Rocket', '#ff6644',
      'Slow, heavy wedge. 15 damage. Appears from Wave 4.', y);
    y += item('Shooter', '#aa44ff',
      'Diamond shape. Stops at range and fires energy bolts (5 dmg each). 8 damage on contact. Appears from Wave 7.', y);
    y += item('Splitter', '#44ff44',
      'Large hexagon. 10 damage. When destroyed far from the core, splits into 2–3 fast mini-drones (2 dmg each). Kill it close to the core for a clean kill. Appears from Wave 9.', y);
    y += item('Phaser', '#44ffff',
      'Octagon that flickers visible/invisible every 0.8s. Can only be hit while visible — passes through shields when invisible. 10 damage. Appears from Wave 12.', y);
    y += item('Shield Breaker', '#ff4444',
      'Large armored wedge. First shield hit destroys the shield instead of the breaker. Requires a second shield to destroy it. 20 damage. Appears from Wave 14.', y);

    y += 6;
    y += hdr('MINI-BOSSES', y, '#ff8833');
    y += body('Every 10 waves, a mini-boss spawns alongside normal enemies.', y);

    y += item('Carrier', '#ff8833',
      'Huge orange diamond. Very slow. Spawns drones every 3s (max 8). Takes 3 shield hits to destroy. Each hit staggers it for 2s. 25 damage. +500 score. Appears at Wave 10, 20, 30...', y);
    y += item('Siege Unit', '#44ddcc',
      'Teal crescent that orbits the planet instead of charging it. Fires 3-bolt volleys every 2.5s. Orbit shrinks each lap. 1 shield hit kill. 30 damage if it reaches the core. +400 score. Appears at Wave 20, 30...', y);

    y += 6;
    y += hdr('SHIELD MECHANICS', y, '#88ddff');
    y += body(
      'Force fields are free to place with no cooldown. They last 5 seconds base duration and destroy enemies on contact.',
      y,
    );

    y += item('Overcharge', '#ffaa44',
      'If a single shield destroys 5+ enemies, it detonates on expiry with a blast radius that destroys nearby enemies.', y);
    y += item('Shield Interference', '#ff6666',
      'Overlapping shields decay faster (1.5x per overlap). Spread them out for full coverage.', y);

    y += 6;
    y += hdr('SCORING', y, '#ffcc44');
    y += body(
      'Drone +50  ·  Shooter +75  ·  Splitter +75  ·  Phaser +100\n' +
      'Rocket +100  ·  Shield Breaker +200  ·  Mini-Drone +25\n' +
      'Carrier +500  ·  Siege Unit +400',
      y,
    );
    y += body(
      'Multi-Kill: A shield that kills 3–4 enemies = x1.5 score. 5–7 = x2. 8+ = x3.\n' +
      'Close Call: +150 for killing an enemy very close to the core.\n' +
      'Last Second: +100 for blocking a projectile near the core.\n' +
      'Perfect Shield: +200 for clearing a wave with zero core damage.',
      y,
    );

    y += 6;
    y += hdr('PERFECT SHIELD STREAK', y, '#ff8844');
    y += body(
      'Consecutive zero-damage waves build a streak (shown as 🔥 on HUD). ' +
      'Each streak wave adds +0.5s to all shield durations. ' +
      'Any core damage resets the streak to zero.',
      y,
    );

    y += 6;
    y += hdr('PASSIVE UPGRADES', y, '#44ff44');
    y += body('Colored orbs float across the screen between or during waves. Click to collect.', y);

    y += item('Duration+', '#44ff44',
      'Green orb. Shields last 3s longer. Stacks 3 times (max +9s).', y);
    y += item('Width+', '#4488ff',
      'Blue orb. Shields become 25% wider. Stacks 3 times.', y);
    y += body(
      'Shields always reflect enemy projectiles back at the nearest enemy.',
      y,
    );
    y += body(
      'Every 3rd orb spawn shows 2 orbs side by side — pick one, the other fades.',
      y,
    );

    y += 6;
    y += hdr('ITEM ROULETTE SYSTEM', y, '#ffffff');
    y += body(
      'You have a 2-slot item queue (shown at top-center of the HUD). ' +
      'Slot 1 is ready — right-click to use. Slot 2 auto-shifts to Slot 1 when used. ' +
      'If both slots are full when you earn an item, it\'s lost.',
      y,
    );
    y += body(
      'Earn items by: collecting Item Box orbs (rainbow ? orbs), ' +
      'destroying 5+ enemies with one shield, or clearing a perfect wave.',
      y,
    );

    y += 4;
    y += hdr('ITEMS', y, '#aabbcc');

    y += item('Gravity Field', '#44ffff',
      'Right-click to place. Pushes nearby enemies away from the core for 3s. Buys time by shoving enemies back toward the screen edge.', y);
    y += item('Time Bender', '#ffffff',
      'All enemies slow to 30% speed for 4s. Shields work normally.', y);
    y += item('Health Surge', '#ff4444',
      'Instantly restores 20 HP to the planet core (max 100).', y);
    y += item('Star Bomb', '#ffdd44',
      'Your next shield placement triggers a massive explosion (3x shield radius). The shield still exists after the blast.', y);
    y += item('Time Freeze', '#aa44ff',
      'All enemies and projectiles freeze in place for 2.5s. You can still place shields to destroy them.', y);
    y += item('Sanctuary', '#ffcc44',
      'The planet core becomes invulnerable for 8s. Enemies that reach the core are destroyed but deal no damage. Golden dome visual with countdown ring.', y);
    y += item('Cardinal Rift', '#ff44ff',
      'All enemies warp to the nearest cardinal direction (N/S/E/W). Consolidates scattered enemies into 4 predictable lanes.', y);

    y += 6;
    y += hdr('RANKS', y, '#ffcc44');
    y += body(
      'Your highest wave reached earns a rank title:\n' +
      'Wave 5: Watcher  ·  Wave 10: Defender  ·  Wave 15: Guardian\n' +
      'Wave 20: Sentinel  ·  Wave 25: Warden  ·  Wave 30: Archon\n' +
      'Wave 40: Overlord  ·  Wave 50+: Eternal',
      y,
    );

    y += 6;
    y += hdr('GAME MODES', y);
    y += body(
      'Normal — Full game with scoring. Your score is saved to the leaderboard.\n' +
      'Practice — No core damage, no score recording. Experiment freely.',
      y,
    );

    y += 10;
    return y - startY;
  }

  private toggleAbout() {
    this.showingAbout = !this.showingAbout;
    if (this.showingAbout) {
      this.aboutScrollY = 0;
      this.aboutContent.setY(0);
      this.aboutContainer.setVisible(true);
      this.aboutContainer.setPosition(this.cx, this.cy);
    } else {
      this.aboutContainer.setVisible(false);
    }
  }
}
