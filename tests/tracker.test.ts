import { describe, expect, it } from 'vitest';
import { ApiFootball } from '../server/apiFootball.ts';
import { HttpError, type FetchJson } from '../server/espn/client.ts';
import { memoryStore } from '../server/store.ts';
import { Tracker } from '../server/tracker.ts';
import {
  ATLANTA,
  MIAMI,
  NASSR,
  NEFTCHI,
  NEOM,
  NYRB,
  messiBraceSummary,
  ronaldoLiveSummary,
  ronaldoSaudiSummary,
  schedule,
  scheduleEvent,
} from './fixtures/espn.ts';

const ASOF = '2026-10-16T23:59:59Z';
const NOW = new Date('2026-10-18T18:07:00Z');
const MIN = 60_000;

/** Simule ESPN : clé « compétition:schedule:équipe:requête » ou « compétition:summary:match ». */
function fakeEspn(routes: Record<string, unknown>, calls: string[] = []): FetchJson {
  return async (url) => {
    calls.push(url);
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const league = parts[parts.indexOf('soccer') + 1] ?? '';
    const key = u.pathname.endsWith('/summary')
      ? `${league}:summary:${u.searchParams.get('event')}`
      : `${league}:schedule:${parts[parts.indexOf('teams') + 1]}:${u.search.slice(1)}`;
    if (key in routes) {
      const r = routes[key];
      if (r instanceof Error) throw r;
      return r;
    }
    throw new HttpError(404, url);
  };
}

const routes = (): Record<string, unknown> => ({
  'usa.1:schedule:20232:': schedule(MIAMI, [
    scheduleEvent('761800', '2026-10-10T23:30Z', MIAMI, ATLANTA, 'post', [1, 1]),
    scheduleEvent('761880', '2026-10-17T23:30Z', ATLANTA, MIAMI, 'post', [1, 3]),
  ]),
  'usa.1:schedule:20232:fixture=true': schedule(MIAMI, [scheduleEvent('761891', '2026-10-24T21:30Z', NYRB, MIAMI, 'pre')]),
  'usa.1:summary:761880': messiBraceSummary(),
  'afc.champions:schedule:817:': schedule(NASSR, [scheduleEvent('401912700', '2026-10-18T17:00Z', NASSR, NEFTCHI, 'in', [1, 0])]),
  'afc.champions:summary:401912700': ronaldoLiveSummary(),
});

/** Simule API-Football (statut, matchs en direct, feuille de match) en comptant les appels payants. */
function fakeApiFootball(opts: { used?: number; status?: string } = {}) {
  const paid: string[] = [];
  let used = opts.used ?? 0;
  let status = opts.status ?? '2H';
  const fixture = () => ({
    fixture: { id: 1490001, status: { short: status, elapsed: 67 } },
    teams: { home: { id: 2939, name: 'Al-Nassr' }, away: { id: 15000, name: 'Neftchi' } },
    players: [
      {
        team: { id: 2939 },
        players: [
          {
            player: { id: 874, name: 'Cristiano Ronaldo' },
            statistics: [
              {
                games: { minutes: 67, rating: '7.8' },
                shots: { total: 4, on: 2 },
                goals: { total: 1, assists: null },
                passes: { total: 21, key: 2, accuracy: '86' },
                dribbles: { attempts: 3, success: 1 },
                duels: { total: 11, won: 6 },
                penalty: { scored: 1, missed: 0 },
              },
            ],
          },
        ],
      },
    ],
  });
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    const path = url.slice(url.indexOf('.io/') + 4);
    const reply = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json', 'x-ratelimit-requests-remaining': String(100 - used) } });
    if (path === 'status') return reply({ errors: [], response: { requests: { current: used, limit_day: 100 } } });
    used += 1;
    paid.push(path);
    if (path === 'fixtures?live=all') return reply({ errors: [], response: [fixture(), { fixture: { id: 7, status: { short: '1H' } }, teams: { home: { id: 1 }, away: { id: 2 } } }] });
    if (path === 'fixtures?id=1490001') return reply({ errors: [], response: [fixture()] });
    return reply({ errors: { plan: 'refusé' }, response: [] });
  }) as typeof fetch;
  return { fetchImpl, paid, finish: () => (status = 'FT'), usedNow: () => used };
}

