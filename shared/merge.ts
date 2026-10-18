import {
  BODY_PARTS,
  GOAL_ZONES,
  PLAYER_IDS,
  type AppState,
  type Baseline,
  type BodyPart,
  type Delta,
  type GoalZone,
  type LiveData,
  type LiveInfo,
  type PlayerBaseline,
  type PlayerLiveData,
  type PlayerMatch,
  type PlayerState,
  type SeasonLine,
  type TeamSplit,
  type ZoneAttempts,
  type ZoneRate,
} from './types.ts';

/** En dessous de ce nombre de tentatives, une zone n'est pas comparée aux autres. */
export const MIN_ATTEMPTS_FOR_RANKING = 15;

function countsOf<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

export function emptyAttempts(): ZoneAttempts {
  return Object.fromEntries(GOAL_ZONES.map((z) => [z, { shots: 0, goals: 0 }])) as ZoneAttempts;
}

export function emptyDelta(): Delta {
  return {
    apps: 0,
    goals: 0,
    assists: 0,
    minutes: 0,
    minutesUnknown: 0,
    shots: 0,
    shotsOnTarget: 0,
    shotSampleGoals: 0,
    hatTricks: 0,
    zones: countsOf(GOAL_ZONES),
    bodyParts: countsOf(BODY_PARTS),
    unclassifiedGoals: 0,
    attempts: emptyAttempts(),
    detailedMatches: 0,
  };
}

export function emptyLiveData(): LiveData {
  return { messi: { completed: [], live: null, next: null }, ronaldo: { completed: [], live: null, next: null } };
}

/** Ajoute la contribution d'un match à un delta (sans effet si le joueur n'est pas entré en jeu). */
export function addMatch(delta: Delta, m: PlayerMatch): Delta {
  if (!m.played) return delta;
  delta.apps += 1;
  delta.goals += m.goals;
  delta.assists += m.assists;
  if (m.minutes == null) delta.minutesUnknown += 1;
  else delta.minutes += m.minutes;
  if (m.shots != null) {
    delta.shots += m.shots;
    delta.shotsOnTarget += m.shotsOnTarget ?? 0;
    delta.shotSampleGoals += m.goals;
  }
  if (m.goals >= 3) delta.hatTricks += 1;

  // Les détails proviennent du fil d'actions ; s'il en manque, les buts restants sont non classés.
  let classified = 0;
  for (const g of m.goalDetails.slice(0, m.goals)) {
    if (g.zone) {
      delta.zones[g.zone] += 1;
      classified += 1;
    }
    if (g.bodyPart) delta.bodyParts[g.bodyPart] += 1;
  }
  delta.unclassifiedGoals += m.goals - classified;

  if (m.attempts) {
    delta.detailedMatches += 1;
    for (const z of GOAL_ZONES) {
      delta.attempts[z].shots += m.attempts[z].shots;
      delta.attempts[z].goals += m.attempts[z].goals;
    }
  }
  return delta;
}

/**
 * Taux de réussite par zone : penalties et coups francs partent des chiffres de
 * référence, complétés par les matchs suivis ; la surface et le hors-surface en
 * jeu ne sont connus que pour les matchs suivis avec fil d'actions détaillé.
 */
export function zoneRates(base: PlayerBaseline, delta: Delta): Record<GoalZone, ZoneRate> {
  const rate = (scored: number, attempts: number, scope: string): ZoneRate => ({
    scored,
    attempts,
    rate: attempts > 0 ? scored / attempts : null,
    sufficient: attempts >= MIN_ATTEMPTS_FOR_RANKING,
    scope,
  });
  const { penalty, freeKick } = base.conversion;
  const a = delta.attempts;
  const tracked = 'matchs suivis depuis la date de référence';
  return {
    penalty: rate(penalty.scored + a.penalty.goals, penalty.attempts + a.penalty.shots, penalty.scope),
    freeKick: rate(freeKick.scored + a.freeKick.goals, freeKick.attempts + a.freeKick.shots, freeKick.scope),
    insideBox: rate(a.insideBox.goals, a.insideBox.shots, tracked),
    outsideBox: rate(a.outsideBox.goals, a.outsideBox.shots, tracked),
  };
}

