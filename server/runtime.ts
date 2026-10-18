import { baseline } from '../shared/baseline.ts';
import { buildAppState, emptyLiveData } from '../shared/merge.ts';
import type { AppState, LiveInfo } from '../shared/types.ts';
import { ApiFootball } from './apiFootball.ts';
import { createFetchJson } from './espn/client.ts';
import type { Store } from './store.ts';
import { Tracker } from './tracker.ts';

/*
 * Assemblage commun au serveur Node (npm start) et à la fonction Vercel.
 * Variables d'environnement :
 *   LIVE_PROVIDER=off          désactive le suivi en direct
 *   API_FOOTBALL_KEY           active le complément API-Football (jamais écrite dans le dépôt)
 *   API_FOOTBALL_DAILY_CAP     plafond quotidien de requêtes (80 par défaut, limite du plan gratuit : 100)
 *   DISCOVERY_INTERVAL_MS / LIVE_INTERVAL_MS
 */

export const log = (message: string) => console.log(`[${new Date().toISOString()}] ${message}`);

/** Charge un fichier .env s'il existe (Node ≥ 20.12), sans écraser les variables déjà définies. */
export function loadDotEnv(): void {
  try {
    process.loadEnvFile?.();
  } catch {
    // Pas de fichier .env : rien à faire.
  }
}

export const liveEnabled = () => (process.env.LIVE_PROVIDER ?? 'espn').toLowerCase() !== 'off';

export function createApiFootball(): ApiFootball | null {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  if (!key) return null;
  const cap = Number(process.env.API_FOOTBALL_DAILY_CAP ?? 80);
  return new ApiFootball({ key, dailyCap: Number.isFinite(cap) && cap > 0 ? cap : 80, log });
}

export function createTracker(store: Store): Tracker | null {
  if (!liveEnabled()) return null;
  return new Tracker({
    fetchJson: createFetchJson(),
    baselineAsOf: baseline.asOf,
    store,
    apiFootball: createApiFootball(),
    log,
    discoveryIntervalMs: Number(process.env.DISCOVERY_INTERVAL_MS ?? 10 * 60_000),
    liveIntervalMs: Number(process.env.LIVE_INTERVAL_MS ?? 30_000),
  });
}

const DISABLED_INFO: LiveInfo = {
  provider: 'aucun',
  status: 'disabled',
  lastSuccessAt: null,
  lastError: null,
  refreshSeconds: null,
  push: false,
  quota: null,
};

export function stateOf(tracker: Tracker | null, push: boolean): AppState {
  const info = tracker ? { ...tracker.info, push } : { ...DISABLED_INFO, push };
  return buildAppState(baseline, tracker?.data ?? emptyLiveData(), info);
}
