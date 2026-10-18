import { emptyAttempts, emptyLiveData } from '../shared/merge.ts';
import { seasonFor } from '../shared/metrics.ts';
import { PLAYER_IDS, type Fixture, type LiveData, type LiveInfo, type PlayerId, type PlayerMatch } from '../shared/types.ts';
import { AF_FINISHED, parseFixtureSummary, playerStatsFromFixture, type ApiFootball } from './apiFootball.ts';
import { DEFAULT_QUERIES, TRACKED_PLAYERS, type TrackedLeague, type TrackedPlayer, type TrackedTeam } from './config.ts';
import { HttpError, scheduleUrl, summaryUrl, type FetchJson } from './espn/client.ts';
import { parseScoreboard, parseSummary, type ScoreboardEvent } from './espn/parse.ts';
import { emptyStore, mergeAfRecords, memoryStore, mergeStores, newAfRecord, type AfRecord, type Store, type StoreData } from './store.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Nouvelles tentatives pour un match terminé dont les compositions manquaient. */
const MAX_SUMMARY_ATTEMPTS = 3;
/** API-Football : intervalle minimal entre deux feuilles de match d'un même match en cours. */
const AF_LIVE_FETCH_MS = 10 * MINUTE;
/** API-Football : recherche de l'identifiant du match (fixtures?live=all). */
const AF_LOOKUP_MS = 15 * MINUTE;
const AF_MAX_LOOKUPS = 4;
/** API-Football : tentatives pour obtenir la feuille définitive après le match. */
const AF_MAX_POST_FETCHES = 3;

export interface TrackerOptions {
  fetchJson: FetchJson;
  baselineAsOf: string;
  players?: TrackedPlayer[];
  store?: Store;
  apiFootball?: ApiFootball | null;
  now?: () => Date;
  log?: (message: string) => void;
  /** Fréquence de lecture des calendriers (résultats et matchs à venir). */
  discoveryIntervalMs?: number;
  /** Fréquence de rafraîchissement d'un match en cours. */
  liveIntervalMs?: number;
  /** Requêtes ESPN simultanées. */
  concurrency?: number;
}

interface TrackedEvent {
  player: TrackedPlayer;
  team: TrackedTeam;
  league: TrackedLeague;
  event: ScoreboardEvent;
}

interface Counter {
  ok: number;
  failed: number;
  lastError: string | null;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Exécute des tâches avec un nombre limité de requêtes en parallèle. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

export class Tracker {
  readonly data: LiveData = emptyLiveData();
  info: LiveInfo;

  private readonly players: TrackedPlayer[];
  private readonly store: Store;
  private readonly af: ApiFootball | null;
  private readonly now: () => Date;
  private readonly log: (message: string) => void;
  private readonly discoveryIntervalMs: number;
  private readonly liveIntervalMs: number;
  private readonly concurrency: number;
  private readonly cutoff: number;

  private readonly events = new Map<string, TrackedEvent>();
  private readonly completed: Record<PlayerId, Map<string, PlayerMatch>> = { messi: new Map(), ronaldo: new Map() };
  private readonly live: Record<PlayerId, PlayerMatch | null> = { messi: null, ronaldo: null };
  private afRecords: Record<string, AfRecord> = {};
  private readonly summaryAttempts = new Map<string, number>();
  private readonly unavailable = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private lastDiscovery = Number.NEGATIVE_INFINITY;
  private dirty = false;
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly opts: TrackerOptions) {
    this.players = opts.players ?? TRACKED_PLAYERS;
    this.store = opts.store ?? memoryStore();
    this.af = opts.apiFootball ?? null;
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => {});
    this.discoveryIntervalMs = opts.discoveryIntervalMs ?? 10 * MINUTE;
    this.liveIntervalMs = opts.liveIntervalMs ?? 30_000;
    this.concurrency = opts.concurrency ?? 6;
    this.cutoff = Date.parse(opts.baselineAsOf);
    this.info = {
      provider: this.af ? 'ESPN + API-Football' : 'ESPN',
      status: 'starting',
      lastSuccessAt: null,
      lastError: null,
      refreshSeconds: null,
      push: false,
      quota: null,
    };
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    this.stopped = false;
    const loop = async () => {
      await this.tick().catch((e) => this.log(`Erreur du suivi : ${errorMessage(e)}`));
      if (!this.stopped) this.timer = setTimeout(loop, this.liveIntervalMs);
    };
    void loop();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Un match est en cours ou sur le point de commencer (rafraîchissement rapproché). */
  hasActiveEvents(): boolean {
    return this.activeEvents().length > 0 || PLAYER_IDS.some((id) => this.live[id] != null);
  }

