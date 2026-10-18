import { GOAL_ZONES, type GoalZone, type PlayerState } from '../../shared/types.ts';
import { fmtDate, fmtInt, fmtPct } from '../lib/format.ts';

/*
 * Moitié offensive du terrain vue de face, but en haut, coupée à 36 m de la ligne
 * de but. Échelle : 10 unités = 1 m (largeur 68 m, surface 40,32 × 16,5 m).
 */
const W = 680;
const H = 360;
const BOX = { x: 138.4, w: 403.2, h: 165 };
const SIX = { x: 248.4, w: 183.2, h: 55 };
const SPOT = { x: 340, y: 110 };

const ZONE_TITLES: Record<GoalZone, string> = {
  insideBox: 'Dans la surface (jeu)',
  outsideBox: 'Hors surface (jeu)',
  freeKick: 'Coup franc direct',
  penalty: 'Penalty',
};

/** Rampe séquentielle à une seule teinte : de la surface vers la couleur du joueur. */
function shade(color: string, intensity: number) {
  return `color-mix(in oklab, ${color} ${Math.round(12 + 68 * intensity)}%, var(--surface))`;
}

function Pitch({ player, color }: { player: PlayerState; color: string }) {
  const total = GOAL_ZONES.reduce((s, z) => s + player.zones[z], 0);
  const share = (z: GoalZone) => (total > 0 ? player.zones[z] / total : 0);
  const maxShare = Math.max(...GOAL_ZONES.map(share));
  const intensity = (z: GoalZone) => (maxShare > 0 ? share(z) / maxShare : 0);
  const strong = (z: GoalZone) => 12 + 68 * intensity(z) >= 50;
  const label = (z: GoalZone) => `${ZONE_TITLES[z]} : ${fmtInt(player.zones[z])} buts (${fmtPct(share(z))})`;

  return (
    <svg className="pitch" viewBox={`-4 -26 ${W + 8} ${H + 30}`} role="img" aria-label={`Zones de but de ${player.baseline.name}`}>
      {/* Zones (de la plus large à la plus petite) */}
      <rect className="zone zone-hit" x={0} y={0} width={W} height={H} fill={shade(color, intensity('outsideBox'))} tabIndex={0}>
        <title>{label('outsideBox')}</title>
      </rect>
      <rect className="zone zone-hit" x={BOX.x} y={0} width={BOX.w} height={BOX.h} fill={shade(color, intensity('insideBox'))} tabIndex={0}>
        <title>{label('insideBox')}</title>
      </rect>

      {/* Lignes du terrain */}
      <rect className="line" x={0} y={0} width={W} height={H} />
      <rect className="line" x={BOX.x} y={0} width={BOX.w} height={BOX.h} />
      <rect className="line" x={SIX.x} y={0} width={SIX.w} height={SIX.h} />
      <path className="line" d={`M ${SPOT.x - 73.1} ${BOX.h} A 91.5 91.5 0 0 0 ${SPOT.x + 73.1} ${BOX.h}`} />
      <rect className="line" x={SPOT.x - 36.6} y={-22} width={73.2} height={22} />

      {/* Penalty : pastille sur le point de penalty */}
      <g className="zone-hit" tabIndex={0}>
        <title>{label('penalty')}</title>
        <circle cx={SPOT.x} cy={SPOT.y} r={34} fill={shade(color, intensity('penalty'))} stroke="var(--surface)" strokeWidth={2} />
        <text x={SPOT.x} y={SPOT.y + 8} textAnchor="middle" className={`mid${strong('penalty') ? ' on-strong' : ''}`}>
          {fmtInt(player.zones.penalty)}
        </text>
      </g>
      <text x={SPOT.x - 46} y={SPOT.y + 7} textAnchor="end" className={`small${strong('insideBox') ? ' on-strong' : ''}`}>
        penalties
      </text>

      {/* Surface : chiffre à droite des six mètres */}
      <text x={(SIX.x + SIX.w + BOX.x + BOX.w) / 2} y={104} textAnchor="middle" className={`big${strong('insideBox') ? ' on-strong' : ''}`}>
        {fmtInt(player.zones.insideBox)}
      </text>
      <text x={(SIX.x + SIX.w + BOX.x + BOX.w) / 2} y={132} textAnchor="middle" className={`small${strong('insideBox') ? ' on-strong' : ''}`}>
        surface
      </text>

      {/* Coups francs : pastille dans l'axe, hors de la surface */}
      <g className="zone-hit" tabIndex={0}>
        <title>{label('freeKick')}</title>
        <rect x={SPOT.x - 90} y={222} width={180} height={76} rx={14} fill={shade(color, intensity('freeKick'))} stroke="var(--surface)" strokeWidth={2} />
        <text x={SPOT.x} y={258} textAnchor="middle" className={`mid${strong('freeKick') ? ' on-strong' : ''}`}>
          {fmtInt(player.zones.freeKick)}
        </text>
        <text x={SPOT.x} y={284} textAnchor="middle" className={`small${strong('freeKick') ? ' on-strong' : ''}`}>
          coups francs
        </text>
      </g>

      {/* Hors surface en jeu : de part et d'autre de l'axe */}
      <text x={570} y={262} textAnchor="middle" className={`big${strong('outsideBox') ? ' on-strong' : ''}`}>
        {fmtInt(player.zones.outsideBox)}
      </text>
      <text x={570} y={290} textAnchor="middle" className={`small${strong('outsideBox') ? ' on-strong' : ''}`}>
        hors surface
      </text>
    </svg>
  );
}

