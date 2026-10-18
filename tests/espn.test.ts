import { describe, expect, it } from 'vitest';
import { classifyBodyPart, classifyGoalZone, isShotLine, shooterOf } from '../shared/goalText.ts';
import { seasonFor } from '../shared/metrics.ts';
import { estimateMinutes, parseMinute, parseScoreboard, parseSummary, type SummaryContext } from '../server/espn/parse.ts';
import { ATLANTA, MIAMI, NYRB, messiBraceSummary, ronaldoLiveSummary, ronaldoSaudiSummary, schedule, scheduleEvent } from './fixtures/espn.ts';

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
  league: 'afc.champions',
  competition: 'Ligue des champions AFC',
  season: (d) => seasonFor(d, 'split'),
};

describe('classement des buts et des tirs à partir du commentaire', () => {
  it.each([
    ['converts the penalty with a right footed shot to the bottom left corner', 'penalty', 'right'],
    ['Penalty saved! Cristiano Ronaldo (Al Nassr) fails to capitalise on this great opportunity, right footed shot saved', 'penalty', 'right'],
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

  it('reconnaît les lignes de tir et le tireur', () => {
    const saved = 'Attempt saved. Lionel Messi (Inter Miami CF) left footed shot from outside the box is saved in the top right corner by Lucas Hoyos (Atlanta United).';
    const goal = 'Goal! Atlanta United 0, Inter Miami CF 2. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box.';
    const post = 'Cristiano Ronaldo (Al Nassr) right footed shot from outside the box hits the left post.';
    expect([saved, goal, post].map(isShotLine)).toEqual([true, true, true]);
    expect(isShotLine('Foul by Lionel Messi (Inter Miami CF).')).toBe(false);
    expect(isShotLine("Own Goal by Anvarjon G'ofurov, Neftchi.")).toBe(false);
    expect([saved, goal, post].map(shooterOf)).toEqual(['Lionel Messi', 'Lionel Messi', 'Cristiano Ronaldo']);
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

describe('calendrier d’équipe', () => {
  it('lit les matchs, statuts et scores (score sous forme d’objet)', () => {
    const json = schedule(MIAMI, [
      scheduleEvent('761880', '2026-10-17T23:30Z', ATLANTA, MIAMI, 'post', [1, 3]),
      scheduleEvent('761891', '2026-10-24T21:30Z', NYRB, MIAMI, 'pre'),
    ]);
    const events = parseScoreboard(json, 'usa.1', 'MLS');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: '761880', competition: 'MLS', state: 'post', statusDetail: 'FT' });
    expect(events[0]?.competitors[1]).toMatchObject({ homeAway: 'away', team: { id: '20232', name: 'Inter Miami CF', score: 3 } });
    expect(events[1]).toMatchObject({ state: 'pre' });
    expect(events[1]?.competitors[0]?.team.score).toBeNull();
  });

  it('ignore un contenu inattendu sans lever d’erreur', () => {
    expect(parseScoreboard(null, 'usa.1', 'MLS')).toEqual([]);
    expect(parseScoreboard({ events: [{}, { id: 'x' }] }, 'usa.1', 'MLS')).toEqual([]);
  });
});

describe('parseSummary', () => {
  it('extrait la ligne de Messi (Atlanta 1-3 Inter Miami) et ses tirs par zone', () => {
    const m = parseSummary(messiBraceSummary(), messiCtx);
    expect(m).toMatchObject({
      eventId: '761880',
      season: '2026',
      state: 'post',
      homeAway: 'away',
      team: { name: 'Inter Miami CF', score: 3 },
      opponent: { name: 'Atlanta United FC', score: 1 },
      inSquad: true,
      played: true,
      starter: true,
      goals: 2,
      assists: 0,
      shots: 5,
      shotsOnTarget: 4,
      minutes: 85,
      lineupsAvailable: true,
    });
    expect(m?.goalDetails.map((g) => [g.minute, g.zone, g.bodyPart])).toEqual([
      ["56'", 'insideBox', 'left'],
      ["60'", 'insideBox', 'left'],
    ]);
    expect(m?.attempts).toEqual({
      insideBox: { shots: 2, goals: 2 },
      outsideBox: { shots: 2, goals: 0 },
      freeKick: { shots: 1, goals: 0 },
      penalty: { shots: 0, goals: 0 },
    });
  });

  it('suit un match en cours', () => {
    const m = parseSummary(ronaldoLiveSummary(), ronaldoCtx);
    expect(m).toMatchObject({ state: 'in', clock: "67'", season: '2026/27', goals: 1, minutes: 67 });
    expect(m?.goalDetails[0]).toMatchObject({ zone: 'penalty', bodyPart: 'right' });
    expect(m?.attempts?.penalty).toEqual({ shots: 1, goals: 1 });
    expect(m?.attempts?.insideBox).toEqual({ shots: 1, goals: 0 });
  });

  it('championnat saoudien : sans commentaire détaillé ni tirs fiables, les données sont marquées inconnues', () => {
    const m = parseSummary(ronaldoSaudiSummary(), { ...ronaldoCtx, league: 'ksa.1', competition: 'Saudi Pro League' });
    expect(m).toMatchObject({ goals: 1, shots: null, shotsOnTarget: null, attempts: null });
    expect(m?.goalDetails[0]).toMatchObject({ zone: null });
  });

  it('compte les stats depuis le fil d’actions si les stats individuelles manquent', () => {
    const json = messiBraceSummary();
    for (const r of json.rosters) for (const p of r.roster) p.stats = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ goals: 2, assists: 0, shots: null });
  });

  it('marque le joueur absent s’il ne figure pas dans la composition', () => {
    const json = messiBraceSummary();
    json.rosters[1]!.roster = json.rosters[1]!.roster.filter((p) => p.athlete.id !== '45843');
    json.keyEvents = [];
    json.commentary = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ inSquad: false, played: false, goals: 0, minutes: 0 });
  });

  it('se fie au fil d’actions quand les compositions sont absentes', () => {
    const json = messiBraceSummary();
    for (const r of json.rosters) r.roster = [];
    const m = parseSummary(json, messiCtx);
    expect(m).toMatchObject({ lineupsAvailable: false, played: true, goals: 2, minutes: null });
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
