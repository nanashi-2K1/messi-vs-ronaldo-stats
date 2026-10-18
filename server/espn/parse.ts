import { classifyBodyPart, classifyGoalZone, isShotLine, shooterOf } from '../../shared/goalText.ts';
import { emptyAttempts } from '../../shared/merge.ts';
import type { GoalDetail, MatchState, MatchTeam, PlayerMatch, TeamKind, ZoneAttempts } from '../../shared/types.ts';

/*
 * Lecture défensive des réponses JSON (non officielles) de site.api.espn.com.
 * Chaque champ est optionnel : un format inattendu donne une valeur nulle,
 * jamais une exception.
 */

type Obj = Record<string, unknown>;

const obj = (x: unknown): Obj => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : {});
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown): string | undefined =>
  typeof x === 'string' && x.length > 0 ? x : typeof x === 'number' ? String(x) : undefined;
const num = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return null;
};
const flag = (x: unknown): boolean => x === true || obj(x).didSub === true;

export interface ScoreboardCompetitor {
  homeAway: 'home' | 'away';
  team: MatchTeam;
}

export interface ScoreboardEvent {
  id: string;
  league: string;
  competition: string;
  date: string;
  state: MatchState;
  statusDetail: string;
  clock?: string;
  competitors: ScoreboardCompetitor[];
}

function parseState(x: unknown): MatchState {
  const s = str(x);
  return s === 'in' || s === 'post' ? s : 'pre';
}

function parseScore(x: unknown): number | null {
  return num(x) ?? num(obj(x).value) ?? num(obj(x).displayValue);
}

function parseTeam(competitor: Obj): MatchTeam {
  const team = obj(competitor.team);
  return {
    id: str(team.id) ?? str(competitor.id) ?? '',
    name: str(team.displayName) ?? str(team.name) ?? str(team.shortDisplayName) ?? 'Équipe inconnue',
    abbreviation: str(team.abbreviation) ?? '',
    logo: str(team.logo) ?? str(obj(arr(team.logos)[0]).href),
    score: parseScore(competitor.score),
  };
}

function parseCompetitors(competition: Obj): ScoreboardCompetitor[] {
  return arr(competition.competitors).map((c) => {
    const o = obj(c);
    return { homeAway: o.homeAway === 'away' ? 'away' : 'home', team: parseTeam(o) };
  });
}

function parseStatus(status: Obj): { state: MatchState; detail: string; clock?: string } {
  const type = obj(status.type);
  return {
    state: parseState(type.state),
    detail: str(type.shortDetail) ?? str(type.detail) ?? str(type.description) ?? '',
    clock: str(status.displayClock),
  };
}

export function parseScoreboard(json: unknown, league: string, fallbackName: string): ScoreboardEvent[] {
  const root = obj(json);
  const competition = str(obj(arr(root.leagues)[0]).name) ?? fallbackName;
  const out: ScoreboardEvent[] = [];
  for (const e of arr(root.events)) {
    const ev = obj(e);
    const comp = obj(arr(ev.competitions)[0]);
    const id = str(ev.id) ?? str(comp.id);
    const date = str(ev.date) ?? str(comp.date);
    if (!id || !date) continue;
    const status = parseStatus(obj(ev.status ?? comp.status));
    out.push({
      id,
      league,
      competition,
      date,
      state: status.state,
      statusDetail: status.detail,
      clock: status.clock,
      competitors: parseCompetitors(comp),
    });
  }
  return out;
}

