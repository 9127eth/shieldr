import Phaser from 'phaser';
import { StorageManager, createRunStats, getTitleForWave, type RunStats } from '../storage';
import { AudioManager } from '../audio';

/* ===== TYPE DEFINITIONS ===== */

type EnemyType = 'drone' | 'rocket' | 'shooter' | 'splitter' | 'miniDrone' | 'phaser' | 'shieldBreaker' | 'carrier' | 'siege';

interface ForceField {
  gfx: Phaser.GameObjects.Graphics;
  x1: number; y1: number;
  x2: number; y2: number;
  mx: number; my: number;
  born: number;
  duration: number;
  baseDuration: number;
  killCount: number;
  decayMultiplier: number;
  isStarBomb: boolean;
  immuneEnemies: Set<Enemy>;
}

interface Enemy {
  gfx: Phaser.GameObjects.Graphics;
  x: number; y: number;
  type: EnemyType;
  speed: number;
  damage: number;
  size: number;
  points: number;
  stopped: boolean;
  shootCd: number;
  shootInterval: number;
  shootRange: number;
  // Phaser enemy flicker
  phaserTimer: number;
  phaserVisible: boolean;
  // Shield Breaker
  hitsRemaining: number;
  // Carrier boss
  carrierSpawnCd: number;
  carrierDronesSpawned: number;
  carrierStaggerTimer: number;
  // Siege Unit
  siegeOrbitAngle: number;
  siegeOrbitRadius: number;
  siegeOrbitLaps: number;
  siegeEntered: boolean;
  // Mini-drone scatter (splitter fragments)
  scatterAngle: number;
  scatterTimer: number;
  scatterDuration: number;
  immuneField: ForceField | null;
}

interface Projectile {
  gfx: Phaser.GameObjects.Graphics;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  friendly: boolean;
}

interface Orb {
  gfx: Phaser.GameObjects.Graphics;
  x: number; y: number;
  vx: number; vy: number;
  kind: 'duration' | 'width';
  size: number;
  age: number;
  paired: boolean;
  partner: Orb | null;
}

interface ItemBox {
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  x: number; y: number;
  vx: number; vy: number;
  age: number;
}

type ItemType = 'gravityField' | 'timeBender' | 'healthSurge' | 'starBomb' | 'timeFreeze' | 'sanctuary' | 'cardinalRift';

interface QueueSlot {
  item: ItemType | null;
}

type GameState = 'playing' | 'waveClear' | 'paused' | 'gameOver';

/* ===== CONSTANTS ===== */

const PLANET_R = 38;
const BASE_FIELD_LEN = 120;
const BASE_FIELD_DUR = 5000;
const FIELD_COLLISION_R = 10;
const DRONE_SPEED = 110;
const ROCKET_SPEED = 55;
const SHOOTER_SPEED = 75;
const SPLITTER_SPEED = 85;
const PHASER_SPEED = 50;
const SHIELD_BREAKER_SPEED = 41;
const CARRIER_SPEED = 28;
const CLOSE_CALL_RADIUS = PLANET_R * 2.5;
const LAST_SECOND_RADIUS = PLANET_R * 2;
const OVERCHARGE_KILL_THRESHOLD = 5;
const OVERCHARGE_BLAST_RADIUS_MUL = 1.5;
const INTERFERENCE_OVERLAP_THRESHOLD = 0.3;

const ITEM_COLORS: Record<ItemType, number> = {
  gravityField: 0x44ffff,
  timeBender: 0xffffff,
  healthSurge: 0xff4444,
  starBomb: 0xffdd44,
  timeFreeze: 0xaa44ff,
  sanctuary: 0xffcc44,
  cardinalRift: 0xff44ff,
};

const ITEM_LABELS: Record<ItemType, string> = {
  gravityField: 'GRAVITY FIELD',
  timeBender: 'TIME BENDER',
  healthSurge: 'HEALTH SURGE',
  starBomb: 'STAR BOMB',
  timeFreeze: 'TIME FREEZE',
  sanctuary: 'SANCTUARY',
  cardinalRift: 'CARDINAL RIFT',
};

/* ===== GAME SCENE ===== */

