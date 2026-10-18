import { fmtInt } from '../lib/format.ts';

export interface CompareItem {
  label: string;
  hint?: string;
  messi: number | null;
  ronaldo: number | null;
  format?: (n: number) => string;
  /** Sens de lecture : quelle valeur est la meilleure (« none » : pas de vainqueur). */
  better?: 'higher' | 'lower' | 'none';
  /** Progression depuis la date de référence, affichée à côté de la valeur. */
  messiDelta?: number;
  ronaldoDelta?: number;
}

function leader(item: CompareItem): 'messi' | 'ronaldo' | null {
  const { messi: m, ronaldo: r, better = 'higher' } = item;
  if (m == null || r == null || m === r || better === 'none') return null;
  return (better === 'higher') === m > r ? 'messi' : 'ronaldo';
}

/** Tableau de comparaison « en miroir » : Messi à gauche, Ronaldo à droite. */
export function CompareRows({ items }: { items: CompareItem[] }) {
  return (
    <div className="compare" role="table" aria-label="Comparaison Messi / Ronaldo">
      <div className="compare-head" role="row">
        <span role="columnheader" className="legend-item">
          <span className="swatch messi-bg" aria-hidden /> Messi
        </span>
        <span role="columnheader">Statistique</span>
        <span role="columnheader" className="legend-item" style={{ justifyContent: 'flex-end' }}>
          Ronaldo <span className="swatch ronaldo-bg" aria-hidden />
        </span>
      </div>
      {items.map((item) => {
        const fmt = item.format ?? fmtInt;
        const max = Math.max(item.messi ?? 0, item.ronaldo ?? 0);
        const width = (v: number | null) => (v == null || max <= 0 ? 0 : (v / max) * 100);
        const lead = leader(item);
        const text = (v: number | null) => (v == null ? '—' : fmt(v));
        return (
          <div
            className="cmp-row"
            role="row"
            key={`${item.label}|${item.hint ?? ''}`}
            aria-label={`${item.label} : Messi ${text(item.messi)}, Ronaldo ${text(item.ronaldo)}`}
          >
            <span className={`cmp-val left${lead === 'messi' ? ' lead' : ''}`} role="cell">
              {item.messiDelta ? <span className="delta-up">+{fmtInt(item.messiDelta)}</span> : null} {text(item.messi)}
            </span>
            <span className="cmp-bar left" aria-hidden>
              <span style={{ width: `${width(item.messi)}%` }} />
            </span>
            <span className="cmp-label" role="rowheader">
              {item.label}
              {item.hint ? <small>{item.hint}</small> : null}
            </span>
            <span className="cmp-bar right" aria-hidden>
              <span style={{ width: `${width(item.ronaldo)}%` }} />
            </span>
            <span className={`cmp-val right${lead === 'ronaldo' ? ' lead' : ''}`} role="cell">
              {text(item.ronaldo)} {item.ronaldoDelta ? <span className="delta-up">+{fmtInt(item.ronaldoDelta)}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
