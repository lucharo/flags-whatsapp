import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomInt } from 'node:crypto';
import { FlagData } from '../shared/types';

interface FlagFile {
  updatedAt: string;
  count: number;
  flags: FlagData[];
}

export class FlagRepository {
  private readonly flags: FlagData[];

  constructor(dataFile = resolve(__dirname, '../../data/flags.json')) {
    const buffer = readFileSync(dataFile, 'utf8');
    const parsed: FlagFile = JSON.parse(buffer) as FlagFile;
    if (!Array.isArray(parsed.flags) || parsed.flags.length === 0) {
      throw new Error('Flag repository cannot start without flag data');
    }
    this.flags = parsed.flags.slice();
  }

  all(): FlagData[] {
    return this.flags.slice();
  }

  randomSelection(count: number): FlagData[] {
    if (count <= 0) {
      throw new Error('Count must be positive');
    }
    if (count > this.flags.length) {
      throw new Error('Requested more flags than available');
    }

    const selected: FlagData[] = [];
    const taken = new Set<number>();
    while (selected.length < count) {
      const index = randomInt(0, this.flags.length);
      if (taken.has(index)) {
        continue;
      }
      taken.add(index);
      selected.push(this.flags[index]);
    }
    return selected;
  }

  getByCode(code: string): FlagData | undefined {
    return this.flags.find((flag) => flag.code === code);
  }
}