export class GameScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private mode: 'normal' | 'practice' = 'normal';

  private coreHP = 100;
  private maxHP = 100;
  private score = 0;
  private currentWave = 0;
  private gameTime = 0;
  private totalEnemiesDestroyed = 0;

  private state: GameState = 'playing';
  private prevState: GameState = 'playing';
  private perfectWave = true;

  private fields: ForceField[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private orbs: Orb[] = [];
  private itemBox: ItemBox | null = null;

  private spawnQ: string[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1000;
  private waveTimer = 0;
  private midWaveOrbRoll = false;
  private orbSpawnCount = 0;

  // Passive upgrades
  private durStacks = 0;
  private widthStacks = 0;

  // Perfect Shield Streak
  private perfectStreak = 0;
  private longestPerfectStreak = 0;
  private streakDurationBonus = 0;

  // Item queue
  private itemQueue: QueueSlot[] = [{ item: null }, { item: null }];
  private pendingStarBomb = false;
  private rouletteSlots: {
    active: boolean; timer: number; result: ItemType | null;
    displayIdx: number; spinAccum: number; text: Phaser.GameObjects.Text | null;
  }[] = [
    { active: false, timer: 0, result: null, displayIdx: 0, spinAccum: 0, text: null },
    { active: false, timer: 0, result: null, displayIdx: 0, spinAccum: 0, text: null },
  ];
  private firstItemEarned = false;
  private itemTutorialShown = false;

  // Active effects
  private timeBenderTimer = 0;
  private timeFreezeTimer = 0;
  private sanctuaryTimer = 0;
  private gravityFields: { x: number; y: number; timer: number; gfx: Phaser.GameObjects.Graphics }[] = [];

  // Spawn telegraphs
  private telegraphs: { x: number; y: number; timer: number; gfx: Phaser.GameObjects.Graphics }[] = [];
  private telegraphPhase = false;

  // Run stats
  private runStats!: RunStats;
  private previousTitle = '';

  // Graphics handles
  private planetGfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;

  private pauseContainer!: Phaser.GameObjects.Container;
  private lbContainer!: Phaser.GameObjects.Container;
  private showingLB = false;
  private tooltip!: Phaser.GameObjects.Text | null;
  private itemTutorialText: Phaser.GameObjects.Text | null = null;

  private audio!: AudioManager;
  private planetAngle = 0;
  private stars: { x: number; y: number; s: number; a: number }[] = [];

  constructor() { super('GameScene'); }

  init(data: any) {
    this.mode = data?.mode || 'normal';
    this.coreHP = 100;
    this.score = 0;
    this.currentWave = 0;
    this.gameTime = 0;
    this.totalEnemiesDestroyed = 0;
    this.state = 'playing';
    this.perfectWave = true;
    this.fields = [];
    this.enemies = [];
    this.projectiles = [];
    this.orbs = [];
    this.itemBox = null;
    this.spawnQ = [];
    this.durStacks = 0;
    this.widthStacks = 0;
    this.perfectStreak = 0;
    this.longestPerfectStreak = 0;
    this.streakDurationBonus = 0;
    this.itemQueue = [{ item: null }, { item: null }];
    this.pendingStarBomb = false;
    for (const rs of this.rouletteSlots) {
      if (rs.text) rs.text.destroy();
      rs.active = false; rs.timer = 0; rs.result = null;
      rs.displayIdx = 0; rs.spinAccum = 0; rs.text = null;
    }
    this.firstItemEarned = false;
    this.itemTutorialShown = false;
    this.itemTutorialText = null;
    this.timeBenderTimer = 0;
    this.timeFreezeTimer = 0;
    this.sanctuaryTimer = 0;
    this.gravityFields = [];
    this.telegraphs = [];
    this.telegraphPhase = false;
    this.showingLB = false;
    this.tooltip = null;
    this.midWaveOrbRoll = false;
    this.orbSpawnCount = 0;
    this.runStats = createRunStats();
    this.previousTitle = StorageManager.getPlayerTitle(StorageManager.getGuardianName());
  }

  create() {
    this.cx = this.scale.width / 2;
    this.cy = this.scale.height / 2;
    this.audio = AudioManager.getInstance();

    this.generateStars();

    if (!this.textures.exists('particle')) {
      const ptex = this.make.graphics({ x: 0, y: 0 });
      ptex.fillStyle(0xffffff);
      ptex.fillCircle(4, 4, 4);
      ptex.generateTexture('particle', 8, 8);
      ptex.destroy();
    }

    this.bgGfx = this.add.graphics().setDepth(0);
    this.planetGfx = this.add.graphics().setDepth(1);
    this.hudGfx = this.add.graphics().setDepth(90);

    this.createHUD();
    this.createPauseOverlay();
    this.createLeaderboardPanel();

    if (!StorageManager.hasSeenIntro() || this.mode === 'practice') {
      const msg = this.mode === 'practice'
        ? 'PRACTICE MODE — No damage, no score recording'
        : 'Click anywhere to place a force field — protect the Core!';
      this.tooltip = this.add.text(this.cx, this.cy + PLANET_R + 60, msg, {
        fontSize: '16px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#667799',
      }).setOrigin(0.5).setDepth(50);
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard!.on('keydown-SPACE', () => this.clearAllFields());

    this.scale.on('resize', (gs: Phaser.Structs.Size) => {
      this.cx = gs.width / 2;
      this.cy = gs.height / 2;
    });

    this.startNextWave();
  }

  update(_time: number, delta: number) {
    this.drawBackground();
    this.planetAngle += delta * 0.0004;
    this.drawPlanet();

    if (this.state === 'paused' || this.state === 'gameOver') return;

    this.gameTime += delta;

    if (this.state === 'playing') {
      this.updateActiveEffects(delta);
      this.handleSpawning(delta);
      this.updateFields(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
      this.checkCollisions();
      this.updateOrbs(delta);
      this.updateItemBox(delta);
      this.updateGravityFields(delta);
      this.updateTelegraphs(delta);
      this.updateRoulette(delta);
      this.checkWaveComplete();
    } else if (this.state === 'waveClear') {
      this.waveTimer -= delta;
      this.updateOrbs(delta);
      this.updateItemBox(delta);
      this.updateFields(delta);
      this.updateRoulette(delta);
      if (this.waveTimer <= 0) this.startNextWave();
    }

    this.updateHUD();
    this.drawItemQueue();
  }

  /* ===== INPUT ===== */

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.state === 'paused') {
      this.togglePause();
      return;
    }
    if (this.state === 'gameOver') return;

    if (p.rightButtonDown()) {
      this.useItem(p.x, p.y);
      return;
    }

    // Check orb clicks
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      const d = Phaser.Math.Distance.Between(p.x, p.y, o.x, o.y);
      if (d < o.size + 20) {
        this.collectOrb(o, i);
        return;
      }
    }

    // Check item box click
    if (this.itemBox) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.itemBox.x, this.itemBox.y);
      if (d < 28) {
        this.collectItemBox();
        return;
      }
    }

    this.placeField(p.x, p.y);

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  /* ===== FORCE FIELDS ===== */

  private getFieldLen(): number {
    return BASE_FIELD_LEN + this.widthStacks * 30;
  }

  private getFieldDur(): number {
    return BASE_FIELD_DUR + this.durStacks * 3000 + this.streakDurationBonus;
  }

  private placeField(mx: number, my: number) {
    const angle = Phaser.Math.Angle.Between(this.cx, this.cy, mx, my);
    const perp = angle + Math.PI / 2;
    const half = this.getFieldLen() / 2;

    const x1 = mx + Math.cos(perp) * half;
    const y1 = my + Math.sin(perp) * half;
    const x2 = mx - Math.cos(perp) * half;
    const y2 = my - Math.sin(perp) * half;

    const dur = this.getFieldDur();
    const immune = new Set<Enemy>();
    for (const e of this.enemies) {
      if (e.type === 'phaser' && !e.phaserVisible) continue;
      const cr = e.size + FIELD_COLLISION_R + this.widthStacks * 3;
      if (this.lineCircle(x1, y1, x2, y2, e.x, e.y, cr)) {
        immune.add(e);
      }
    }

    const ff: ForceField = {
      gfx: this.add.graphics().setDepth(5),
      x1, y1, x2, y2,
      mx, my,
      born: this.gameTime,
      duration: dur,
      baseDuration: dur,
      killCount: 0,
      decayMultiplier: 1,
      isStarBomb: this.pendingStarBomb,
      immuneEnemies: immune,
    };
    this.fields.push(ff);
    this.audio.playZap();

    // Track sector for run stats
    this.runStats.totalShieldsPlaced++;
    if (mx >= this.cx && my < this.cy) this.runStats.sectorCounts.NE++;
    else if (mx < this.cx && my < this.cy) this.runStats.sectorCounts.NW++;
    else if (mx >= this.cx && my >= this.cy) this.runStats.sectorCounts.SE++;
    else this.runStats.sectorCounts.SW++;

    if (this.pendingStarBomb) {
      this.pendingStarBomb = false;
      this.doStarBombBlast(mx, my);
    }

    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  private updateFields(delta: number) {
    this.computeShieldInterference();

    for (let i = this.fields.length - 1; i >= 0; i--) {
      const ff = this.fields[i];
      const elapsed = this.gameTime - ff.born;
      const effectiveDur = ff.duration / ff.decayMultiplier;

      if (elapsed >= effectiveDur) {
        if (ff.killCount >= OVERCHARGE_KILL_THRESHOLD) {
          this.doOverchargeDetonation(ff);
        }
        this.showMultiKillText(ff);
        ff.gfx.destroy();
        this.fields.splice(i, 1);
        continue;
      }

      const ratio = 1 - elapsed / effectiveDur;
      const alpha = Math.max(0.1, ratio);
      const thick = 3 + this.widthStacks * 1.5;

      // Overcharge glow
      let glowColor = 0x44aaff;
      let glowAlpha = alpha * 0.2;
      if (ff.killCount >= OVERCHARGE_KILL_THRESHOLD) {
        glowColor = 0xffaa44;
        glowAlpha = alpha * (0.3 + Math.sin(this.gameTime * 0.01) * 0.15);
      } else if (ff.killCount >= 3) {
        glowColor = 0x88ccff;
        glowAlpha = alpha * 0.25;
      }

      // Interference flicker
      const interferenceFlicker = ff.decayMultiplier > 1
        ? 0.7 + Math.sin(this.gameTime * 0.02 * ff.decayMultiplier) * 0.3
        : 1;

      ff.gfx.clear();
      ff.gfx.lineStyle(thick + 6, glowColor, glowAlpha * interferenceFlicker);
      ff.gfx.lineBetween(ff.x1, ff.y1, ff.x2, ff.y2);
      ff.gfx.lineStyle(thick, 0x88ddff, alpha * interferenceFlicker);
      ff.gfx.lineBetween(ff.x1, ff.y1, ff.x2, ff.y2);
    }
  }

  private computeShieldInterference() {
    for (const ff of this.fields) ff.decayMultiplier = 1;

    for (let i = 0; i < this.fields.length; i++) {
      for (let j = i + 1; j < this.fields.length; j++) {
        const a = this.fields[i];
        const b = this.fields[j];
        const overlapFrac = this.computeLineOverlap(a, b);
        if (overlapFrac > INTERFERENCE_OVERLAP_THRESHOLD) {
          a.decayMultiplier += 0.5;
          b.decayMultiplier += 0.5;
        }
      }
    }
  }

  private computeLineOverlap(a: ForceField, b: ForceField): number {
    const lenA = this.getFieldLen();
    const dist = Phaser.Math.Distance.Between(a.mx, a.my, b.mx, b.my);
    if (dist >= lenA) return 0;
    return Math.max(0, 1 - dist / lenA);
  }

  private showMultiKillText(ff: ForceField) {
    if (ff.killCount < 3) return;

    let mul: number, color: string;
    if (ff.killCount >= 8) { mul = 3; color = '#ff4444'; }
    else if (ff.killCount >= 5) { mul = 2; color = '#ffcc44'; }
    else { mul = 1.5; color = '#ffffff'; }

    const txt = this.add.text(ff.mx, ff.my, `MULTI-KILL x${mul}!`, {
      fontSize: '18px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color,
    }).setOrigin(0.5).setDepth(50).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: 1, y: ff.my - 30, duration: 300,
      yoyo: true, hold: 1000,
      onComplete: () => txt.destroy(),
    });
    this.audio.playMultiKill();

    if (ff.killCount >= 5) {
      this.triggerRouletteReward('multi-kill');
    }
  }

  private doOverchargeDetonation(ff: ForceField) {
    const radius = this.getFieldLen() * OVERCHARGE_BLAST_RADIUS_MUL;
    this.audio.playOverchargeDetonate();

    const ring = this.add.graphics().setDepth(8);
    let r = 0;
    const dur = 350;
    const start = this.gameTime;

    const expand = () => {
      const elapsed = this.gameTime - start;
      const t = Math.min(1, elapsed / dur);
      r = radius * t;
      ring.clear();
      ring.lineStyle(6 * (1 - t), 0xffaa44, 1 - t);
      ring.strokeCircle(ff.mx, ff.my, r);
      ring.fillStyle(0xffaa44, 0.1 * (1 - t));
      ring.fillCircle(ff.mx, ff.my, r);
      if (t < 1) this.time.delayedCall(16, expand);
      else ring.destroy();
    };
    expand();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Phaser.Math.Distance.Between(ff.mx, ff.my, e.x, e.y) < radius) {
        if (e.type === 'phaser' && !e.phaserVisible) continue;
        this.destroyEnemy(e, i, false);
      }
    }

    this.spawnExplosion(ff.mx, ff.my, 0xffaa44);
  }

  private clearAllFields() {
    for (const ff of this.fields) {
      this.showMultiKillText(ff);
      ff.gfx.destroy();
    }
    this.fields = [];
  }

  /* ===== ENEMIES ===== */

  private createEnemy(type: EnemyType, x: number, y: number, speedOverride?: number): Enemy {
    const cfg = this.getWaveConfig();
    let speed: number, damage: number, size: number, points: number;
    let shootInterval = 2000, shootRange = 250;

    switch (type) {
      case 'rocket':
        speed = ROCKET_SPEED * cfg.rocketMul;
        damage = 15 + cfg.dmgBonus; size = 14; points = 100;
        break;
      case 'shooter':
        speed = SHOOTER_SPEED * cfg.shooterMul;
        damage = 8 + cfg.dmgBonus; size = 11; points = 75;
        shootInterval = cfg.shooterFireRate; shootRange = cfg.shooterRange;
        break;
      case 'splitter':
        speed = SPLITTER_SPEED * (1 + cfg.dmgBonus * 0.02);
        damage = 10; size = 16; points = 75;
        break;
      case 'miniDrone':
        speed = speedOverride || DRONE_SPEED * 1.5;
        damage = 2; size = 6; points = 25;
        break;
      case 'phaser':
        speed = PHASER_SPEED * (1 + cfg.dmgBonus * 0.02);
        damage = 10; size = 12; points = 100;
        break;
      case 'shieldBreaker':
        speed = SHIELD_BREAKER_SPEED * (1 + cfg.dmgBonus * 0.015);
        damage = 20; size = 18; points = 200;
        break;
      case 'carrier':
        speed = CARRIER_SPEED;
        damage = 25; size = 30; points = 500;
        break;
      case 'siege':
        speed = 40;
        damage = 30; size = 22; points = 400;
        break;
      default: // drone
        speed = DRONE_SPEED * cfg.droneMul;
        damage = 3 + cfg.dmgBonus; size = 8; points = 50;
        break;
    }

    const gfx = this.add.graphics().setDepth(3);
    this.drawEnemyShape(gfx, type, size, 1);

    return {
      gfx, x, y, type, speed, damage, size, points,
      stopped: false, shootCd: shootInterval, shootInterval, shootRange,
      phaserTimer: 0, phaserVisible: true,
      hitsRemaining: type === 'shieldBreaker' ? 2 : (type === 'carrier' ? 3 : 1),
      carrierSpawnCd: 3000, carrierDronesSpawned: 0, carrierStaggerTimer: 0,
      siegeOrbitAngle: 0, siegeOrbitRadius: 0, siegeOrbitLaps: 0, siegeEntered: false,
      scatterAngle: 0, scatterTimer: 0, scatterDuration: 0, immuneField: null,
    };
  }

  private spawnEnemy(type: string) {
    const w = this.scale.width;
    const h = this.scale.height;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number;
    switch (edge) {
      case 0: x = Phaser.Math.Between(0, w); y = -30; break;
      case 1: x = w + 30; y = Phaser.Math.Between(0, h); break;
      case 2: x = Phaser.Math.Between(0, w); y = h + 30; break;
      default: x = -30; y = Phaser.Math.Between(0, h); break;
    }

    const e = this.createEnemy(type as EnemyType, x, y);

    if (type === 'siege') {
      const angleToCore = Phaser.Math.Angle.Between(x, y, this.cx, this.cy);
      e.siegeOrbitAngle = angleToCore;
      e.siegeOrbitRadius = Math.min(this.scale.width, this.scale.height) * 0.35;
    }

    this.enemies.push(e);
  }

  private spawnEnemyAt(type: EnemyType, x: number, y: number, speedOverride?: number): Enemy {
    const e = this.createEnemy(type, x, y, speedOverride);
    this.enemies.push(e);
    return e;
  }

  private drawEnemyShape(g: Phaser.GameObjects.Graphics, type: EnemyType, size: number, alpha: number) {
    g.clear();
    switch (type) {
      case 'drone':
      case 'miniDrone': {
        const c = type === 'miniDrone' ? 0x88ffaa : 0x44ff88;
        g.fillStyle(c, 0.2 * alpha); g.fillCircle(0, 0, size + 4);
        g.fillStyle(c, alpha);
        g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.7, -size * 0.7);
        g.lineTo(-size * 0.3, 0); g.lineTo(-size * 0.7, size * 0.7);
        g.closePath(); g.fillPath();
        break;
      }
      case 'rocket':
        g.fillStyle(0xff6644, 0.15 * alpha); g.fillCircle(0, 0, size + 5);
        g.fillStyle(0xff6644, alpha);
        g.beginPath(); g.moveTo(size, 0); g.lineTo(-size * 0.6, -size * 0.6);
        g.lineTo(-size * 0.3, 0); g.lineTo(-size * 0.6, size * 0.6);
        g.closePath(); g.fillPath();
        g.fillStyle(0xffaa44, 0.6 * alpha); g.fillCircle(-size * 0.2, 0, size * 0.35);
        break;
      case 'shooter':
        g.fillStyle(0xaa44ff, 0.15 * alpha); g.fillCircle(0, 0, size + 4);
        g.fillStyle(0xaa44ff, alpha);
        g.beginPath(); g.moveTo(size, 0); g.lineTo(0, -size * 0.7);
        g.lineTo(-size, 0); g.lineTo(0, size * 0.7);
        g.closePath(); g.fillPath();
        break;
      case 'splitter':
        g.fillStyle(0x44ff44, 0.15 * alpha); g.fillCircle(0, 0, size + 5);
        g.fillStyle(0x44ff44, alpha);
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 / 6) * i - Math.PI / 2;
          const px = Math.cos(a) * size;
          const py = Math.sin(a) * size;
          if (i === 0) g.beginPath(), g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath(); g.fillPath();
        break;
      case 'phaser': {
        const c = 0x44ffff;
        g.fillStyle(c, 0.15 * alpha); g.fillCircle(0, 0, size + 4);
        g.fillStyle(c, alpha);
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i - Math.PI / 8;
          const px = Math.cos(a) * size;
          const py = Math.sin(a) * size;
          if (i === 0) g.beginPath(), g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath(); g.fillPath();
        break;
      }
      case 'shieldBreaker':
        g.lineStyle(3, 0xff4444, 0.8 * alpha); g.strokeCircle(0, 0, size + 4);
        g.fillStyle(0xff2222, 0.5 * alpha); g.fillCircle(0, 0, size * 0.4);
        g.fillStyle(0xff4444, alpha);
        g.beginPath(); g.moveTo(size * 1.2, 0); g.lineTo(-size * 0.5, -size * 0.8);
        g.lineTo(-size * 0.2, 0); g.lineTo(-size * 0.5, size * 0.8);
        g.closePath(); g.fillPath();
        break;
      case 'carrier':
        g.fillStyle(0xff8833, 0.1 * alpha); g.fillCircle(0, 0, size + 8);
        g.fillStyle(0xff8833, alpha);
        g.beginPath(); g.moveTo(size, 0); g.lineTo(0, -size * 0.6);
        g.lineTo(-size, 0); g.lineTo(0, size * 0.6);
        g.closePath(); g.fillPath();
        g.fillStyle(0xffaa55, 0.6 * alpha);
        g.fillRect(-size * 0.3, -size * 0.15, size * 0.15, size * 0.3);
        g.fillRect(-size * 0.1, -size * 0.15, size * 0.15, size * 0.3);
        break;
      case 'siege':
        g.fillStyle(0x44ddcc, 0.15 * alpha); g.fillCircle(0, 0, size + 5);
        g.fillStyle(0x44ddcc, alpha);
        g.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (Math.PI * 2 / 12) * i;
          const r = i % 2 === 0 ? size : size * 0.6;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath(); g.fillPath();
        g.fillStyle(0x88ffee, 0.7 * alpha); g.fillCircle(size * 0.3, 0, 3);
        break;
    }
  }

  private updateEnemies(delta: number) {
    const dt = delta / 1000;
    const speedMul = this.getEnemySpeedMultiplier();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      // Phaser flicker logic
      if (e.type === 'phaser') {
        e.phaserTimer += delta;
        const cycle = 1600; // 0.8s visible + 0.8s invisible
        const phase = e.phaserTimer % cycle;
        e.phaserVisible = phase < 800;
        const drawAlpha = e.phaserVisible ? 1 : 0.1;
        this.drawEnemyShape(e.gfx, 'phaser', e.size, drawAlpha);
      }

      // Carrier boss logic
      if (e.type === 'carrier') {
        if (e.carrierStaggerTimer > 0) {
          e.carrierStaggerTimer -= delta;
        } else {
          e.carrierSpawnCd -= delta;
          if (e.carrierSpawnCd <= 0 && e.carrierDronesSpawned < 8) {
            const spawnCount = Phaser.Math.Between(1, 2);
            for (let s = 0; s < spawnCount && e.carrierDronesSpawned < 8; s++) {
              this.spawnEnemyAt('drone', e.x + Phaser.Math.Between(-10, 10), e.y + Phaser.Math.Between(-10, 10));
              e.carrierDronesSpawned++;
            }
            e.carrierSpawnCd = 3000;
          }
        }
      }

      // Siege Unit orbit logic
      if (e.type === 'siege') {
        if (!e.siegeEntered) {
          const dist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
          if (dist <= e.siegeOrbitRadius + 5) {
            e.siegeEntered = true;
            e.siegeOrbitAngle = Phaser.Math.Angle.Between(this.cx, this.cy, e.x, e.y);
          } else {
            const ang = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
            e.x += Math.cos(ang) * e.speed * dt * speedMul;
            e.y += Math.sin(ang) * e.speed * dt * speedMul;
          }
        }

        if (e.siegeEntered) {
          const orbitSpeed = (Math.PI * 2) / 12; // full orbit in ~12s
          e.siegeOrbitAngle += orbitSpeed * dt;
          if (e.siegeOrbitAngle > Math.PI * 2) {
            e.siegeOrbitAngle -= Math.PI * 2;
            e.siegeOrbitLaps++;
            e.siegeOrbitRadius *= 0.85; // shrink orbit each lap
          }
          e.x = this.cx + Math.cos(e.siegeOrbitAngle) * e.siegeOrbitRadius;
          e.y = this.cy + Math.sin(e.siegeOrbitAngle) * e.siegeOrbitRadius;

          e.shootCd -= delta;
          if (e.shootCd <= 0) {
            this.fireSiegeVolley(e);
            e.shootCd = 2500;
          }
        }

        e.gfx.setPosition(e.x, e.y);
        const angle = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
        e.gfx.setRotation(angle);

        if (e.siegeEntered && e.siegeOrbitRadius < PLANET_R + e.size) {
          this.enemyHitCore(e, i);
          if (this.state === 'gameOver') return;
        }
        continue;
      }

      // Mini-drone scatter phase: eject sideways along the shield, then curve to core
      if (e.type === 'miniDrone' && e.scatterTimer > 0) {
        e.scatterTimer = Math.max(0, e.scatterTimer - delta);
        const t = e.scatterTimer / e.scatterDuration;
        const blend = 1 - t * t;

        const coreAngle = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
        const angleDiff = Phaser.Math.Angle.Wrap(coreAngle - e.scatterAngle);
        const moveAngle = e.scatterAngle + angleDiff * blend;

        e.x += Math.cos(moveAngle) * e.speed * dt * speedMul;
        e.y += Math.sin(moveAngle) * e.speed * dt * speedMul;

        e.gfx.setPosition(e.x, e.y);
        e.gfx.setRotation(moveAngle);

        const dist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
        if (dist < PLANET_R + e.size * 0.5) {
          this.enemyHitCore(e, i);
          if (this.state === 'gameOver') return;
        }
        continue;
      }

      // Standard movement
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);

      if (e.type === 'shooter' && dist <= e.shootRange) {
        e.stopped = true;
      }

      if (!e.stopped) {
        const ang = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
        e.x += Math.cos(ang) * e.speed * dt * speedMul;
        e.y += Math.sin(ang) * e.speed * dt * speedMul;
      }

      if (e.stopped && e.type === 'shooter') {
        e.shootCd -= delta;
        if (e.shootCd <= 0) {
          this.fireEnemyProjectile(e);
          e.shootCd = e.shootInterval;
        }
      }

      const angle = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
      e.gfx.setPosition(e.x, e.y);
      e.gfx.setRotation(angle);

      if (dist < PLANET_R + e.size * 0.5) {
        this.enemyHitCore(e, i);
        if (this.state === 'gameOver') return;
      }
    }
  }

  private getEnemySpeedMultiplier(): number {
    if (this.timeFreezeTimer > 0) return 0;
    if (this.timeBenderTimer > 0) return 0.3;
    return 1;
  }

  private enemyHitCore(e: Enemy, idx: number) {
    if (this.mode !== 'practice') {
      if (this.sanctuaryTimer > 0) {
        // Sanctuary active: enemy is destroyed but deals no damage
        this.score += e.points;
        this.totalEnemiesDestroyed++;
        this.spawnExplosion(e.x, e.y, 0xffcc44);
        this.audio.playEnemyDestroy();
        e.gfx.destroy();
        this.enemies.splice(idx, 1);
        return;
      }
      this.coreHP = Math.max(0, this.coreHP - e.damage);
      this.perfectWave = false;
      this.perfectStreak = 0;
      this.streakDurationBonus = 0;
      this.coreHitEffect();
    }
    e.gfx.destroy();
    this.enemies.splice(idx, 1);
    if (this.coreHP <= 0) this.triggerGameOver();
  }

  private destroyEnemy(e: Enemy, idx: number, trackMultiKill = true, sourceField?: ForceField) {
    // Apply scoring multipliers later based on shield kill count
    let basePoints = e.points;

    // Close Call bonus
    const distFromCore = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
    if (distFromCore < CLOSE_CALL_RADIUS) {
      basePoints += 150;
      this.runStats.closeCalls++;
      this.showFloatingText(e.x, e.y - 15, 'CLOSE CALL!', '#ff8844');
      this.audio.playCloseCall();
    }

    if (sourceField && trackMultiKill) {
      sourceField.killCount++;
      this.runStats.bestMultiKill = Math.max(this.runStats.bestMultiKill, sourceField.killCount);
    }

    this.score += basePoints;
    this.totalEnemiesDestroyed++;

    const colorMap: Partial<Record<EnemyType, number>> = {
      drone: 0x44ff88, miniDrone: 0x88ffaa, rocket: 0xff6644, shooter: 0xaa44ff,
      splitter: 0x44ff44, phaser: 0x44ffff, shieldBreaker: 0xff4444,
      carrier: 0xff8833, siege: 0x44ddcc,
    };
    this.spawnExplosion(e.x, e.y, colorMap[e.type] || 0xffffff);
    this.audio.playEnemyDestroy();
    e.gfx.destroy();
    this.enemies.splice(idx, 1);
  }

  /* ===== SPLITTER LOGIC ===== */

  private handleSplitterDestroy(e: Enemy, distFromCore: number, ff: ForceField) {
    const maxDist = Math.max(this.scale.width, this.scale.height) / 2;
    const outerThreshold = maxDist * 0.4;

    if (distFromCore > outerThreshold) {
      const shieldAngle = Math.atan2(ff.y2 - ff.y1, ff.x2 - ff.x1);
      const count = Phaser.Math.Between(2, 3);
      for (let s = 0; s < count; s++) {
        const side = s % 2 === 0 ? 1 : -1;
        const jitter = (Math.random() - 0.5) * 0.4;
        const ejectAngle = shieldAngle + (side > 0 ? 0 : Math.PI) + jitter;

        const spreadDist = 30 + Math.random() * 20;
        const sx = e.x + Math.cos(ejectAngle) * spreadDist;
        const sy = e.y + Math.sin(ejectAngle) * spreadDist;
        const drone = this.spawnEnemyAt('miniDrone', sx, sy, DRONE_SPEED * 1.5);
        drone.scatterAngle = ejectAngle;
        drone.scatterDuration = 600 + Math.random() * 200;
        drone.scatterTimer = drone.scatterDuration;
        drone.immuneField = ff;
      }
    }
  }

  /* ===== PROJECTILES ===== */

  private fireEnemyProjectile(e: Enemy) {
    const ang = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
    const speed = 180;
    const gfx = this.add.graphics().setDepth(4);
    gfx.fillStyle(0xff44aa);
    gfx.fillCircle(0, 0, 4);
    gfx.fillStyle(0xff44aa, 0.3);
    gfx.fillCircle(0, 0, 7);

    this.projectiles.push({
      gfx, x: e.x, y: e.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      damage: 5 + this.getWaveConfig().dmgBonus,
      friendly: false,
    });
  }

  private fireSiegeVolley(e: Enemy) {
    const baseAng = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
    const spread = 0.25;
    for (let b = -1; b <= 1; b++) {
      const ang = baseAng + b * spread;
      const speed = 160;
      const gfx = this.add.graphics().setDepth(4);
      gfx.fillStyle(0x44ddcc);
      gfx.fillCircle(0, 0, 4);
      gfx.fillStyle(0x44ddcc, 0.3);
      gfx.fillCircle(0, 0, 7);
      this.projectiles.push({
        gfx, x: e.x, y: e.y,
        vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        damage: 5, friendly: false,
      });
    }
  }

  private updateProjectiles(delta: number) {
    const dt = delta / 1000;
    const speedMul = this.getEnemySpeedMultiplier();

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const pSpeed = p.friendly ? 1 : speedMul;
      p.x += p.vx * dt * pSpeed;
      p.y += p.vy * dt * pSpeed;
      p.gfx.setPosition(p.x, p.y);

      if (p.friendly) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.type === 'phaser' && !e.phaserVisible) continue;
          if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < e.size + 5) {
            this.destroyEnemy(e, j, false);
            p.gfx.destroy();
            this.projectiles.splice(i, 1);
            break;
          }
        }
        if (!this.projectiles[i]) continue;
      }

      if (!p.friendly) {
        const distCore = Phaser.Math.Distance.Between(p.x, p.y, this.cx, this.cy);
        if (distCore < PLANET_R) {
          if (this.mode !== 'practice') {
            if (this.sanctuaryTimer > 0) {
              // Sanctuary: absorb without damage
            } else {
              this.coreHP = Math.max(0, this.coreHP - p.damage);
              this.perfectWave = false;
              this.perfectStreak = 0;
              this.streakDurationBonus = 0;
              this.coreHitEffect();
            }
          }
          p.gfx.destroy();
          this.projectiles.splice(i, 1);
          if (this.coreHP <= 0) { this.triggerGameOver(); return; }
          continue;
        }
      }

      const w = this.scale.width;
      const h = this.scale.height;
      if (p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) {
        p.gfx.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  /* ===== COLLISIONS ===== */

  private checkCollisions() {
    for (let fi = this.fields.length - 1; fi >= 0; fi--) {
      const ff = this.fields[fi];

      for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
        const e = this.enemies[ei];
        if (e.type === 'phaser' && !e.phaserVisible) continue;

        const cr = e.size + FIELD_COLLISION_R + this.widthStacks * 3;
        const intersecting = this.lineCircle(ff.x1, ff.y1, ff.x2, ff.y2, e.x, e.y, cr);

        if (!intersecting) {
          ff.immuneEnemies.delete(e);
          continue;
        }

        if (ff.immuneEnemies.has(e)) continue;
        if (e.immuneField === ff) continue;

        // Shield Breaker special handling
        if (e.type === 'shieldBreaker') {
          e.hitsRemaining--;
          if (e.hitsRemaining > 0) {
            this.audio.playShieldBreak();
            this.spawnExplosion(ff.mx, ff.my, 0xff4444);
            this.showMultiKillText(ff);
            ff.gfx.destroy();
            this.fields.splice(fi, 1);
            this.drawEnemyShape(e.gfx, 'shieldBreaker', e.size, 0.6);
            break;
          }
          this.destroyEnemy(e, ei, true, ff);
          continue;
        }

        // Carrier boss: multi-hit
        if (e.type === 'carrier') {
          e.hitsRemaining--;
          e.carrierStaggerTimer = 2000;
          this.audio.playBossStagger();
          this.spawnExplosion(e.x, e.y, 0xff8833);
          if (e.hitsRemaining <= 0) {
            this.audio.playBossDeath();
            this.destroyEnemy(e, ei, true, ff);
          } else {
            this.drawEnemyShape(e.gfx, 'carrier', e.size, 0.4 + 0.3 * (e.hitsRemaining / 3));
          }
          continue;
        }

        // Splitter: check distance from core for split mechanic
        if (e.type === 'splitter') {
          const distFromCore = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);
          this.handleSplitterDestroy(e, distFromCore, ff);
        }

        this.destroyEnemy(e, ei, true, ff);
      }

      if (!this.fields[fi]) continue;

      for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
        const p = this.projectiles[pi];
        if (p.friendly) continue;
        const cr = 6 + FIELD_COLLISION_R + this.widthStacks * 3;
        if (this.lineCircle(ff.x1, ff.y1, ff.x2, ff.y2, p.x, p.y, cr)) {
          // Last Second bonus
          const distFromCore = Phaser.Math.Distance.Between(p.x, p.y, this.cx, this.cy);
          if (distFromCore < LAST_SECOND_RADIUS) {
            this.score += 100;
            this.showFloatingText(p.x, p.y - 15, 'LAST SECOND!', '#ffaa44');
            this.audio.playCloseCall();
          }

          this.reflectProjectile(p);
        }
      }
    }
  }

  private reflectProjectile(p: Projectile) {
    let nearest: Enemy | null = null;
    let nearDist = Infinity;
    for (const e of this.enemies) {
      if (e.type === 'phaser' && !e.phaserVisible) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y);
      if (d < nearDist) { nearDist = d; nearest = e; }
    }
    if (nearest) {
      const ang = Phaser.Math.Angle.Between(p.x, p.y, nearest.x, nearest.y);
      const speed = 250;
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed;
    } else {
      p.vx = -p.vx;
      p.vy = -p.vy;
    }
    p.friendly = true;
    p.gfx.clear();
    p.gfx.fillStyle(0x44ffaa);
    p.gfx.fillCircle(0, 0, 4);
    p.gfx.fillStyle(0x44ffaa, 0.3);
    p.gfx.fillCircle(0, 0, 7);
  }

  private lineCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a === 0) return Phaser.Math.Distance.Between(x1, y1, cx, cy) <= r;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - r * r;
    let disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    disc = Math.sqrt(disc);
    const t1 = (-b - disc) / (2 * a);
    const t2 = (-b + disc) / (2 * a);
    if (t1 >= 0 && t1 <= 1) return true;
    if (t2 >= 0 && t2 <= 1) return true;
    return t1 < 0 && t2 > 1;
  }

  /* ===== WAVES ===== */

  private getWaveConfig() {
    const w = this.currentWave;
    let droneMul: number, rocketMul: number, shooterMul: number;
    let dmgBonus: number, shooterFireRate: number, shooterRange: number;

    if (w <= 3) {
      droneMul = 1; rocketMul = 1; shooterMul = 1; dmgBonus = 0;
      shooterFireRate = 2000; shooterRange = 250;
    } else if (w <= 6) {
      droneMul = 1 + (w - 3) * 0.1;
      rocketMul = 1; shooterMul = 1; dmgBonus = 0;
      shooterFireRate = 2000; shooterRange = 250;
    } else if (w <= 10) {
      droneMul = 1.3 + (w - 6) * 0.1;
      rocketMul = 1; shooterMul = 1; dmgBonus = 0;
      shooterFireRate = 1800; shooterRange = 240;
    } else if (w <= 15) {
      droneMul = 1.7 + (w - 10) * 0.06;
      rocketMul = 1.1; shooterMul = 1.1; dmgBonus = 0;
      shooterFireRate = 1500; shooterRange = 220;
    } else if (w <= 20) {
      droneMul = 2.0;
      rocketMul = 1.3; shooterMul = 1.3; dmgBonus = 0;
      shooterFireRate = 1200; shooterRange = 200;
    } else {
      const ex = w - 20;
      droneMul = 2.0 + ex * 0.05;
      rocketMul = 1.3 + ex * 0.05;
      shooterMul = 1.3 + ex * 0.05;
      dmgBonus = ex;
      shooterFireRate = Math.max(600, 1200 - ex * 30);
      shooterRange = Math.max(150, 200 - ex * 3);
    }
    return { droneMul, rocketMul, shooterMul, dmgBonus, shooterFireRate, shooterRange };
  }

  private getWaveEnemyCount(): number {
    const w = this.currentWave;
    if (w <= 3) return 3 + 2 * (w - 1);
    if (w <= 6) return 6 + 2 * (w - 3);
    if (w <= 10) return 10 + 2 * (w - 6);
    if (w <= 15) return 16 + 2 * (w - 10);
    if (w <= 20) return 23 + 3 * (w - 15);
    return 40 + 3 * (w - 20);
  }

  private getWaveTypes(): string[] {
    const w = this.currentWave;
    const types: string[] = [];

    types.push('drone');
    if (w >= 4) types.push('rocket');
    if (w >= 7) types.push('shooter');
    if (w >= 9) types.push('splitter');
    if (w >= 12) types.push('phaser');
    if (w >= 14) types.push('shieldBreaker');

    return types;
  }

  private buildSpawnQueue(): string[] {
    const count = this.getWaveEnemyCount();
    const types = this.getWaveTypes();
    const w = this.currentWave;
    const q: string[] = [];

    for (let i = 0; i < count; i++) {
      if (types.length === 1) {
        q.push('drone');
      } else {
        const r = Math.random();
        if (w < 7) {
          q.push(r < 0.6 ? 'drone' : 'rocket');
        } else if (w < 9) {
          q.push(r < 0.4 ? 'drone' : r < 0.7 ? 'rocket' : 'shooter');
        } else if (w < 12) {
          q.push(r < 0.35 ? 'drone' : r < 0.55 ? 'rocket' : r < 0.75 ? 'shooter' : 'splitter');
        } else if (w < 14) {
          q.push(r < 0.3 ? 'drone' : r < 0.48 ? 'rocket' : r < 0.65 ? 'shooter' : r < 0.8 ? 'splitter' : 'phaser');
        } else {
          q.push(r < 0.25 ? 'drone' : r < 0.42 ? 'rocket' : r < 0.57 ? 'shooter'
            : r < 0.72 ? 'splitter' : r < 0.86 ? 'phaser' : 'shieldBreaker');
        }
      }
    }

    // Shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    return q;
  }

  private startNextWave() {
    this.currentWave++;
    this.perfectWave = true;
    this.midWaveOrbRoll = false;
    this.spawnQ = this.buildSpawnQueue();

    // Mini-boss spawning
    if (this.currentWave % 10 === 0) {
      if (this.currentWave >= 10) this.spawnQ.push('carrier');
      if (this.currentWave >= 20) this.spawnQ.push('siege');
    }

    const w = this.currentWave;
    if (w <= 3) this.spawnInterval = 1200;
    else if (w <= 6) this.spawnInterval = 1000;
    else if (w <= 10) this.spawnInterval = 800;
    else if (w <= 15) this.spawnInterval = 600;
    else if (w <= 20) this.spawnInterval = 400;
    else this.spawnInterval = Math.max(200, 400 - (w - 20) * 10);

    // Spawn telegraphs
    this.showSpawnTelegraphs();

    this.spawnTimer = w <= 10 ? 1500 : (w <= 20 ? 750 : 750);
    this.telegraphPhase = true;
    this.state = 'playing';

    // Check title progression
    this.checkTitleProgression();

    // Try spawning item box (waves 4+)
    if (w >= 4 && !this.itemBox && Math.random() < 0.6) {
      this.time.delayedCall(Phaser.Math.Between(2000, 5000), () => {
        if (!this.itemBox && this.state === 'playing') this.spawnItemBox();
      });
    }
  }

  private handleSpawning(delta: number) {
    if (this.spawnQ.length === 0) return;
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      const groupSize = this.currentWave <= 6 ? 1
        : this.currentWave <= 10 ? Phaser.Math.Between(1, 2)
        : this.currentWave <= 15 ? Phaser.Math.Between(1, 3)
        : this.currentWave <= 20 ? Phaser.Math.Between(2, 4)
        : Phaser.Math.Between(2, 6);
      const toSpawn = Math.min(groupSize, this.spawnQ.length);
      for (let i = 0; i < toSpawn; i++) {
        this.spawnEnemy(this.spawnQ.shift()!);
      }
      this.spawnTimer = this.spawnInterval;
    }

    if (!this.midWaveOrbRoll && this.spawnQ.length < this.getWaveEnemyCount() / 2) {
      this.midWaveOrbRoll = true;
      if (this.orbs.length === 0 && Math.random() < 0.1) this.spawnOrbEvent();
    }
  }

  private checkWaveComplete() {
    if (this.spawnQ.length > 0 || this.enemies.length > 0 || this.projectiles.some(p => !p.friendly)) return;
    this.onWaveClear();
  }

  private onWaveClear() {
    this.state = 'waveClear';
    this.waveTimer = 3000;
    this.audio.playWaveClear();

    const banner = this.add.text(this.cx, this.cy - 60, `WAVE ${this.currentWave} CLEAR`, {
      fontSize: '44px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color: '#44aaff',
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    banner.setShadow(0, 0, '#44aaff', 12, true, true);

    this.tweens.add({
      targets: banner, alpha: 1, duration: 300,
      yoyo: true, hold: 2000,
      onComplete: () => banner.destroy(),
    });

    if (this.perfectWave && this.mode === 'normal') {
      this.score += 200;
      this.perfectStreak++;
      this.longestPerfectStreak = Math.max(this.longestPerfectStreak, this.perfectStreak);
      this.runStats.longestPerfectStreak = this.longestPerfectStreak;
      this.streakDurationBonus = this.perfectStreak * 500; // +0.5s per streak

      const perf = this.add.text(this.cx, this.cy, `★ PERFECT SHIELD +200 ★  STREAK: ${this.perfectStreak}`, {
        fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontStyle: 'bold', color: '#ffcc44',
      }).setOrigin(0.5).setDepth(50).setAlpha(0);
      this.tweens.add({
        targets: perf, alpha: 1, y: this.cy - 20, duration: 400,
        yoyo: true, hold: 1500,
        onComplete: () => perf.destroy(),
      });

      this.triggerRouletteReward('perfect');
    }

    if (this.orbs.length === 0 && Math.random() < 0.4) this.spawnOrbEvent();
  }

  /* ===== SPAWN TELEGRAPHS ===== */

  private showSpawnTelegraphs() {
    for (const t of this.telegraphs) t.gfx.destroy();
    this.telegraphs = [];

    const w = this.currentWave;
    const duration = w >= 21 ? 750 : 1500;
    const alpha = w >= 21 ? 0.15 : (w >= 11 ? 0.25 : 0.4);
    const count = w >= 11 ? Phaser.Math.Between(2, 4) : this.getWaveEnemyCount();
    const precise = w <= 10;

    const sw = this.scale.width;
    const sh = this.scale.height;

    for (let i = 0; i < Math.min(count, 12); i++) {
      const edge = Phaser.Math.Between(0, 3);
      let x: number, y: number;
      switch (edge) {
        case 0: x = Phaser.Math.Between(50, sw - 50); y = 4; break;
        case 1: x = sw - 4; y = Phaser.Math.Between(50, sh - 50); break;
        case 2: x = Phaser.Math.Between(50, sw - 50); y = sh - 4; break;
        default: x = 4; y = Phaser.Math.Between(50, sh - 50); break;
      }

      const gfx = this.add.graphics().setDepth(2);
      if (precise) {
        gfx.fillStyle(0xaaaaaa, alpha);
        gfx.fillCircle(x, y, 5);
      } else {
        gfx.fillStyle(0x888888, alpha * 0.6);
        const len = Phaser.Math.Between(40, 100);
        if (edge === 0 || edge === 2) {
          gfx.fillRect(x - len / 2, y - 3, len, 6);
        } else {
          gfx.fillRect(x - 3, y - len / 2, 6, len);
        }
      }

      this.telegraphs.push({ x, y, timer: duration, gfx });
    }
  }

  private updateTelegraphs(delta: number) {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer -= delta;
      if (t.timer <= 0) {
        t.gfx.destroy();
        this.telegraphs.splice(i, 1);
      } else {
        const fadeRatio = t.timer / 1500;
        t.gfx.setAlpha(Math.min(1, fadeRatio));
      }
    }
  }

  /* ===== PASSIVE UPGRADES ===== */

  private spawnOrbEvent() {
    this.orbSpawnCount++;
    const isChoice = this.orbSpawnCount % 3 === 0;

    if (isChoice) {
      const available = this.getAvailableOrbKinds();
      if (available.length >= 2) {
        const shuffled = Phaser.Utils.Array.Shuffle([...available]);
        this.spawnOrbPair(shuffled[0], shuffled[1]);
        return;
      }
    }
    this.spawnSingleOrb();
  }

  private getAvailableOrbKinds(): Orb['kind'][] {
    const kinds: Orb['kind'][] = ['duration', 'width'];
    return kinds.filter(k => {
      if (k === 'duration' && this.durStacks >= 3) return false;
      if (k === 'width' && this.widthStacks >= 3) return false;
      return true;
    });
  }

  private spawnSingleOrb() {
    const available = this.getAvailableOrbKinds();
    if (available.length === 0) return;
    const kind = available[Math.floor(Math.random() * available.length)];
    this.createOrb(kind, false);
  }

  private spawnOrbPair(kind1: Orb['kind'], kind2: Orb['kind']) {
    const orb1 = this.createOrb(kind1, true);
    const orb2 = this.createOrb(kind2, true, 30);
    if (orb1 && orb2) {
      orb1.partner = orb2;
      orb2.partner = orb1;
    }
  }

  private createOrb(kind: Orb['kind'], paired: boolean, yOffset = 0): Orb | null {
    const w = this.scale.width;
    const h = this.scale.height;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number, vx: number, vy: number;
    const speed = 30 + Math.random() * 20;
    switch (edge) {
      case 0: x = Phaser.Math.Between(100, w - 100); y = -20 - yOffset; vx = (Math.random() - 0.5) * 20; vy = speed; break;
      case 1: x = w + 20; y = Phaser.Math.Between(100, h - 100) + yOffset; vx = -speed; vy = (Math.random() - 0.5) * 20; break;
      case 2: x = Phaser.Math.Between(100, w - 100); y = h + 20 + yOffset; vx = (Math.random() - 0.5) * 20; vy = -speed; break;
      default: x = -20; y = Phaser.Math.Between(100, h - 100) + yOffset; vx = speed; vy = (Math.random() - 0.5) * 20; break;
    }

    const colors: Record<string, number> = {
      duration: 0x44ff44, width: 0x4488ff,
    };

    const gfx = this.add.graphics().setDepth(6);
    const color = colors[kind];
    gfx.fillStyle(color, 0.15); gfx.fillCircle(0, 0, 22);
    gfx.fillStyle(color, 0.4); gfx.fillCircle(0, 0, 14);
    gfx.fillStyle(color, 0.9); gfx.fillCircle(0, 0, 8);
    gfx.lineStyle(1.5, color, 0.6); gfx.strokeCircle(0, 0, 18);

    const orb: Orb = { gfx, x, y, vx, vy, kind, size: 18, age: 0, paired, partner: null };
    this.orbs.push(orb);
    return orb;
  }

  private updateOrbs(delta: number) {
    const dt = delta / 1000;
    const w = this.scale.width;
    const h = this.scale.height;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.age += delta;
      o.gfx.setPosition(o.x, o.y);

      const pulse = 1 + Math.sin(o.age * 0.005) * 0.1;
      o.gfx.setScale(pulse);

      if (o.x < -40 || o.x > w + 40 || o.y < -40 || o.y > h + 40) {
        o.gfx.destroy();
        this.orbs.splice(i, 1);
      }
    }
  }

  private collectOrb(orb: Orb, idx: number) {
    const kind = orb.kind;
    orb.gfx.destroy();
    this.orbs.splice(idx, 1);
    this.audio.playUpgrade();

    // If paired, remove partner
    if (orb.paired && orb.partner) {
      const partnerIdx = this.orbs.indexOf(orb.partner);
      if (partnerIdx >= 0) {
        this.orbs[partnerIdx].gfx.destroy();
        this.orbs.splice(partnerIdx, 1);
      }
    }

    let label = '';
    switch (kind) {
      case 'duration':
        this.durStacks = Math.min(3, this.durStacks + 1);
        label = `SHIELD DURATION +${this.durStacks * 60}%`;
        break;
      case 'width':
        this.widthStacks = Math.min(3, this.widthStacks + 1);
        label = `SHIELD WIDTH +${this.widthStacks * 25}%`;
        break;
    }

    this.showFloatingText(this.cx, this.cy - 90, label, '#ffffff');
  }

  /* ===== ITEM ROULETTE SYSTEM ===== */

  private spawnItemBox() {
    const w = this.scale.width;
    const h = this.scale.height;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number, vx: number, vy: number;
    const speed = 25 + Math.random() * 15;
    switch (edge) {
      case 0: x = Phaser.Math.Between(100, w - 100); y = -20; vx = (Math.random() - 0.5) * 15; vy = speed; break;
      case 1: x = w + 20; y = Phaser.Math.Between(100, h - 100); vx = -speed; vy = (Math.random() - 0.5) * 15; break;
      case 2: x = Phaser.Math.Between(100, w - 100); y = h + 20; vx = (Math.random() - 0.5) * 15; vy = -speed; break;
      default: x = -20; y = Phaser.Math.Between(100, h - 100); vx = speed; vy = (Math.random() - 0.5) * 15; break;
    }

    const gfx = this.add.graphics().setDepth(6);
    this.drawItemBoxGraphic(gfx);
    const label = this.add.text(0, 0, '?', {
      fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(6);
    this.itemBox = { gfx, label, x, y, vx, vy, age: 0 };
  }

  private drawItemBoxGraphic(gfx: Phaser.GameObjects.Graphics) {
    gfx.fillStyle(0xffffff, 0.06); gfx.fillCircle(0, 0, 24);
    gfx.lineStyle(2, 0xffffff, 0.6); gfx.strokeCircle(0, 0, 20);
  }

  private updateItemBox(delta: number) {
    if (!this.itemBox) return;
    const dt = delta / 1000;
    const ib = this.itemBox;
    ib.age += delta;

    // Gradual ramp: no speed/wobble change for first 3s, then eases in
    const rampStart = 3000;
    const elapsed = Math.max(0, ib.age - rampStart);
    const speedMul = 1 + elapsed * 0.0004;

    ib.x += ib.vx * speedMul * dt;
    ib.y += ib.vy * speedMul * dt;

    // Wobble grows from 0 after rampStart
    const wobbleAmp = Math.min(50, elapsed * 0.008);
    const wobbleFreq = 0.0015 + elapsed * 0.0000003;
    const wobble = Math.sin(ib.age * wobbleFreq) * wobbleAmp;
    const perpX = -ib.vy;
    const perpY = ib.vx;
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
    const displayX = ib.x + (perpX / perpLen) * wobble;
    const displayY = ib.y + (perpY / perpLen) * wobble;

    ib.gfx.setPosition(displayX, displayY);
    ib.label.setPosition(displayX, displayY);

    const shimmer = 1 + Math.sin(ib.age * 0.004) * 0.15;
    ib.gfx.setScale(shimmer);
    ib.label.setScale(shimmer);

    const w = this.scale.width;
    const h = this.scale.height;
    if (ib.x < -60 || ib.x > w + 60 || ib.y < -60 || ib.y > h + 60) {
      ib.gfx.destroy();
      ib.label.destroy();
      this.itemBox = null;
    }
  }

  private collectItemBox() {
    if (!this.itemBox) return;

    this.itemBox.gfx.destroy();
    this.itemBox.label.destroy();
    this.itemBox = null;

    const slotIdx = this.getNextEmptySlot();
    if (slotIdx === -1) {
      this.audio.playQueueFull();
      return;
    }

    this.audio.playItemCollect();
    this.startRoulette(slotIdx);
  }

  private getNextEmptySlot(): number {
    if (!this.itemQueue[0].item && !this.rouletteSlots[0].active) return 0;
    if (!this.itemQueue[1].item && !this.rouletteSlots[1].active) return 1;
    return -1;
  }

  private triggerRouletteReward(source: string) {
    const slotIdx = this.getNextEmptySlot();
    if (slotIdx === -1) {
      this.showFloatingText(this.cx, this.scale.height - 60, 'QUEUE FULL', '#886644');
      this.audio.playQueueFull();
      return;
    }

    this.showFloatingText(this.cx, this.cy - 120, 'ITEM EARNED!', '#ffcc44');
    this.startRoulette(slotIdx);
  }

  private startRoulette(slotIdx: number) {
    const rs = this.rouletteSlots[slotIdx];
    if (rs.active) return;

    rs.active = true;
    rs.timer = 2000;
    rs.displayIdx = Math.floor(Math.random() * 7);
    rs.spinAccum = 0;
    rs.result = this.rollWeightedItem();

    if (rs.text) rs.text.destroy();
    rs.text = this.add.text(0, 0, '', {
      fontSize: '14px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color: '#ffffff',
    }).setDepth(95);
    rs.text.setOrigin(slotIdx === 0 ? 1 : 0, 0.5);

    if (!this.firstItemEarned) {
      this.firstItemEarned = true;
      if (!this.itemTutorialShown) {
        this.itemTutorialShown = true;
        this.itemTutorialText = this.add.text(this.cx, this.scale.height - 100, 'Right-click to use item', {
          fontSize: '16px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#667799',
        }).setOrigin(0.5).setDepth(50);
        this.time.delayedCall(5000, () => {
          if (this.itemTutorialText) {
            this.itemTutorialText.destroy();
            this.itemTutorialText = null;
          }
        });
      }
    }
  }

  private rollWeightedItem(): ItemType {
    const items: ItemType[] = ['gravityField', 'timeBender', 'healthSurge', 'starBomb', 'timeFreeze', 'sanctuary', 'cardinalRift'];
    const weights: number[] = [10, 10, 10, 10, 10, 10, 10];
    const hpRatio = this.coreHP / this.maxHP;

    // Weight adjustments based on game state
    if (hpRatio < 0.3) {
      weights[2] += 15; // healthSurge
      weights[5] += 10; // sanctuary
    }
    if (hpRatio > 0.8) {
      weights[2] = 2; // healthSurge rare when healthy
    }

    const enemyCount = this.enemies.length;
    if (enemyCount >= 15) {
      weights[0] += 8; // gravityField
      weights[3] += 8; // starBomb
      weights[6] += 6; // cardinalRift
    }
    if (enemyCount < 5) {
      weights[1] = Math.max(2, weights[1] - 5); // timeBender less useful
      weights[4] = Math.max(2, weights[4] - 5); // timeFreeze less useful
    }

    // Check quadrant spread for Cardinal Rift
    const quadrants = new Set<number>();
    for (const e of this.enemies) {
      const qx = e.x >= this.cx ? 1 : 0;
      const qy = e.y >= this.cy ? 1 : 0;
      quadrants.add(qx * 2 + qy);
    }
    if (quadrants.size >= 3) {
      weights[6] += 10; // cardinalRift
    }

    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  private updateRoulette(delta: number) {
    const allItems: ItemType[] = ['gravityField', 'timeBender', 'healthSurge', 'starBomb', 'timeFreeze', 'sanctuary', 'cardinalRift'];

    for (let si = 0; si < 2; si++) {
      const rs = this.rouletteSlots[si];
      if (!rs.active) continue;

      rs.timer -= delta;
      const progress = 1 - Math.max(0, rs.timer) / 2000;
      const tickInterval = 60 + progress * progress * 300;

      rs.spinAccum += delta;
      if (rs.spinAccum >= tickInterval) {
        rs.spinAccum -= tickInterval;
        rs.displayIdx = (rs.displayIdx + 1) % allItems.length;
        this.audio.playRouletteSpinTick();
      }

      if (rs.text) {
        const displayItem = rs.timer > 0 ? allItems[rs.displayIdx] : rs.result!;
        const label = ITEM_LABELS[displayItem];
        const color = ITEM_COLORS[displayItem];
        rs.text.setText(label);
        rs.text.setColor('#' + color.toString(16).padStart(6, '0'));
      }

      if (rs.timer <= 0) {
        rs.active = false;
        this.itemQueue[si].item = rs.result;
        this.audio.playRouletteLand();

        if (rs.text) {
          rs.text.setText(ITEM_LABELS[rs.result!]);
          rs.text.setColor('#' + ITEM_COLORS[rs.result!].toString(16).padStart(6, '0'));
        }
      }
    }

    this.enforceQueueOrder();
  }

  private enforceQueueOrder() {
    if (!this.itemQueue[0].item && this.itemQueue[1].item
        && !this.rouletteSlots[0].active && !this.rouletteSlots[1].active) {
      this.itemQueue[0].item = this.itemQueue[1].item;
      this.itemQueue[1].item = null;

      const rs0 = this.rouletteSlots[0];
      const rs1 = this.rouletteSlots[1];
      if (rs0.text) { rs0.text.destroy(); rs0.text = null; }
      if (rs1.text) {
        rs0.text = rs1.text;
        rs1.text = null;
        rs0.text!.setOrigin(1, 0.5);
      }
    }
  }

  private useItem(mx: number, my: number) {
    const slot = this.itemQueue[0];
    if (!slot.item) return;

    const item = slot.item;
    slot.item = null;

    // Clear the label text for slot 0
    const rs0 = this.rouletteSlots[0];
    if (rs0.text) { rs0.text.destroy(); rs0.text = null; }

    // Shift slot 2 → slot 1 only when no roulette is actively spinning
    if (!this.rouletteSlots[1].active) {
      this.itemQueue[0].item = this.itemQueue[1].item;
      this.itemQueue[1].item = null;

      // Move slot 1's label text to slot 0 position
      const rs1 = this.rouletteSlots[1];
      if (rs1.text) {
        this.rouletteSlots[0].text = rs1.text;
        rs1.text = null;
        this.rouletteSlots[0].text!.setOrigin(1, 0.5);
      }
    }

    this.runStats.itemsUsed++;

    if (this.itemTutorialText) {
      this.itemTutorialText.destroy();
      this.itemTutorialText = null;
    }

    switch (item) {
      case 'gravityField': this.activateGravityField(mx, my); break;
      case 'timeBender': this.activateTimeBender(); break;
      case 'healthSurge': this.activateHealthSurge(); break;
      case 'starBomb': this.activateStarBomb(); break;
      case 'timeFreeze': this.activateTimeFreeze(); break;
      case 'sanctuary': this.activateSanctuary(); break;
      case 'cardinalRift': this.activateCardinalRift(); break;
    }
  }

  /* ===== ITEM ACTIVATIONS ===== */

  private activateGravityField(x: number, y: number) {
    this.audio.playGravityField();
    const gfx = this.add.graphics().setDepth(7);
    this.gravityFields.push({ x, y, timer: 3000, gfx });
  }

  private updateGravityFields(delta: number) {
    const dt = delta / 1000;
    const radius = 180;

    for (let i = this.gravityFields.length - 1; i >= 0; i--) {
      const gf = this.gravityFields[i];
      gf.timer -= delta;

      // Push enemies away from core through the gravity field point
      for (const e of this.enemies) {
        const dist = Phaser.Math.Distance.Between(e.x, e.y, gf.x, gf.y);
        if (dist < radius && dist > 5) {
          const ang = Phaser.Math.Angle.Between(this.cx, this.cy, e.x, e.y);
          const pushStrength = 140 * (1 - dist / radius);
          e.x += Math.cos(ang) * pushStrength * dt;
          e.y += Math.sin(ang) * pushStrength * dt;
        }
      }

      // Draw vortex
      gf.gfx.clear();
      const alphaFade = Math.min(1, gf.timer / 500);
      const angle = this.gameTime * 0.003;
      gf.gfx.lineStyle(2, 0x44ffff, 0.4 * alphaFade);
      gf.gfx.strokeCircle(gf.x, gf.y, radius * 0.3 + Math.sin(angle) * 10);
      gf.gfx.lineStyle(1.5, 0x44ffff, 0.25 * alphaFade);
      gf.gfx.strokeCircle(gf.x, gf.y, radius * 0.6 + Math.cos(angle * 1.3) * 15);
      gf.gfx.lineStyle(1, 0x44ffff, 0.15 * alphaFade);
      gf.gfx.strokeCircle(gf.x, gf.y, radius);

      if (gf.timer <= 0) {
        gf.gfx.destroy();
        this.gravityFields.splice(i, 1);
      }
    }
  }

  private activateTimeBender() {
    this.audio.playTimeBender();
    this.timeBenderTimer = 4000;
    this.cameras.main.flash(200, 200, 200, 255, true);
  }

  private activateHealthSurge() {
    this.audio.playHealthSurge();
    this.coreHP = Math.min(this.maxHP, this.coreHP + 20);

    const ring = this.add.graphics().setDepth(8);
    let r = 0;
    const start = this.gameTime;
    const expand = () => {
      const elapsed = this.gameTime - start;
      const t = Math.min(1, elapsed / 400);
      r = 120 * t;
      ring.clear();
      ring.lineStyle(3 * (1 - t), 0xff4444, 0.6 * (1 - t));
      ring.strokeCircle(this.cx, this.cy, r);
      if (t < 1) this.time.delayedCall(16, expand);
      else ring.destroy();
    };
    expand();
  }

  private activateStarBomb() {
    this.audio.playClick();
    this.pendingStarBomb = true;
    this.showFloatingText(this.cx, this.cy - 100, 'STAR BOMB — Place shield!', '#ffdd44');
  }

  private doStarBombBlast(x: number, y: number) {
    this.audio.playStarBomb();
    const radius = this.getFieldLen() * 3;

    const ring = this.add.graphics().setDepth(8);
    let r = 0;
    const start = this.gameTime;
    const expand = () => {
      const elapsed = this.gameTime - start;
      const t = Math.min(1, elapsed / 400);
      r = radius * t;
      ring.clear();
      ring.lineStyle(8 * (1 - t), 0xffdd44, 1 - t);
      ring.strokeCircle(x, y, r);
      ring.fillStyle(0xffdd44, 0.08 * (1 - t));
      ring.fillCircle(x, y, r);
      if (t < 1) this.time.delayedCall(16, expand);
      else ring.destroy();
    };
    expand();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
        if (e.type === 'phaser' && !e.phaserVisible) continue;
        this.destroyEnemy(e, i, false);
      }
    }
  }

  private activateTimeFreeze() {
    this.audio.playTimeFreeze();
    this.timeFreezeTimer = 2500;
    this.cameras.main.flash(100, 170, 100, 255, true);
  }

  private activateSanctuary() {
    this.audio.playSanctuary();
    this.sanctuaryTimer = 8000;
  }

  private activateCardinalRift() {
    this.audio.playCardinalRift();
    this.cameras.main.flash(150, 255, 100, 255, true);

    for (const e of this.enemies) {
      const angle = Phaser.Math.Angle.Between(this.cx, this.cy, e.x, e.y);
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);

      // Snap to nearest cardinal
      let snappedAngle: number;
      const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (normalized < Math.PI * 0.25 || normalized >= Math.PI * 1.75) snappedAngle = 0;
      else if (normalized < Math.PI * 0.75) snappedAngle = Math.PI * 0.5;
      else if (normalized < Math.PI * 1.25) snappedAngle = Math.PI;
      else snappedAngle = Math.PI * 1.5;

      e.x = this.cx + Math.cos(snappedAngle) * dist;
      e.y = this.cy + Math.sin(snappedAngle) * dist;
      e.gfx.setPosition(e.x, e.y);
    }

    // Visual: magenta cross
    const cross = this.add.graphics().setDepth(8);
    cross.lineStyle(4, 0xff44ff, 0.6);
    cross.lineBetween(this.cx, 0, this.cx, this.scale.height);
    cross.lineBetween(0, this.cy, this.scale.width, this.cy);
    this.tweens.add({
      targets: cross, alpha: 0, duration: 600,
      onComplete: () => cross.destroy(),
    });
  }

  private updateActiveEffects(delta: number) {
    if (this.timeBenderTimer > 0) this.timeBenderTimer -= delta;
    if (this.timeFreezeTimer > 0) this.timeFreezeTimer -= delta;
    if (this.sanctuaryTimer > 0) {
      this.sanctuaryTimer -= delta;
      if (this.sanctuaryTimer <= 0) {
        this.audio.playSanctuaryEnd();
      }
    }
  }

  /* ===== TITLE PROGRESSION ===== */

  private checkTitleProgression() {
    const currentTitle = getTitleForWave(this.currentWave);
    if (currentTitle && currentTitle !== this.previousTitle) {
      this.previousTitle = currentTitle;
      this.audio.playRankUp();

      const banner = this.add.text(this.cx, this.cy - 100, `RANK ACHIEVED: ${currentTitle.toUpperCase()}`, {
        fontSize: '28px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontStyle: 'bold', color: '#ffcc44',
      }).setOrigin(0.5).setDepth(55).setAlpha(0);
      banner.setShadow(0, 0, '#ffcc44', 12, true, true);

      this.tweens.add({
        targets: banner, alpha: 1, duration: 400,
        yoyo: true, hold: 2000,
        onComplete: () => banner.destroy(),
      });
    }
  }

  /* ===== EFFECTS ===== */

  private spawnExplosion(x: number, y: number, color: number) {
    const emitter = this.add.particles(x, y, 'particle', {
      speed: { min: 60, max: 200 },
      lifespan: 400,
      quantity: 12,
      scale: { start: 0.8, end: 0 },
      tint: color,
      emitting: false,
    }).setDepth(7);
    emitter.explode(12);
    this.time.delayedCall(600, () => emitter.destroy());
  }

  private coreHitEffect() {
    this.audio.playCoreHit();
    this.cameras.main.shake(120, 0.006);
    this.cameras.main.flash(80, 180, 30, 30);
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const txt = this.add.text(x, y, text, {
      fontSize: '18px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color,
    }).setOrigin(0.5).setDepth(50).setAlpha(0);

    this.tweens.add({
      targets: txt, alpha: 1, y: y - 25, duration: 300,
      yoyo: true, hold: 1000,
      onComplete: () => txt.destroy(),
    });
  }

  /* ===== PLANET ===== */

  private drawPlanet() {
    const g = this.planetGfx;
    g.clear();

    g.fillStyle(0x2244aa, 0.05);
    g.fillCircle(this.cx, this.cy, 90);
    g.fillStyle(0x2244aa, 0.08);
    g.fillCircle(this.cx, this.cy, 65);

    g.fillStyle(0x1a3388, 1);
    g.fillCircle(this.cx, this.cy, PLANET_R);
    g.fillStyle(0x2952b8, 0.7);
    g.fillCircle(this.cx - 6, this.cy - 6, PLANET_R - 6);
    g.fillStyle(0x4477dd, 0.25);
    g.fillCircle(this.cx - 12, this.cy - 12, PLANET_R * 0.5);

    const hpRatio = this.coreHP / this.maxHP;
    const hpColor = hpRatio > 0.6 ? 0x44ff88 : hpRatio > 0.3 ? 0xffaa44 : 0xff4466;
    g.fillStyle(hpColor, 0.15);
    g.fillCircle(this.cx, this.cy, PLANET_R + 6);

    // Sanctuary dome
    if (this.sanctuaryTimer > 0) {
      const pulseAlpha = 0.2 + Math.sin(this.gameTime * 0.005) * 0.1;
      g.fillStyle(0xffcc44, pulseAlpha);
      g.fillCircle(this.cx, this.cy, PLANET_R + 16);
      g.lineStyle(2, 0xffcc44, 0.5);
      g.strokeCircle(this.cx, this.cy, PLANET_R + 16);

      // Countdown ring
      const ratio = this.sanctuaryTimer / 8000;
      g.lineStyle(3, 0xffcc44, 0.7);
      g.beginPath();
      g.arc(this.cx, this.cy, PLANET_R + 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio, false);
      g.strokePath();
    }

    const tilt = Math.sin(this.planetAngle) * 0.35 + 0.35;
    g.lineStyle(2.5, 0x5599ff, 0.35);
    g.strokeEllipse(this.cx, this.cy, PLANET_R * 3.2, PLANET_R * 3.2 * tilt);
    g.lineStyle(1.5, 0x77bbff, 0.15);
    g.strokeEllipse(this.cx, this.cy, PLANET_R * 4, PLANET_R * 4 * tilt);
  }

  /* ===== HUD ===== */

  private createHUD() {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '15px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#8899aa',
    };

    this.waveText = this.add.text(16, 12, '', style).setDepth(95);
    this.scoreText = this.add.text(140, 12, '', style).setDepth(95);
    this.hpText = this.add.text(0, 12, '', style).setDepth(95);
    this.nameText = this.add.text(0, 12, '', { ...style, color: '#556677' }).setDepth(95);
    this.bestText = this.add.text(0, 12, '', { ...style, color: '#556677', fontSize: '12px' }).setDepth(95);
    this.streakText = this.add.text(0, 12, '', { ...style, color: '#ff8844', fontSize: '13px' }).setDepth(95);

    const lbBtn = this.add.text(0, 12, '☰', {
      fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#446688',
    }).setDepth(95).setInteractive({ useHandCursor: true });
    lbBtn.on('pointerover', () => lbBtn.setColor('#ffffff'));
    lbBtn.on('pointerout', () => lbBtn.setColor('#446688'));
    lbBtn.on('pointerdown', () => this.toggleLB());

    this.scale.on('resize', () => this.repositionHUD(lbBtn));
    this.repositionHUD(lbBtn);
  }

  private repositionHUD(lbBtn?: Phaser.GameObjects.Text) {
    const w = this.scale.width;
    this.hpText.setPosition(w / 2 - 80, 12);
    this.nameText.setPosition(w - 220, 12);
    this.bestText.setPosition(w - 220, 30);
    this.streakText.setPosition(260, 12);
    if (lbBtn) lbBtn.setPosition(w - 40, 10);
  }

  private updateHUD() {
    this.waveText.setText(`WAVE ${this.currentWave}`);
    this.scoreText.setText(`SCORE ${this.score}`);

    const hpRatio = this.coreHP / this.maxHP;
    const hpPct = Math.round(hpRatio * 100);
    this.hpText.setText(`CORE ${hpPct}%`);
    this.hpText.setColor(hpRatio > 0.6 ? '#44ff88' : hpRatio > 0.3 ? '#ffaa44' : '#ff4466');

    const name = StorageManager.getGuardianName();
    const title = getTitleForWave(this.currentWave);
    this.nameText.setText(title ? `${name} · ${title}` : name);

    if (this.mode === 'normal') {
      const best = StorageManager.getPersonalBest(name);
      this.bestText.setText(`BEST: ${best}`);
    } else {
      this.bestText.setText('PRACTICE');
    }

    // Perfect streak display
    this.streakText.setText(`🔥 ${this.perfectStreak}`);
    this.streakText.setAlpha(this.perfectStreak > 0 ? 1 : 0.4);

    this.hudGfx.clear();
    const barX = this.scale.width / 2 - 75;
    const barY = 34;
    const barW = 150;
    const barH = 6;

    this.hudGfx.fillStyle(0x1a1a2a);
    this.hudGfx.fillRoundedRect(barX, barY, barW, barH, 3);

    const hpColor = hpRatio > 0.6 ? 0x44ff88 : hpRatio > 0.3 ? 0xffaa44 : 0xff4466;
    this.hudGfx.fillStyle(hpColor, 0.8);
    this.hudGfx.fillRoundedRect(barX, barY, barW * hpRatio, barH, 3);

    // Active upgrade indicators
    let indicatorX = this.scale.width / 2 + 100;
    if (this.durStacks > 0) {
      this.hudGfx.fillStyle(0x44ff44, 0.6);
      this.hudGfx.fillCircle(indicatorX, 20, 6);
      indicatorX += 18;
    }
    if (this.widthStacks > 0) {
      this.hudGfx.fillStyle(0x4488ff, 0.6);
      this.hudGfx.fillCircle(indicatorX, 20, 6);
      indicatorX += 18;
    }

    // Active effect timers
    if (this.timeBenderTimer > 0) {
      this.hudGfx.fillStyle(0xffffff, 0.3);
      this.hudGfx.fillRoundedRect(this.cx - 50, 50, 100 * (this.timeBenderTimer / 4000), 4, 2);
    }
    if (this.timeFreezeTimer > 0) {
      this.hudGfx.fillStyle(0xaa44ff, 0.3);
      this.hudGfx.fillRoundedRect(this.cx - 50, 58, 100 * (this.timeFreezeTimer / 2500), 4, 2);
    }
    if (this.sanctuaryTimer > 0) {
      this.hudGfx.fillStyle(0xffcc44, 0.3);
      this.hudGfx.fillRoundedRect(this.cx - 50, 66, 100 * (this.sanctuaryTimer / 8000), 4, 2);
    }
  }

  private drawItemQueue() {
    const slotW = 36;
    const slotH = 36;
    const gap = 8;
    const totalW = slotW * 2 + gap;
    const baseX = this.cx - totalW / 2;
    const baseY = 48;
    const s2x = baseX + slotW + gap;
    const slotMidY = baseY + slotH / 2;

    // Slot outlines
    this.hudGfx.lineStyle(1.5, 0x334455, 0.5);
    this.hudGfx.strokeRoundedRect(baseX, baseY, slotW, slotH, 5);
    this.hudGfx.strokeRoundedRect(s2x, baseY, slotW, slotH, 5);

    // Slot 1 (ready)
    const s1 = this.itemQueue[0];
    if (s1.item) {
      const color = ITEM_COLORS[s1.item];
      this.hudGfx.fillStyle(color, 0.3);
      this.hudGfx.fillRoundedRect(baseX + 2, baseY + 2, slotW - 4, slotH - 4, 4);
      this.hudGfx.fillStyle(color, 0.8);
      this.hudGfx.fillCircle(baseX + slotW / 2, slotMidY, 7);
    } else {
      this.hudGfx.fillStyle(0x222233, 0.3);
      this.hudGfx.fillRoundedRect(baseX + 2, baseY + 2, slotW - 4, slotH - 4, 4);
    }

    // Slot 2 (on deck)
    const s2 = this.itemQueue[1];
    if (s2.item) {
      const color = ITEM_COLORS[s2.item];
      this.hudGfx.fillStyle(color, 0.2);
      this.hudGfx.fillRoundedRect(s2x + 2, baseY + 2, slotW - 4, slotH - 4, 4);
      this.hudGfx.fillStyle(color, 0.6);
      this.hudGfx.fillCircle(s2x + slotW / 2, slotMidY, 5);
    } else {
      this.hudGfx.fillStyle(0x222233, 0.2);
      this.hudGfx.fillRoundedRect(s2x + 2, baseY + 2, slotW - 4, slotH - 4, 4);
    }

    // Roulette text positioning — always keep text aligned to its slot
    const allItems: ItemType[] = ['gravityField', 'timeBender', 'healthSurge', 'starBomb', 'timeFreeze', 'sanctuary', 'cardinalRift'];
    for (let si = 0; si < 2; si++) {
      const rs = this.rouletteSlots[si];

      if (rs.text) {
        const textX = si === 0 ? baseX - 6 : s2x + slotW + 6;
        rs.text.setPosition(textX, slotMidY);
      }

      if (!rs.active) continue;
      const slotX = si === 0 ? baseX : s2x;
      const flickColor = ITEM_COLORS[allItems[rs.displayIdx]];
      this.hudGfx.fillStyle(flickColor, 0.5);
      this.hudGfx.fillRoundedRect(slotX + 2, baseY + 2, slotW - 4, slotH - 4, 4);
    }

    // Star bomb pending indicator
    if (this.pendingStarBomb) {
      this.hudGfx.lineStyle(2, 0xffdd44, 0.5 + Math.sin(this.gameTime * 0.008) * 0.3);
      this.hudGfx.strokeCircle(this.cx, this.cy, PLANET_R + 30);
    }
  }

  /* ===== PAUSE ===== */

  private createPauseOverlay() {
    this.pauseContainer = this.add.container(0, 0).setDepth(100).setVisible(false);
    const bg = this.add.rectangle(this.cx, this.cy, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.7);
    const txt = this.add.text(this.cx, this.cy, 'PAUSED\nClick to resume', {
      fontSize: '40px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      color: '#ffffff', align: 'center', lineSpacing: 12,
    }).setOrigin(0.5);
    this.pauseContainer.add([bg, txt]);
  }

  private togglePause() {
    if (this.state === 'gameOver') return;
    if (this.showingLB) this.toggleLB();
    if (this.state === 'paused') {
      this.state = this.prevState;
      this.pauseContainer.setVisible(false);
    } else {
      this.prevState = this.state;
      this.state = 'paused';
      this.pauseContainer.setVisible(true);
    }
  }

  /* ===== LEADERBOARD ===== */

  private createLeaderboardPanel() {
    this.lbContainer = this.add.container(this.cx, this.cy).setDepth(110).setVisible(false);
  }

  private toggleLB() {
    this.showingLB = !this.showingLB;
    if (this.showingLB) {
      this.lbContainer.removeAll(true);
      const bg = this.add.rectangle(0, 0, 480, 380, 0x0a0a1a, 0.75).setStrokeStyle(2, 0x335577);
      const title = this.add.text(0, -165, 'LEADERBOARD', {
        fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#4af', fontStyle: 'bold',
      }).setOrigin(0.5);
      const hdr = this.add.text(-210, -130, 'RANK  NAME             RANK        WAVE   SCORE', {
        fontSize: '10px', fontFamily: 'monospace', color: '#556677',
      });
      this.lbContainer.add([bg, title, hdr]);

      const entries = StorageManager.getLeaderboard().slice(0, 10);
      entries.forEach((e, i) => {
        const rank = String(i + 1).padStart(2);
        const name = e.name.padEnd(16);
        const titleStr = (e.title || '').padEnd(10);
        const wave = String(e.wave).padStart(4);
        const score = String(e.score).padStart(7);
        const row = this.add.text(-210, -100 + i * 24, `${rank}    ${name} ${titleStr} ${wave}   ${score}`, {
          fontSize: '12px', fontFamily: 'monospace',
          color: i === 0 ? '#ffcc44' : i < 3 ? '#44aaff' : '#8899aa',
        });
        this.lbContainer.add(row);
      });

      const close = this.add.text(0, 160, '[ CLOSE ]', {
        fontSize: '13px', fontFamily: '"Segoe UI", system-ui, sans-serif', color: '#556677',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      close.on('pointerover', () => close.setColor('#ffffff'));
      close.on('pointerout', () => close.setColor('#556677'));
      close.on('pointerdown', () => this.toggleLB());
      this.lbContainer.add(close);
      this.lbContainer.setVisible(true);
      this.lbContainer.setPosition(this.cx, this.cy);
    } else {
      this.lbContainer.setVisible(false);
    }
  }

  /* ===== GAME OVER ===== */

  private triggerGameOver() {
    this.state = 'gameOver';
    for (const e of this.enemies) e.gfx.destroy();
    for (const ff of this.fields) ff.gfx.destroy();
    for (const p of this.projectiles) p.gfx.destroy();
    for (const o of this.orbs) o.gfx.destroy();
    for (const gf of this.gravityFields) gf.gfx.destroy();
    for (const t of this.telegraphs) t.gfx.destroy();
    if (this.itemBox) { this.itemBox.gfx.destroy(); this.itemBox.label.destroy(); this.itemBox = null; }
    this.enemies = [];
    this.fields = [];
    this.projectiles = [];
    this.orbs = [];
    this.gravityFields = [];
    this.telegraphs = [];

    this.spawnExplosion(this.cx, this.cy, 0x4488ff);
    this.cameras.main.shake(400, 0.015);

    // Compute favorite sector
    const sc = this.runStats.sectorCounts;
    const sectors: [string, number][] = [['NE', sc.NE], ['NW', sc.NW], ['SE', sc.SE], ['SW', sc.SW]];
    sectors.sort((a, b) => b[1] - a[1]);
    const sectorLabels: Record<string, string> = {
      NE: 'Northeast Guardian', NW: 'Northwest Guardian',
      SE: 'Southeast Guardian', SW: 'Southwest Guardian',
    };
    this.runStats.favoriteSector = sectorLabels[sectors[0][0]];

    // Apply multi-kill score adjustments for any remaining multi-kill shields
    // (already applied per-destroy, this just ensures final stats are correct)

    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        wave: this.currentWave,
        mode: this.mode,
        runStats: this.runStats,
        totalEnemiesDestroyed: this.totalEnemiesDestroyed,
      });
    });
  }

  /* ===== BACKGROUND ===== */

  private generateStars() {
    this.stars = [];
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * 2400,
        y: Math.random() * 1400,
        s: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.4 + 0.1,
      });
    }
  }

  private drawBackground() {
    this.bgGfx.clear();
    for (const s of this.stars) {
      this.bgGfx.fillStyle(0xffffff, s.a);
      this.bgGfx.fillCircle(s.x, s.y, s.s);
    }
  }
}
