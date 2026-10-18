import { fmtInt } from '../lib/format.ts';
import { leader, type CompareItem } from '../lib/figures.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';

/**
 * Barres miroir : Messi à gauche, Ronaldo à droite, chaque ligne sur sa propre
 * échelle (sauf `scaleMax`). Les barres poussent quand la section apparaît (`grown`).
 */
export function CompareRows({ items, grown }: { items: CompareItem[]; grown: boolean }) {
  return (
    <div role="table" aria-label="Comparaison Messi / Ronaldo">
      <div className="bf-head" role="row">
        <span className="lg" role="columnheader">
          <i className="sw m" aria-hidden /> Messi
        </span>
        <span aria-hidden />
        <span role="columnheader">Statistique</span>
        <span aria-hidden />
        <span className="lg r" role="columnheader">
          Ronaldo <i className="sw r" aria-hidden />
        </span>
      </div>
      {items.map((item) => {
        const fmt = item.format ?? fmtInt;
        const text = (v: number | null) => (v == null ? '—' : fmt(v));
        const max = item.scaleMax ?? Math.max(item.messi ?? 0, item.ronaldo ?? 0);
        const width = (v: number | null) => (!grown || v == null || max <= 0 ? 0 : (v / max) * 100);
        const lead = leader(item);
        const onMove = (e: React.MouseEvent) => {
          const verdict =
            lead == null
              ? item.messi === item.ronaldo
                ? 'Égalité'
                : (item.hint ?? 'À titre d’information')
              : `${lead === 'messi' ? 'Messi' : 'Ronaldo'} devant${item.better === 'lower' ? ' (moins = mieux)' : ''}`;
          showTip(
            item.label.toUpperCase(),
            [
              { label: 'Messi', value: text(item.messi) },
              { label: 'Ronaldo', value: text(item.ronaldo) },
              { value: verdict },
            ],
            e.clientX,
            e.clientY,
          );
        };
        return (
          <div
            className="bf-row"
            role="row"
            key={`${item.label}|${item.hint ?? ''}`}
            aria-label={`${item.label} : Messi ${text(item.messi)}, Ronaldo ${text(item.ronaldo)}`}
            onMouseMove={onMove}
            onMouseLeave={hideTip}
          >
            <span className={`bf-v m${lead === 'messi' ? ' win' : ''}`} role="cell">
              {item.messiDelta ? <span className="up">+{fmtInt(item.messiDelta)}</span> : null}
              {text(item.messi)}
            </span>
            <span className="bf-bar m" aria-hidden>
              <i style={{ width: `${width(item.messi)}%` }} />
            </span>
            <span className="bf-l" role="rowheader">
              {item.label}
              {item.hint ? <small>{item.hint}</small> : null}
            </span>
            <span className="bf-bar r" aria-hidden>
              <i style={{ width: `${width(item.ronaldo)}%` }} />
            </span>
            <span className={`bf-v r${lead === 'ronaldo' ? ' win' : ''}`} role="cell">
              {text(item.ronaldo)}
              {item.ronaldoDelta ? <span className="up">+{fmtInt(item.ronaldoDelta)}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