function ZoneTable({ player, color }: { player: PlayerState; color: string }) {
  const total = GOAL_ZONES.reduce((s, z) => s + player.zones[z], 0);
  const max = Math.max(...GOAL_ZONES.map((z) => player.zones[z]));
  return (
    <table className="zone-table">
      <tbody>
        {GOAL_ZONES.map((z) => (
          <tr key={z}>
            <td>
              <span className="legend-item">
                <span className="swatch" style={{ background: shade(color, max > 0 ? player.zones[z] / max : 0) }} aria-hidden />
                {ZONE_TITLES[z]}
              </span>
            </td>
            <td className="num">{fmtInt(player.zones[z])}</td>
            <td className="num muted">{fmtPct(total > 0 ? player.zones[z] / total : null)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GoalZones({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const pairs = [
    [messi, 'var(--messi)'],
    [ronaldo, 'var(--ronaldo)'],
  ] as const;
  const unclassified = messi.delta.unclassifiedGoals + ronaldo.delta.unclassifiedGoals;
  return (
    <section className="section card" aria-labelledby="zones-title">
      <div className="section-head">
        <h2 id="zones-title">Zones de but</h2>
        <p>D’où partent les buts — plus la zone est foncée, plus elle pèse dans le total du joueur.</p>
      </div>
      <div className="grid-2">
        {pairs.map(([p, color]) => (
          <div className="pitch-wrap" key={p.baseline.id}>
            <h3>
              <span className={`swatch ${p.baseline.id}-bg`} aria-hidden /> {p.baseline.name}
            </h3>
            <Pitch player={p} color={color} />
            <ZoneTable player={p} color={color} />
          </div>
        ))}
      </div>
      <p className="note">
        Répartition de référence au {fmtDate(messi.baseline.zones.asOf)} (ordres de grandeur, compilation de plusieurs sources :
        penalties, coups francs, frappes hors surface ; le reste est compté dans la surface). Les buts marqués depuis sont
        classés automatiquement à partir du commentaire du match
        {unclassified > 0 ? ` — ${unclassified} but${unclassified > 1 ? 's' : ''} récent${unclassified > 1 ? 's' : ''} non classé${unclassified > 1 ? 's' : ''}` : ''}.
      </p>
    </section>
  );
}
