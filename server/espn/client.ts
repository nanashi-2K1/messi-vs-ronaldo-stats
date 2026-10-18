/** Surchargeable (ESPN_BASE_URL) pour pointer vers un miroir ou un faux serveur de test. */
export const ESPN_BASE = process.env.ESPN_BASE_URL ?? 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} pour ${url}`);
  }
}

export type FetchJson = (url: string) => Promise<unknown>;

export function createFetchJson(timeoutMs = 10_000): FetchJson {
  return async (url) => {
    const res = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'messi-vs-ronaldo-stats/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status, url);
    return res.json();
  };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');

/** Scoreboard d'une journée (ESPN refuse les plages de dates : 400). */
export function scoreboardUrl(league: string, day: Date): string {
  return `${ESPN_BASE}/${league}/scoreboard?dates=${ymd(day)}`;
}

/** Calendrier d'une équipe dans une compétition (« fixture=true » : matchs à venir). */
export function scheduleUrl(league: string, teamId: string, query = ''): string {
  return `${ESPN_BASE}/${league}/teams/${encodeURIComponent(teamId)}/schedule${query ? `?${query}` : ''}`;
}

export function summaryUrl(league: string, eventId: string): string {
  return `${ESPN_BASE}/${league}/summary?event=${encodeURIComponent(eventId)}`;
}
