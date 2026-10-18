import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ratio, seasonMidpoint } from '../../shared/metrics.ts';
import type { PlayerId, PlayerState } from '../../shared/types.ts';
import { fmtDec, fmtInt } from '../lib/format.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';

type Metric = 'goals' | 'apps' | 'ratio';

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'goals', label: 'Buts', unit: 'buts' },
  { id: 'apps', label: 'Matchs', unit: 'matchs' },
  { id: 'ratio', label: 'Buts par match', unit: 'but/match' },
];

interface Point {
  x: number;
  season: string;
  teams: string[];
  apps: number;
  goals: number;
  value: number;
}

interface Series {
  id: PlayerId;
  name: string;
  color: string;
  points: Point[];
}

function buildSeries(p: PlayerState, metric: Metric): Series {
  const bySeason = new Map<string, Point>();
  for (const s of p.seasons) {
    const team = p.teams.find((t) => t.key === s.teamKey)?.name ?? s.teamKey;
    const pt = bySeason.get(s.season) ?? { x: seasonMidpoint(s.season), season: s.season, teams: [], apps: 0, goals: 0, value: 0 };
    pt.apps += s.apps;
    pt.goals += s.goals;
    pt.teams.push(team);
    bySeason.set(s.season, pt);
  }
  const points = [...bySeason.values()]
    .filter((pt) => Number.isFinite(pt.x))
    .map((pt) => ({ ...pt, value: metric === 'goals' ? pt.goals : metric === 'apps' ? pt.apps : (ratio(pt.goals, pt.apps) ?? 0) }))
    .sort((a, b) => a.x - b.x);
  return { id: p.baseline.id, name: p.baseline.name, color: p.baseline.id === 'messi' ? 'var(--m)' : 'var(--r)', points };
}

function niceStep(max: number, count: number) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const M = { top: 24, right: 14, bottom: 30, left: 40 };

export function SeasonChart({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const [metric, setMetric] = useState<Metric>('goals');
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [boxRef, width] = useWidth<HTMLDivElement>(900);
  const height = width < 560 ? 260 : 320;

  const series = useMemo(() => [buildSeries(messi, metric), buildSeries(ronaldo, metric)], [messi, ronaldo, metric]);
  const allX = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series]);
  const unit = METRICS.find((m) => m.id === metric)!.unit;
  const fmt = (v: number) => (metric === 'ratio' ? fmtDec(v) : fmtInt(v));

  const x0 = Math.floor(allX[0] ?? 2003) - 0.5;
  const x1 = Math.ceil(allX.at(-1) ?? 2027) + 0.5;
  const yMaxRaw = Math.max(1e-9, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const step = niceStep(yMaxRaw, 4);
  const yMax = Math.ceil(yMaxRaw / step) * step;
  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const sx = (x: number) => M.left + ((x - x0) / (x1 - x0)) * innerW;
  const sy = (y: number) => M.top + innerH - (y / yMax) * innerH;
  const yTicks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const yearStep = innerW < 420 ? 6 : innerW < 700 ? 4 : 2;
  const xTicks: number[] = [];
  for (let y = Math.ceil(x0 / yearStep) * yearStep; y <= x1; y += yearStep) xTicks.push(y);

  const nearest = (s: Series, x: number) => {
    let best: Point | null = null;
    for (const p of s.points) if (Math.abs(p.x - x) <= 0.75 && (!best || Math.abs(p.x - x) < Math.abs(best.x - x))) best = p;
    return best;
  };

  const tipFor = (x: number, clientX: number, clientY: number) => {
    const lines = series.flatMap((s) => {
      const p = nearest(s, x);
      return p
        ? [
            {
              label: s.name.split(' ').at(-1)!,
              value: `${fmt(p.value)} ${unit} · ${p.season} · ${p.teams.join(' + ')} (${fmtInt(p.goals)} b. / ${fmtInt(p.apps)} m.)`,
              color: s.color,
            },
          ]
        : [];
    });
    if (lines.length) showTip('SAISON', lines, clientX, clientY);
    else hideTip();
  };

  const clear = () => {
    setHoverX(null);
    hideTip();
  };

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const xVal = x0 + ((e.clientX - rect.left - M.left) / innerW) * (x1 - x0);
    const snap = allX.reduce((a, b) => (Math.abs(b - xVal) < Math.abs(a - xVal) ? b : a), allX[0] ?? xVal);
    setHoverX(snap);
    tipFor(snap, e.clientX, e.clientY);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = hoverX == null ? -1 : allX.indexOf(hoverX);
    const next = allX[Math.min(allX.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    if (next == null) return;
    setHoverX(next);
    const rect = e.currentTarget.getBoundingClientRect();
    tipFor(next, rect.left + sx(next), rect.top + M.top + 10);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Saison par saison (clubs)</h3>
          <p className="sub">Toutes compétitions de club · dernier point : saison en cours</p>
        </div>
        <div className="seg" role="group" aria-label="Indicateur affiché">
          {METRICS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="legend">
        {series.map((s) => (
          <span className="lg" key={s.id}>
            <i className={`sw ${s.id === 'messi' ? 'm' : 'r'}`} aria-hidden /> {s.name}
          </span>
        ))}
      </div>
      <div className="chart-box" ref={boxRef}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${METRICS.find((m) => m.id === metric)!.label} par saison en club, Messi et Ronaldo. Flèches gauche/droite pour parcourir.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={clear}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={M.left} x2={width - M.right} y1={sy(t)} y2={sy(t)} />
              <text className="tick" x={M.left - 8} y={sy(t) + 4} textAnchor="end">
                {fmt(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="tick" x={sx(t)} y={height - 8} textAnchor="middle">
              {t}
            </text>
          ))}
          {hoverX != null ? <line className="crosshair" x1={sx(hoverX)} x2={sx(hoverX)} y1={M.top} y2={M.top + innerH} /> : null}
          {series.map((s) => {
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
            const top = s.points.reduce<Point | null>((a, b) => (!a || b.value > a.value ? b : a), null);
            return (
              <g key={s.id}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {s.points.map((p) => (
                  <circle key={p.season} cx={sx(p.x)} cy={sy(p.value)} r={hoverX === p.x ? 5.5 : 4} fill={s.color} stroke="var(--panel)" strokeWidth={2} />
                ))}
                {top ? (
                  <text className="direct-label" x={sx(top.x)} y={sy(top.value) - 10} textAnchor="middle">
                    {fmt(top.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <rect x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={clear} />
        </svg>
      </div>
      <details>
        <summary>Voir les données en tableau</summary>
        <div className="tbl">
          <table>
            <caption className="sr-only">Saisons en club de Messi et Ronaldo</caption>
            <thead>
              <tr>
                <th>Saison</th>
                <th>Joueur</th>
                <th>Club</th>
                <th>Matchs</th>
                <th>Buts</th>
              </tr>
            </thead>
            <tbody>
              {series.flatMap((s) =>
                s.points.map((p) => (
                  <tr key={`${s.id}-${p.season}`}>
                    <td>{p.season}</td>
                    <td>{s.name.split(' ').at(-1)}</td>
                    <td>{p.teams.join(' + ')}</td>
                    <td>{fmtInt(p.apps)}</td>
                    <td>{fmtInt(p.goals)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