  /** Une itération ; les appels simultanés partagent la même exécution. */
  tick(): Promise<void> {
    this.running ??= this.runTick().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runTick(): Promise<void> {
    const now = this.now().getTime();
    if (now - this.lastDiscovery >= this.discoveryIntervalMs) {
      this.lastDiscovery = now;
      // Relit le stockage partagé : une autre instance a pu enregistrer des matchs entre-temps.
      this.absorb(await this.store.load().catch(() => emptyStore()));
      await this.discover();
    } else if (this.activeEvents().length > 0) {
      await this.refreshActive();
    }
    if (this.af) await this.enrich();
    await this.persist();
    this.publish();
  }

  private absorb(stored: StoreData): void {
    for (const id of PLAYER_IDS) {
      for (const m of stored.matches[id] ?? []) {
        if (Date.parse(m.date) > this.cutoff && m.state === 'post' && !this.completed[id].has(m.eventId)) {
          this.completed[id].set(m.eventId, m);
        }
      }
    }
    this.afRecords = mergeAfRecords(stored.apiFootball, this.afRecords);
  }

  private snapshot(): StoreData {
    return {
      version: 2,
      matches: Object.fromEntries(PLAYER_IDS.map((id) => [id, [...this.completed[id].values()]])),
      apiFootball: this.afRecords,
    };
  }

  private async persist(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      const remote = await this.store.load().catch(() => emptyStore());
      const merged = mergeStores(remote, this.snapshot());
      await this.store.save(merged);
      this.absorb(merged);
    } catch (e) {
      this.dirty = true;
      this.log(`Stockage non enregistré : ${errorMessage(e)}`);
    }
  }

  private available(url: string, now: number): boolean {
    const until = this.unavailable.get(url);
    return until == null || until <= now;
  }

  private async discover(): Promise<void> {
    const now = this.now().getTime();
    const counter: Counter = { ok: 0, failed: 0, lastError: null };
    const jobs: { url: string; player: TrackedPlayer; team: TrackedTeam; league: TrackedLeague }[] = [];
    for (const player of this.players) {
      for (const team of player.teams) {
        for (const league of team.leagues) {
          for (const q of league.queries ?? DEFAULT_QUERIES) {
            const url = scheduleUrl(league.slug, team.espnId, q);
            if (this.available(url, now)) jobs.push({ url, player, team, league });
          }
        }
      }
    }

    await pool(jobs, this.concurrency, async ({ url, player, team, league }) => {
      let json: unknown;
      try {
        json = await this.opts.fetchJson(url);
        counter.ok += 1;
      } catch (e) {
        if (e instanceof HttpError && (e.status === 400 || e.status === 404)) {
          // Compétition hors saison ou sans calendrier pour cette équipe : on réessaiera plus tard.
          this.unavailable.set(url, now + 6 * HOUR);
          return;
        }
        counter.failed += 1;
        counter.lastError = errorMessage(e);
        return;
      }
      for (const event of parseScoreboard(json, league.slug, league.name)) {
        const involved = event.competitors.some((c) => c.team.id === team.espnId || team.names.test(c.team.name));
        if (!involved || !(Date.parse(event.date) > this.cutoff)) continue;
        const key = `${player.id}:${event.id}`;
        const known = this.events.get(key);
        // Le calendrier peut être en retard sur la feuille de match : on ne revient pas en arrière.
        if (known && known.event.state === 'post' && event.state !== 'post') continue;
        this.events.set(key, { player, team, league, event });
      }
    });

    const todo: [string, TrackedEvent][] = [];
    for (const [key, t] of this.events) {
      const done = this.completed[t.player.id].get(t.event.id);
      if (done) {
        const attempts = this.summaryAttempts.get(key) ?? 0;
        const date = Date.parse(t.event.date);
        if (!done.lineupsAvailable && attempts < MAX_SUMMARY_ATTEMPTS && now - date < 2 * DAY) todo.push([key, t]);
      } else if (t.event.state === 'post' || this.isActive(t, now)) {
        todo.push([key, t]);
      }
    }
    await pool(todo, this.concurrency, ([key, t]) => this.fetchSummary(key, t, counter));
    this.updateInfo(counter, true);
  }

