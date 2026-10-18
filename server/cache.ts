import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlayerId, PlayerMatch } from '../shared/types.ts';

export type StoredMatches = Partial<Record<PlayerId, PlayerMatch[]>>;

/** Persistance des matchs terminés, pour ne pas les redemander à chaque démarrage. */
export interface MatchCache {
  load(): Promise<StoredMatches>;
  save(data: StoredMatches): Promise<void>;
}

export function memoryCache(initial: StoredMatches = {}): MatchCache {
  let data = initial;
  return {
    load: async () => data,
    save: async (d) => {
      data = d;
    },
  };
}

export function fileCache(dir: string): MatchCache {
  const file = join(dir, 'matches.json');
  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8')) as { version?: number; matches?: StoredMatches };
        return parsed.version === 1 && parsed.matches ? parsed.matches : {};
      } catch {
        return {};
      }
    },
    async save(matches) {
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify({ version: 1, matches }, null, 2));
      await rename(tmp, file);
    },
  };
}
