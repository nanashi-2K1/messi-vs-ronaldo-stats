// Réponses ESPN minimales reproduisant la structure de site.api.espn.com (scoreboard / summary).

export const MIAMI = { id: '20232', displayName: 'Inter Miami CF', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png' };
export const ATLANTA = { id: '18418', displayName: 'Atlanta United FC', abbreviation: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18418.png' };
export const NASHVILLE = { id: '18986', displayName: 'Nashville SC', abbreviation: 'NSH' };
export const NASSR = { id: '817', displayName: 'Al Nassr', abbreviation: 'NSR' };
export const HILAL = { id: '929', displayName: 'Al Hilal', abbreviation: 'HIL' };

type Team = { id: string; displayName: string; abbreviation: string; logo?: string };

export function statusOf(state: 'pre' | 'in' | 'post', detail: string, displayClock = "0'") {
  return {
    clock: 0,
    displayClock,
    period: state === 'pre' ? 0 : 2,
    type: { state, completed: state === 'post', detail, shortDetail: detail, description: detail },
  };
}

export function scoreboardEvent(
  id: string,
  date: string,
  home: Team,
  away: Team,
  state: 'pre' | 'in' | 'post',
  score: [number, number] = [0, 0],
  detail = state === 'post' ? 'FT' : state === 'in' ? "67'" : 'Sat, October 25th',
) {
  return {
    id,
    date,
    name: `${away.displayName} at ${home.displayName}`,
    status: statusOf(state, detail, state === 'in' ? "67'" : "90'"),
    competitions: [
      {
        id,
        date,
        competitors: [
          { id: home.id, homeAway: 'home', score: String(score[0]), team: home },
          { id: away.id, homeAway: 'away', score: String(score[1]), team: away },
        ],
      },
    ],
  };
}

export function scoreboard(leagueName: string, events: unknown[]) {
  return { leagues: [{ id: '770', name: leagueName, abbreviation: leagueName }], events };
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
    athlete: { id: p.id, displayName: p.name },
    stats: Object.entries(p.stats ?? {}).map(([name, value]) => ({ name, value, displayValue: String(value) })),
  };
}

interface SummaryInput {
  id: string;
  date: string;
  home: Team;
  away: Team;
  score: [number, number];
  state: 'pre' | 'in' | 'post';
  detail?: string;
  clock?: string;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
  keyEvents: unknown[];
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

export const MESSI: [string, string] = ['45843', 'Lionel Messi'];
export const SUAREZ: [string, string] = ['11745', 'Luis Suárez'];
export const RONALDO: [string, string] = ['22774', 'Cristiano Ronaldo'];

/** Inter Miami 3-1 Atlanta : doublé de Messi (coup franc + pied gauche dans la surface) et une passe décisive. */
export function messiBraceSummary() {
  return summary({
    id: '692900',
    date: '2026-10-17T23:30Z',
    home: MIAMI,
    away: ATLANTA,
    score: [3, 1],
    state: 'post',
    homeRoster: [
      { id: MESSI[0], name: MESSI[1], starter: true, subbedOut: true, stats: { appearances: 1, totalGoals: 2, goalAssists: 1, totalShots: 5, shotsOnTarget: 3, yellowCards: 0, redCards: 0 } },
      { id: SUAREZ[0], name: SUAREZ[1], starter: true, stats: { appearances: 1, totalGoals: 1, goalAssists: 0 } },
      { id: '999', name: 'Tadeo Allende', starter: false, subbedIn: true, stats: { appearances: 1, subIns: 1 } },
    ],
    awayRoster: [{ id: '501', name: 'Saba Lobjanidze', starter: true, stats: { appearances: 1, totalGoals: 1 } }],
    keyEvents: [
      goalEvent(
        "21'",
        'Goal! Inter Miami CF 1, Atlanta United FC 0. Lionel Messi (Inter Miami CF) left footed shot from outside the box to the top left corner from a direct free kick.',
        MESSI,
        undefined,
        'Goal - Free-kick',
      ),
      goalEvent(
        "38'",
        'Goal! Inter Miami CF 2, Atlanta United FC 0. Luis Suárez (Inter Miami CF) right footed shot from the centre of the box to the bottom right corner. Assisted by Lionel Messi with a through ball.',
        SUAREZ,
        MESSI,
      ),
      goalEvent("55'", 'Goal! Inter Miami CF 2, Atlanta United FC 1. Saba Lobjanidze (Atlanta United FC) header from very close range.', ['501', 'Saba Lobjanidze']),
      goalEvent(
        "71'",
        'Goal! Inter Miami CF 3, Atlanta United FC 1. Lionel Messi (Inter Miami CF) left footed shot from the left side of the box to the bottom right corner. Assisted by Luis Suárez.',
        MESSI,
        SUAREZ,
      ),
      subEvent("85'", 'Substitution, Inter Miami CF. Tadeo Allende replaces Lionel Messi.'),
    ],
  });
}

/** Al Nassr - Al Hilal en cours (67e) : Ronaldo a transformé un penalty. */
export function ronaldoLiveSummary() {
  return summary({
    id: '716300',
    date: '2026-10-18T17:00Z',
    home: NASSR,
    away: HILAL,
    score: [1, 0],
    state: 'in',
    clock: "67'",
    detail: "67'",
    homeRoster: [{ id: RONALDO[0], name: RONALDO[1], starter: true, stats: { appearances: 1, totalGoals: 1, goalAssists: 0, totalShots: 3, shotsOnTarget: 2 } }],
    awayRoster: [],
    keyEvents: [
      goalEvent(
        "34'",
        'Goal! Al Nassr 1, Al Hilal 0. Cristiano Ronaldo (Al Nassr) converts the penalty with a right footed shot to the bottom left corner.',
        RONALDO,
        undefined,
        'Penalty - Scored',
      ),
    ],
  });
}
