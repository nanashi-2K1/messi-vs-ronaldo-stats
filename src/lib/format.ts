const intFmt = new Intl.NumberFormat('fr-FR');
const decFmt = (digits: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pctFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
const pct1Fmt = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const kickoffFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export const fmtInt = (n: number) => intFmt.format(n);
export const fmtDec = (n: number | null, digits = 2) => (n == null ? '—' : decFmt(digits).format(n));
export const fmtPct = (n: number | null, precise = false) => (n == null ? '—' : (precise ? pct1Fmt : pctFmt).format(n));
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtShortDate = (iso: string) => shortDateFmt.format(new Date(iso));
export const fmtKickoff = (iso: string) => kickoffFmt.format(new Date(iso));

export function fmtRelative(iso: string | null, now: number): string {
  if (!iso) return 'jamais';
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (Math.abs(seconds) < 60) return rtf.format(Math.min(0, seconds), 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}

/** Accord simple : 1 but, 2 buts. */
export const plural = (n: number, one: string, many: string) => `${fmtInt(n)} ${Math.abs(n) >= 2 ? many : one}`;
