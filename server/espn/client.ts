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

export function scoreboardUrl(league: string, from: Date, to: Date): string {
  return `${ESPN_BASE}/${league}/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=500`;
}

export function summaryUrl(league: string, eventId: string): string {
  return `${ESPN_BASE}/${league}/summary?event=${encodeURIComponent(eventId)}`;
}