/** Meilleure et plus faible zone parmi celles dont l'échantillon est suffisant. */
export function bestAndWorstZones(rates: Record<GoalZone, ZoneRate>): { best: GoalZone | null; worst: GoalZone | null } {
  const ranked = GOAL_ZONES.filter((z) => rates[z].sufficient && rates[z].rate != null).sort(
    (x, y) => (rates[y].rate ?? 0) - (rates[x].rate ?? 0),
  );
  if (ranked.length < 2) return { best: ranked[0] ?? null, worst: null };
  return { best: ranked[0]!, worst: ranked.at(-1)! };
}

function addCounts<K extends string>(a: Record<K, number>, b: Record<K, number>): Record<K, number> {
  const out = { ...a };
  for (const k of Object.keys(b) as K[]) out[k] = (out[k] ?? 0) + b[k];
  return out;
}

function mergeTeams(base: TeamSplit[], matches: PlayerMatch[]): TeamSplit[] {
  const teams = base.map((t) => ({ ...t }));
  for (const m of matches) {
    if (!m.played) continue;
    let team = teams.find((t) => t.key === m.teamKey);
    if (!team) {
      // Nouveau club (transfert après la date de référence).
      team = { key: m.teamKey, name: m.team.name, kind: m.teamKind, from: m.date.slice(0, 4), to: null, apps: 0, goals: 0 };
      teams.push(team);
    }
    team.apps += 1;
    team.goals += m.goals;
  }
  return teams;
}

function mergeSeasons(base: SeasonLine[], matches: PlayerMatch[]): SeasonLine[] {
  const seasons = base.map((s) => ({ ...s }));
  for (const m of matches) {
    if (!m.played || m.teamKind !== 'club') continue;
    let line = seasons.find((s) => s.season === m.season && s.teamKey === m.teamKey);
    if (!line) {
      line = { season: m.season, teamKey: m.teamKey, apps: 0, goals: 0 };
      seasons.push(line);
    }
    line.apps += 1;
    line.goals += m.goals;
  }
  return seasons;
}

export function buildPlayerState(base: PlayerBaseline, live: PlayerLiveData, asOf: string): PlayerState {
  const cutoff = Date.parse(asOf);
  // Un match antérieur à la date de référence est déjà compté dans les totaux.
  const completed = live.completed
    .filter((m) => Date.parse(m.date) > cutoff && m.state === 'post')
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const current = live.live && Date.parse(live.live.date) > cutoff ? live.live : null;
  const counted = current ? [...completed, current] : completed;

  const delta = counted.reduce(addMatch, emptyDelta());
  const liveDelta = current ? addMatch(emptyDelta(), current) : emptyDelta();

  return {
    baseline: base,
    totals: {
      apps: base.totals.apps + delta.apps,
      goals: base.totals.goals + delta.goals,
      assists: base.totals.assists + delta.assists,
      minutes: base.totals.minutes + delta.minutes,
      hatTricks: base.hatTricks.count + delta.hatTricks,
    },
    delta,
    liveDelta,
    teams: mergeTeams(base.teams, counted),
    seasons: mergeSeasons(base.seasons, counted),
    zones: addCounts<GoalZone>(base.zones.parts, delta.zones),
    bodyParts: addCounts<BodyPart>(base.bodyParts.parts, delta.bodyParts),
    conversion: zoneRates(base, delta),
    recent: completed,
    live: current,
    next: live.next,
  };
}

export function buildAppState(baseline: Baseline, live: LiveData, info: LiveInfo, now: Date = new Date()): AppState {
  const players = Object.fromEntries(
    PLAYER_IDS.map((id) => [id, buildPlayerState(baseline.players[id], live[id], baseline.asOf)]),
  ) as Record<(typeof PLAYER_IDS)[number], PlayerState>;
  return {
    generatedAt: now.toISOString(),
    baselineAsOf: baseline.asOf,
    live: info,
    players,
    sources: baseline.sources,
  };
}
