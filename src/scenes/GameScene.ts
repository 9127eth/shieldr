import Phaser from 'phaser';
import { StorageManager } from '../storage';
import { AudioManager } from '../audio';

interface ForceField {
  gfx: Phaser.GameObjects.Graphics;
  x1: number; y1: number;
  x2: number; y2: number;
  born: number;
  duration: number;
  isShockwave: boolean;
}

interface Enemy {
  gfx: Phaser.GameObjects.Graphics;
  x: number; y: number;
  type: 'drone' | 'rocket' | 'shooter';
  speed: number;
  damage: number;
  size: number;
  points: number;
  stopped: boolean;
  shootCd: number;
  shootInterval: number;
  shootRange: number;
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
  kind: 'duration' | 'width' | 'reflective' | 'repair' | 'shockwave';
  size: number;
  age: number;
}

type GameState = 'playing' | 'waveClear' | 'paused' | 'gameOver';

const PLANET_R = 38;
const BASE_FIELD_LEN = 120;
const BASE_FIELD_DUR = 5000;
const FIELD_COLLISION_R = 10;
const DRONE_SPEED = 110;
const ROCKET_SPEED = 55;
const SHOOTER_SPEED = 75;

export class GameScene extends Phaser.Scene {
  private cx = 0;
  private cy = 0;
  private mode: 'normal' | 'practice' = 'normal';

  private coreHP = 100;
  private maxHP = 100;
  private score = 0;
  private currentWave = 0;
  private gameTime = 0;

  private state: GameState = 'playing';
  private prevState: GameState = 'playing';
  private perfectWave = true;

  private fields: ForceField[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private orb: Orb | null = null;

  private spawnQ: string[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1000;
  private waveTimer = 0;
  private midWaveOrbRoll = false;

  private durStacks = 0;
  private widthStacks = 0;
  private hasReflect = false;
  private hasShockwave = false;

  private planetGfx!: Phaser.GameObjects.Graphics;
  private hudGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;

  private pauseContainer!: Phaser.GameObjects.Container;
  private lbContainer!: Phaser.GameObjects.Container;
  private showingLB = false;
  private tooltip!: Phaser.GameObjects.Text | null;

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
    this.state = 'playing';
    this.perfectWave = true;
    this.fields = [];
    this.enemies = [];
    this.projectiles = [];
    this.orb = null;
    this.spawnQ = [];
    this.durStacks = 0;
    this.widthStacks = 0;
    this.hasReflect = false;
    this.hasShockwave = false;
    this.showingLB = false;
    this.tooltip = null;
    this.midWaveOrbRoll = false;
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
      this.handleSpawning(delta);
      this.updateFields(delta);
      this.updateEnemies(delta);
      this.updateProjectiles(delta);
      this.checkCollisions();
      this.updateOrb(delta);
      this.checkWaveComplete();
    } else if (this.state === 'waveClear') {
      this.waveTimer -= delta;
      this.updateOrb(delta);
      this.updateFields(delta);
      if (this.waveTimer <= 0) this.startNextWave();
    }

    this.updateHUD();
  }

  /* ===== INPUT ===== */

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (this.showingLB) return;
    if (this.state === 'paused') {
      this.togglePause();
      return;
    }
    if (this.state === 'gameOver') return;

