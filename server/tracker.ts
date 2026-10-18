import { emptyLiveData } from '../shared/merge.ts';
import { seasonFor } from '../shared/metrics.ts';
import { PLAYER_IDS, type Fixture, type LiveData, type LiveInfo, type PlayerId, type PlayerMatch } from '../shared/types.ts';
import { memoryCache, type MatchCache } from './cache.ts';
import { TRACKED_PLAYERS, type TrackedLeague, type TrackedPlayer, type TrackedTeam } from './config.ts';
import { HttpError, scoreboardUrl, summaryUrl, type FetchJson } from './espn/client.ts';
import { parseScoreboard, parseSummary, type ScoreboardEvent } from './espn/parse.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Taille maximale d'une plage de dates demandée en une seule requête. */
const WINDOW_DAYS = 28;
/** Nouvelles tentatives pour un match terminé dont les compositions manquaient. */
const MAX_SUMMARY_ATTEMPTS = 3;

export interface TrackerOptions {
  fetchJson: FetchJson;
  baselineAsOf: string;
  players?: TrackedPlayer[];
  cache?: MatchCache;
  now?: () => Date;
  log?: (message: string) => void;
  /** Fréquence de recherche des matchs (calendrier, résultats). */
  discoveryIntervalMs?: number;
  /** Fréquence de rafraîchissement d'un match en cours. */
  liveIntervalMs?: number;
  lookaheadDays?: number;
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

export class Tracker {
  readonly data: LiveData = emptyLiveData();
  info: LiveInfo = { provider: 'ESPN', status: 'starting', lastSuccessAt: null, lastError: null, refreshSeconds: null };

  private readonly players: TrackedPlayer[];
  private readonly cache: MatchCache;
  private readonly now: () => Date;
  private readonly log: (message: string) => void;
  private readonly discoveryIntervalMs: number;
  private readonly liveIntervalMs: number;
  private readonly lookaheadDays: number;
  private readonly cutoff: number;

