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
  private aboutMaskGfx!: Phaser.GameObjects.Graphics;
  private aboutBackdrop!: Phaser.GameObjects.Rectangle;
  private aboutScrollbar!: Phaser.GameObjects.Graphics;
  private aboutTotalH = 0;
  private aboutContentH = 0;
  private audio!: AudioManager;

  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private menuButtons: Phaser.GameObjects.Text[] = [];
  private volText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;

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

    this.titleText = this.add.text(this.cx, this.cy - 10, 'SHIELDR', {
      fontSize: '72px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#44aaff',
    }).setOrigin(0.5).setDepth(10);
    this.titleText.setShadow(0, 0, '#44aaff', 20, true, true);

    this.subtitleText = this.add.text(this.cx, this.cy + 48, 'PROTECT THE CORE', {
      fontSize: '16px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#667788',
    }).setOrigin(0.5).setDepth(10);

    this.menuButtons = [];
    const menuX = this.cx - 100;

    this.menuButtons.push(this.createButton(menuX, this.cy + 100, '▶  COMPETITIVE', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'competitive' });
    }));

    this.menuButtons.push(this.createButton(menuX, this.cy + 145, '◎  PRACTICE', () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'practice' });
    }));

    this.menuButtons.push(this.createButton(menuX, this.cy + 190, '☰  LEADERBOARD', () => {
      this.audio.playClick();
      this.toggleLeaderboard();
    }));

    this.menuButtons.push(this.createButton(menuX, this.cy + 235, 'ⓘ  HOW TO PLAY', () => {
      this.audio.playClick();
      this.toggleAbout();
    }));

    this.volText = this.add.text(menuX, this.cy + 290, this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0, 0.5).setDepth(10).setInteractive({ useHandCursor: true });

    this.volText.on('pointerdown', () => {
      this.audio.enabled = !this.audio.enabled;
      StorageManager.setVolume(this.audio.enabled);
      this.volText.setText(this.audio.enabled ? '♫ SOUND: ON' : '♫ SOUND: OFF');
      if (this.audio.enabled) this.audio.playClick();
    });
    this.volText.on('pointerover', () => this.volText.setColor('#aabbcc'));
    this.volText.on('pointerout', () => this.volText.setColor('#556677'));

    const currentName = StorageManager.getGuardianName();
    this.nameText = this.add.text(menuX, this.cy + 325, `✎ ${currentName}`, {
      fontSize: '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0, 0.5).setDepth(10).setInteractive({ useHandCursor: true });

    this.nameText.on('pointerdown', () => {
      this.audio.playClick();
      this.promptNameChange();
    });
    this.nameText.on('pointerover', () => this.nameText.setColor('#aabbcc'));
    this.nameText.on('pointerout', () => this.nameText.setColor('#556677'));

    this.buildLeaderboard();
    this.buildAbout();

    this.input.on('wheel', (_p: any, _gos: any, _dx: number, dy: number) => {
      if (this.showingAbout) {
        const maxScroll = Math.max(0, this.aboutTotalH - this.aboutContentH);
        this.aboutScrollY = Phaser.Math.Clamp(this.aboutScrollY + dy * 0.5, 0, maxScroll);
        this.aboutContent.setY(-this.aboutScrollY);
        const panelW = 820, panelH = 780;
        const contentTop = -panelH / 2 + 65;
        this.drawAboutScrollbar(panelW, panelH, contentTop, this.aboutContentH);
      }
    });

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.cx = gs.width / 2;
      this.cy = gs.height / 2;
      this.repositionUI();
    });
  }

  private repositionUI() {
    const menuX = this.cx - 100;
    const buttonOffsets = [100, 145, 190, 235];

    this.titleText.setPosition(this.cx, this.cy - 10);
    this.subtitleText.setPosition(this.cx, this.cy + 48);

    this.menuButtons.forEach((btn, i) => {
      btn.setPosition(menuX, this.cy + buttonOffsets[i]);
    });

    this.volText.setPosition(menuX, this.cy + 290);
    this.nameText.setPosition(menuX, this.cy + 325);

    this.leaderboardContainer.setPosition(this.cx, this.cy);
    this.aboutContainer.setPosition(this.cx, this.cy);

    this.updateAboutMask();
  }

  private updateAboutMask() {
    const panelW = 820;
    const panelH = 780;
    const contentX = -panelW / 2 + 36;
    const contentTop = -panelH / 2 + 65;
    const contentW = panelW - 72;
    const contentH = panelH - 110;

    this.aboutBackdrop.setPosition(this.cx, this.cy);
    if (this.showingAbout) {
      this.drawAboutScrollbar(panelW, panelH, contentTop, contentH);
    }

    this.aboutMaskGfx.clear();
    this.aboutMaskGfx.fillStyle(0xffffff);
    this.aboutMaskGfx.fillRect(this.cx + contentX, this.cy + contentTop, contentW, contentH);
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

  private promptNameChange() {
    const openModal = (window as any).shieldrOpenNameModal;
    if (!openModal) return;
    const oldName = StorageManager.getGuardianName();
    openModal(oldName, (newName: string) => {
      StorageManager.renameGuardian(newName);
      this.nameText.setText(`✎ ${newName}`);
      if (this.showingLB) {
        this.leaderboardContainer.destroy();
        this.buildLeaderboard();
        this.leaderboardContainer.setVisible(true);
      }
    });
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
    const panelW = 820;
    const panelH = 780;

    this.aboutBackdrop = this.add.rectangle(this.cx, this.cy, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.5)
      .setDepth(59).setVisible(false).setInteractive();
    this.aboutBackdrop.on('pointerdown', () => this.toggleAbout());

    this.aboutContainer = this.add.container(this.cx, this.cy).setDepth(60).setVisible(false);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a1a, 0.97).setStrokeStyle(2, 0x335577);
    this.aboutContainer.add(bg);

    const panelTitle = this.add.text(0, -panelH / 2 + 28, 'HOW TO PLAY', {
      fontSize: '28px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#44aaff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.aboutContainer.add(panelTitle);

    const xBtn = this.add.text(panelW / 2 - 32, -panelH / 2 + 24, '✕', {
      fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#556677'));
    xBtn.on('pointerdown', () => this.toggleAbout());
    this.aboutContainer.add(xBtn);

    const contentX = -panelW / 2 + 36;
    const contentTop = -panelH / 2 + 65;
    const contentW = panelW - 72;
    const contentH = panelH - 110;
    this.aboutContentH = contentH;

    this.aboutMaskGfx = this.make.graphics({});
    this.aboutMaskGfx.fillStyle(0xffffff);
    this.aboutMaskGfx.fillRect(this.cx + contentX, this.cy + contentTop, contentW, contentH);
    this.aboutMask = this.aboutMaskGfx.createGeometryMask();

    this.aboutContent = this.add.container(0, 0);
    this.aboutContent.setMask(this.aboutMask);
    this.aboutContainer.add(this.aboutContent);

    const h = this.addAboutText(contentX, contentTop, contentW);
    this.aboutTotalH = h;

    // Scrollbar track + thumb
    this.aboutScrollbar = this.add.graphics().setDepth(61).setVisible(false);
    this.drawAboutScrollbar(panelW, panelH, contentTop, contentH);

    const closeBtn = this.add.text(0, panelH / 2 - 20, '[ CLOSE ]', {
      fontSize: '18px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#556677'));
    closeBtn.on('pointerdown', () => this.toggleAbout());
    this.aboutContainer.add(closeBtn);
  }

  private drawAboutScrollbar(panelW: number, panelH: number, contentTop: number, contentH: number) {
    const g = this.aboutScrollbar;
    g.clear();
    if (this.aboutTotalH <= contentH) return;

    const trackX = this.cx + panelW / 2 - 20;
    const trackY = this.cy + contentTop;
    const trackH = contentH;
    const trackW = 6;

    g.fillStyle(0x223344, 0.5);
    g.fillRoundedRect(trackX, trackY, trackW, trackH, 3);

    const ratio = contentH / this.aboutTotalH;
    const thumbH = Math.max(30, trackH * ratio);
    const maxScroll = this.aboutTotalH - contentH;
    const scrollFrac = maxScroll > 0 ? this.aboutScrollY / maxScroll : 0;
    const thumbY = trackY + scrollFrac * (trackH - thumbH);

    g.fillStyle(0x44aaff, 0.6);
    g.fillRoundedRect(trackX, thumbY, trackW, thumbH, 3);
  }

  private addAboutText(x: number, startY: number, maxW: number): number {
    const hdr = (txt: string, y: number, color = '#44aaff') => {
      const t = this.add.text(x, y, txt, {
        fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + 8;
    };

    const body = (txt: string, y: number, color = '#8899aa') => {
      const t = this.add.text(x, y, txt, {
        fontSize: '16px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, lineSpacing: 6,
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + 10;
    };

    const item = (name: string, color: string, desc: string, y: number) => {
      const nameText = this.add.text(x, y, `● ${name}`, {
        fontSize: '16px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      });
      this.aboutContent.add(nameText);
      const descText = this.add.text(x + 14, y + 22, desc, {
        fontSize: '14px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#778899', lineSpacing: 4,
      }).setWordWrapWidth(maxW - 14);
      this.aboutContent.add(descText);
      return 22 + descText.height + 8;
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
    y += item('Star Shield', '#ffcc44',
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
      'Competitive — Full game with scoring. Your score is saved to the leaderboard.\n' +
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
      this.aboutBackdrop.setVisible(true);
      this.aboutContainer.setVisible(true);
      this.aboutContainer.setPosition(this.cx, this.cy);
      this.aboutScrollbar.setVisible(true);
      const panelW = 820, panelH = 780;
      const contentTop = -panelH / 2 + 65;
      this.drawAboutScrollbar(panelW, panelH, contentTop, this.aboutContentH);
    } else {
      this.aboutBackdrop.setVisible(false);
      this.aboutContainer.setVisible(false);
      this.aboutScrollbar.setVisible(false);
    }
  }
}
