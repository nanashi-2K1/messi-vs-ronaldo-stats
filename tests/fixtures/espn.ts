// Réponses ESPN reproduisant la structure réelle de site.api.espn.com (relevée le 18/10/2026) :
// calendrier d'équipe (teams/{id}/schedule) et feuille de match (summary?event=).

export const MIAMI = { id: '20232', displayName: 'Inter Miami CF', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png' };
export const ATLANTA = { id: '18418', displayName: 'Atlanta United FC', abbreviation: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18418.png' };
export const NYRB = { id: '190', displayName: 'Red Bull New York', abbreviation: 'NY' };
export const NASSR = { id: '817', displayName: 'Al Nassr', abbreviation: 'NSR' };
export const NEOM = { id: '21900', displayName: 'Neom SC', abbreviation: 'NEO' };
export const NEFTCHI = { id: '5960', displayName: 'Neftchi Fergana', abbreviation: 'NEF' };

type Team = { id: string; displayName: string; abbreviation: string; logo?: string };
type State = 'pre' | 'in' | 'post';

export function statusOf(state: State, detail: string, displayClock = "0'") {
  return {
    clock: 0,
    displayClock,
    period: state === 'pre' ? 0 : 2,
    type: { state, completed: state === 'post', detail, shortDetail: detail, description: detail },
  };
}

/** Évènement tel que renvoyé par teams/{id}/schedule (score sous forme d'objet). */
export function scheduleEvent(id: string, date: string, home: Team, away: Team, state: State, score: [number, number] = [0, 0]) {
  const detail = state === 'post' ? 'FT' : state === 'in' ? "67'" : 'Sat, October 24th';
  return {
    id,
    date,
    name: `${away.displayName} at ${home.displayName}`,
    competitions: [
      {
        id,
        date,
        status: statusOf(state, detail, state === 'in' ? "67'" : "90'+5'"),
        competitors: [
          { id: home.id, homeAway: 'home', team: home, ...(state === 'pre' ? {} : { score: { value: score[0], displayValue: String(score[0]) } }) },
          { id: away.id, homeAway: 'away', team: away, ...(state === 'pre' ? {} : { score: { value: score[1], displayValue: String(score[1]) } }) },
        ],
      },
    ],
  };
}

export function schedule(team: Team, events: unknown[]) {
  return { timestamp: '2026-10-18T10:00Z', status: 'success', team, events };
}

interface RosterPlayer {
  id: string;
  name: string;
  starter: boolean;
  subbedIn?: boolean;
  subbedOut?: boolean;
  stats?: Record<string, number>;
}

function rosterEntry(p: RosterPlayer) {
  return {
    active: true,
    starter: p.starter,
    subbedIn: p.subbedIn ?? false,
    subbedOut: p.subbedOut ?? false,
    athlete: { id: p.id, displayName: p.name, fullName: p.name },
    stats: Object.entries(p.stats ?? {}).map(([name, value]) => ({ name, value, displayValue: String(value) })),
  };
}

interface SummaryInput {
  id: string;
  date: string;
  home: Team;
  away: Team;
  score: [number, number];
  state: State;
  detail?: string;
  clock?: string;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
  keyEvents: unknown[];
  commentary?: unknown[];
}

export function summary(s: SummaryInput) {
  return {
    header: {
      id: s.id,
      competitions: [
        {
          id: s.id,
          date: s.date,
          status: statusOf(s.state, s.detail ?? (s.state === 'post' ? 'FT' : (s.clock ?? '')), s.clock ?? "90'"),
          competitors: [
            { id: s.home.id, homeAway: 'home', score: String(s.score[0]), team: { ...s.home, logos: [{ href: 'home.png' }] } },
            { id: s.away.id, homeAway: 'away', score: String(s.score[1]), team: { ...s.away, logos: [{ href: 'away.png' }] } },
          ],
        },
      ],
    },
    rosters: [
      { homeAway: 'home', team: s.home, roster: s.homeRoster.map(rosterEntry) },
      { homeAway: 'away', team: s.away, roster: s.awayRoster.map(rosterEntry) },
    ],
    keyEvents: s.keyEvents,
    commentary: s.commentary ?? [],
  };
}

export function goalEvent(minute: string, text: string, scorer: [string, string], assister?: [string, string], typeText = 'Goal') {
  return {
    type: { id: '70', text: typeText },
    text,
    clock: { displayValue: minute },
    scoringPlay: true,
    participants: [scorer, ...(assister ? [assister] : [])].map(([id, displayName]) => ({ athlete: { id, displayName } })),
  };
}

export function subEvent(minute: string, text: string) {
  return { type: { id: '76', text: 'Substitution' }, text, clock: { displayValue: minute }, scoringPlay: false, participants: [] };
}

/** Ligne de commentaire Opta (le premier participant est le tireur). */
export function comment(minute: string, text: string, shooter?: string, typeText = 'Shot On Target') {
  return {
    time: { displayValue: minute },
    text,
    play: { type: { text: typeText }, period: { number: 2 }, participants: shooter ? [{ athlete: { displayName: shooter } }] : [] },
  };
}

export const MESSI: [string, string] = ['45843', 'Lionel Messi'];
export const SUAREZ: [string, string] = ['125088', 'Luis Suárez'];
export const BERTERAME: [string, string] = ['228394', 'Germán Berterame'];
export const RONALDO: [string, string] = ['22774', 'Cristiano Ronaldo'];

/** Atlanta 1-3 Inter Miami (17/10/2026) : doublé de Messi, du pied gauche dans la surface. */
export function messiBraceSummary() {
  return summary({
    id: '761880',
    date: '2026-10-17T23:30Z',
    home: ATLANTA,
    away: MIAMI,
    score: [1, 3],
    state: 'post',
    homeRoster: [{ id: '501', name: 'Saba Lobjanidze', starter: true, stats: { appearances: 1, totalGoals: 1 } }],
    awayRoster: [
      { id: MESSI[0], name: MESSI[1], starter: true, subbedOut: true, stats: { appearances: 1, totalGoals: 2, goalAssists: 0, totalShots: 5, shotsOnTarget: 4, yellowCards: 0, redCards: 0 } },
      { id: SUAREZ[0], name: SUAREZ[1], starter: true, stats: { appearances: 1, totalGoals: 0, goalAssists: 2 } },
      { id: BERTERAME[0], name: BERTERAME[1], starter: true, stats: { appearances: 1, totalGoals: 1, goalAssists: 1 } },
      { id: '999', name: 'Tadeo Allende', starter: false, subbedIn: true, stats: { appearances: 1, subIns: 1 } },
    ],
    keyEvents: [
      goalEvent(
        "45'",
        'Goal! Atlanta United 0, Inter Miami CF 1. Germán Berterame (Inter Miami CF) header from very close range to the bottom right corner. Assisted by Luis Suárez.',
        BERTERAME,
        SUAREZ,
        'Goal - Header',
      ),
      goalEvent(
        "56'",
        'Goal! Atlanta United 0, Inter Miami CF 2. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box to the centre of the goal. Assisted by Germán Berterame.',
        MESSI,
        BERTERAME,
      ),
      goalEvent(
        "60'",
        'Goal! Atlanta United 0, Inter Miami CF 3. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box to the bottom right corner. Assisted by Luis Suárez following a fast break.',
        MESSI,
        SUAREZ,
      ),
      subEvent("85'", 'Substitution, Inter Miami CF. Tadeo Allende replaces Lionel Messi.'),
      goalEvent("88'", 'Goal! Atlanta United 1, Inter Miami CF 3. Saba Lobjanidze (Atlanta United) right footed shot from the left side of the box.', ['501', 'Saba Lobjanidze']),
    ],
    commentary: [
      comment("18'", 'Foul by Lionel Messi (Inter Miami CF).', 'Lionel Messi', 'Foul'),
      comment("41'", 'Attempt saved. Lionel Messi (Inter Miami CF) left footed shot from outside the box is saved in the top right corner by Lucas Hoyos (Atlanta United).', 'Lionel Messi'),
      comment("44'", 'Attempt missed. Luis Suárez (Inter Miami CF) right footed shot from the centre of the box misses to the left.', 'Luis Suárez', 'Shot Off Target'),
      comment("48'", 'Attempt saved. Lionel Messi (Inter Miami CF) left footed shot from outside the box is saved in the centre of the goal by Lucas Hoyos (Atlanta United).', 'Lionel Messi'),
      comment("56'", 'Goal! Atlanta United 0, Inter Miami CF 2. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box to the centre of the goal. Assisted by Germán Berterame.', 'Lionel Messi', 'Goal'),
      comment("60'", 'Goal! Atlanta United 0, Inter Miami CF 3. Lionel Messi (Inter Miami CF) left footed shot from the centre of the box to the bottom right corner. Assisted by Luis Suárez following a fast break.', 'Lionel Messi', 'Goal'),
      comment("72'", 'Attempt missed. Lionel Messi (Inter Miami CF) left footed shot from outside the box is too high from a direct free kick.', 'Lionel Messi', 'Shot Off Target'),
    ],
  });
}

/** Al Nassr - Neftchi en cours (Ligue des champions AFC, commentaire Opta) : penalty transformé par Ronaldo. */
export function ronaldoLiveSummary() {
  return summary({
    id: '401912700',
    date: '2026-10-18T17:00Z',
    home: NASSR,
    away: NEFTCHI,
    score: [1, 0],
    state: 'in',
    clock: "67'",
    detail: "67'",
    homeRoster: [{ id: RONALDO[0], name: RONALDO[1], starter: true, stats: { appearances: 1, totalGoals: 1, goalAssists: 0, totalShots: 3, shotsOnTarget: 2 } }],
    awayRoster: [],
    keyEvents: [
      goalEvent(
        "34'",
        'Goal! Al Nassr 1, Neftchi 0. Cristiano Ronaldo (Al Nassr) converts the penalty with a right footed shot to the bottom left corner.',
        RONALDO,
        undefined,
        'Penalty - Scored',
      ),
    ],
    commentary: [
      comment("12'", 'Attempt blocked. Cristiano Ronaldo (Al Nassr) right footed shot from outside the box is blocked.', 'Cristiano Ronaldo', 'Blocked Shot'),
      comment("34'", 'Goal! Al Nassr 1, Neftchi 0. Cristiano Ronaldo (Al Nassr) converts the penalty with a right footed shot to the bottom left corner.', 'Cristiano Ronaldo', 'Goal'),
      comment("51'", 'Attempt missed. Cristiano Ronaldo (Al Nassr) left footed shot from the centre of the box misses to the left.', 'Cristiano Ronaldo', 'Shot Off Target'),
    ],
  });
}

/** Al Nassr - Neom (championnat saoudien) : pas de commentaire détaillé et 0 tir malgré un but. */
export function ronaldoSaudiSummary() {
  return summary({
    id: '401900446',
    date: '2026-10-20T18:00Z',
    home: NASSR,
    away: NEOM,
    score: [2, 0],
    state: 'post',
    homeRoster: [{ id: RONALDO[0], name: RONALDO[1], starter: true, stats: { appearances: 1, totalGoals: 1, goalAssists: 0, totalShots: 0, shotsOnTarget: 0 } }],
    awayRoster: [],
    keyEvents: [goalEvent("23'", "Cristiano Ronaldo (Al Nassr) Goal at 23'", RONALDO)],
    commentary: [comment("23'", "Cristiano Ronaldo (Al Nassr) Goal at 23'", 'Cristiano Ronaldo', 'Goal')],
  });
}
