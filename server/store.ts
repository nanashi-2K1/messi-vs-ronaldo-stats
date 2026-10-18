import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PLAYER_IDS, type PlayerId, type PlayerMatch } from '../shared/types.ts';
import type { AfPlayerStats } from './apiFootball.ts';

/** Suivi des appels API-Football pour un match donné (persisté pour ne jamais les répéter). */
export interface AfRecord {
  fixtureId: number | null;
  lookups: number;
  lastLookupAt: number | null;
  fetches: number;
  /** Appels faits après le coup de sifflet final (limités). */
  postFetches: number;
  lastFetchAt: number | null;
  /** Feuille de match définitive récupérée : plus aucun appel pour ce match. */
  final: boolean;
  stats: AfPlayerStats | null;
}

export interface StoreData {
  version: 2;
  /** Matchs terminés après la date de référence. */
  matches: Partial<Record<PlayerId, PlayerMatch[]>>;
  /** Clé : « joueur:identifiant ESPN du match ». */
  apiFootball: Record<string, AfRecord>;
}

export interface Store {
  load(): Promise<StoreData>;
  save(data: StoreData): Promise<void>;
}

export const emptyStore = (): StoreData => ({ version: 2, matches: {}, apiFootball: {} });

export const newAfRecord = (): AfRecord => ({
  fixtureId: null,
  lookups: 0,
  lastLookupAt: null,
  fetches: 0,
  postFetches: 0,
  lastFetchAt: null,
  final: false,
  stats: null,
});

/** Pour chaque match, garde l'enregistrement le plus avancé (définitif, puis le plus récent). */
export function mergeAfRecords(remote: Record<string, AfRecord>, local: Record<string, AfRecord>): Record<string, AfRecord> {
  const score = (r: AfRecord) => (r.final ? 1e15 : 0) + Math.max(r.lastFetchAt ?? 0, r.lastLookupAt ?? 0);
  const out = { ...remote };
  for (const [key, rec] of Object.entries(local)) {
    const other = out[key];
    if (!other || score(rec) >= score(other)) out[key] = rec;
  }
  return out;
}

export function parseStore(text: string): StoreData {
  try {
    const parsed = JSON.parse(text) as Partial<Omit<StoreData, 'version'>> & { version?: unknown };
    if (parsed.version !== 1 && parsed.version !== 2) return emptyStore();
    return { version: 2, matches: parsed.matches ?? {}, apiFootball: parsed.apiFootball ?? {} };
  } catch {
    return emptyStore();
  }
}

/** Fusionne deux états (plusieurs instances serverless peuvent écrire) : rien de ce qui a été payé n'est perdu. */
export function mergeStores(remote: StoreData, local: StoreData): StoreData {
  const matches: StoreData['matches'] = {};
  for (const id of PLAYER_IDS) {
    const byId = new Map<string, PlayerMatch>();
    for (const m of remote.matches[id] ?? []) byId.set(m.eventId, m);
    for (const m of local.matches[id] ?? []) byId.set(m.eventId, m);
    matches[id] = [...byId.values()];
  }
  return { version: 2, matches, apiFootball: mergeAfRecords(remote.apiFootball, local.apiFootball) };
}

export function memoryStore(initial: StoreData = emptyStore()): Store {
  let data = initial;
  return {
    load: async () => structuredClone(data),
    save: async (d) => {
      data = structuredClone(d);
    },
  };
}

export function fileStore(dir: string): Store {
  const file = join(dir, 'store.json');
  return {
    async load() {
      try {
        return parseStore(await readFile(file, 'utf8'));
      } catch {
        return emptyStore();
      }
    },
    async save(data) {
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, file);
    },
  };
}
