import Phaser from 'phaser';
import { StorageManager } from '../storage';
import { AudioManager } from '../audio';

export class MenuScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private planetAngle = 0;
  private planetGfx!: Phaser.GameObjects.Graphics;
  private starField: { x: number; y: number; s: number; a: number; speed: number; twinkle: number }[] = [];
  private starFieldW = 0;
  private starFieldH = 0;
  private starDirX = 0;
  private starDirY = 1;
  private leaderboardContainer!: Phaser.GameObjects.Container;
  private leaderboardBackdrop!: Phaser.GameObjects.Rectangle;
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
  private isMobile = false;
  private aboutPanelW = 820;
  private aboutPanelH = 780;

  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private menuButtons: Phaser.GameObjects.Container[] = [];
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
    this.isMobile = !this.sys.game.device.os.desktop;

    this.generateStars();
    this.planetGfx = this.add.graphics();

    this.titleText = this.add.text(this.cx, this.cy - 140, 'SHIELDR', {
      fontSize: '88px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    } as any).setOrigin(0.5).setDepth(10);
    this.titleText.setLetterSpacing?.(4);

    this.subtitleText = this.add.text(this.cx, this.cy - 82, 'PROTECT YOUR PLANET', {
      fontSize: '14px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#6a8aa8',
    } as any).setOrigin(0.5).setDepth(10);
    this.subtitleText.setLetterSpacing?.(6);

    this.menuButtons = [];
    const btnW = 260;
    const btnH = 44;
    const btnGap = 12;
    const firstBtnY = this.cy - 20;

    this.menuButtons.push(this.createBoxButton(this.cx, firstBtnY, btnW, btnH, '▶  COMPETITIVE', 0x4aa4ff, () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'competitive' });
    }));

    this.menuButtons.push(this.createBoxButton(this.cx, firstBtnY + (btnH + btnGap), btnW, btnH, '◎  PRACTICE', 0x4aa4ff, () => {
      this.audio.playClick();
      this.scene.start('GameScene', { mode: 'practice' });
    }));

    this.menuButtons.push(this.createBoxButton(this.cx, firstBtnY + (btnH + btnGap) * 2, btnW, btnH, '☰  LEADERBOARD', 0x4aa4ff, () => {
      this.audio.playClick();
      this.toggleLeaderboard();
    }));

    this.menuButtons.push(this.createBoxButton(this.cx, firstBtnY + (btnH + btnGap) * 3, btnW, btnH, 'ⓘ  HOW TO PLAY', 0x4aa4ff, () => {
      this.audio.playClick();
      this.toggleAbout();
    }));

    const footerY = firstBtnY + (btnH + btnGap) * 3 + btnH / 2 + 28;

    this.volText = this.add.text(this.cx, footerY, this.audio.enabled ? '♫  SOUND: ON' : '♫  SOUND: OFF', {
      fontSize: '13px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

    this.volText.on('pointerdown', () => {
      this.audio.enabled = !this.audio.enabled;
      StorageManager.setVolume(this.audio.enabled);
      this.volText.setText(this.audio.enabled ? '♫  SOUND: ON' : '♫  SOUND: OFF');
      if (this.audio.enabled) this.audio.playClick();
    });
    this.volText.on('pointerover', () => this.volText.setColor('#aabbcc'));
    this.volText.on('pointerout', () => this.volText.setColor('#556677'));

    const currentName = StorageManager.getGuardianName();
    this.nameText = this.add.text(this.cx, footerY + 22, `✎  ${currentName}`, {
      fontSize: '13px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677',
    }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

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
        this.scrollAbout(dy * 0.5);
      }
    });

    if (this.isMobile) {
      let aboutDragY: number | null = null;
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.showingAbout) aboutDragY = p.y;
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!this.showingAbout || aboutDragY === null) return;
        const dy = aboutDragY - p.y;
        aboutDragY = p.y;
        this.scrollAbout(dy);
      });
      this.input.on('pointerup', () => { aboutDragY = null; });
    }

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.cx = gs.width / 2;
      this.cy = gs.height / 2;
      this.repositionUI();
    });
  }

  private repositionUI() {
    const btnH = 44;
    const btnGap = 12;
    const firstBtnY = this.cy - 20;

    this.titleText.setPosition(this.cx, this.cy - 140);
    this.subtitleText.setPosition(this.cx, this.cy - 82);

    this.menuButtons.forEach((btn, i) => {
      btn.setPosition(this.cx, firstBtnY + (btnH + btnGap) * i);
    });

    const footerY = firstBtnY + (btnH + btnGap) * 3 + btnH / 2 + 28;
    this.volText.setPosition(this.cx, footerY);
    this.nameText.setPosition(this.cx, footerY + 22);

    this.leaderboardContainer.setPosition(this.cx, this.cy);
    this.aboutContainer.setPosition(this.cx, this.cy);

    this.updateAboutMask();
  }

  private updateAboutMask() {
    const panelW = this.aboutPanelW;
    const panelH = this.aboutPanelH;
    const m = this.isMobile;
    const pad = m ? 16 : 36;
    const contentX = -panelW / 2 + pad;
    const contentTop = -panelH / 2 + (m ? 52 : 65);
    const contentW = panelW - pad * 2;
    const contentH = panelH - (m ? 80 : 110);

    this.aboutBackdrop.setPosition(this.cx, this.cy);
    if (this.showingAbout) {
      this.drawAboutScrollbar(panelW, panelH, contentTop, contentH);
    }

    this.aboutMaskGfx.clear();
    this.aboutMaskGfx.fillStyle(0xffffff);
    this.aboutMaskGfx.fillRect(this.cx + contentX, this.cy + contentTop, contentW, contentH);
  }

  update(time: number, delta: number) {
    this.planetAngle += delta * 0.0003;
    this.updateStars(delta);
    this.drawBackground(time);
  }

  private generateStars() {
    this.starField = [];
    this.starFieldW = Math.max(this.scale.width, 1200);
    this.starFieldH = Math.max(this.scale.height, 900);

    // Pick a random travel direction: 8 cardinals/diagonals, equal chance.
    const dirIdx = Math.floor(Math.random() * 8);
    const angle = (dirIdx * Math.PI) / 4;
    this.starDirX = Math.cos(angle);
    this.starDirY = Math.sin(angle);

    const count = 320;
    for (let i = 0; i < count; i++) {
      // Three parallax layers: far (slow, dim, small), mid, near (fast, bright, larger).
      const layer = Math.random();
      let s: number, a: number, speed: number;
      if (layer < 0.55) {
        s = Math.random() * 0.8 + 0.3;
        a = Math.random() * 0.35 + 0.15;
        speed = 4;
      } else if (layer < 0.88) {
        s = Math.random() * 1.2 + 0.7;
        a = Math.random() * 0.4 + 0.35;
        speed = 9;
      } else {
        s = Math.random() * 1.6 + 1.2;
        a = Math.random() * 0.35 + 0.6;
        speed = 16;
      }
      this.starField.push({
        x: Math.random() * this.starFieldW,
        y: Math.random() * this.starFieldH,
        s, a, speed,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  private updateStars(delta: number) {
    const w = this.scale.width;
    const h = this.scale.height;
    if (w > this.starFieldW) this.starFieldW = w;
    if (h > this.starFieldH) this.starFieldH = h;

    const dt = delta / 1000;
    const dx = this.starDirX;
    const dy = this.starDirY;
    const margin = 4;

    for (const s of this.starField) {
      s.x += s.speed * dx * dt;
      s.y += s.speed * dy * dt;

      if (s.x > w + margin) { s.x = -margin; s.y = Math.random() * h; }
      else if (s.x < -margin) { s.x = w + margin; s.y = Math.random() * h; }

      if (s.y > h + margin) { s.y = -margin; s.x = Math.random() * w; }
      else if (s.y < -margin) { s.y = h + margin; s.x = Math.random() * w; }
    }
  }

  private drawBackground(time: number) {
    const g = this.planetGfx;
    g.clear();

    for (const s of this.starField) {
      const tw = 0.75 + 0.25 * Math.sin(time * 0.002 + s.twinkle);
      g.fillStyle(0xffffff, Math.min(1, s.a * tw));
      g.fillCircle(s.x, s.y, s.s);
    }

    const px = this.cx;
    const py = this.cy - 340;
    const R = 50;
    const ang = this.planetAngle;
    const tilt = 0.34;

    g.fillStyle(0x2a4a88, 0.04); g.fillCircle(px, py, R + 44);
    g.fillStyle(0x3d6dbf, 0.06); g.fillCircle(px, py, R + 28);
    g.fillStyle(0x5a8ed8, 0.10); g.fillCircle(px, py, R + 14);
    g.fillStyle(0x7fb0ee, 0.18); g.fillCircle(px, py, R + 5);

    this.drawMenuRings(g, px, py, R, ang, tilt, 'back');

    g.fillStyle(0x081533, 1);         g.fillCircle(px, py, R);
    g.fillStyle(0x13306e, 1);         g.fillCircle(px - 2, py - 3, R - 1);
    g.fillStyle(0x2553a8, 1);         g.fillCircle(px - 4, py - 5, R - 4);
    g.fillStyle(0x3b74d0, 0.85);      g.fillCircle(px - 7, py - 8, R - 9);

    this.drawMenuContinents(g, px, py, R, ang);
    this.drawMenuClouds(g, px, py, R, ang * 1.35 + 0.7);

    g.fillStyle(0xdfe9ff, 0.45); g.fillEllipse(px - 3, py - R + 5, R * 0.95, 6);
    g.fillStyle(0xdfe9ff, 0.28); g.fillEllipse(px - 2, py + R - 5, R * 0.8, 5);

    g.fillStyle(0x9ec9ff, 0.22); g.fillCircle(px - 11, py - 12, R * 0.55);
    g.fillStyle(0xd6e4ff, 0.18); g.fillCircle(px - 15, py - 15, R * 0.28);

    g.fillStyle(0x000010, 0.30); g.fillCircle(px + 7, py + 6, R - 2);
    g.fillStyle(0x000008, 0.25); g.fillCircle(px + 11, py + 9, R - 5);

    g.lineStyle(1.5, 0x03081a, 0.85); g.strokeCircle(px, py, R);
    g.lineStyle(1,   0x88b8ff, 0.30); g.strokeCircle(px, py, R - 1);

    this.drawMenuRings(g, px, py, R, ang, tilt, 'front');
  }

  private drawMenuContinents(g: Phaser.GameObjects.Graphics, cx: number, cy: number, R: number, ang: number) {
    const continents: [number, number, number, number][] = [
      [0.0, -0.30, 11, 0],
      [0.8,  0.20,  9, 1],
      [1.6, -0.10, 10, 0],
      [2.5,  0.45,  7, 1],
      [3.3, -0.40, 12, 0],
      [4.2,  0.10,  8, 1],
      [5.1,  0.35,  9, 0],
      [5.8, -0.25,  7, 1],
    ];
    const base = [0x2f6b3f, 0x3a7a4a];
    const hi   = [0x5a9a6a, 0x6aaa7a];
    for (const [lon, lat, size, v] of continents) {
      const phi = lon + ang;
      const cosP = Math.cos(phi);
      if (cosP <= 0.02) continue;
      const sinP = Math.sin(phi);
      const cosLat = Math.cos(lat);
      const px = cx + R * sinP * cosLat;
      const py = cy + R * Math.sin(lat);
      const sz = size * cosP;
      const alpha = 0.6 * cosP;
      g.fillStyle(base[v], alpha);
      g.fillCircle(px, py, sz);
      g.fillStyle(hi[v], alpha * 0.55);
      g.fillCircle(px - sz * 0.25, py - sz * 0.25, sz * 0.5);
    }
  }

  private drawMenuClouds(g: Phaser.GameObjects.Graphics, cx: number, cy: number, R: number, ang: number) {
    const clouds: [number, number, number][] = [
      [0.5,  0.05, 15],
      [1.9, -0.35, 11],
      [3.1,  0.30, 13],
      [4.3, -0.15, 10],
      [5.5,  0.25, 12],
    ];
    for (const [lon, lat, size] of clouds) {
      const phi = lon + ang;
      const cosP = Math.cos(phi);
      if (cosP <= 0.08) continue;
      const sinP = Math.sin(phi);
      const px = cx + R * sinP * Math.cos(lat);
      const py = cy + R * Math.sin(lat);
      const a = 0.2 * cosP;
      g.fillStyle(0xffffff, a);
      g.fillEllipse(px, py, size * cosP, size * 0.45 * cosP);
      g.fillStyle(0xffffff, a * 0.6);
      g.fillEllipse(px + size * 0.2, py + size * 0.1, size * 0.55 * cosP, size * 0.28 * cosP);
    }
  }

  private drawMenuRings(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number, R: number,
    ang: number, tilt: number,
    side: 'back' | 'front',
  ) {
    const bands: { r: number; w: number; color: number; alpha: number }[] = [
      { r: R * 1.55, w: 4,  color: 0x4d6a94, alpha: 0.20 },
      { r: R * 1.78, w: 9,  color: 0x95b5d8, alpha: 0.34 },
      { r: R * 2.02, w: 2,  color: 0x1a2540, alpha: 0.28 },
      { r: R * 2.25, w: 11, color: 0xb8d2ef, alpha: 0.38 },
      { r: R * 2.58, w: 6,  color: 0x9cbbe0, alpha: 0.24 },
      { r: R * 2.95, w: 3,  color: 0x6b89b8, alpha: 0.14 },
    ];

    const [a0, a1] = side === 'back' ? [Math.PI, Math.PI * 2] : [0, Math.PI];
    const steps = 56;

    for (const b of bands) {
      const rx = b.r;
      const ry = b.r * tilt;
      g.lineStyle(b.w, b.color, b.alpha);
      let drawing = false;
      for (let i = 0; i <= steps; i++) {
        const t = a0 + (a1 - a0) * (i / steps);
        const x = cx + rx * Math.cos(t);
        const y = cy + ry * Math.sin(t);
        if (side === 'back') {
          const dx = x - cx, dy = y - cy;
          if (dx * dx + dy * dy < (R + 0.5) * (R + 0.5)) {
            if (drawing) { g.strokePath(); drawing = false; }
            continue;
          }
        }
        if (!drawing) { g.beginPath(); g.moveTo(x, y); drawing = true; }
        else g.lineTo(x, y);
      }
      if (drawing) g.strokePath();
    }

    const N = 34;
    for (let i = 0; i < N; i++) {
      const bandIdx = i % bands.length;
      if (bandIdx === 2) continue;
      const band = bands[bandIdx];
      const baseAng = (i * 0.618034) * Math.PI * 2;
      const speedFactor = 2.2 - (band.r / R - 1.5) * 0.45;
      const theta = baseAng + ang * speedFactor;
      const jitter = ((i * 53) % 7) - 3;
      const r = band.r + jitter;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * tilt * Math.sin(theta);
      const isFront = Math.sin(theta) > 0;
      if ((side === 'front') !== isFront) continue;
      if (side === 'back') {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < R * R) continue;
      }
      const sz = 0.9 + (i % 3) * 0.35;
      const br = side === 'front' ? 0.75 : 0.45;
      g.fillStyle(0xeaf2ff, br);
      g.fillCircle(x, y, sz);
    }
  }

  private createBoxButton(x: number, y: number, w: number, h: number, label: string, accent: number, cb: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(10);
    const gfx = this.add.graphics();

    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(0x0b1224, hover ? 0.95 : 0.8);
      gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      gfx.lineStyle(1.5, accent, hover ? 1 : 0.55);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);

    const text = this.add.text(0, 0, label, {
      fontSize: '17px',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#dbeaff',
      fontStyle: 'bold',
    } as any).setOrigin(0.5);
    text.setLetterSpacing?.(2);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => { draw(true); text.setColor('#ffffff'); });
    hit.on('pointerout', () => { draw(false); text.setColor('#dbeaff'); });
    hit.on('pointerdown', cb);

    container.add([gfx, text, hit]);
    return container;
  }

  private promptNameChange() {
    const openModal = (window as any).shieldrOpenNameModal;
    if (!openModal) return;
    const oldName = StorageManager.getGuardianName();
    openModal(oldName, (newName: string) => {
      StorageManager.renameGuardian(newName);
      this.nameText.setText(`✎  ${newName}`);
      if (this.showingLB) {
        this.leaderboardContainer.destroy();
        if (this.leaderboardBackdrop) this.leaderboardBackdrop.destroy();
        this.buildLeaderboard();
        this.leaderboardBackdrop.setVisible(true);
        this.leaderboardContainer.setVisible(true);
      }
    });
  }

  /* ===== LEADERBOARD ===== */

  private buildLeaderboard() {
    const m = this.isMobile;
    const sw = this.scale.width;
    const sh = this.scale.height;
    const panelW = m ? Math.min(sw - 24, 360) : 500;
    const panelH = m ? Math.min(sh - 40, 360) : 400;

    this.leaderboardBackdrop = this.add.rectangle(this.cx, this.cy, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.5)
      .setDepth(49).setVisible(false).setInteractive();
    if (!m) this.leaderboardBackdrop.on('pointerdown', () => this.toggleLeaderboard());

    this.leaderboardContainer = this.add.container(this.cx, this.cy).setDepth(50).setVisible(false);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a1a, 0.95)
      .setStrokeStyle(2, 0x335577)
      .setInteractive();
    this.leaderboardContainer.add(bg);

    const title = this.add.text(0, -panelH / 2 + 20, 'MY LEADERBOARD', {
      fontSize: m ? '18px' : '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#4af', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.leaderboardContainer.add(title);

    const entries = StorageManager.getLeaderboard().slice(0, 10);
    const colX = -panelW / 2 + 18;

    if (entries.length === 0) {
      const empty = this.add.text(0, 0, 'No scores stored yet.\nPlay a Competitive run to start your record.', {
        fontSize: m ? '13px' : '15px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#8899aa', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5);
      this.leaderboardContainer.add(empty);
    } else {
      if (!m) {
        const header = this.add.text(colX, -panelH / 2 + 50, 'RANK   NAME             RANK        WAVE   SCORE', {
          fontSize: '11px', fontFamily: 'monospace', color: '#556677',
        });
        this.leaderboardContainer.add(header);
      }

      const rowStart = m ? -panelH / 2 + 50 : -panelH / 2 + 70;
      const rowGap = m ? 22 : 26;

      entries.forEach((e, i) => {
        const rank = String(i + 1).padStart(2, ' ');
        let rowStr: string;
        if (m) {
          const name = e.name.substring(0, 12).padEnd(12, ' ');
          const wave = String(e.wave).padStart(3, ' ');
          const score = String(e.score).padStart(6, ' ');
          rowStr = `${rank}  ${name} W${wave} ${score}`;
        } else {
          const name = e.name.padEnd(16, ' ');
          const titleStr = (e.title || '').padEnd(10, ' ');
          const wave = String(e.wave).padStart(4, ' ');
          const score = String(e.score).padStart(7, ' ');
          rowStr = `${rank}     ${name} ${titleStr} ${wave}   ${score}`;
        }
        const row = this.add.text(colX, rowStart + i * rowGap, rowStr, {
          fontSize: m ? '11px' : '13px', fontFamily: 'monospace',
          color: i === 0 ? '#ffcc44' : i < 3 ? '#44aaff' : '#8899aa',
        });
        this.leaderboardContainer.add(row);
      });
    }

    const comingSoon = this.add.text(0, panelH / 2 - 48, '🌐  Global leaderboard coming soon', {
      fontSize: m ? '11px' : '12px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#556677', fontStyle: 'italic',
    }).setOrigin(0.5);
    this.leaderboardContainer.add(comingSoon);

    const closeBtn = this.add.text(0, panelH / 2 - 20, '[ CLOSE ]', {
      fontSize: m ? '13px' : '14px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
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
      if (this.leaderboardBackdrop) this.leaderboardBackdrop.destroy();
      this.buildLeaderboard();
      this.leaderboardBackdrop.setVisible(true);
      this.leaderboardContainer.setVisible(true);
    } else {
      this.leaderboardContainer.setVisible(false);
      this.leaderboardBackdrop.setVisible(false);
    }
  }

  /* ===== ABOUT / HOW TO PLAY ===== */

  private buildAbout() {
    const m = this.isMobile;
    const sw = this.scale.width;
    const sh = this.scale.height;
    const panelW = m ? Math.min(sw - 16, 500) : 820;
    const panelH = m ? Math.min(sh - 16, 700) : 780;
    this.aboutPanelW = panelW;
    this.aboutPanelH = panelH;

    this.aboutBackdrop = this.add.rectangle(this.cx, this.cy, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.5)
      .setDepth(59).setVisible(false).setInteractive();
    if (!m) this.aboutBackdrop.on('pointerdown', () => this.toggleAbout());

    this.aboutContainer = this.add.container(this.cx, this.cy).setDepth(60).setVisible(false);

    const bg = this.add.rectangle(0, 0, panelW, panelH, 0x0a0a1a, 0.97)
      .setStrokeStyle(2, 0x335577)
      .setInteractive();
    this.aboutContainer.add(bg);

    const panelTitle = this.add.text(0, -panelH / 2 + 28, 'HOW TO PLAY', {
      fontSize: m ? '20px' : '28px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#44aaff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.aboutContainer.add(panelTitle);

    const xBtn = this.add.text(panelW / 2 - (m ? 20 : 32), -panelH / 2 + 24, '✕', {
      fontSize: m ? '20px' : '22px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
      padding: m ? { x: 8, y: 4 } : undefined,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    xBtn.on('pointerover', () => xBtn.setColor('#ff6666'));
    xBtn.on('pointerout', () => xBtn.setColor('#556677'));
    xBtn.on('pointerdown', () => this.toggleAbout());
    this.aboutContainer.add(xBtn);

    const pad = m ? 16 : 36;
    const contentX = -panelW / 2 + pad;
    const contentTop = -panelH / 2 + (m ? 52 : 65);
    const contentW = panelW - pad * 2;
    const contentH = panelH - (m ? 80 : 110);
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

    this.aboutScrollbar = this.add.graphics().setDepth(61).setVisible(false);
    this.drawAboutScrollbar(panelW, panelH, contentTop, contentH);

    const closeBtn = this.add.text(0, panelH / 2 - 20, '[ CLOSE ]', {
      fontSize: m ? '14px' : '18px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
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
    const m = this.isMobile;

    const hdr = (txt: string, y: number, color = '#44aaff') => {
      const t = this.add.text(x, y, txt, {
        fontSize: m ? '15px' : '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + (m ? 5 : 8);
    };

    const body = (txt: string, y: number, color = '#8899aa') => {
      const t = this.add.text(x, y, txt, {
        fontSize: m ? '12px' : '16px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, lineSpacing: m ? 3 : 6,
      }).setWordWrapWidth(maxW);
      this.aboutContent.add(t);
      return t.height + (m ? 6 : 10);
    };

    const item = (name: string, color: string, desc: string, y: number) => {
      const nameText = this.add.text(x, y, `● ${name}`, {
        fontSize: m ? '13px' : '16px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color, fontStyle: 'bold',
      });
      this.aboutContent.add(nameText);
      const indent = m ? 10 : 14;
      const descText = this.add.text(x + indent, y + (m ? 18 : 22), desc, {
        fontSize: m ? '11px' : '14px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#778899', lineSpacing: m ? 2 : 4,
      }).setWordWrapWidth(maxW - indent);
      this.aboutContent.add(descText);
      return (m ? 18 : 22) + descText.height + (m ? 5 : 8);
    };

    let y = startY;

    // THE GAME
    y += hdr('THE GAME', y);
    y += body(
      'Defend your planet from endless waves of enemies. ' +
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
      'Large hexagon. 10 damage. When destroyed far from the planet, splits into 2–3 fast mini-drones (2 dmg each). Kill it close to the planet for a clean kill. Appears from Wave 9.', y);
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
      'Teal crescent that orbits the planet instead of charging it. Fires 3-bolt volleys every 2.5s. Orbit shrinks each lap. 1 shield hit kill. 30 damage if it reaches the planet. +400 score. Appears at Wave 20, 30...', y);

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
      'Close Call: +150 for killing an enemy very close to the planet.\n' +
      'Last Second: +100 for blocking a projectile near the planet.\n' +
      'Perfect Shield: +200 for clearing a wave with zero planet damage.',
      y,
    );

    y += 6;
    y += hdr('PERFECT SHIELD STREAK', y, '#ff8844');
    y += body(
      'Consecutive zero-damage waves build a streak (shown as 🔥 on HUD). ' +
      'Each streak wave adds +0.5s to all shield durations. ' +
      'Any planet damage resets the streak to zero.',
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
      'Right-click to place. Pushes nearby enemies away from the planet for 3s. Buys time by shoving enemies back toward the screen edge.', y);
    y += item('Time Bender', '#ffffff',
      'All enemies slow to 30% speed for 4s. Shields work normally.', y);
    y += item('Health Surge', '#ff4444',
      'Instantly restores 20 HP to the planet (max 100).', y);
    y += item('Star Bomb', '#ffdd44',
      'Your next shield placement triggers a massive explosion (3x shield radius). The shield still exists after the blast.', y);
    y += item('Time Freeze', '#aa44ff',
      'All enemies and projectiles freeze in place for 2.5s. You can still place shields to destroy them.', y);
    y += item('Star Shield', '#ffcc44',
      'The planet becomes invulnerable for 8s. Enemies that reach the planet are destroyed but deal no damage. Golden dome visual with countdown ring.', y);
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
      'Practice — No planet damage, no score recording. Experiment freely.',
      y,
    );

    y += 10;
    return y - startY;
  }

  private scrollAbout(dy: number) {
    const maxScroll = Math.max(0, this.aboutTotalH - this.aboutContentH);
    this.aboutScrollY = Phaser.Math.Clamp(this.aboutScrollY + dy, 0, maxScroll);
    this.aboutContent.setY(-this.aboutScrollY);
    const contentTop = -this.aboutPanelH / 2 + (this.isMobile ? 52 : 65);
    this.drawAboutScrollbar(this.aboutPanelW, this.aboutPanelH, contentTop, this.aboutContentH);
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
      const panelW = this.aboutPanelW, panelH = this.aboutPanelH;
      const contentTop = -panelH / 2 + (this.isMobile ? 52 : 65);
      this.drawAboutScrollbar(panelW, panelH, contentTop, this.aboutContentH);
    } else {
      this.aboutBackdrop.setVisible(false);
      this.aboutContainer.setVisible(false);
      this.aboutScrollbar.setVisible(false);
    }
  }
}