  private readonly events = new Map<string, TrackedEvent>();
  private readonly completed: Record<PlayerId, Map<string, PlayerMatch>> = { messi: new Map(), ronaldo: new Map() };
  private readonly live: Record<PlayerId, PlayerMatch | null> = { messi: null, ronaldo: null };
  private readonly summaryAttempts = new Map<string, number>();
  private readonly unavailableLeagues = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private lastDiscovery = Number.NEGATIVE_INFINITY;
  private fullScanDone = false;
  private loaded = false;
  private cacheDirty = false;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly opts: TrackerOptions) {
    this.players = opts.players ?? TRACKED_PLAYERS;
    this.cache = opts.cache ?? memoryCache();
    this.now = opts.now ?? (() => new Date());
    this.log = opts.log ?? (() => {});
    this.discoveryIntervalMs = opts.discoveryIntervalMs ?? 10 * MINUTE;
    this.liveIntervalMs = opts.liveIntervalMs ?? 30_000;
    this.lookaheadDays = opts.lookaheadDays ?? 21;
    this.cutoff = Date.parse(opts.baselineAsOf);
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

  /** Une itération : recherche périodique des matchs, puis suivi des matchs en cours. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      if (!this.loaded) await this.loadCache();
      const now = this.now().getTime();
      if (now - this.lastDiscovery >= this.discoveryIntervalMs) {
        this.lastDiscovery = now;
        await this.discover();
      } else if (this.activeEvents().length > 0) {
        await this.refreshActive();
      }
      await this.persist();
      this.publish();
    } finally {
      this.running = false;
    }
  }

  private async loadCache(): Promise<void> {
    this.loaded = true;
    const stored = await this.cache.load().catch(() => ({}) as Awaited<ReturnType<MatchCache['load']>>);
    for (const id of PLAYER_IDS) {
      for (const m of stored[id] ?? []) {
        if (Date.parse(m.date) > this.cutoff && m.state === 'post') this.completed[id].set(m.eventId, m);
      }
    }
  }

  private async persist(): Promise<void> {
    if (!this.cacheDirty) return;
    this.cacheDirty = false;
    const out = Object.fromEntries(PLAYER_IDS.map((id) => [id, [...this.completed[id].values()]]));
    await this.cache.save(out).catch((e) => this.log(`Cache non enregistré : ${errorMessage(e)}`));
  }

  private leagueAvailable(slug: string, now: number): boolean {
    const until = this.unavailableLeagues.get(slug);
    return until == null || until <= now;
  }

  private async discover(): Promise<void> {
    const now = this.now().getTime();
    const counter: Counter = { ok: 0, failed: 0, lastError: null };
    // Premier passage : depuis la date de référence. Ensuite, seuls les derniers jours suffisent.
    const from = this.fullScanDone ? Math.max(this.cutoff, now - 7 * DAY) : this.cutoff;
    const to = now + this.lookaheadDays * DAY;
    const memo = new Map<string, Promise<unknown>>();

    for (const player of this.players) {
      for (const team of player.teams) {
        for (const league of team.leagues) {
          if (!this.leagueAvailable(league.slug, now)) continue;
          for (let start = from; start < to; start += WINDOW_DAYS * DAY) {
            const url = scoreboardUrl(league.slug, new Date(start), new Date(Math.min(to, start + (WINDOW_DAYS - 1) * DAY)));
            let json: unknown;
            try {
              if (!memo.has(url)) memo.set(url, this.opts.fetchJson(url));
              json = await memo.get(url);
              counter.ok += 1;
            } catch (e) {
              if (e instanceof HttpError && (e.status === 400 || e.status === 404)) {
                // Compétition inconnue ou hors saison : on réessaiera plus tard.
                this.unavailableLeagues.set(league.slug, now + 6 * HOUR);
                this.log(`Compétition ${league.slug} indisponible (${e.status}), ignorée pendant 6 h`);
                break;
              }
              counter.failed += 1;
              counter.lastError = errorMessage(e);
              continue;
            }
            for (const event of parseScoreboard(json, league.slug, league.name)) {
              if (!event.competitors.some((c) => team.names.test(c.team.name))) continue;
              this.events.set(`${player.id}:${event.id}`, { player, team, league, event });
            }
          }
        }
      }
    }
    if (counter.failed === 0) this.fullScanDone = true;

    for (const [key, t] of this.events) {
      const date = Date.parse(t.event.date);
      if (!(date > this.cutoff)) {
        this.events.delete(key);
        continue;
      }
      const done = this.completed[t.player.id].get(t.event.id);
      if (done) {
        const attempts = this.summaryAttempts.get(key) ?? 0;
        const retry = !done.lineupsAvailable && attempts < MAX_SUMMARY_ATTEMPTS && now - date < 2 * DAY;
        if (!retry) continue;
        await this.fetchSummary(key, t, counter);
      } else if (t.event.state === 'post' || this.isActive(t, now)) {
        await this.fetchSummary(key, t, counter);
      }
    }
    this.updateInfo(counter, true);
  }

  private async refreshActive(): Promise<void> {
    const counter: Counter = { ok: 0, failed: 0, lastError: null };
    for (const [key, t] of this.activeEvents()) await this.fetchSummary(key, t, counter);
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
      this.cacheDirty = true;
      if (this.live[id]?.eventId === match.eventId) this.live[id] = null;
    } else if (match.state === 'in') {
      this.live[id] = match;
    }
  }

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
    const ours = best.event.competitors.find((c) => best.team.names.test(c.team.name));
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
        completed: [...this.completed[id].values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
        live: live && liveEvent?.event.state === 'in' ? live : null,
        next: this.nextFixture(id, now),
      };
    }
    const anyLive = PLAYER_IDS.some((id) => this.data[id].live) || this.activeEvents().length > 0;
    this.info.refreshSeconds = Math.round((anyLive ? this.liveIntervalMs : this.discoveryIntervalMs) / 1000);
    for (const fn of this.listeners) fn();
  }
}