describe('Tracker (ESPN)', () => {
  it('lit les calendriers, ajoute les matchs terminés, suit le direct et le prochain match', async () => {
    const calls: string[] = [];
    const tracker = new Tracker({ fetchJson: fakeEspn(routes(), calls), baselineAsOf: ASOF, now: () => NOW });
    let changes = 0;
    tracker.onChange(() => changes++);
    await tracker.tick();

    expect(changes).toBe(1);
    expect(tracker.data.messi.completed.map((m) => m.eventId)).toEqual(['761880']);
    expect(tracker.data.messi.completed[0]).toMatchObject({ goals: 2, assists: 0, attempts: { insideBox: { shots: 2, goals: 2 } } });
    expect(tracker.data.messi.next).toMatchObject({ eventId: '761891', homeAway: 'away', opponent: { name: 'Red Bull New York' } });
    expect(tracker.data.ronaldo.live).toMatchObject({ eventId: '401912700', state: 'in', goals: 1 });
    // Les compétitions qui renvoient 404 sont ignorées : ce n'est pas un échec.
    expect(tracker.info.status).toBe('ok');
    expect(tracker.hasActiveEvents()).toBe(true);
    // Le match antérieur à la date de référence n'a pas été demandé, et aucune plage de dates n'est utilisée.
    expect(calls.some((u) => u.includes('event=761800'))).toBe(false);
    expect(calls.some((u) => u.includes('dates='))).toBe(false);
  });

  it('ne redemande pas un match terminé déjà enregistré et rafraîchit le direct', async () => {
    const calls: string[] = [];
    let now = NOW;
    const store = memoryStore();
    const tracker = new Tracker({ fetchJson: fakeEspn(routes(), calls), baselineAsOf: ASOF, now: () => now, store });
    await tracker.tick();
    const summaryCalls = () => calls.filter((u) => u.includes('summary')).length;
    const afterFirst = summaryCalls();

    now = new Date(NOW.getTime() + 30_000);
    await tracker.tick();
    expect(summaryCalls()).toBe(afterFirst + 1);
    expect(calls.filter((u) => u.includes('event=761880'))).toHaveLength(1);
    expect((await store.load()).matches.messi?.map((m) => m.eventId)).toEqual(['761880']);

    // Nouvelle instance (redémarrage ou autre fonction serverless) : rien n'est redemandé.
    const calls2: string[] = [];
    const again = new Tracker({ fetchJson: fakeEspn(routes(), calls2), baselineAsOf: ASOF, now: () => now, store });
    await again.tick();
    expect(calls2.some((u) => u.includes('event=761880'))).toBe(false);
    expect(again.data.messi.completed).toHaveLength(1);
  });

  it('bascule le match en cours dans les matchs terminés au coup de sifflet final', async () => {
    const r = routes();
    const tracker = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => NOW });
    await tracker.tick();
    expect(tracker.data.ronaldo.live).not.toBeNull();

    const finished = ronaldoLiveSummary();
    finished.header.competitions[0]!.status.type = { state: 'post', completed: true, detail: 'FT', shortDetail: 'FT', description: 'FT' };
    r['afc.champions:summary:401912700'] = finished;
    await tracker.tick();
    expect(tracker.data.ronaldo.live).toBeNull();
    expect(tracker.data.ronaldo.completed[0]).toMatchObject({ eventId: '401912700', state: 'post', goals: 1 });
  });

  it('signale un état dégradé si une partie des requêtes échoue, hors ligne si toutes échouent', async () => {
    const r = routes();
    r['afc.champions:schedule:817:'] = new Error('timeout');
    const partial = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => NOW });
    await partial.tick();
    expect(partial.info).toMatchObject({ status: 'degraded', lastError: 'timeout' });
    expect(partial.data.messi.completed).toHaveLength(1);

    const offline = new Tracker({
      fetchJson: async () => {
        throw new Error('réseau indisponible');
      },
      baselineAsOf: ASOF,
      now: () => NOW,
    });
    await offline.tick();
    expect(offline.info).toMatchObject({ status: 'offline', lastError: 'réseau indisponible' });
  });

  it('championnat saoudien : le match compte même sans tirs ni commentaire détaillé', async () => {
    const r = routes();
    r['ksa.1:schedule:817:'] = schedule(NASSR, [scheduleEvent('401900446', '2026-10-20T18:00Z', NASSR, NEOM, 'post', [2, 0])]);
    r['ksa.1:summary:401900446'] = ronaldoSaudiSummary();
    const tracker = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => new Date('2026-10-21T08:00:00Z') });
    await tracker.tick();
    expect(tracker.data.ronaldo.completed.find((m) => m.eventId === '401900446')).toMatchObject({ goals: 1, shots: null, attempts: null });
  });
});

