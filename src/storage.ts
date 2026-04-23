export interface LeaderboardEntry {
  name: string;
  wave: number;
  score: number;
  title: string;
}

export interface LifetimeStats {
  totalEnemiesDestroyed: number;
  totalShieldsPlaced: number;
  highestWave: number;
  highestPerfectStreak: number;
}

export interface RunStats {
  totalShieldsPlaced: number;
  bestMultiKill: number;
  longestPerfectStreak: number;
  favoriteSector: string;
  itemsUsed: number;
  closeCalls: number;
  sectorCounts: { NE: number; NW: number; SE: number; SW: number };
}

const TITLE_TIERS: { wave: number; title: string }[] = [
  { wave: 50, title: 'Eternal' },
  { wave: 40, title: 'Overlord' },
  { wave: 30, title: 'Archon' },
  { wave: 25, title: 'Warden' },
  { wave: 20, title: 'Sentinel' },
  { wave: 15, title: 'Guardian' },
  { wave: 10, title: 'Defender' },
  { wave: 5, title: 'Watcher' },
];

export function getTitleForWave(wave: number): string {
  for (const tier of TITLE_TIERS) {
    if (wave >= tier.wave) return tier.title;
  }
  return '';
}

export function getNextTitleTier(wave: number): { wave: number; title: string } | null {
  for (let i = TITLE_TIERS.length - 1; i >= 0; i--) {
    if (TITLE_TIERS[i].wave > wave) return TITLE_TIERS[i];
  }
  return null;
}

const DEFAULT_ENTRIES: LeaderboardEntry[] = [];

export function createRunStats(): RunStats {
  return {
    totalShieldsPlaced: 0,
    bestMultiKill: 0,
    longestPerfectStreak: 0,
    favoriteSector: 'NE',
    itemsUsed: 0,
    closeCalls: 0,
    sectorCounts: { NE: 0, NW: 0, SE: 0, SW: 0 },
  };
}

export class StorageManager {
  private static _available: boolean | null = null;

  static get available(): boolean {
    if (this._available === null) {
      try {
        const k = '__shieldr_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        this._available = true;
      } catch {
        this._available = false;
      }
    }
    return this._available;
  }

  static getGuardianName(): string {
    if (!this.available) return 'StarWard';
    return localStorage.getItem('shieldr_name') || 'StarWard';
  }

  static setGuardianName(name: string): void {
    if (this.available) localStorage.setItem('shieldr_name', name);
  }

  static hasSeenIntro(): boolean {
    if (!this.available) return true;
    return localStorage.getItem('shieldr_intro') === '1';
  }

  static setSeenIntro(): void {
    if (this.available) localStorage.setItem('shieldr_intro', '1');
  }

  static hasSeenItemIntro(): boolean {
    if (!this.available) return false;
    return localStorage.getItem('shieldr_item_intro') === '1';
  }

  static setSeenItemIntro(): void {
    if (this.available) localStorage.setItem('shieldr_item_intro', '1');
  }

  static getVolume(): boolean {
    if (!this.available) return true;
    return localStorage.getItem('shieldr_vol') !== '0';
  }

  static setVolume(on: boolean): void {
    if (this.available) localStorage.setItem('shieldr_vol', on ? '1' : '0');
  }

  static getLeaderboard(): LeaderboardEntry[] {
    if (!this.available) return [...DEFAULT_ENTRIES];
    const raw = localStorage.getItem('shieldr_lb');
    if (!raw) return [...DEFAULT_ENTRIES];
    try {
      const entries: LeaderboardEntry[] = JSON.parse(raw);
      return entries
        .map(e => ({ ...e, title: e.title || getTitleForWave(e.wave) }))
        .sort((a, b) => b.score - a.score);
    } catch {
      return [...DEFAULT_ENTRIES];
    }
  }

  static saveScore(name: string, wave: number, score: number): void {
    if (!this.available) return;
    const entries = this.getLeaderboard();
    const title = getTitleForWave(wave);
    const existing = entries.find(e => e.name === name);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.wave = wave;
      }
      if (wave > existing.wave) existing.wave = wave;
      const bestTitle = getTitleForWave(existing.wave);
      existing.title = bestTitle;
    } else {
      entries.push({ name, wave, score, title });
    }
    entries.sort((a, b) => b.score - a.score);
    localStorage.setItem('shieldr_lb', JSON.stringify(entries));
  }

  static renameGuardian(newName: string): void {
    const oldName = this.getGuardianName();
    if (oldName === newName) return;
    this.setGuardianName(newName);
    if (!this.available) return;
    const entries = this.getLeaderboard();
    const entry = entries.find(e => e.name === oldName);
    if (entry) {
      const existing = entries.find(e => e.name === newName);
      if (existing) {
        if (entry.score > existing.score) existing.score = entry.score;
        if (entry.wave > existing.wave) existing.wave = entry.wave;
        existing.title = getTitleForWave(existing.wave);
        const filtered = entries.filter(e => e.name !== oldName);
        filtered.sort((a, b) => b.score - a.score);
        localStorage.setItem('shieldr_lb', JSON.stringify(filtered));
      } else {
        entry.name = newName;
        localStorage.setItem('shieldr_lb', JSON.stringify(entries));
      }
    }
  }

  static getPersonalBest(name: string): number {
    const entries = this.getLeaderboard();
    return entries.find(e => e.name === name)?.score || 0;
  }

  static getPlayerTitle(name: string): string {
    const entries = this.getLeaderboard();
    const entry = entries.find(e => e.name === name);
    if (entry) return entry.title || getTitleForWave(entry.wave);
    return '';
  }

  static getLifetimeStats(): LifetimeStats {
    if (!this.available) return { totalEnemiesDestroyed: 0, totalShieldsPlaced: 0, highestWave: 0, highestPerfectStreak: 0 };
    const raw = localStorage.getItem('shieldr_lifetime');
    if (!raw) return { totalEnemiesDestroyed: 0, totalShieldsPlaced: 0, highestWave: 0, highestPerfectStreak: 0 };
    try { return JSON.parse(raw); } catch { return { totalEnemiesDestroyed: 0, totalShieldsPlaced: 0, highestWave: 0, highestPerfectStreak: 0 }; }
  }

  static updateLifetimeStats(runStats: RunStats, wave: number, enemiesDestroyed: number): void {
    if (!this.available) return;
    const lt = this.getLifetimeStats();
    lt.totalEnemiesDestroyed += enemiesDestroyed;
    lt.totalShieldsPlaced += runStats.totalShieldsPlaced;
    lt.highestWave = Math.max(lt.highestWave, wave);
    lt.highestPerfectStreak = Math.max(lt.highestPerfectStreak, runStats.longestPerfectStreak);
    localStorage.setItem('shieldr_lifetime', JSON.stringify(lt));
  }
}