  private async refreshActive(): Promise<void> {
    const counter: Counter = { ok: 0, failed: 0, lastError: null };
    await pool(this.activeEvents(), this.concurrency, ([key, t]) => this.fetchSummary(key, t, counter));
    this.updateInfo(counter, false);
  }

  private isActive(t: TrackedEvent, now: number): boolean {
    if (t.event.state === 'in') return true;
    if (t.event.state !== 'pre') return false;
    const kickoff = Date.parse(t.event.date);
    return kickoff - 15 * MINUTE <= now && now <= kickoff + 3 * HOUR;
  }

  private activeEvents(): [string, TrackedEvent][] {
    const now = this.now().getTime();
    return [...this.events].filter(([, t]) => this.isActive(t, now));
  }

  private async fetchSummary(key: string, t: TrackedEvent, counter: Counter): Promise<void> {
    this.summaryAttempts.set(key, (this.summaryAttempts.get(key) ?? 0) + 1);
    let json: unknown;
    try {
      json = await this.opts.fetchJson(summaryUrl(t.league.slug, t.event.id));
      counter.ok += 1;
    } catch (e) {
      counter.failed += 1;
      counter.lastError = errorMessage(e);
      return;
    }
    const match = parseSummary(
      json,
      {
        athleteId: t.player.espnAthleteId,
        playerName: t.player.name,
        teamKey: t.team.key,
        teamKind: t.team.kind,
        teamNames: t.team.names,
        league: t.league.slug,
        competition: t.league.name,
        season: (date) => seasonFor(date, t.team.seasonFormat),
      },
      t.event,
    );
    if (!match) return;
    t.event = { ...t.event, state: match.state, statusDetail: match.statusDetail, clock: match.clock };
    const id = t.player.id;
    if (match.state === 'post') {
      this.completed[id].set(match.eventId, match);
      this.dirty = true;
      if (this.live[id]?.eventId === match.eventId) this.live[id] = null;
    } else if (match.state === 'in') {
      this.live[id] = match;
    }
  }

  /* ------------------------------ API-Football ------------------------------ */

  private teamOf(playerId: PlayerId, teamKey: string): TrackedTeam | undefined {
    return this.players.find((p) => p.id === playerId)?.teams.find((t) => t.key === teamKey);
  }

  /**
   * Complète les matchs suivis avec API-Football, sans jamais dépasser le budget :
   * recherche de l'identifiant pendant le match (au plus toutes les 15 min), feuille
   * de match au plus toutes les 10 min, puis une dernière fois après le coup de sifflet.
   */
  private async enrich(): Promise<void> {
    const af = this.af!;
    const now = this.now().getTime();
    for (const player of this.players) {
      const live = this.live[player.id];
      if (live) {
        const key = `${player.id}:${live.eventId}`;
        const rec = (this.afRecords[key] ??= newAfRecord());
        const team = this.teamOf(player.id, live.teamKey);
        if (rec.fixtureId == null && team && rec.lookups < AF_MAX_LOOKUPS && now - (rec.lastLookupAt ?? 0) >= AF_LOOKUP_MS) {
          rec.lookups += 1;
          rec.lastLookupAt = now;
          this.dirty = true;
          const fixtures = await af.liveFixtures();
          const found = fixtures?.find((f) => f.homeId === team.apiFootballId || f.awayId === team.apiFootballId);
          if (found) rec.fixtureId = found.id;
        }
        if (rec.fixtureId != null && !rec.final && now - (rec.lastFetchAt ?? 0) >= AF_LIVE_FETCH_MS) {
          await this.fetchAfFixture(player, rec);
        }
      }
      for (const m of this.completed[player.id].values()) {
        const rec = this.afRecords[`${player.id}:${m.eventId}`];
        if (!rec || rec.final || rec.fixtureId == null || rec.postFetches >= AF_MAX_POST_FETCHES) continue;
        if (now - (rec.lastFetchAt ?? 0) < 5 * MINUTE) continue;
        rec.postFetches += 1;
        await this.fetchAfFixture(player, rec);
      }
    }
    this.info.quota = af.quota;
  }

