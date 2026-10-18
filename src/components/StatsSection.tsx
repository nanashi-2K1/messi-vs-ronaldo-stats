import type { PlayerState } from '../../shared/types.ts';
import { useReveal } from '../hooks/useArcade.ts';
import { competitionFigures, efficiencyFigures, keyFigures } from '../lib/figures.ts';
import { CompareRows } from './CompareRows.tsx';

export function StatsSection({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const [ref, shown] = useReveal<HTMLElement>();
  return (
    <section id="s-stats" ref={ref} className={`lvl reveal${shown ? ' in' : ''}`} aria-labelledby="stats-title">
      <div className="sh">
        <div>
          <span className="kicker">NIVEAU 3</span>
          <h2 id="stats-title">Chiffres clés</h2>
          <p>Chaque ligne compare les deux joueurs sur sa propre échelle. La valeur en gras est la meilleure des deux ; en vert, la progression depuis la date de référence.</p>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Totaux de carrière</h3>
          <p className="sub">Club et sélection, matchs officiels</p>
          <CompareRows items={keyFigures(messi, ronaldo)} grown={shown} />
        </div>
        <div className="card">
          <h3>Efficacité</h3>
          <p className="sub">Ratios sur l’ensemble de la carrière</p>
          <CompareRows items={efficiencyFigures(messi, ronaldo)} grown={shown} />
        </div>
      </div>
      <div className="card">
        <h3>Grandes compétitions</h3>
        <p className="sub">Valeurs de référence</p>
        <CompareRows items={competitionFigures(messi, ronaldo)} grown={shown} />
      </div>
    </section>
  );
}
