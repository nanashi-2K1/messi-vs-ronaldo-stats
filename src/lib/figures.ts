import { efficiency } from '../../shared/metrics.ts';
import { BODY_PARTS, type BodyPart, type PlayerState } from '../../shared/types.ts';
import { fmtDec, fmtInt, fmtPct } from './format.ts';

/** Une ligne de comparaison Messi / Ronaldo. */
export interface CompareItem {
  label: string;
  hint?: string;
  messi: number | null;
  ronaldo: number | null;
  format?: (n: number) => string;
  /** Quelle valeur l'emporte (« none » : pas de vainqueur, simple information). */
  better?: 'higher' | 'lower' | 'none';
  /** Progression depuis la date de référence, affichée à côté de la valeur. */
  messiDelta?: number;
  ronaldoDelta?: number;
  /** Échelle commune à plusieurs lignes (parts d'un même total) ; sinon chaque ligne a la sienne. */
  scaleMax?: number;
}

export function leader(item: Pick<CompareItem, 'messi' | 'ronaldo' | 'better'>): 'messi' | 'ronaldo' | null {
  const { messi: m, ronaldo: r, better = 'higher' } = item;
  if (m == null || r == null || m === r || better === 'none') return null;
  return (better === 'higher') === m > r ? 'messi' : 'ronaldo';
}

const national = (p: PlayerState, k: 'apps' | 'goals') => p.teams.filter((t) => t.kind === 'national').reduce((s, t) => s + t[k], 0);
const honours = (p: PlayerState, id: string) => p.baseline.honours.find((h) => h.id === id)?.items.length ?? null;
const dec = (n: number) => fmtDec(n);
const round = (n: number) => fmtInt(Math.round(n));

export function keyFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  return [
    { label: 'Matchs joués', messi: m.totals.apps, ronaldo: r.totals.apps, better: 'none', messiDelta: m.delta.apps, ronaldoDelta: r.delta.apps },
    { label: 'Buts', messi: m.totals.goals, ronaldo: r.totals.goals, messiDelta: m.delta.goals, ronaldoDelta: r.delta.goals },
    { label: 'Passes décisives', messi: m.totals.assists, ronaldo: r.totals.assists, messiDelta: m.delta.assists, ronaldoDelta: r.delta.assists },
    { label: 'Buts + passes déc.', messi: m.totals.goals + m.totals.assists, ronaldo: r.totals.goals + r.totals.assists },
    { label: 'Minutes jouées', messi: m.totals.minutes, ronaldo: r.totals.minutes, better: 'none' },
    { label: 'Triplés', hint: '3 buts ou plus dans un match', messi: m.totals.hatTricks, ronaldo: r.totals.hatTricks },
    { label: 'Buts en club', messi: m.totals.goals - national(m, 'goals'), ronaldo: r.totals.goals - national(r, 'goals') },
    { label: 'Sélections', messi: national(m, 'apps'), ronaldo: national(r, 'apps'), better: 'none' },
    { label: 'Buts en sélection', messi: national(m, 'goals'), ronaldo: national(r, 'goals') },
    { label: 'Ballons d’Or', messi: honours(m, 'ballon'), ronaldo: honours(r, 'ballon') },
  ];
}

export function efficiencyFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  const em = efficiency(m);
  const er = efficiency(r);
  return [
    { label: 'Buts par match', messi: em.goalsPerMatch, ronaldo: er.goalsPerMatch, format: dec },
    { label: 'Passes déc. par match', messi: em.assistsPerMatch, ronaldo: er.assistsPerMatch, format: dec },
    { label: 'Buts + passes par match', messi: em.contributionsPerMatch, ronaldo: er.contributionsPerMatch, format: dec },
    { label: 'Buts par 90 min', messi: em.goalsPer90, ronaldo: er.goalsPer90, format: dec },
    { label: 'Minutes par but', hint: 'moins = mieux', messi: em.minutesPerGoal, ronaldo: er.minutesPerGoal, format: round, better: 'lower' },
    { label: 'Min. par but ou passe', hint: 'moins = mieux', messi: em.minutesPerContribution, ronaldo: er.minutesPerContribution, format: round, better: 'lower' },
    { label: 'Buts hors penalty', messi: em.nonPenaltyGoals, ronaldo: er.nonPenaltyGoals },
    { label: 'Part des buts sur penalty', messi: em.penaltyShare, ronaldo: er.penaltyShare, format: (n) => fmtPct(n), better: 'none' },
    { label: 'Réussite aux penalties', messi: m.conversion.penalty.rate, ronaldo: r.conversion.penalty.rate, format: (n) => fmtPct(n, true) },
    { label: 'Buts par match en club', messi: em.clubGoalsPerMatch, ronaldo: er.clubGoalsPerMatch, format: dec },
    { label: 'Buts par match en sélection', messi: em.internationalGoalsPerMatch, ronaldo: er.internationalGoalsPerMatch, format: dec },
  ];
}

