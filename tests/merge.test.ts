import { describe, expect, it } from 'vitest';
import { baseline } from '../shared/baseline.ts';
import { bestAndWorstZones, buildAppState, buildPlayerState, emptyAttempts, emptyLiveData, MIN_ATTEMPTS_FOR_RANKING } from '../shared/merge.ts';
import { ageAt, efficiency, seasonFor, seasonMidpoint } from '../shared/metrics.ts';
import type { LiveInfo, PlayerMatch } from '../shared/types.ts';

const info: LiveInfo = { provider: 'test', status: 'ok', lastSuccessAt: null, lastError: null, refreshSeconds: 30, push: false, quota: null };

function match(over: Partial<PlayerMatch> = {}): PlayerMatch {
  return {
    eventId: '1',
    league: 'usa.1',
    competition: 'MLS',
    date: '2026-10-24T21:30:00Z',
    season: '2026',
    state: 'post',
    statusDetail: 'FT',
    teamKey: 'inter-miami',
    teamKind: 'club',
    homeAway: 'home',
    team: { id: '20232', name: 'Inter Miami CF', abbreviation: 'MIA', score: 3 },
    opponent: { id: '18418', name: 'Atlanta United FC', abbreviation: 'ATL', score: 1 },
    lineupsAvailable: true,
    inSquad: true,
    played: true,
    starter: true,
    minutes: 85,
    goals: 2,
    assists: 1,
    shots: 5,
    shotsOnTarget: 3,
    yellowCards: 0,
    redCards: 0,
    goalDetails: [
      { minute: "21'", zone: 'freeKick', bodyPart: 'left' },
      { minute: "71'", zone: 'insideBox', bodyPart: 'left' },
    ],
    attempts: {
      insideBox: { shots: 3, goals: 1 },
      outsideBox: { shots: 2, goals: 0 },
      freeKick: { shots: 1, goals: 1 },
      penalty: { shots: 0, goals: 0 },
    },
    ...over,
  };
}

describe('buildPlayerState', () => {
  const messi = baseline.players.messi;

  it('sans données en direct, renvoie les valeurs de référence', () => {
    const s = buildPlayerState(messi, { completed: [], live: null, next: null }, baseline.asOf);
    expect(s.totals).toEqual({ ...messi.totals, hatTricks: messi.hatTricks.count });
    expect(s.zones).toEqual(messi.zones.parts);
    expect(s.teams).toEqual(messi.teams);
  });

  it('ajoute les matchs terminés après la date de référence', () => {
    const s = buildPlayerState(messi, { completed: [match()], live: null, next: null }, baseline.asOf);
    expect(s.totals.goals).toBe(messi.totals.goals + 2);
    expect(s.totals.apps).toBe(messi.totals.apps + 1);
    expect(s.totals.assists).toBe(messi.totals.assists + 1);
    expect(s.totals.minutes).toBe(messi.totals.minutes + 85);
    expect(s.zones.freeKick).toBe(messi.zones.parts.freeKick + 1);
    expect(s.zones.insideBox).toBe(messi.zones.parts.insideBox + 1);
    expect(s.bodyParts.left).toBe(messi.bodyParts.parts.left + 2);
    expect(s.teams.find((t) => t.key === 'inter-miami')).toMatchObject({ apps: 121, goals: 108 });
    expect(s.seasons.find((x) => x.season === '2026')).toMatchObject({ apps: 33, goals: 31 });
    expect(s.delta.shots).toBe(5);
    expect(s.delta.attempts.freeKick).toEqual({ shots: 1, goals: 1 });
    // Coups francs : référence (50 / 538) + tentative suivie (1 / 1).
    expect(s.conversion.freeKick).toMatchObject({ scored: 51, attempts: 539, sufficient: true });
    expect(s.conversion.insideBox).toMatchObject({ scored: 1, attempts: 3, sufficient: false });
  });

  it('ignore les matchs déjà inclus dans la référence', () => {
    const old = match({ eventId: 'old', date: '2026-10-17T23:30:00Z' });
    const s = buildPlayerState(messi, { completed: [old], live: null, next: null }, baseline.asOf);
    expect(s.totals.goals).toBe(messi.totals.goals);
    expect(s.recent).toHaveLength(0);
  });

  it('ne compte pas un match sur le banc, mais le garde dans la liste', () => {
    const bench = match({ played: false, starter: false, minutes: 0, goals: 0, assists: 0, goalDetails: [] });
    const s = buildPlayerState(messi, { completed: [bench], live: null, next: null }, baseline.asOf);
    expect(s.totals.apps).toBe(messi.totals.apps);
    expect(s.recent).toHaveLength(1);
  });

  it('inclut le match en cours et isole sa contribution', () => {
    const live = match({ eventId: '2', state: 'in', date: '2026-10-28T23:30:00Z', goals: 3, assists: 0, minutes: 60, goalDetails: [], attempts: null });
    const s = buildPlayerState(messi, { completed: [match()], live, next: null }, baseline.asOf);
    expect(s.totals.goals).toBe(messi.totals.goals + 5);
    expect(s.liveDelta.goals).toBe(3);
    expect(s.liveDelta.hatTricks).toBe(1);
    expect(s.totals.hatTricks).toBe(messi.hatTricks.count + 1);
    expect(s.delta.unclassifiedGoals).toBe(3);
  });

  it('crée une ligne pour un nouveau club', () => {
    const transfer = match({ teamKey: 'newells', team: { id: '1', name: "Newell's Old Boys", abbreviation: 'NOB', score: 1 }, season: '2027' });
    const s = buildPlayerState(messi, { completed: [transfer], live: null, next: null }, baseline.asOf);
    expect(s.teams.at(-1)).toMatchObject({ key: 'newells', name: "Newell's Old Boys", apps: 1, goals: 2 });
    expect(s.seasons.at(-1)).toMatchObject({ season: '2027', teamKey: 'newells', apps: 1 });
  });
});