    if (this.orb) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, this.orb.x, this.orb.y);
      if (d < this.orb.size + 20) {
        this.collectOrb();
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
    return BASE_FIELD_DUR + this.durStacks * 3000;
  }

  private placeField(mx: number, my: number) {
    const angle = Phaser.Math.Angle.Between(this.cx, this.cy, mx, my);
    const perp = angle + Math.PI / 2;
    const half = this.getFieldLen() / 2;

    const x1 = mx + Math.cos(perp) * half;
    const y1 = my + Math.sin(perp) * half;
    const x2 = mx - Math.cos(perp) * half;
    const y2 = my - Math.sin(perp) * half;

    const ff: ForceField = {
      gfx: this.add.graphics().setDepth(5),
      x1, y1, x2, y2,
      born: this.gameTime,
      duration: this.getFieldDur(),
      isShockwave: this.hasShockwave,
    };
    this.fields.push(ff);
    this.audio.playZap();

    if (this.hasShockwave) {
      this.hasShockwave = false;
      this.doShockwave(mx, my);
    }
  }

  private updateFields(delta: number) {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const ff = this.fields[i];
      const elapsed = this.gameTime - ff.born;
      if (elapsed >= ff.duration) {
        ff.gfx.destroy();
        this.fields.splice(i, 1);
        continue;
      }
      const ratio = 1 - elapsed / ff.duration;
      const alpha = Math.max(0.1, ratio);
      const thick = 3 + this.widthStacks * 1.5;

      ff.gfx.clear();
      ff.gfx.lineStyle(thick + 6, 0x44aaff, alpha * 0.2);
      ff.gfx.lineBetween(ff.x1, ff.y1, ff.x2, ff.y2);
      ff.gfx.lineStyle(thick, 0x88ddff, alpha);
      ff.gfx.lineBetween(ff.x1, ff.y1, ff.x2, ff.y2);
    }
  }

  private clearAllFields() {
    for (const ff of this.fields) ff.gfx.destroy();
    this.fields = [];
  }

  /* ===== ENEMIES ===== */

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

    const cfg = this.getWaveConfig();
    let speed: number, damage: number, size: number, points: number;
    let shootInterval = 2000, shootRange = 250;

    switch (type) {
      case 'rocket':
        speed = ROCKET_SPEED * cfg.rocketMul;
        damage = 15 + cfg.dmgBonus;
        size = 14;
        points = 100;
        break;
      case 'shooter':
        speed = SHOOTER_SPEED * cfg.shooterMul;
        damage = 8 + cfg.dmgBonus;
        size = 11;
        points = 75;
        shootInterval = cfg.shooterFireRate;
        shootRange = cfg.shooterRange;
        break;
      default:
        speed = DRONE_SPEED * cfg.droneMul;
        damage = 3 + cfg.dmgBonus;
        size = 8;
        points = 50;
        break;
    }

    const gfx = this.add.graphics().setDepth(3);
    this.drawEnemyShape(gfx, type as any, size);

    const e: Enemy = {
      gfx, x, y, type: type as any, speed, damage, size, points,
      stopped: false, shootCd: shootInterval, shootInterval, shootRange,
    };
    this.enemies.push(e);
  }

  private drawEnemyShape(g: Phaser.GameObjects.Graphics, type: string, size: number) {
    g.clear();
    switch (type) {
      case 'drone':
        g.fillStyle(0x44ff88, 0.2);
        g.fillCircle(0, 0, size + 4);
        g.fillStyle(0x44ff88);
        g.beginPath();
        g.moveTo(size, 0);
        g.lineTo(-size * 0.7, -size * 0.7);
        g.lineTo(-size * 0.3, 0);
        g.lineTo(-size * 0.7, size * 0.7);
        g.closePath();
        g.fillPath();
        break;
      case 'rocket':
        g.fillStyle(0xff6644, 0.15);
        g.fillCircle(0, 0, size + 5);
        g.fillStyle(0xff6644);
        g.beginPath();
        g.moveTo(size, 0);
        g.lineTo(-size * 0.6, -size * 0.6);
        g.lineTo(-size * 0.3, 0);
        g.lineTo(-size * 0.6, size * 0.6);
        g.closePath();
        g.fillPath();
        g.fillStyle(0xffaa44, 0.6);
        g.fillCircle(-size * 0.2, 0, size * 0.35);
        break;
      case 'shooter':
        g.fillStyle(0xaa44ff, 0.15);
        g.fillCircle(0, 0, size + 4);
        g.fillStyle(0xaa44ff);
        g.beginPath();
        g.moveTo(size, 0);
        g.lineTo(0, -size * 0.7);
        g.lineTo(-size, 0);
        g.lineTo(0, size * 0.7);
        g.closePath();
        g.fillPath();
        break;
    }
  }

  private updateEnemies(delta: number) {
    const dt = delta / 1000;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy);

      if (e.type === 'shooter' && dist <= e.shootRange) {
        e.stopped = true;
      }

      if (!e.stopped) {
        const ang = Phaser.Math.Angle.Between(e.x, e.y, this.cx, this.cy);
        e.x += Math.cos(ang) * e.speed * dt;
        e.y += Math.sin(ang) * e.speed * dt;
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

  private enemyHitCore(e: Enemy, idx: number) {
    if (this.mode !== 'practice') {
      this.coreHP = Math.max(0, this.coreHP - e.damage);
      this.perfectWave = false;
      this.coreHitEffect();
    }
    e.gfx.destroy();
    this.enemies.splice(idx, 1);
    if (this.coreHP <= 0) this.triggerGameOver();
  }

  private destroyEnemy(e: Enemy, idx: number) {
    this.score += e.points;
    this.spawnExplosion(e.x, e.y, e.type === 'drone' ? 0x44ff88 : e.type === 'rocket' ? 0xff6644 : 0xaa44ff);
    this.audio.playEnemyDestroy();
    e.gfx.destroy();
    this.enemies.splice(idx, 1);
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

  private updateProjectiles(delta: number) {
    const dt = delta / 1000;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.gfx.setPosition(p.x, p.y);

      if (p.friendly) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) < e.size + 5) {
            this.destroyEnemy(e, j);
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
            this.coreHP = Math.max(0, this.coreHP - p.damage);
            this.perfectWave = false;
            this.coreHitEffect();
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
        const cr = e.size + FIELD_COLLISION_R + this.widthStacks * 3;
        if (this.lineCircle(ff.x1, ff.y1, ff.x2, ff.y2, e.x, e.y, cr)) {
          this.destroyEnemy(e, ei);
        }
      }

      for (let pi = this.projectiles.length - 1; pi >= 0; pi--) {
        const p = this.projectiles[pi];
        if (p.friendly) continue;
        const cr = 6 + FIELD_COLLISION_R + this.widthStacks * 3;
        if (this.lineCircle(ff.x1, ff.y1, ff.x2, ff.y2, p.x, p.y, cr)) {
          if (this.hasReflect) {
            this.reflectProjectile(p);
          } else {
            p.gfx.destroy();
            this.projectiles.splice(pi, 1);
          }
        }
      }
    }
  }

  private reflectProjectile(p: Projectile) {
    let nearest: Enemy | null = null;
    let nearDist = Infinity;
    for (const e of this.enemies) {
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
    if (w <= 3) return ['drone'];
    if (w <= 6) return ['drone', 'rocket'];
    return ['drone', 'rocket', 'shooter'];
  }

  private buildSpawnQueue(): string[] {
    const count = this.getWaveEnemyCount();
    const types = this.getWaveTypes();
    const q: string[] = [];
    for (let i = 0; i < count; i++) {
      if (types.length === 1) {
        q.push('drone');
      } else if (types.length === 2) {
        q.push(Math.random() < 0.6 ? 'drone' : 'rocket');
      } else {
        const r = Math.random();
        q.push(r < 0.4 ? 'drone' : r < 0.7 ? 'rocket' : 'shooter');
      }
    }
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

    const w = this.currentWave;
    if (w <= 3) this.spawnInterval = 1200;
    else if (w <= 6) this.spawnInterval = 1000;
    else if (w <= 10) this.spawnInterval = 800;
    else if (w <= 15) this.spawnInterval = 600;
    else if (w <= 20) this.spawnInterval = 400;
    else this.spawnInterval = Math.max(200, 400 - (w - 20) * 10);

    this.spawnTimer = 300;
    this.state = 'playing';
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
      if (!this.orb && Math.random() < 0.1) this.spawnOrb();
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
      const perf = this.add.text(this.cx, this.cy, '★ PERFECT SHIELD +200 ★', {
        fontSize: '22px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        fontStyle: 'bold', color: '#ffcc44',
      }).setOrigin(0.5).setDepth(50).setAlpha(0);
      this.tweens.add({
        targets: perf, alpha: 1, y: this.cy - 20, duration: 400,
        yoyo: true, hold: 1500,
        onComplete: () => perf.destroy(),
      });
    }

    if (!this.orb && Math.random() < 0.4) this.spawnOrb();
  }

  /* ===== UPGRADES ===== */

  private spawnOrb() {
    const kinds: Orb['kind'][] = ['duration', 'width', 'reflective', 'repair', 'shockwave'];
    const available = kinds.filter(k => {
      if (k === 'duration' && this.durStacks >= 3) return false;
      if (k === 'width' && this.widthStacks >= 3) return false;
      if (k === 'reflective' && this.hasReflect) return false;
      return true;
    });
    if (available.length === 0) return;
    const kind = available[Math.floor(Math.random() * available.length)];

    const w = this.scale.width;
    const h = this.scale.height;
    const edge = Phaser.Math.Between(0, 3);
    let x: number, y: number, vx: number, vy: number;
    const speed = 30 + Math.random() * 20;
    switch (edge) {
      case 0: x = Phaser.Math.Between(100, w - 100); y = -20; vx = (Math.random() - 0.5) * 20; vy = speed; break;
      case 1: x = w + 20; y = Phaser.Math.Between(100, h - 100); vx = -speed; vy = (Math.random() - 0.5) * 20; break;
      case 2: x = Phaser.Math.Between(100, w - 100); y = h + 20; vx = (Math.random() - 0.5) * 20; vy = -speed; break;
      default: x = -20; y = Phaser.Math.Between(100, h - 100); vx = speed; vy = (Math.random() - 0.5) * 20; break;
    }

    const colors: Record<string, number> = {
      duration: 0x44ff44, width: 0x4488ff, reflective: 0xaa44ff,
      repair: 0xff4444, shockwave: 0xffdd44,
    };

    const gfx = this.add.graphics().setDepth(6);
    const color = colors[kind];
    gfx.fillStyle(color, 0.15);
    gfx.fillCircle(0, 0, 22);
    gfx.fillStyle(color, 0.4);
    gfx.fillCircle(0, 0, 14);
    gfx.fillStyle(color, 0.9);
    gfx.fillCircle(0, 0, 8);
    gfx.lineStyle(1.5, color, 0.6);
    gfx.strokeCircle(0, 0, 18);

    this.orb = { gfx, x, y, vx, vy, kind, size: 18, age: 0 };
  }

  private updateOrb(delta: number) {
    if (!this.orb) return;
    const o = this.orb;
    const dt = delta / 1000;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.age += delta;
    o.gfx.setPosition(o.x, o.y);

    const pulse = 1 + Math.sin(o.age * 0.005) * 0.1;
    o.gfx.setScale(pulse);

    const w = this.scale.width;
    const h = this.scale.height;
    if (o.x < -40 || o.x > w + 40 || o.y < -40 || o.y > h + 40) {
      o.gfx.destroy();
      this.orb = null;
    }
  }

  private collectOrb() {
    if (!this.orb) return;
    const kind = this.orb.kind;
    this.orb.gfx.destroy();
    this.orb = null;
    this.audio.playUpgrade();

    let label = '';
    switch (kind) {
      case 'duration':
        this.durStacks = Math.min(3, this.durStacks + 1);
        label = `DURATION+ (${this.durStacks}/3)`;
        break;
      case 'width':
        this.widthStacks = Math.min(3, this.widthStacks + 1);
        label = `WIDTH+ (${this.widthStacks}/3)`;
        break;
      case 'reflective':
        this.hasReflect = true;
        label = 'REFLECTIVE SHIELD';
        break;
      case 'repair':
        this.coreHP = Math.min(this.maxHP, this.coreHP + 15);
        label = 'CORE REPAIR +15';
        break;
      case 'shockwave':
        this.hasShockwave = true;
        label = 'SHOCKWAVE READY';
        break;
    }

    const txt = this.add.text(this.cx, this.cy - 90, label, {
      fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
      fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(50).setAlpha(0);
    this.tweens.add({
      targets: txt, alpha: 1, y: this.cy - 110, duration: 300,
      yoyo: true, hold: 1200,
      onComplete: () => txt.destroy(),
    });
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

  private doShockwave(x: number, y: number) {
    const radius = 200;
    const ring = this.add.graphics().setDepth(8);

    let r = 0;
    const dur = 300;
    const start = this.gameTime;

    const expand = () => {
      const elapsed = this.gameTime - start;
      const t = Math.min(1, elapsed / dur);
      r = radius * t;
      ring.clear();
      ring.lineStyle(4 * (1 - t), 0xffdd44, 1 - t);
      ring.strokeCircle(x, y, r);
      if (t < 1) this.time.delayedCall(16, expand);
      else ring.destroy();
    };
    expand();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) {
        this.destroyEnemy(e, i);
      }
    }
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
    this.nameText.setPosition(w - 200, 12);
    this.bestText.setPosition(w - 200, 30);
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
    this.nameText.setText(name);

    if (this.mode === 'normal') {
      const best = StorageManager.getPersonalBest(name);
      this.bestText.setText(`BEST: ${best}`);
    } else {
      this.bestText.setText('PRACTICE');
    }

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

    if (this.hasShockwave) {
      this.hudGfx.fillStyle(0xffdd44, 0.6);
      this.hudGfx.fillCircle(this.scale.width / 2 + 100, 20, 6);
    }
    if (this.hasReflect) {
      this.hudGfx.fillStyle(0xaa44ff, 0.6);
      this.hudGfx.fillCircle(this.scale.width / 2 + 115, 20, 6);
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
    if (this.showingLB) { this.toggleLB(); return; }
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
      if (this.state !== 'paused') {
        this.prevState = this.state;
        this.state = 'paused';
      }
      this.lbContainer.removeAll(true);
      const bg = this.add.rectangle(0, 0, 400, 360, 0x0a0a1a, 0.95).setStrokeStyle(2, 0x335577);
      const title = this.add.text(0, -155, 'LEADERBOARD', {
        fontSize: '20px', fontFamily: '"Segoe UI", system-ui, sans-serif',
        color: '#4af', fontStyle: 'bold',
      }).setOrigin(0.5);
      const hdr = this.add.text(-170, -120, 'RANK  NAME             WAVE   SCORE', {
        fontSize: '11px', fontFamily: 'monospace', color: '#556677',
      });
      this.lbContainer.add([bg, title, hdr]);

      const entries = StorageManager.getLeaderboard().slice(0, 10);
      entries.forEach((e, i) => {
        const rank = String(i + 1).padStart(2);
        const name = e.name.padEnd(16);
        const wave = String(e.wave).padStart(4);
        const score = String(e.score).padStart(7);
        const row = this.add.text(-170, -90 + i * 24, `${rank}    ${name} ${wave}   ${score}`, {
          fontSize: '13px', fontFamily: 'monospace',
          color: i === 0 ? '#ffcc44' : i < 3 ? '#44aaff' : '#8899aa',
        });
        this.lbContainer.add(row);
      });

      const close = this.add.text(0, 150, '[ CLOSE ]', {
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
      this.state = this.prevState;
    }
  }

  /* ===== GAME OVER ===== */

  private triggerGameOver() {
    this.state = 'gameOver';
    for (const e of this.enemies) e.gfx.destroy();
    for (const ff of this.fields) ff.gfx.destroy();
    for (const p of this.projectiles) p.gfx.destroy();
    if (this.orb) { this.orb.gfx.destroy(); this.orb = null; }
    this.enemies = [];
    this.fields = [];
    this.projectiles = [];

    this.spawnExplosion(this.cx, this.cy, 0x4488ff);
    this.cameras.main.shake(400, 0.015);

    this.time.delayedCall(800, () => {
      this.scene.start('GameOverScene', {
        score: this.score,
        wave: this.currentWave,
        mode: this.mode,
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
