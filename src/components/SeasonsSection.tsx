import { ratio } from '../../shared/metrics.ts';
import type { PlayerState } from '../../shared/types.ts';
import { useReveal } from '../hooks/useArcade.ts';
import { fmtDec, fmtInt } from '../lib/format.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';
import { SeasonChart } from './SeasonChart.tsx';

const period = (from: string, to: string | null) => (to == null ? `depuis ${from}` : from === to ? from : `${from}–${to}`);

function Clubs({ messi, ronaldo, grown }: { messi: PlayerState; ronaldo: PlayerState; grown: boolean }) {
  const max = Math.max(...[messi, ronaldo].flatMap((p) => p.teams.map((t) => t.goals)), 1);
  return (
    <div className="clubs">
      {[messi, ronaldo].map((p) => {
        const side = p.baseline.id === 'messi' ? 'm' : 'r';
        return (
          <div key={side}>
            <h4 style={{ color: `var(--${side})` }}>
              <i className={`sw ${side}`} aria-hidden />
              {p.baseline.name.toUpperCase()}
            </h4>
            {p.teams.map((t) => {
              const r = ratio(t.goals, t.apps);
              return (
                <div
                  className="club"
                  key={t.key}
                  aria-label={`${t.name} : ${t.goals} buts en ${t.apps} matchs`}
                  onMouseMove={(e) =>
                    showTip(t.name.toUpperCase(), [{ value: period(t.from, t.to) }, { value: `${fmtInt(t.goals)} buts en ${fmtInt(t.apps)} matchs` }, { value: `${fmtDec(r)} but/match` }], e.clientX, e.clientY)
                  }
                  onMouseLeave={hideTip}
                >
                  <div className="t">
                    {t.name}{' '}
                    <span>
                      {period(t.from, t.to)} · {fmtInt(t.apps)} m. · {fmtDec(r)}/m.
                    </span>
                  </div>
                  <div className="row">
                    <div>
                      <i style={{ width: grown ? `${(t.goals / max) * 100}%` : 0, background: `var(--${side})` }} />
                    </div>
                    <b>{fmtInt(t.goals)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function SeasonsSection({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const [ref, shown] = useReveal<HTMLElement>();
  return (
    <section id="s-seasons" ref={ref} className={`lvl reveal${shown ? ' in' : ''}`} aria-labelledby="seasons-title">
      <div className="sh">
        <div>
          <span className="kicker">NIVEAU 5</span>
          <h2 id="seasons-title">Saisons & clubs</h2>
          <p>Survole la courbe (ou utilise les flèches du clavier) pour comparer une saison précise.</p>
        </div>
      </div>
      <SeasonChart messi={messi} ronaldo={ronaldo} />
      <div className="card">
        <h3>Club par club</h3>
        <p className="sub">Buts par équipe, même échelle pour les deux joueurs · m. = matchs officiels</p>
        <Clubs messi={messi} ronaldo={ronaldo} grown={shown} />
      </div>
    </section>
  );
}
