export interface LeaderboardEntry {
  name: string;
  wave: number;
  score: number;
}

const DEFAULT_ENTRIES: LeaderboardEntry[] = [
  { name: 'Orion', wave: 14, score: 4200 },
  { name: 'Nova', wave: 11, score: 3100 },
  { name: 'Cosmo', wave: 8, score: 1800 },
  { name: 'Pixel', wave: 5, score: 900 },
];

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
      return entries.sort((a, b) => b.score - a.score);
    } catch {
      return [...DEFAULT_ENTRIES];
    }
  }

  static saveScore(name: string, wave: number, score: number): void {
    if (!this.available) return;
    const entries = this.getLeaderboard();
    const existing = entries.find(e => e.name === name);
    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.wave = wave;
      }
    } else {
      entries.push({ name, wave, score });
    }
    entries.sort((a, b) => b.score - a.score);
    localStorage.setItem('shieldr_lb', JSON.stringify(entries));
  }

  static getPersonalBest(name: string): number {
    const entries = this.getLeaderboard();
    return entries.find(e => e.name === name)?.score || 0;
  }
}
