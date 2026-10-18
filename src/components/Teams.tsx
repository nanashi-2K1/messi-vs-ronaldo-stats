import type { PlayerState } from '../../shared/types.ts';
import { ratio } from '../../shared/metrics.ts';
import { fmtDec, fmtInt } from '../lib/format.ts';

function period(from: string, to: string | null) {
  return to == null ? `depuis ${from}` : from === to ? from : `${from}–${to}`;
}

export function Teams({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const max = Math.max(...[messi, ronaldo].flatMap((p) => p.teams.map((t) => t.goals)));
  return (
    <section className="card" aria-labelledby="teams-title">
      <div className="section-head">
        <h2 id="teams-title">Club par club</h2>
        <p>Buts par équipe (même échelle pour les deux joueurs)</p>
      </div>
      <div className="grid-2">
        {[messi, ronaldo].map((p) => (
          <div className="team-list" key={p.baseline.id}>
            <h3>
              <span className={`swatch ${p.baseline.id}-bg`} aria-hidden /> {p.baseline.name}
            </h3>
            {p.teams.map((t) => (
              <div className="team-row" key={t.key}>
                <div className="team-meta">
                  <span>
                    {t.name} <span style={{ color: 'var(--muted)' }}>· {period(t.from, t.to)}</span>
                  </span>
                  <span>
                    {fmtInt(t.apps)} m. · {fmtDec(ratio(t.goals, t.apps))}/m.
                  </span>
                </div>
                <div className="team-bar" aria-label={`${t.name} : ${t.goals} buts en ${t.apps} matchs`}>
                  <span
                    className={`team-fill ${p.baseline.id}-bg`}
                    style={{ width: `calc((100% - 3.5em) * ${max > 0 ? t.goals / max : 0})` }}
                    aria-hidden
                  />
                  <strong>{fmtInt(t.goals)}</strong>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="note">m. = matchs officiels ; ratio en buts par match. Les sélections nationales sont comptées à part des clubs.</p>
    </section>
  );
}