/** Minute de jeu à partir d'un libellé ESPN ("67'", "90'+3'", "45+2'"). */
export function parseMinute(display: string | undefined): number | null {
  if (!display) return null;
  const m = /(\d+)\s*'?\s*(?:\+\s*(\d+))?/.exec(display);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

export interface SummaryContext {
  athleteId: string;
  playerName: RegExp;
  teamKey: string;
  teamKind: TeamKind;
  teamNames: RegExp;
  league: string;
  competition: string;
  season: (date: string) => string;
}

interface KeyEvent {
  typeText: string;
  text: string;
  minute: string;
  scoringPlay: boolean;
  penaltyKick: boolean;
  ownGoal: boolean;
  shootout: boolean;
  participants: { id?: string; name?: string }[];
}

function parseKeyEvents(root: Obj, comp: Obj): KeyEvent[] {
  const source = arr(root.keyEvents).length > 0 ? arr(root.keyEvents) : arr(comp.details);
  return source.map((k) => {
    const o = obj(k);
    const type = obj(o.type);
    const people = arr(o.participants).length > 0 ? arr(o.participants) : arr(o.athletesInvolved);
    return {
      typeText: str(type.text) ?? str(type.type) ?? '',
      text: str(o.text) ?? str(o.shortText) ?? '',
      minute: str(obj(o.clock).displayValue) ?? '',
      scoringPlay: o.scoringPlay === true,
      penaltyKick: o.penaltyKick === true,
      ownGoal: o.ownGoal === true || /own goal/i.test(str(type.text) ?? ''),
      shootout: o.shootout === true || /shootout/i.test(str(type.text) ?? '') || (num(obj(o.period).number) ?? 0) >= 5,
      participants: people.map((p) => {
        const a = obj(obj(p).athlete ?? p);
        return { id: str(a.id), name: str(a.displayName) ?? str(a.fullName) };
      }),
    };
  });
}

function isGoal(k: KeyEvent): boolean {
  return (k.scoringPlay || /^goal|penalty - scored/i.test(k.typeText)) && !k.ownGoal && !k.shootout;
}

/**
 * Tirs du joueur par zone, à partir du commentaire détaillé (« Attempt saved. … from outside the box … »).
 * Renvoie null si le match n'a pas de commentaire tir par tir (cas du championnat saoudien chez ESPN).
 */
export function parseAttempts(root: Obj, isPlayerName: (name: string) => boolean): ZoneAttempts | null {
  const lines = arr(root.commentary).map((c) => {
    const o = obj(c);
    const play = obj(o.play);
    const first = obj(obj(arr(play.participants)[0]).athlete);
    return { text: str(o.text) ?? '', shooter: str(first.displayName), period: num(obj(play.period).number) };
  });
  if (!lines.some((l) => /^attempt (missed|saved|blocked)\./i.test(l.text))) return null;

  const attempts = emptyAttempts();
  for (const l of lines) {
    if (!isShotLine(l.text) || (l.period ?? 0) >= 5) continue;
    const shooter = shooterOf(l.text) ?? l.shooter;
    if (!shooter || !isPlayerName(shooter)) continue;
    const zone = classifyGoalZone(l.text);
    if (!zone) continue;
    attempts[zone].shots += 1;
    if (/^goal!/i.test(l.text)) attempts[zone].goals += 1;
  }
  return attempts;
}

export function parseSummary(json: unknown, ctx: SummaryContext, fallback?: ScoreboardEvent): PlayerMatch | null {
  const root = obj(json);
  const header = obj(root.header);
  const comp = obj(arr(header.competitions)[0]);
  const date = str(comp.date) ?? fallback?.date;
  const eventId = str(header.id) ?? str(comp.id) ?? fallback?.id;
  if (!date || !eventId) return null;

  const status = comp.status ? parseStatus(obj(comp.status)) : null;
  const state = status?.state ?? fallback?.state ?? 'pre';
  const statusDetail = status?.detail || fallback?.statusDetail || '';
  const clock = status?.clock ?? fallback?.clock;
  const competitors = arr(comp.competitors).length > 0 ? parseCompetitors(comp) : (fallback?.competitors ?? []);

  const isPlayer = (p: { id?: string; name?: string }) =>
    (p.id != null && p.id === ctx.athleteId) || (p.name != null && ctx.playerName.test(p.name));

  // Recherche du joueur dans les compositions.
  const rosters = arr(root.rosters).map(obj);
  const lineupsAvailable = rosters.some((r) => arr(r.roster).length > 0);
  let entry: Obj | null = null;
  let rosterTeamId: string | undefined;
  for (const r of rosters) {
    for (const p of arr(r.roster)) {
      const a = obj(obj(p).athlete);
      if (isPlayer({ id: str(a.id), name: str(a.displayName) ?? str(a.fullName) })) {
        entry = obj(p);
        rosterTeamId = str(obj(r.team).id);
      }
    }
  }

  const ours =
    competitors.find((c) => rosterTeamId != null && c.team.id === rosterTeamId) ??
    competitors.find((c) => ctx.teamNames.test(c.team.name)) ??
    competitors[0];
  const theirs = competitors.find((c) => c !== ours);
  if (!ours || !theirs) return null;

  const stats = new Map<string, number>();
  for (const s of arr(entry?.stats)) {
    const o = obj(s);
    const name = str(o.name);
    const value = num(o.value) ?? num(o.displayValue);
    if (name && value != null) stats.set(name, value);
  }
  const stat = (name: string) => stats.get(name) ?? null;

  const keyEvents = parseKeyEvents(root, comp);
  const goalEvents = keyEvents.filter((k) => isGoal(k) && k.participants[0] && isPlayer(k.participants[0]));
  const assistEvents = keyEvents.filter(
    (k) =>
      isGoal(k) &&
      ((k.participants[1] != null && isPlayer(k.participants[1])) ||
        (/assisted by ([^.]+)/i.exec(k.text)?.[1] ?? '').match(ctx.playerName) != null),
  );

  const goalDetails: GoalDetail[] = goalEvents.map((k) => ({
    minute: k.minute,
    zone: classifyGoalZone(k.text, { penaltyKick: k.penaltyKick, typeText: k.typeText }),
    bodyPart: classifyBodyPart(k.text, { typeText: k.typeText }),
    description: k.text || undefined,
  }));

  const goals = stat('totalGoals') ?? goalEvents.length;
  const assists = stat('goalAssists') ?? assistEvents.length;
  // Certains flux renvoient 0 tir malgré des buts (championnat saoudien) : la donnée est alors inexploitable.
  const rawShots = stat('totalShots');
  const shotsKnown = rawShots != null && rawShots >= goals;
  const starter = entry?.starter === true;
  const subbedIn = flag(entry?.subbedIn) || (stat('subIns') ?? 0) > 0;
  const played =
    state !== 'pre' &&
    (starter || subbedIn || (stat('appearances') ?? 0) > 0 || (!lineupsAvailable && goals + assists > 0));

  return {
    eventId,
    league: ctx.league,
    competition: ctx.competition,
    date,
    season: ctx.season(date),
    state,
    statusDetail,
    clock,
    teamKey: ctx.teamKey,
    teamKind: ctx.teamKind,
    homeAway: ours.homeAway,
    team: ours.team,
    opponent: theirs.team,
    lineupsAvailable,
    inSquad: entry != null || played,
    played,
    starter,
    minutes: played
      ? estimateMinutes({
          starter,
          subbedIn,
          subbedOut: flag(entry?.subbedOut),
          state,
          statusDetail,
          clock,
          keyEvents,
          isPlayer: (name) => ctx.playerName.test(name),
        })
      : 0,
    goals,
    assists,
    shots: shotsKnown ? rawShots : null,
    shotsOnTarget: shotsKnown ? stat('shotsOnTarget') : null,
    yellowCards: stat('yellowCards') ?? 0,
    redCards: stat('redCards') ?? 0,
    goalDetails,
    attempts: parseAttempts(root, (name) => ctx.playerName.test(name)),
  };
}

interface MinutesInput {
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  state: MatchState;
  statusDetail: string;
  clock?: string;
  keyEvents: KeyEvent[];
  isPlayer: (name: string) => boolean;
}

/**
 * Temps de jeu estimé à partir des remplacements et cartons rouges du fil d'actions
 * (« Substitution, Inter Miami CF. X replaces Lionel Messi. »). Renvoie null si
 * l'information manque.
 */
export function estimateMinutes(i: MinutesInput): number | null {
  const extraTime = /aet|a\.e\.t|extra time|pen/i.test(i.statusDetail);
  const end = i.state === 'in' ? parseMinute(i.clock) : extraTime ? 120 : 90;
  if (end == null) return null;

  let inMinute: number | null = i.starter ? 0 : null;
  let outMinute: number | null = null;
  for (const k of i.keyEvents) {
    if (/substitution/i.test(k.typeText) || /replaces/i.test(k.text)) {
      const m = /([^.,]+?) replaces ([^.]+?)(?: because of an injury)?\.?$/i.exec(k.text.trim());
      if (!m) continue;
      const [, playerIn = '', playerOut = ''] = m;
      if (i.isPlayer(playerIn)) inMinute = parseMinute(k.minute);
      if (i.isPlayer(playerOut)) outMinute = parseMinute(k.minute);
    } else if (/red card/i.test(k.typeText) && k.participants.some((p) => p.name && i.isPlayer(p.name))) {
      outMinute = parseMinute(k.minute);
    }
  }
  if (inMinute == null) return null;
  if (i.subbedOut && outMinute == null) return null;
  return Math.max(1, Math.min(end, outMinute ?? end) - inMinute);
}