export function competitionFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  return m.baseline.competitions.flatMap((c, i) => {
    const rc = r.baseline.competitions[i]!;
    const rows: CompareItem[] = [{ label: c.label, hint: 'buts', messi: c.goals, ronaldo: rc.goals }];
    if (c.apps != null && rc.apps != null) rows.push({ label: c.label, hint: 'matchs', messi: c.apps, ronaldo: rc.apps, better: 'none' });
    return rows;
  });
}

const BODY_LABELS: Record<BodyPart, string> = { left: 'Pied gauche', right: 'Pied droit', head: 'Tête', other: 'Autre surface' };

export function bodyPartFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  const total = (p: PlayerState) => BODY_PARTS.reduce((s, b) => s + p.bodyParts[b], 0);
  const tm = total(m);
  const tr = total(r);
  const share = (n: number, t: number) => (t ? n / t : null);
  const scaleMax = Math.max(...BODY_PARTS.flatMap((b) => [share(m.bodyParts[b], tm) ?? 0, share(r.bodyParts[b], tr) ?? 0]));
  return BODY_PARTS.map((b) => ({
    label: BODY_LABELS[b],
    hint: `${fmtInt(m.bodyParts[b])} contre ${fmtInt(r.bodyParts[b])} buts`,
    messi: share(m.bodyParts[b], tm),
    ronaldo: share(r.bodyParts[b], tr),
    format: (n: number) => (n > 0 && n < 0.01 ? '< 1 %' : fmtPct(n)),
    better: 'none' as const,
    scaleMax,
  }));
}

/** Statistiques proposées dans le mode duel de l'arène. */
export function duelFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  const em = efficiency(m);
  const er = efficiency(r);
  const ucl = (p: PlayerState) => p.baseline.competitions.find((c) => c.label === 'Ligue des champions')?.goals ?? null;
  return [
    { label: 'Buts', messi: m.totals.goals, ronaldo: r.totals.goals },
    { label: 'Matchs', hint: 'plus = plus de matchs joués', messi: m.totals.apps, ronaldo: r.totals.apps },
    { label: 'Passes déc.', messi: m.totals.assists, ronaldo: r.totals.assists },
    { label: 'Buts + passes', messi: m.totals.goals + m.totals.assists, ronaldo: r.totals.goals + r.totals.assists },
    { label: 'Buts / match', messi: em.goalsPerMatch, ronaldo: er.goalsPerMatch, format: dec },
    { label: 'Min. par but', hint: 'moins = mieux', messi: em.minutesPerGoal, ronaldo: er.minutesPerGoal, format: round, better: 'lower' },
    { label: 'Triplés', messi: m.totals.hatTricks, ronaldo: r.totals.hatTricks },
    { label: 'Buts sélection', messi: national(m, 'goals'), ronaldo: national(r, 'goals') },
    { label: 'Buts en LdC', messi: ucl(m), ronaldo: ucl(r) },
    { label: 'Ballons d’Or', messi: honours(m, 'ballon'), ronaldo: honours(r, 'ballon') },
    { label: 'Penalties', hint: 'taux de réussite', messi: m.conversion.penalty.rate, ronaldo: r.conversion.penalty.rate, format: (n) => fmtPct(n, true) },
  ];
}
