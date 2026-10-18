import type { BodyPart, GoalZone } from './types.ts';

/*
 * Classement d'un but à partir du commentaire texte fourni par le flux de données
 * (format Opta repris par ESPN), par exemple :
 *   "Lionel Messi (Inter Miami CF) left footed shot from outside the box to the top left corner."
 *   "Cristiano Ronaldo (Al Nassr) converts the penalty with a right footed shot to the bottom right corner."
 *   "Cristiano Ronaldo (Al Nassr) header from the centre of the box to the bottom left corner."
 */

export interface GoalFlags {
  penaltyKick?: boolean;
  /** Libellé du type d'action, ex. "Goal - Header", "Penalty - Scored", "Goal - Free-kick". */
  typeText?: string;
}

export function classifyGoalZone(text: string, flags: GoalFlags = {}): GoalZone | null {
  const t = `${flags.typeText ?? ''} ${text}`.toLowerCase();
  if (
    flags.penaltyKick ||
    /converts the penalty|penalty\s*-\s*(scored|saved|missed)|penalty (saved|missed)!|from the penalty spot|\(pen\)/.test(t)
  )
    return 'penalty';
  if (/(from|with) a (direct )?free[- ]kick|goal\s*-\s*free[- ]kick|direct free[- ]kick/.test(t)) return 'freeKick';
  if (/outside the box|from long range|more than \d+ yards|from distance/.test(t)) return 'outsideBox';
  if (/(the|six[- ]yard) box|very close range|difficult angle|penalty area/.test(t)) return 'insideBox';
  return null;
}

export function classifyBodyPart(text: string, flags: GoalFlags = {}): BodyPart | null {
  const t = `${flags.typeText ?? ''} ${text}`.toLowerCase();
  if (/left[- ]foot(ed)?/.test(t)) return 'left';
  if (/right[- ]foot(ed)?/.test(t)) return 'right';
  if (/header|headed/.test(t)) return 'head';
  if (/\b(chest|knee|thigh|shoulder|back ?heel)\b/.test(t)) return 'other';
  return null;
}

/** Ligne de commentaire décrivant une tentative (tir manqué, arrêté, contré, sur le poteau, but). */
export function isShotLine(text: string): boolean {
  if (/^own goal/i.test(text)) return false;
  return /^(attempt (missed|saved|blocked)\.|goal!|penalty (saved|missed)!)/i.test(text) || /hits the (left |right )?(post|bar)|crossbar/i.test(text);
}

/** Nom du tireur dans une ligne de commentaire Opta : « Attempt saved. Lionel Messi (Inter Miami CF) left footed… ». */
export function shooterOf(text: string): string | null {
  const m = /(?:^|[.!]\s+)([^.!()]+?)\s+\([^)]*\)\s+(?:left footed|right footed|header|shot|fails|converts|with a)/i.exec(text);
  return m?.[1]?.trim() ?? null;
}
