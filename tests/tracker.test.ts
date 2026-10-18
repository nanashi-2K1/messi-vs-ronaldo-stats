import { describe, expect, it } from 'vitest';
import { memoryCache } from '../server/cache.ts';
import { HttpError, type FetchJson } from '../server/espn/client.ts';
import { Tracker } from '../server/tracker.ts';
import { ATLANTA, HILAL, MIAMI, NASHVILLE, NASSR, messiBraceSummary, ronaldoLiveSummary, scoreboard, scoreboardEvent } from './fixtures/espn.ts';

const ASOF = '2026-10-16T23:59:59Z';
const NOW = new Date('2026-10-18T18:07:00Z');

/** Simule ESPN : renvoie une réponse selon la compétition et le type de requête. */
function fakeEspn(routes: Record<string, unknown>, calls: string[] = []): FetchJson {
  return async (url) => {
    calls.push(url);
    const league = /soccer\/([^/]+)\//.exec(url)?.[1] ?? '';
    const kind = url.includes('/summary') ? `summary:${/event=(\d+)/.exec(url)?.[1]}` : 'scoreboard';
    const key = `${league}:${kind}`;
    if (key in routes) {
      const r = routes[key];
      if (r instanceof Error) throw r;
      return r;
    }
    throw new HttpError(404, url);
  };
}

const routes = (): Record<string, unknown> => ({
  'usa.1:scoreboard': scoreboard('MLS', [
    scoreboardEvent('600000', '2026-10-10T23:30Z', MIAMI, NASHVILLE, 'post', [1, 1]),
    scoreboardEvent('692900', '2026-10-17T23:30Z', MIAMI, ATLANTA, 'post', [3, 1]),
    scoreboardEvent('693000', '2026-10-25T20:00Z', NASHVILLE, MIAMI, 'pre'),
    scoreboardEvent('693001', '2026-10-25T22:00Z', NASHVILLE, ATLANTA, 'pre'),
  ]),
  'usa.1:summary:692900': messiBraceSummary(),
  'ksa.1:scoreboard': scoreboard('Saudi Pro League', [scoreboardEvent('716300', '2026-10-18T17:00Z', NASSR, HILAL, 'in', [1, 0])]),
  'ksa.1:summary:716300': ronaldoLiveSummary(),
});

describe('Tracker', () => {
  it('découvre les matchs, ajoute les matchs terminés, suit le direct et le prochain match', async () => {
    const calls: string[] = [];
    const tracker = new Tracker({ fetchJson: fakeEspn(routes(), calls), baselineAsOf: ASOF, now: () => NOW });
    let changes = 0;
    tracker.onChange(() => changes++);
    await tracker.tick();

    expect(changes).toBe(1);
    expect(tracker.data.messi.completed.map((m) => m.eventId)).toEqual(['692900']);
    expect(tracker.data.messi.completed[0]).toMatchObject({ goals: 2, assists: 1 });
    expect(tracker.data.messi.next).toMatchObject({ eventId: '693000', homeAway: 'away', opponent: { name: 'Nashville SC' } });
    expect(tracker.data.ronaldo.live).toMatchObject({ eventId: '716300', state: 'in', goals: 1 });
    // Les compétitions qui renvoient 404 sont ignorées : ce n'est pas un échec.
    expect(tracker.info.status).toBe('ok');
    // Le match antérieur à la date de référence n'a pas été demandé.
    expect(calls.some((u) => u.includes('event=600000'))).toBe(false);
  });

  it('ne redemande pas un match terminé déjà en cache et rafraîchit le direct', async () => {
    const calls: string[] = [];
    let now = NOW;
    const cache = memoryCache();
    const tracker = new Tracker({ fetchJson: fakeEspn(routes(), calls), baselineAsOf: ASOF, now: () => now, cache, liveIntervalMs: 30_000 });
    await tracker.tick();
    const summaryCalls = () => calls.filter((u) => u.includes('summary')).length;
    const afterFirst = summaryCalls();

    now = new Date(NOW.getTime() + 30_000);
    await tracker.tick();
    // Seul le match en cours est redemandé (pas de nouvelle découverte avant 10 min).
    expect(summaryCalls()).toBe(afterFirst + 1);
    expect(calls.filter((u) => u.includes('event=692900'))).toHaveLength(1);
    expect((await cache.load()).messi?.map((m) => m.eventId)).toEqual(['692900']);
  });

  it('bascule le match en cours dans les matchs terminés au coup de sifflet final', async () => {
    const r = routes();
    const tracker = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => NOW });
    await tracker.tick();
    expect(tracker.data.ronaldo.live).not.toBeNull();

    const finished = ronaldoLiveSummary();
    finished.header.competitions[0]!.status.type = { state: 'post', completed: true, detail: 'FT', shortDetail: 'FT', description: 'FT' };
    r['ksa.1:summary:716300'] = finished;
    await tracker.tick();
    expect(tracker.data.ronaldo.live).toBeNull();
    expect(tracker.data.ronaldo.completed[0]).toMatchObject({ eventId: '716300', state: 'post', goals: 1 });
  });

  it('reprend les matchs du cache au démarrage', async () => {
    const first = new Tracker({ fetchJson: fakeEspn(routes()), baselineAsOf: ASOF, now: () => NOW, cache: memoryCache() });
    await first.tick();
    const cache = memoryCache({ messi: first.data.messi.completed });
    const offline: FetchJson = async () => {
      throw new Error('réseau indisponible');
    };
    const second = new Tracker({ fetchJson: offline, baselineAsOf: ASOF, now: () => NOW, cache });
    await second.tick();
    expect(second.data.messi.completed).toHaveLength(1);
    expect(second.info).toMatchObject({ status: 'offline', lastError: 'réseau indisponible' });
  });

  it('signale un état dégradé si une partie des requêtes échoue', async () => {
    const r = routes();
    r['ksa.1:scoreboard'] = new Error('timeout');
    const tracker = new Tracker({ fetchJson: fakeEspn(r), baselineAsOf: ASOF, now: () => NOW });
    await tracker.tick();
    expect(tracker.info.status).toBe('degraded');
    expect(tracker.info.lastError).toBe('timeout');
    expect(tracker.data.messi.completed).toHaveLength(1);
  });
});
