import type { PlayerId, TeamKind } from '../shared/types.ts';

export interface TrackedLeague {
  /** Identifiant de compétition ESPN, ex. "usa.1" pour la MLS. */
  slug: string;
  name: string;
}

export interface TrackedTeam {
  /** Doit correspondre à TeamSplit.key dans shared/baseline.ts. */
  key: string;
  kind: TeamKind;
  /** Reconnaît le nom de l'équipe dans les flux ESPN. */
  names: RegExp;
  seasonFormat: 'calendar' | 'split';
  leagues: TrackedLeague[];
}

export interface TrackedPlayer {
  id: PlayerId;
  espnAthleteId: string;
  /** Repli si l'identifiant ESPN du joueur change : nom complet attendu dans les compositions. */
  name: RegExp;
  teams: TrackedTeam[];
}

/*
 * Équipes et compétitions surveillées. Messi a fait ses adieux à l'Argentine en
 * septembre 2026 : seule l'Inter Miami est suivie. Pour suivre un nouveau club
 * après un transfert, ajouter une entrée ici (la clé peut être nouvelle : la
 * ligne correspondante sera créée automatiquement dans la répartition par équipe).
 */
export const TRACKED_PLAYERS: TrackedPlayer[] = [
  {
    id: 'messi',
    espnAthleteId: '45843',
    name: /lionel (andr[eé]s )?messi/i,
    teams: [
      {
        key: 'inter-miami',
        kind: 'club',
        names: /inter miami/i,
        seasonFormat: 'calendar',
        leagues: [
          { slug: 'usa.1', name: 'MLS' },
          { slug: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
          { slug: 'concacaf.leagues.cup', name: 'Leagues Cup' },
          { slug: 'usa.open', name: 'US Open Cup' },
        ],
      },
    ],
  },
  {
    id: 'ronaldo',
    espnAthleteId: '22774',
    name: /cristiano ronaldo/i,
    teams: [
      {
        key: 'al-nassr',
        kind: 'club',
        names: /al[\s-]?nassr/i,
        seasonFormat: 'split',
        leagues: [
          { slug: 'ksa.1', name: 'Saudi Pro League' },
          { slug: 'afc.champions', name: 'Ligue des champions AFC' },
          { slug: 'ksa.kings.cup', name: 'Coupe du Roi' },
        ],
      },
      {
        key: 'portugal',
        kind: 'national',
        names: /^portugal$/i,
        seasonFormat: 'split',
        leagues: [
          { slug: 'uefa.nations', name: 'Ligue des nations' },
          { slug: 'fifa.friendly', name: 'Match amical international' },
          { slug: 'uefa.euroq', name: 'Qualifications Euro' },
          { slug: 'fifa.worldq.uefa', name: 'Qualifications Coupe du monde' },
        ],
      },
    ],
  },
];
