import { useState } from 'react';
import { bestAndWorstZones, MIN_ATTEMPTS_FOR_RANKING } from '../../shared/merge.ts';
import { GOAL_ZONES, type GoalZone, type PlayerState } from '../../shared/types.ts';
import { PLAYER_COLORS, useReveal, type ThemeChoice } from '../hooks/useArcade.ts';
import { bodyPartFigures } from '../lib/figures.ts';
import { fmtDate, fmtInt, fmtPct } from '../lib/format.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';
import { CompareRows } from './CompareRows.tsx';

type Mode = 'share' | 'rate';

const TITLES: Record<GoalZone, string> = {
  insideBox: 'Dans la surface (jeu)',
  outsideBox: 'Hors surface (jeu)',
  freeKick: 'Coup franc direct',
  penalty: 'Penalty',
};

const CAPTIONS: Record<GoalZone, string> = { penalty: 'PEN.', insideBox: 'SURFACE', freeKick: 'COUPS FRANCS', outsideBox: 'HORS SURFACE' };

interface ZoneView {
  zone: GoalZone;
  /** Valeur affichée sur le terrain. */
  value: string;
  /** 0 → 1, null si la donnée manque. */
  intensity: number | null;
  tip: string[];
  /** Ligne du classement. */
  main: string;
  side: string;
  scope?: string;
  sort: number;
  mark?: 'best' | 'worst';
}

function shareViews(p: PlayerState): ZoneView[] {
  const total = GOAL_ZONES.reduce((s, z) => s + p.zones[z], 0);
  const max = Math.max(...GOAL_ZONES.map((z) => p.zones[z]), 1);
  return GOAL_ZONES.map((z) => {
    const v = p.zones[z];
    const share = total ? v / total : 0;
    return {
      zone: z,
      value: fmtInt(v),
      intensity: v / max,
      tip: [`${fmtInt(v)} buts`, `${fmtPct(share)} du total`],
      main: fmtInt(v),
      side: fmtPct(share),
      sort: v,
    };
  });
}

function rateViews(p: PlayerState): ZoneView[] {
  const rates = p.conversion;
  const { best, worst } = bestAndWorstZones(rates);
  const ok = (z: GoalZone) => rates[z].sufficient && rates[z].rate != null;
  const max = Math.max(...GOAL_ZONES.filter(ok).map((z) => rates[z].rate ?? 0), 0.0001);
  return GOAL_ZONES.map((z) => {
    const r = rates[z];
    const known = ok(z);
    const view: ZoneView = {
      zone: z,
      value: known ? fmtPct(r.rate) : '—',
      intensity: known ? (r.rate ?? 0) / max : null,
      tip: known
        ? [`${fmtPct(r.rate, true)} de réussite`, `${fmtInt(r.scored)} buts sur ${fmtInt(r.attempts)} tentatives`, r.scope]
        : [`Échantillon insuffisant : ${fmtInt(r.attempts)} tentative${r.attempts > 1 ? 's' : ''} suivie${r.attempts > 1 ? 's' : ''}`, `Affiché à partir de ${MIN_ATTEMPTS_FOR_RANKING}`],
      main: known ? fmtPct(r.rate, true) : '—',
      side: known ? `${fmtInt(r.scored)}/${fmtInt(r.attempts)}` : `${fmtInt(r.attempts)} tir${r.attempts > 1 ? 's' : ''}`,
      scope: r.scope,
      sort: known ? (r.rate ?? 0) : -1,
    };
    if (z === best) view.mark = 'best';
    else if (z === worst) view.mark = 'worst';
    return view;
  });
}

const markText = (m?: 'best' | 'worst') => (m === 'best' ? '★ ' : m === 'worst' ? '▼ ' : '');

