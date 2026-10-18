import { describe, expect, it } from 'vitest';
import { classifyBodyPart, classifyGoalZone } from '../shared/goalText.ts';
import { seasonFor } from '../shared/metrics.ts';
import { estimateMinutes, parseMinute, parseScoreboard, parseSummary, type SummaryContext } from '../server/espn/parse.ts';
import { ATLANTA, MIAMI, NASHVILLE, messiBraceSummary, ronaldoLiveSummary, scoreboard, scoreboardEvent } from './fixtures/espn.ts';

const messiCtx: SummaryContext = {
  athleteId: '45843',
  playerName: /lionel messi/i,
  teamKey: 'inter-miami',
  teamKind: 'club',
  teamNames: /inter miami/i,
  league: 'usa.1',
  competition: 'MLS',
  season: (d) => seasonFor(d, 'calendar'),
};

const ronaldoCtx: SummaryContext = {
  athleteId: '22774',
  playerName: /cristiano ronaldo/i,
  teamKey: 'al-nassr',
  teamKind: 'club',
  teamNames: /al[\s-]?nassr/i,
  league: 'ksa.1',
  competition: 'Saudi Pro League',
  season: (d) => seasonFor(d, 'split'),
};

describe('classement des buts à partir du commentaire', () => {
  it.each([
    ['converts the penalty with a right footed shot to the bottom left corner', 'penalty', 'right'],
    ['left footed shot from outside the box to the top left corner from a direct free kick', 'freeKick', 'left'],
    ['right footed shot from outside the box to the high centre of the goal', 'outsideBox', 'right'],
    ['header from the centre of the box to the bottom left corner', 'insideBox', 'head'],
    ['left footed shot from very close range to the centre of the goal', 'insideBox', 'left'],
    ['right footed shot from the right side of the six yard box', 'insideBox', 'right'],
    ['right footed shot from more than 35 yards to the top right corner', 'outsideBox', 'right'],
    ['scores after a goalmouth scramble', null, null],
  ])('%s', (text, zone, body) => {
    expect(classifyGoalZone(text)).toBe(zone);
    expect(classifyBodyPart(text)).toBe(body);
  });

  it('utilise les indicateurs structurés quand le texte manque', () => {
    expect(classifyGoalZone('', { penaltyKick: true })).toBe('penalty');
    expect(classifyGoalZone('', { typeText: 'Goal - Free-kick' })).toBe('freeKick');
    expect(classifyBodyPart('', { typeText: 'Goal - Header' })).toBe('head');
  });
});

describe('parseMinute', () => {
  it.each([
    ["67'", 67],
    ["90'+3'", 93],
    ['45+2', 47],
    ['HT', null],
    [undefined, null],
  ])('%s → %s', (input, expected) => {
    expect(parseMinute(input)).toBe(expected);
  });
});

describe('parseScoreboard', () => {
  it('lit les matchs, statuts et équipes', () => {
    const json = scoreboard('MLS', [
      scoreboardEvent('1', '2026-10-17T23:30Z', MIAMI, ATLANTA, 'post', [3, 1]),
      scoreboardEvent('2', '2026-10-25T20:00Z', NASHVILLE, MIAMI, 'pre'),
    ]);
    const events = parseScoreboard(json, 'usa.1', 'repli');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: '1', competition: 'MLS', state: 'post', statusDetail: 'FT' });
    expect(events[0]?.competitors[0]).toMatchObject({ homeAway: 'home', team: { name: 'Inter Miami CF', score: 3 } });
    expect(events[1]?.competitors[1]?.team.name).toBe('Inter Miami CF');
  });

  it('ignore un contenu inattendu sans lever d’erreur', () => {
    expect(parseScoreboard(null, 'usa.1', 'MLS')).toEqual([]);
    expect(parseScoreboard({ events: [{}, { id: 'x' }] }, 'usa.1', 'MLS')).toEqual([]);
  });
});

describe('parseSummary', () => {
  it('extrait la ligne de stats de Messi sur un match terminé', () => {
    const m = parseSummary(messiBraceSummary(), messiCtx);
    expect(m).toMatchObject({
      eventId: '692900',
      season: '2026',
      state: 'post',
      homeAway: 'home',
      team: { name: 'Inter Miami CF', score: 3 },
      opponent: { name: 'Atlanta United FC', score: 1 },
      inSquad: true,
      played: true,
      starter: true,
      goals: 2,
      assists: 1,
      shots: 5,
      shotsOnTarget: 3,
      minutes: 85,
      lineupsAvailable: true,
    });
    expect(m?.goalDetails.map((g) => [g.minute, g.zone, g.bodyPart])).toEqual([
      ["21'", 'freeKick', 'left'],
      ["71'", 'insideBox', 'left'],
    ]);
  });

  it('suit un match en cours', () => {
    const m = parseSummary(ronaldoLiveSummary(), ronaldoCtx);
    expect(m).toMatchObject({ state: 'in', clock: "67'", season: '2026/27', goals: 1, minutes: 67 });
    expect(m?.goalDetails[0]).toMatchObject({ zone: 'penalty', bodyPart: 'right' });
  });

  it('compte les stats depuis le fil d’actions si les stats individuelles manquent', () => {
    const json = messiBraceSummary();
    for (const r of json.rosters) for (const p of r.roster) p.stats = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ goals: 2, assists: 1, shots: null });
  });

  it('marque le joueur absent s’il ne figure pas dans la composition', () => {
    const json = messiBraceSummary();
    json.rosters[0]!.roster = json.rosters[0]!.roster.filter((p) => p.athlete.id !== '45843');
    json.keyEvents = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ inSquad: false, played: false, goals: 0, minutes: 0 });
  });

  it('se fie au fil d’actions quand les compositions sont absentes', () => {
    const json = messiBraceSummary();
    for (const r of json.rosters) r.roster = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ lineupsAvailable: false, played: true, goals: 2, assists: 1, minutes: null });
  });
});

describe('estimateMinutes', () => {
  const base = { subbedIn: false, subbedOut: false, state: 'post' as const, statusDetail: 'FT', keyEvents: [], isPlayer: (n: string) => /messi/i.test(n) };

  it('titulaire non remplacé : 90 minutes, 120 après prolongation', () => {
    expect(estimateMinutes({ ...base, starter: true })).toBe(90);
    expect(estimateMinutes({ ...base, starter: true, statusDetail: 'AET' })).toBe(120);
  });

  it('remplaçant entré à la 70e', () => {
    const keyEvents = [
      { typeText: 'Substitution', text: 'Substitution, Inter Miami CF. Lionel Messi replaces Tadeo Allende.', minute: "70'", scoringPlay: false, penaltyKick: false, ownGoal: false, shootout: false, participants: [] },
    ];
    expect(estimateMinutes({ ...base, starter: false, subbedIn: true, keyEvents })).toBe(20);
  });

  it('remplacé sans minute connue : inconnu', () => {
    expect(estimateMinutes({ ...base, starter: true, subbedOut: true })).toBeNull();
  });
});
