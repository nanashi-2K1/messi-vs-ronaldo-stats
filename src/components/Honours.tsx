import type { PlayerState } from '../../shared/types.ts';
import { fmtInt } from '../lib/format.ts';

export function Honours({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const rows = messi.baseline.honours.map((h, i) => ({ label: h.label, m: h, r: ronaldo.baseline.honours[i]! }));
  return (
    <section className="card" aria-labelledby="honours-title">
      <div className="section-head">
        <h2 id="honours-title">Palmarès</h2>
        <p>Trophées majeurs, collectifs et individuels</p>
      </div>
      <div className="table-scroll">
        <table className="data-table honours">
          <thead>
            <tr>
              <th>Titre</th>
              <th>
                <span className="legend-item">
                  <span className="swatch messi-bg" aria-hidden /> Messi
                </span>
              </th>
              <th>
                <span className="legend-item">
                  <span className="swatch ronaldo-bg" aria-hidden /> Ronaldo
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, m, r }) => (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  <span className={`count${m.count > r.count ? ' lead' : ''}`}>{fmtInt(m.count)}</span>
                  {m.detail ? <small>{m.detail}</small> : null}
                </td>
                <td>
                  <span className={`count${r.count > m.count ? ' lead' : ''}`}>{fmtInt(r.count)}</span>
                  {r.detail ? <small>{r.detail}</small> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