/** Demi-terrain pixel (maquette arcade) : zones colorées selon leur poids ou leur réussite. */
function Pitch({ side, name, views, color }: { side: 'm' | 'r'; name: string; views: ZoneView[]; color: string }) {
  const by = Object.fromEntries(views.map((v) => [v.zone, v])) as Record<GoalZone, ZoneView>;
  const opacity = (v: ZoneView) => (v.intensity == null ? 0.06 : 0.14 + 0.86 * Math.pow(v.intensity, 0.6));
  const zone = (z: GoalZone, shape: React.ReactElement<React.SVGProps<SVGRectElement>>) => {
    const v = by[z];
    const props: React.SVGProps<SVGRectElement> = {
      className: 'z',
      fill: color,
      fillOpacity: opacity(v),
      tabIndex: 0,
      'aria-label': `${TITLES[z]} : ${v.tip.join(', ')}`,
      onMouseMove: (e) => showTip(`${name.toUpperCase()} · ${TITLES[z]}`, v.tip.map((value) => ({ value })), e.clientX, e.clientY, color),
      onMouseLeave: hideTip,
    };
    return <rect {...shape.props} {...props} />;
  };
  return (
    <svg className="pitch" viewBox="0 0 340 284" shapeRendering="crispEdges" role="img" aria-label={`Carte des zones de but de ${name}`}>
      <defs>
        <pattern id={`pxg-${side}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="1" fill="rgba(0,0,0,.25)" />
          <rect width="1" height="6" fill="rgba(0,0,0,.25)" />
        </pattern>
      </defs>
      <rect x="10" y="20" width="320" height="254" fill="var(--pitch-bg)" />
      {zone('outsideBox', <rect x="10" y="20" width="320" height="254" />)}
      {zone('freeKick', <rect x="44" y="20" width="252" height="146" />)}
      {zone('insideBox', <rect x="72" y="20" width="196" height="104" />)}
      {zone('penalty', <rect x="150" y="70" width="40" height="36" />)}
      <rect x="10" y="20" width="320" height="254" fill={`url(#pxg-${side})`} pointerEvents="none" />
      <rect className="ln" x="10" y="20" width="320" height="254" />
      <rect className="ln" x="72" y="20" width="196" height="104" />
      <rect className="ln" x="126" y="20" width="88" height="34" />
      <rect className="ln" x="140" y="6" width="60" height="14" />
      <path className="ln" d="M136 124 A42 42 0 0 0 204 124" />
      <path className="ln" d="M118 274 A52 52 0 0 1 222 274" />
      <text x="170" y="90" textAnchor="middle" fontSize={by.penalty.value.length > 4 ? 9 : 11}>
        {by.penalty.value}
      </text>
      <text x="170" y="102" textAnchor="middle" fontSize="6">
        {markText(by.penalty.mark)}
        {CAPTIONS.penalty}
      </text>
      <text x="236" y="78" textAnchor="middle" fontSize="15">
        {by.insideBox.value}
      </text>
      <text x="236" y="96" textAnchor="middle" fontSize="7">
        {markText(by.insideBox.mark)}
        {CAPTIONS.insideBox}
      </text>
      <text x="170" y="146" textAnchor="middle" fontSize="11">
        {by.freeKick.value}
      </text>
      <text x="170" y="159" textAnchor="middle" fontSize="6">
        {markText(by.freeKick.mark)}
        {CAPTIONS.freeKick}
      </text>
      <text x="170" y="222" textAnchor="middle" fontSize="14">
        {by.outsideBox.value}
      </text>
      <text x="170" y="240" textAnchor="middle" fontSize="6">
        {markText(by.outsideBox.mark)}
        {CAPTIONS.outsideBox}
      </text>
    </svg>
  );
}

function ZoneCard({ player, mode, color, grown }: { player: PlayerState; mode: Mode; color: string; grown: boolean }) {
  const side = player.baseline.id === 'messi' ? 'm' : 'r';
  const views = mode === 'share' ? shareViews(player) : rateViews(player);
  const ranked = [...views].sort((a, b) => b.sort - a.sort);
  const max = Math.max(...views.map((v) => (v.intensity == null ? 0 : v.intensity)), 0.0001);
  const total = GOAL_ZONES.reduce((s, z) => s + player.zones[z], 0);
  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`sw ${side}`} aria-hidden /> {player.baseline.name}
      </h3>
      <p className="sub">
        {mode === 'share' ? `${fmtInt(total)} buts classés par zone de départ` : 'Part des tentatives transformées dans chaque zone'}
      </p>
      <Pitch side={side} name={player.baseline.name} views={views} color={color} />
      <div className="scale">
        <span>{mode === 'share' ? 'Faible' : 'Moins efficace'}</span>
        <i style={{ background: `linear-gradient(90deg, ${color}24, ${color})` }} />
        <span>{mode === 'share' ? 'Prolifique' : 'Plus efficace'}</span>
      </div>
      <ol className="rank">
        {ranked.map((v, i) => (
          <li key={v.zone}>
            <span className="n">{v.intensity == null ? '–' : i + 1}</span>
            <div>
              {TITLES[v.zone]}
              {v.mark ? <span className="mk">{v.mark === 'best' ? '★ MEILLEUR' : '▼ PLUS FAIBLE'}</span> : null}
              {mode === 'rate' && v.scope ? <small>{v.scope}</small> : null}
              <div className="tr">
                <i style={{ width: grown && v.intensity != null ? `${(v.intensity / max) * 100}%` : 0, background: color }} />
              </div>
            </div>
            <span className="v">{v.main}</span>
            <span className="p">{v.side}</span>
          </li>
        ))}
      </ol>
      {mode === 'rate' ? (
        <p className="note">
          Tous les tirs ({player.baseline.conversion.allShots.scope}) : {fmtPct(player.baseline.conversion.allShots.scored / player.baseline.conversion.allShots.attempts, true)} (
          {fmtInt(player.baseline.conversion.allShots.scored)} / {fmtInt(player.baseline.conversion.allShots.attempts)}).
        </p>
      ) : null}
    </div>
  );
}

