import type { QuotaInfo } from '../shared/types.ts';

/*
 * Client API-Football (v3.football.api-sports.io), utilisé avec parcimonie : le
 * plan gratuit est limité à 100 requêtes par jour (et 10 par minute) et refuse
 * les requêtes par saison en cours. Deux appels seulement sont utilisés :
 *   - fixtures?live=all : tous les matchs en cours (pour trouver l'identifiant du match suivi) ;
 *   - fixtures?id=…     : feuille de match complète (minutes exactes, note, passes clés…).
 * Avant chaque appel payant, /status (gratuit) donne la consommation réelle du jour :
 * au-delà du plafond fixé (80 par défaut), plus aucun appel n'est fait.
 */

export const AF_BASE = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const num = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return null;
};

export interface AfPlayerStats {
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  keyPasses: number | null;
  passes: number | null;
  passAccuracy: number | null;
  dribblesAttempted: number | null;
  dribblesSucceeded: number | null;
  duelsWon: number | null;
  duelsTotal: number | null;
  penaltyScored: number | null;
  penaltyMissed: number | null;
}

export interface AfFixtureSummary {
  id: number;
  status: string;
  homeId: number | null;
  awayId: number | null;
}

/** Statuts API-Football d'un match terminé. */
export const AF_FINISHED = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);

export function parseFixtureSummary(f: unknown): AfFixtureSummary | null {
  const o = obj(f);
  const id = num(obj(o.fixture).id);
  if (id == null) return null;
  const teams = obj(o.teams);
  return {
    id,
    status: String(obj(obj(o.fixture).status).short ?? ''),
    homeId: num(obj(teams.home).id),
    awayId: num(obj(teams.away).id),
  };
}

/** Statistiques d'un joueur dans une feuille de match API-Football (recherche par identifiant, puis par nom). */
export function playerStatsFromFixture(fixture: unknown, playerId: number, name: RegExp): AfPlayerStats | null {
  for (const team of arr(obj(fixture).players)) {
    for (const p of arr(obj(team).players)) {
      const player = obj(obj(p).player);
      if (num(player.id) !== playerId && !name.test(String(player.name ?? ''))) continue;
      const s = obj(arr(obj(p).statistics)[0]);
      const games = obj(s.games);
      const shots = obj(s.shots);
      const goals = obj(s.goals);
      const passes = obj(s.passes);
      const dribbles = obj(s.dribbles);
      const duels = obj(s.duels);
      const penalty = obj(s.penalty);
      return {
        minutes: num(games.minutes),
        rating: num(games.rating),
        goals: num(goals.total),
        assists: num(goals.assists),
        shots: num(shots.total),
        shotsOnTarget: num(shots.on),
        keyPasses: num(passes.key),
        passes: num(passes.total),
        passAccuracy: num(passes.accuracy),
        dribblesAttempted: num(dribbles.attempts),
        dribblesSucceeded: num(dribbles.success),
        duelsWon: num(duels.won),
        duelsTotal: num(duels.total),
        penaltyScored: num(penalty.scored),
        penaltyMissed: num(penalty.missed),
      };
    }
  }
  return null;
}

export interface ApiFootballOptions {
  key: string;
  /** Plafond quotidien que l'application s'impose (la limite du forfait reste la limite dure). */
  dailyCap?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: (message: string) => void;
}

const STATUS_TTL_MS = 30_000;
const LIVE_TTL_MS = 2 * 60_000;

export class ApiFootball {
  quota: QuotaInfo | null = null;
  readonly dailyCap: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly log: (message: string) => void;
  private quotaAt = 0;
  private quotaDay = '';
  private liveMemo: { at: number; data: AfFixtureSummary[] } | null = null;
  private capLogged = '';

  constructor(private readonly opts: ApiFootballOptions) {
    this.dailyCap = opts.dailyCap ?? 80;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => {});
  }

  private async request(path: string): Promise<{ json: Obj; headers: Headers }> {
    const res = await this.fetchImpl(`${AF_BASE}/${path}`, {
      headers: { 'x-apisports-key': this.opts.key, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
    return { json: obj(await res.json()), headers: res.headers };
  }

  /** Consommation du jour via /status, qui ne compte pas dans le quota. */
  async refreshQuota(): Promise<QuotaInfo | null> {
    const now = this.now().getTime();
    const day = this.now().toISOString().slice(0, 10);
    if (this.quota && this.quotaDay === day && now - this.quotaAt < STATUS_TTL_MS) return this.quota;
    try {
      const { json } = await this.request('status');
      const requests = obj(obj(json.response).requests);
      const used = num(requests.current);
      const limit = num(requests.limit_day);
      if (used == null || limit == null) throw new Error('réponse /status inattendue');
      this.quota = { provider: 'API-Football', used, cap: Math.min(this.dailyCap, limit), limit };
      this.quotaAt = now;
      this.quotaDay = day;
    } catch (e) {
      this.log(`API-Football /status indisponible : ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
    return this.quota;
  }

  /** Appel payant (1 requête), seulement si le plafond du jour n'est pas atteint. */
  private async spend(path: string): Promise<unknown[] | null> {
    const quota = await this.refreshQuota();
    if (!quota) return null;
    if (quota.used >= quota.cap) {
      const day = this.now().toISOString().slice(0, 10);
      if (this.capLogged !== day) this.log(`API-Football : plafond de ${quota.cap} requêtes atteint pour aujourd'hui`);
      this.capLogged = day;
      return null;
    }
    quota.used += 1;
    try {
      const { json, headers } = await this.request(path);
      const remaining = num(headers.get('x-ratelimit-requests-remaining'));
      if (remaining != null) quota.used = Math.max(quota.used, quota.limit - remaining);
      const errors = json.errors;
      const hasErrors = Array.isArray(errors) ? errors.length > 0 : Object.keys(obj(errors)).length > 0;
      if (hasErrors) {
        this.log(`API-Football ${path} : ${JSON.stringify(errors)}`);
        return null;
      }
      return arr(json.response);
    } catch (e) {
      this.log(`API-Football ${path} : ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  /** Matchs en cours dans le monde (1 requête, mémorisée 2 minutes). */
  async liveFixtures(): Promise<AfFixtureSummary[] | null> {
    const now = this.now().getTime();
    if (this.liveMemo && now - this.liveMemo.at < LIVE_TTL_MS) return this.liveMemo.data;
    const response = await this.spend('fixtures?live=all');
    if (!response) return null;
    const data = response.map(parseFixtureSummary).filter((f): f is AfFixtureSummary => f != null);
    this.liveMemo = { at: now, data };
    return data;
  }

  /** Feuille de match complète (1 requête). */
  async fixture(id: number): Promise<unknown | null> {
    const response = await this.spend(`fixtures?id=${id}`);
    return response?.[0] ?? null;
  }
}