  private async fetchAfFixture(player: TrackedPlayer, rec: AfRecord): Promise<void> {
    rec.fetches += 1;
    rec.lastFetchAt = this.now().getTime();
    this.dirty = true;
    const fixture = await this.af!.fixture(rec.fixtureId!);
    if (!fixture) return;
    const stats = playerStatsFromFixture(fixture, player.apiFootballId, player.lastName);
    if (stats) rec.stats = stats;
    if (AF_FINISHED.has(parseFixtureSummary(fixture)?.status ?? '')) rec.final = true;
  }

  /** Superpose les données API-Football à la ligne ESPN d'un match. */
  private withAf(playerId: PlayerId, m: PlayerMatch): PlayerMatch {
    const rec = this.afRecords[`${playerId}:${m.eventId}`];
    const s = rec?.stats;
    if (!s || rec.fixtureId == null) return m;
    const penalties = (s.penaltyScored ?? 0) + (s.penaltyMissed ?? 0);
    let attempts = m.attempts;
    if (!attempts && penalties > 0) {
      // Sans commentaire détaillé, seules les tentatives de penalty sont connues.
      attempts = emptyAttempts();
      attempts.penalty = { shots: penalties, goals: s.penaltyScored ?? 0 };
    }
    return {
      ...m,
      minutes: m.played && s.minutes != null ? s.minutes : m.minutes,
      shots: m.shots ?? s.shots,
      shotsOnTarget: m.shots != null ? m.shotsOnTarget : s.shotsOnTarget,
      attempts,
      extra: {
        source: 'API-Football',
        fixtureId: rec.fixtureId,
        rating: s.rating,
        keyPasses: s.keyPasses,
        passes: s.passes,
        passAccuracy: s.passAccuracy,
        dribblesAttempted: s.dribblesAttempted,
        dribblesSucceeded: s.dribblesSucceeded,
        duelsWon: s.duelsWon,
        duelsTotal: s.duelsTotal,
      },
    };
  }

  /* --------------------------------- État --------------------------------- */

  private updateInfo(counter: Counter, discovery: boolean): void {
    const now = this.now().toISOString();
    if (counter.ok > 0) this.info.lastSuccessAt = now;
    if (counter.lastError) this.info.lastError = counter.lastError;
    if (discovery) {
      if (counter.ok === 0) {
        this.info.status = 'offline';
        this.info.lastError ??= 'Aucune compétition disponible';
      } else {
        this.info.status = counter.failed > 0 ? 'degraded' : 'ok';
        if (counter.failed === 0) this.info.lastError = null;
      }
    } else if (counter.failed > 0 && this.info.status === 'ok') {
      this.info.status = 'degraded';
    }
  }

  private nextFixture(playerId: PlayerId, now: number): Fixture | null {
    let best: TrackedEvent | null = null;
    for (const t of this.events.values()) {
      if (t.player.id !== playerId || t.event.state !== 'pre') continue;
      const kickoff = Date.parse(t.event.date);
      if (kickoff + 3 * HOUR < now) continue;
      if (!best || kickoff < Date.parse(best.event.date)) best = t;
    }
    if (!best) return null;
    const team = best.team;
    const ours = best.event.competitors.find((c) => c.team.id === team.espnId || team.names.test(c.team.name));
    const theirs = best.event.competitors.find((c) => c !== ours);
    if (!ours || !theirs) return null;
    return {
      eventId: best.event.id,
      league: best.league.slug,
      competition: best.league.name,
      date: best.event.date,
      homeAway: ours.homeAway,
      team: ours.team,
      opponent: theirs.team,
    };
  }

  private publish(): void {
    const now = this.now().getTime();
    for (const id of PLAYER_IDS) {
      const live = this.live[id];
      const liveEvent = live ? this.events.get(`${id}:${live.eventId}`) : undefined;
      this.data[id] = {
        completed: [...this.completed[id].values()]
          .map((m) => this.withAf(id, m))
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
        live: live && liveEvent?.event.state === 'in' ? this.withAf(id, live) : null,
        next: this.nextFixture(id, now),
      };
    }
    this.info.refreshSeconds = Math.round((this.hasActiveEvents() ? this.liveIntervalMs : this.discoveryIntervalMs) / 1000);
    for (const fn of this.listeners) fn();
  }
}