describe('Tracker + API-Football (budget de requêtes)', () => {
  it('trouve le match en direct, complète la ligne et respecte l’intervalle de 10 minutes', async () => {
    const af = fakeApiFootball();
    let now = NOW;
    const apiFootball = new ApiFootball({ key: 'test', fetchImpl: af.fetchImpl, now: () => now });
    const tracker = new Tracker({ fetchJson: fakeEspn(routes()), baselineAsOf: ASOF, now: () => now, apiFootball });

    await tracker.tick();
    expect(af.paid).toEqual(['fixtures?live=all', 'fixtures?id=1490001']);
    expect(tracker.data.ronaldo.live).toMatchObject({ minutes: 67, extra: { rating: 7.8, keyPasses: 2, dribblesSucceeded: 1 } });
    expect(tracker.info.quota).toMatchObject({ used: 2, cap: 80, limit: 100 });

    // 30 s plus tard (ouvertures de page, rafraîchissements) : aucun appel payant.
    now = new Date(NOW.getTime() + 30_000);
    await tracker.tick();
    now = new Date(NOW.getTime() + 5 * MIN);
    await tracker.tick();
    expect(af.paid).toHaveLength(2);

    // Au-delà de 10 minutes : une seule nouvelle feuille de match.
    now = new Date(NOW.getTime() + 11 * MIN);
    await tracker.tick();
    expect(af.paid).toEqual(['fixtures?live=all', 'fixtures?id=1490001', 'fixtures?id=1490001']);
  });

  it('n’appelle plus rien une fois la feuille définitive obtenue', async () => {
    const af = fakeApiFootball();
    let now = NOW;
    const r = routes();
    const apiFootball = new ApiFootball({ key: 'test', fetchImpl: af.fetchImpl, now: () => now });
    const tracker = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => now, apiFootball });
    await tracker.tick();

    const finished = ronaldoLiveSummary();
    finished.header.competitions[0]!.status.type = { state: 'post', completed: true, detail: 'FT', shortDetail: 'FT', description: 'FT' };
    r['afc.champions:summary:401912700'] = finished;
    af.finish();
    now = new Date(NOW.getTime() + 20 * MIN);
    await tracker.tick();
    const count = af.paid.length;
    expect(tracker.data.ronaldo.completed[0]).toMatchObject({ extra: { rating: 7.8 } });

    for (const m of [40, 60, 120, 600]) {
      now = new Date(NOW.getTime() + m * MIN);
      await tracker.tick();
    }
    expect(af.paid.length).toBe(count);
  });

  it('ne dépense rien quand le plafond quotidien est atteint', async () => {
    const af = fakeApiFootball({ used: 80 });
    const apiFootball = new ApiFootball({ key: 'test', fetchImpl: af.fetchImpl, now: () => NOW, dailyCap: 80 });
    const tracker = new Tracker({ fetchJson: fakeEspn(routes()), baselineAsOf: ASOF, now: () => NOW, apiFootball });
    await tracker.tick();
    expect(af.paid).toEqual([]);
    expect(tracker.info.quota).toMatchObject({ used: 80, cap: 80 });
    expect(tracker.data.ronaldo.live?.extra).toBeUndefined();
  });

  it('ne répète pas les appels après un redémarrage (état persisté)', async () => {
    const af = fakeApiFootball();
    const store = memoryStore();
    let now = NOW;
    const mk = () =>
      new Tracker({
        fetchJson: fakeEspn(routes()),
        baselineAsOf: ASOF,
        now: () => now,
        store,
        apiFootball: new ApiFootball({ key: 'test', fetchImpl: af.fetchImpl, now: () => now }),
      });
    await mk().tick();
    expect(af.paid).toHaveLength(2);
    now = new Date(NOW.getTime() + 2 * MIN);
    const restarted = mk();
    await restarted.tick();
    expect(af.paid).toHaveLength(2);
    expect(restarted.data.ronaldo.live?.extra?.rating).toBe(7.8);
  });
});
