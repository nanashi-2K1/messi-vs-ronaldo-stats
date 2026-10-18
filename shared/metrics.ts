import { GOAL_ZONES, type PlayerState } from './types.ts';

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export interface Efficiency {
  goalsPerMatch: number | null;
  assistsPerMatch: number | null;
  contributionsPerMatch: number | null;
  minutesPerGoal: number | null;
  minutesPerContribution: number | null;
  goalsPer90: number | null;
  /** Part des buts marqués sur penalty, d'après la répartition par zone. */
  penaltyShare: number | null;
  /** Buts hors penalty (estimation : total × part hors penalty). */
  nonPenaltyGoals: number;
  nonPenaltyGoalsPerMatch: number | null;
  clubGoalsPerMatch: number | null;
  internationalGoalsPerMatch: number | null;
}

export function efficiency(p: PlayerState): Efficiency {
  const { apps, goals, assists, minutes } = p.totals;
  const contributions = goals + assists;
  const zoneTotal = GOAL_ZONES.reduce((sum, z) => sum + p.zones[z], 0);
  const penaltyShare = ratio(p.zones.penalty, zoneTotal);
  const nonPenaltyGoals = penaltyShare == null ? goals : Math.round(goals * (1 - penaltyShare));
  const club = p.teams.filter((t) => t.kind === 'club');
  const intl = p.teams.filter((t) => t.kind === 'national');
  const sum = (ts: typeof club, k: 'apps' | 'goals') => ts.reduce((s, t) => s + t[k], 0);
  const per90 = ratio(goals, minutes);
  return {
    goalsPerMatch: ratio(goals, apps),
    assistsPerMatch: ratio(assists, apps),
    contributionsPerMatch: ratio(contributions, apps),
    minutesPerGoal: ratio(minutes, goals),
    minutesPerContribution: ratio(minutes, contributions),
    goalsPer90: per90 == null ? null : per90 * 90,
    penaltyShare,
    nonPenaltyGoals,
    nonPenaltyGoalsPerMatch: ratio(nonPenaltyGoals, apps),
    clubGoalsPerMatch: ratio(sum(club, 'goals'), sum(club, 'apps')),
    internationalGoalsPerMatch: ratio(sum(intl, 'goals'), sum(intl, 'apps')),
  };
}

/** Âge en années révolues à une date donnée. */
export function ageAt(birthDate: string, now: Date): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Position d'une saison sur un axe temporel continu (en années) :
 * "2008/09" est centrée sur le 1er janvier 2009, "2025" (année civile) sur le 1er juillet 2025.
 */
export function seasonMidpoint(season: string): number {
  const split = /^(\d{4})\/(\d{2})$/.exec(season);
  if (split) return Number(split[1]) + 1;
  const year = /^(\d{4})$/.exec(season);
  if (year) return Number(year[1]) + 0.5;
  return Number.NaN;
}

/** Libellé de saison pour une date de match, selon le calendrier du championnat. */
export function seasonFor(date: string, format: 'calendar' | 'split'): string {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  if (format === 'calendar') return String(y);
  // Saisons à cheval : on bascule au 1er juillet.
  const start = d.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}
