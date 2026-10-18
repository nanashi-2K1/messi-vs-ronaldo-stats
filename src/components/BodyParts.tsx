import { BODY_PARTS, type BodyPart, type PlayerState } from '../../shared/types.ts';
import { fmtInt, fmtPct } from '../lib/format.ts';

const LABELS: Record<BodyPart, string> = { left: 'Pied gauche', right: 'Pied droit', head: 'Tête' };

export function BodyParts({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const players = [messi, ronaldo];
  const totals = players.map((p) => BODY_PARTS.reduce((s, k) => s + p.bodyParts[k], 0));
  const shares = players.map((p, i) => BODY_PARTS.map((k) => (totals[i]! > 0 ? p.bodyParts[k] / totals[i]! : 0)));
  const max = Math.max(...shares.flat());
  return (
    <section className="card" aria-labelledby="body-title">
      <div className="section-head">
        <h2 id="body-title">Pied gauche, pied droit, tête</h2>
        <div className="legend">
          <span className="legend-item">
            <span className="swatch messi-bg" aria-hidden /> Messi
          </span>
          <span className="legend-item">
            <span className="swatch ronaldo-bg" aria-hidden /> Ronaldo
          </span>
        </div>
      </div>
      <div className="bars">
        {BODY_PARTS.map((k, ki) => (
          <div className="bar-group" key={k}>
            <h4>{LABELS[k]}</h4>
            {players.map((p, pi) => {
              const share = shares[pi]![ki]!;
              return (
                <div className="bar-line" key={p.baseline.id} aria-label={`${LABELS[k]}, ${p.baseline.name} : ${p.bodyParts[k]} buts (${fmtPct(share)})`}>
                  <span>{p.baseline.name.split(' ').at(-1)}</span>
                  <span className="bar-track" aria-hidden>
                    <span className={`${p.baseline.id}-bg`} style={{ width: `${max > 0 ? (share / max) * 100 : 0}%` }} />
                  </span>
                  <span className="num">
                    {fmtPct(share)} · {fmtInt(p.bodyParts[k])}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="note">
        En % des buts classés par la source ({fmtInt(totals[0]!)} pour Messi, {fmtInt(totals[1]!)} pour Ronaldo) ; poitrine, genou et
        buts non renseignés exclus. Source : {messi.baseline.bodyParts.source.label.split(' — ')[0]} (oct. 2026), puis mise à jour
        automatique à chaque nouveau but.
      </p>
    </section>
  );
}