export function ZonesSection({ messi, ronaldo, theme, asOf }: { messi: PlayerState; ronaldo: PlayerState; theme: ThemeChoice; asOf: string }) {
  const [mode, setMode] = useState<Mode>('share');
  const [ref, shown] = useReveal<HTMLElement>();
  const colors = PLAYER_COLORS[theme];
  const unclassified = messi.delta.unclassifiedGoals + ronaldo.delta.unclassifiedGoals;
  return (
    <section id="s-zones" ref={ref} className={`lvl reveal${shown ? ' in' : ''}`} aria-labelledby="zones-title">
      <div className="sh">
        <div>
          <span className="kicker">NIVEAU 4</span>
          <h2 id="zones-title">Zones de but</h2>
          <p>
            {mode === 'share'
              ? 'D’où partent les buts. Plus une zone est intense, plus elle pèse dans le total du joueur. Sous chaque terrain, les zones sont classées de la plus prolifique à la plus faible.'
              : 'Où chaque joueur est le plus efficace : part des tentatives transformées. ★ zone au meilleur taux, ▼ zone au taux le plus faible.'}
          </p>
        </div>
        <div className="seg" role="group" aria-label="Affichage du terrain">
          <button type="button" aria-pressed={mode === 'share'} onClick={() => setMode('share')}>
            Répartition
          </button>
          <button type="button" aria-pressed={mode === 'rate'} onClick={() => setMode('rate')}>
            Réussite
          </button>
        </div>
      </div>
      <div className="grid2">
        <ZoneCard player={messi} mode={mode} color={colors.m} grown={shown} />
        <ZoneCard player={ronaldo} mode={mode} color={colors.r} grown={shown} />
      </div>
      <p className="note">
        {mode === 'share' ? (
          <>
            Répartition au {fmtDate(messi.baseline.zones.asOf)} (messivsronaldo.app) : hors surface = frappes dans le jeu, sans les coups
            francs ; surface = hors penalties. Les buts marqués depuis sont classés automatiquement à partir du commentaire du match
            {unclassified > 0 ? ` (${unclassified} but${unclassified > 1 ? 's' : ''} récent${unclassified > 1 ? 's' : ''} non classé${unclassified > 1 ? 's' : ''})` : ''}.
          </>
        ) : (
          <>
            Penalties : carrière (hors tirs au but). Coups francs directs : championnat. Ces deux taux intègrent ensuite chaque tentative des
            matchs suivis. Dans la surface et hors surface : aucune source publique ne détaille les tentatives sur toute la carrière ; ces
            taux se construisent tir par tir depuis le {fmtDate(asOf)}, d’après le commentaire des matchs, et s’affichent à partir de{' '}
            {MIN_ATTEMPTS_FOR_RANKING} tentatives.
          </>
        )}
      </p>
      <div className="card" style={{ marginTop: 32 }}>
        <h3>Pied gauche, pied droit, tête</h3>
        <p className="sub">Part des buts par surface de frappe (référence au {fmtDate(messi.baseline.bodyParts.asOf)}, puis chaque nouveau but)</p>
        <CompareRows items={bodyPartFigures(messi, ronaldo)} grown={shown} />
      </div>
    </section>
  );
}
