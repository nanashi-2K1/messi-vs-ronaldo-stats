// Types partagés entre le serveur (suivi en direct) et l'interface.

export type PlayerId = 'messi' | 'ronaldo';
export const PLAYER_IDS: readonly PlayerId[] = ['messi', 'ronaldo'];

/** Zone d'où le but a été marqué. */
export type GoalZone = 'insideBox' | 'outsideBox' | 'penalty' | 'freeKick';
export const GOAL_ZONES: readonly GoalZone[] = ['insideBox', 'outsideBox', 'freeKick', 'penalty'];

/** Partie du corps utilisée pour marquer. */
export type BodyPart = 'left' | 'right' | 'head';
export const BODY_PARTS: readonly BodyPart[] = ['left', 'right', 'head'];

export type TeamKind = 'club' | 'national';

export interface Source {
  label: string;
  url?: string;
}

export interface TeamSplit {
  /** Identifiant stable, utilisé pour relier les matchs en direct à la bonne ligne. */
  key: string;
  name: string;
  kind: TeamKind;
  from: string;
  to: string | null;
  apps: number;
  goals: number;
}

export interface SeasonLine {
  /** "2008/09" pour une saison à cheval, "2025" pour une saison sur l'année civile (MLS). */
  season: string;
  /** Référence vers TeamSplit.key. */
  teamKey: string;
  apps: number;
  goals: number;
  /** Valeur reconstituée (différence entre totaux) plutôt que relevée directement. */
  estimated?: boolean;
}

/** Une répartition (zones ou surfaces de contact) relevée à une date donnée. */
export interface Breakdown<K extends string> {
  asOf: string;
  parts: Record<K, number>;
  source: Source;
  note?: string;
}

export interface CompetitionLine {
  label: string;
  goals: number;
  apps?: number;
  assists?: number;
}

export interface Honour {
  label: string;
  count: number;
  detail?: string;
}

export interface PlayerBaseline {
  id: PlayerId;
  name: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  position: string;
  preferredFoot: 'gauche' | 'droit';
  heightCm: number;
  currentClub: string;
  /** Totaux carrière (matchs officiels, club + sélection) à la date de référence. */
  totals: {
    apps: number;
    goals: number;
    assists: number;
    minutes: number;
  };
  hatTricks: { count: number; approximate: boolean; source: Source };
  teams: TeamSplit[];
  seasons: SeasonLine[];
  zones: Breakdown<GoalZone>;
  bodyParts: Breakdown<BodyPart>;
  competitions: CompetitionLine[];
  honours: Honour[];
}

export interface Baseline {
  /** Fin de la période couverte par les données de référence (ISO 8601, UTC). */
  asOf: string;
  players: Record<PlayerId, PlayerBaseline>;
  sources: Source[];
}

/* ----------------------------- Données en direct ----------------------------- */

export type MatchState = 'pre' | 'in' | 'post';

export interface MatchTeam {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
  score: number | null;
}

export interface GoalDetail {
  minute: string;
  zone: GoalZone | null;
  bodyPart: BodyPart | null;
  description?: string;
}

/** Ligne de stats d'un joueur pour un match suivi (en cours ou terminé). */
export interface PlayerMatch {
  eventId: string;
  league: string;
  competition: string;
  date: string;
  /** Saison à laquelle rattacher le match (format identique à SeasonLine.season). */
  season: string;
  state: MatchState;
  statusDetail: string;
  clock?: string;
  teamKey: string;
  teamKind: TeamKind;
  homeAway: 'home' | 'away';
  team: MatchTeam;
  opponent: MatchTeam;
  /** Les compositions d'équipe étaient disponibles dans le flux. */
  lineupsAvailable: boolean;
  /** Le joueur figure sur la feuille de match. */
  inSquad: boolean;
  /** Le joueur est entré en jeu (titulaire ou remplaçant utilisé). */
  played: boolean;
  starter: boolean;
  minutes: number | null;
  goals: number;
  assists: number;
  shots: number | null;
  shotsOnTarget: number | null;
  yellowCards: number;
  redCards: number;
  goalDetails: GoalDetail[];
}

export interface Fixture {
  eventId: string;
  league: string;
  competition: string;
  date: string;
  homeAway: 'home' | 'away';
  team: MatchTeam;
  opponent: MatchTeam;
}

export type LiveStatus = 'starting' | 'ok' | 'degraded' | 'offline' | 'disabled';

export interface LiveInfo {
  provider: string;
  status: LiveStatus;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Intervalle de rafraîchissement actuel côté serveur, en secondes. */
  refreshSeconds: number | null;
}

export interface PlayerLiveData {
  /** Matchs terminés après la date de référence. */
  completed: PlayerMatch[];
  /** Match en cours, le cas échéant. */
  live: PlayerMatch | null;
  next: Fixture | null;
}

export type LiveData = Record<PlayerId, PlayerLiveData>;

/* ------------------------------ État consolidé ------------------------------ */

export interface Delta {
  apps: number;
  goals: number;
  assists: number;
  minutes: number;
  /** Nombre de matchs dont le temps de jeu n'a pas pu être déterminé. */
  minutesUnknown: number;
  shots: number;
  shotsOnTarget: number;
  /** Matchs où les tirs étaient disponibles (pour les ratios). */
  shotSampleGoals: number;
  hatTricks: number;
  zones: Record<GoalZone, number>;
  bodyParts: Record<BodyPart, number>;
  /** Buts dont la zone n'a pas pu être déterminée à partir du commentaire. */
  unclassifiedGoals: number;
}

export interface PlayerTotals {
  apps: number;
  goals: number;
  assists: number;
  minutes: number;
  hatTricks: number;
}

export interface PlayerState {
  baseline: PlayerBaseline;
  totals: PlayerTotals;
  /** Apport des matchs joués depuis la date de référence (y compris le match en cours). */
  delta: Delta;
  /** Apport du seul match en cours. */
  liveDelta: Delta;
  teams: TeamSplit[];
  seasons: SeasonLine[];
  zones: Record<GoalZone, number>;
  bodyParts: Record<BodyPart, number>;
  recent: PlayerMatch[];
  live: PlayerMatch | null;
  next: Fixture | null;
}

export interface AppState {
  generatedAt: string;
  baselineAsOf: string;
  live: LiveInfo;
  players: Record<PlayerId, PlayerState>;
  sources: Source[];
}