describe('buildAppState', () => {
  it('assemble les deux joueurs', () => {
    const s = buildAppState(baseline, emptyLiveData(), info, new Date('2026-10-18T12:00:00Z'));
    expect(s.generatedAt).toBe('2026-10-18T12:00:00.000Z');
    expect(s.players.messi.totals.goals).toBe(936);
    expect(s.players.ronaldo.totals.goals).toBe(981);
  });
});

describe('taux de réussite par zone', () => {
  const ronaldo = baseline.players.ronaldo;

  it('part des références penalties et coups francs, sans données dans le jeu', () => {
    const s = buildPlayerState(ronaldo, { completed: [], live: null, next: null }, baseline.asOf);
    expect(s.conversion.penalty).toMatchObject({ scored: 184, attempts: 220, sufficient: true });
    expect(s.conversion.penalty.rate).toBeCloseTo(184 / 220, 5);
    expect(s.conversion.insideBox).toMatchObject({ attempts: 0, rate: null, sufficient: false });
    expect(bestAndWorstZones(s.conversion)).toEqual({ best: 'penalty', worst: 'freeKick' });
  });

  it('classe les zones de jeu une fois l’échantillon suffisant', () => {
    const attempts = emptyAttempts();
    attempts.insideBox = { shots: MIN_ATTEMPTS_FOR_RANKING + 5, goals: 6 };
    attempts.outsideBox = { shots: MIN_ATTEMPTS_FOR_RANKING, goals: 0 };
    const m = match({ teamKey: 'al-nassr', goals: 6, goalDetails: [], attempts });
    const s = buildPlayerState(ronaldo, { completed: [m], live: null, next: null }, baseline.asOf);
    expect(s.conversion.insideBox.sufficient).toBe(true);
    expect(bestAndWorstZones(s.conversion)).toEqual({ best: 'penalty', worst: 'outsideBox' });
  });
});

describe('métriques', () => {
  it('calcule les ratios d’efficacité', () => {
    const s = buildPlayerState(baseline.players.ronaldo, { completed: [], live: null, next: null }, baseline.asOf);
    const e = efficiency(s);
    expect(e.goalsPerMatch).toBeCloseTo(981 / 1340, 5);
    expect(e.minutesPerGoal).toBeCloseTo(109542 / 981, 5);
    expect(e.contributionsPerMatch).toBeCloseTo((981 + 261) / 1340, 5);
    expect(e.penaltyShare).toBeCloseTo(184 / 981, 5);
    expect(e.nonPenaltyGoals).toBe(981 - 184);
    expect(e.internationalGoalsPerMatch).toBeCloseTo(146 / 234, 5);
  });

  it('positionne les saisons sur un axe temporel', () => {
    expect(seasonMidpoint('2008/09')).toBe(2009);
    expect(seasonMidpoint('2025')).toBe(2025.5);
  });

  it('rattache un match à sa saison', () => {
    expect(seasonFor('2026-10-17T23:30Z', 'calendar')).toBe('2026');
    expect(seasonFor('2026-10-17T23:30Z', 'split')).toBe('2026/27');
    expect(seasonFor('2027-03-01T18:00Z', 'split')).toBe('2026/27');
    expect(seasonFor('2099-08-01T18:00Z', 'split')).toBe('2099/00');
  });

  it('calcule l’âge', () => {
    expect(ageAt('1987-06-24', new Date('2026-10-18T00:00:00Z'))).toBe(39);
    expect(ageAt('1985-02-05', new Date('2026-10-18T00:00:00Z'))).toBe(41);
    expect(ageAt('1987-06-24', new Date('2027-06-23T00:00:00Z'))).toBe(39);
  });
});
