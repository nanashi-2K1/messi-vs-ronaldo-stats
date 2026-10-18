import type { PlayerId, TeamKind } from '../shared/types.ts';

export interface TrackedLeague {
  /** Identifiant de compétition ESPN, ex. "usa.1" pour la MLS. */
  slug: string;
  name: string;
  /** Variantes du calendrier d'équipe à interroger (« » : résultats, « fixture=true » : matchs à venir). */
  queries?: string[];
}

export interface TrackedTeam {
  /** Doit correspondre à TeamSplit.key dans shared/baseline.ts. */
  key: string;
  kind: TeamKind;
  /** Identifiant de l'équipe chez ESPN (calendrier, feuilles de match). */
  espnId: string;
  /** Identifiant de l'équipe chez API-Football (statistiques complémentaires). */
  apiFootballId: number;
  /** Repli si l'identifiant change : nom de l'équipe dans les flux. */
  names: RegExp;
  seasonFormat: 'calendar' | 'split';
  leagues: TrackedLeague[];
}

export interface TrackedPlayer {
  id: PlayerId;
  espnAthleteId: string;
  apiFootballId: number;
  /** Repli si l'identifiant change : nom complet attendu dans les compositions ESPN. */
  name: RegExp;
  /** Repli pour API-Football, qui abrège les prénoms (« L. Messi »). */
  lastName: RegExp;
  teams: TrackedTeam[];
}

export const DEFAULT_QUERIES = ['', 'fixture=true'];

/*
 * Équipes et compétitions surveillées (identifiants ESPN vérifiés le 18/10/2026).
 * Messi a fait ses adieux à l'Argentine en septembre 2026 : seule l'Inter Miami est
 * suivie. Après un transfert, ajouter une entrée ici : la nouvelle équipe apparaît
 * automatiquement dans la répartition par club.
 */
export const TRACKED_PLAYERS: TrackedPlayer[] = [
  {
    id: 'messi',
    espnAthleteId: '45843',
    apiFootballId: 154,
    name: /lionel (andr[eé]s )?messi/i,
    lastName: /\bmessi\b/i,
    teams: [
      {
        key: 'inter-miami',
        kind: 'club',
        espnId: '20232',
        apiFootballId: 9568,
        names: /inter miami/i,
        seasonFormat: 'calendar',
        leagues: [
          // seasontype=3 : phase finale (playoffs MLS).
          { slug: 'usa.1', name: 'MLS', queries: ['', 'fixture=true', 'seasontype=3', 'seasontype=3&fixture=true'] },
          { slug: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
          { slug: 'concacaf.leagues.cup', name: 'Leagues Cup' },
        ],
      },
    ],
  },
  {
    id: 'ronaldo',
    espnAthleteId: '22774',
    apiFootballId: 874,
    name: /cristiano ronaldo/i,
    lastName: /\bronaldo\b/i,
    teams: [
      {
        key: 'al-nassr',
        kind: 'club',
        espnId: '817',
        apiFootballId: 2939,
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
        espnId: '482',
        apiFootballId: 27,
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
