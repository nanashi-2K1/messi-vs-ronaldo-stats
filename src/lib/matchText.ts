import type { BodyPart, Fixture, GoalZone, MatchTeam, PlayerMatch } from '../../shared/types.ts';
import { fmtDec, plural } from './format.ts';

export const ZONE_LABELS: Record<GoalZone, string> = {
  insideBox: 'dans la surface',
  outsideBox: 'hors surface',
  freeKick: 'coup franc',
  penalty: 'penalty',
};

export const BODY_LABELS: Record<BodyPart, string> = { left: 'pied gauche', right: 'pied droit', head: 'tête', other: 'autre surface' };

function homeAway(m: { homeAway: 'home' | 'away'; team: MatchTeam; opponent: MatchTeam }) {
  return m.homeAway === 'home' ? [m.team, m.opponent] : [m.opponent, m.team];
}

/** « Atlanta United FC 1–3 Inter Miami CF » (équipe à domicile en premier). */
export function scoreText(m: { homeAway: 'home' | 'away'; team: MatchTeam; opponent: MatchTeam }): string {
  const [home, away] = homeAway(m);
  const score = home!.score != null && away!.score != null ? ` ${home!.score}–${away!.score} ` : ' – ';
  return `${home!.name}${score}${away!.name}`;
}

export function fixtureText(f: Fixture): string {
  const [home, away] = homeAway(f);
  return `${home!.name} – ${away!.name}`;
}

/** « 56' (dans la surface, pied gauche), 60' (dans la surface, pied gauche) » */
export function goalSummary(m: PlayerMatch): string {
  return m.goalDetails
    .map((g) => {
      const how = [g.zone ? ZONE_LABELS[g.zone] : null, g.bodyPart ? BODY_LABELS[g.bodyPart] : null].filter(Boolean).join(', ');
      return how ? `${g.minute} (${how})` : g.minute;
    })
    .join(', ');
}

export function resultOf(m: PlayerMatch): 'V' | 'N' | 'D' | '' {
  if (m.state !== 'post' || m.team.score == null || m.opponent.score == null) return '';
  return m.team.score > m.opponent.score ? 'V' : m.team.score < m.opponent.score ? 'D' : 'N';
}

/** Résumé de la prestation du joueur dans un match. */
export function playerLine(m: PlayerMatch): string {
  if (!m.inSquad) return m.lineupsAvailable ? 'Absent de la feuille de match' : 'Composition indisponible';
  if (!m.played) return m.state === 'pre' ? 'Avant le coup d’envoi' : 'Resté sur le banc';
  const parts = [plural(m.goals, 'but', 'buts'), plural(m.assists, 'passe déc.', 'passes déc.')];
  if (m.shots != null) parts.push(`${m.shotsOnTarget ?? 0}/${m.shots} tirs cadrés`);
  if (m.minutes != null) parts.push(`${m.minutes} min jouées`);
  if (!m.starter) parts.push('entré en jeu');
  if (m.extra?.rating != null) parts.push(`note ${fmtDec(m.extra.rating, 1)}`);
  if (m.extra?.keyPasses) parts.push(plural(m.extra.keyPasses, 'passe clé', 'passes clés'));
  const goals = goalSummary(m);
  return parts.join(' · ') + (goals ? ` — buts : ${goals}` : '');
}
