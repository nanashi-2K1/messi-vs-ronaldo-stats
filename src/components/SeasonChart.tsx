import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ratio, seasonMidpoint } from '../../shared/metrics.ts';
import type { PlayerId, PlayerState } from '../../shared/types.ts';
import { fmtDec, fmtInt } from '../lib/format.ts';

type Metric = 'goals' | 'apps' | 'ratio';

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'goals', label: 'Buts', unit: 'buts' },
  { id: 'apps', label: 'Matchs', unit: 'matchs' },
  { id: 'ratio', label: 'Buts / match', unit: 'but/match' },
];

interface Point {
  x: number;
  season: string;
  teams: string[];
  apps: number;
  goals: number;
  estimated: boolean;
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
    const pt = bySeason.get(s.season) ?? { x: seasonMidpoint(s.season), season: s.season, teams: [], apps: 0, goals: 0, estimated: false, value: 0 };
    pt.apps += s.apps;
    pt.goals += s.goals;
    pt.teams.push(team);
    pt.estimated ||= s.estimated === true;
    bySeason.set(s.season, pt);
  }
  const points = [...bySeason.values()]
    .filter((pt) => Number.isFinite(pt.x))
    .map((pt) => ({ ...pt, value: metric === 'goals' ? pt.goals : metric === 'apps' ? pt.apps : (ratio(pt.goals, pt.apps) ?? 0) }))
    .sort((a, b) => a.x - b.x);
  return { id: p.baseline.id, name: p.baseline.name, color: `var(--${p.baseline.id})`, points };
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
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

const HEIGHT = 300;
const M = { top: 22, right: 14, bottom: 28, left: 40 };

export function SeasonChart({ messi, ronaldo }: { messi: PlayerState; ronaldo: PlayerState }) {
  const [metric, setMetric] = useState<Metric>('goals');
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [boxRef, width] = useWidth<HTMLDivElement>(900);

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
  const innerH = HEIGHT - M.top - M.bottom;
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

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const xVal = x0 + ((px - M.left) / innerW) * (x1 - x0);
    const snap = allX.reduce((a, b) => (Math.abs(b - xVal) < Math.abs(a - xVal) ? b : a), allX[0] ?? xVal);
    setHoverX(snap);
    setPointer({ x: px, y: e.clientY - rect.top });
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = hoverX == null ? -1 : allX.indexOf(hoverX);
    const next = allX[Math.min(allX.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))] ?? null;
    setHoverX(next);
    setPointer(next == null ? null : { x: sx(next), y: M.top + 20 });
  };

  const hovered = hoverX == null ? [] : series.map((s) => ({ s, p: nearest(s, hoverX) }));
  const tipLeft = pointer ? Math.min(Math.max(8, pointer.x + 14), width - 270) : 0;

  return (
    <section className="card" aria-labelledby="seasons-title">
      <div className="section-head">
        <h2 id="seasons-title">Saison par saison (clubs)</h2>
        <div className="segmented" role="group" aria-label="Indicateur affiché">
          {METRICS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="legend" style={{ marginBottom: 8 }}>
        {series.map((s) => (
          <span className="legend-item" key={s.id}>
            <span className="swatch line" style={{ background: s.color }} aria-hidden /> {s.name}
          </span>
        ))}
        <span className="legend-item">
          <svg width="12" height="12" aria-hidden>
            <circle cx="6" cy="6" r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
          </svg>
          valeur estimée
        </span>
        <span className="legend-item">dernier point : saison en cours</span>
      </div>
      <div className="chart-box" ref={boxRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${METRICS.find((m) => m.id === metric)!.label} par saison en club, Messi et Ronaldo. Flèches gauche/droite pour parcourir.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => {
            setHoverX(null);
            setPointer(null);
          }}
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
            <text key={t} className="tick" x={sx(t)} y={HEIGHT - 8} textAnchor="middle">
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
                  <circle
                    key={p.season}
                    cx={sx(p.x)}
                    cy={sy(p.value)}
                    r={hoverX === p.x ? 5.5 : 4}
                    fill={p.estimated ? 'var(--surface)' : s.color}
                    stroke={p.estimated ? s.color : 'var(--surface)'}
                    strokeWidth={2}
                  />
                ))}
                {top ? (
                  <text className="direct-label" x={sx(top.x)} y={sy(top.value) - 10} textAnchor="middle">
                    {fmt(top.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => {
              setHoverX(null);
              setPointer(null);
            }}
          />
        </svg>
        {hoverX != null && pointer && hovered.some((h) => h.p) ? (
          <div className="tooltip" style={{ left: tipLeft, top: Math.max(0, pointer.y - 70) }} role="status">
            {hovered.map(({ s, p }) =>
              p ? (
                <div className="tt-row" key={s.id}>
                  <span className="tt-key" style={{ background: s.color }} />
                  <span>
                    <strong>
                      {fmt(p.value)} {unit}
                    </strong>
                    {p.estimated ? ' (estimé)' : ''}
                    <span className="tt-sub">
                      {s.name.split(' ').at(-1)} · {p.season} · {p.teams.join(' + ')}
                    </span>
                    <span className="tt-sub">
                      {fmtInt(p.goals)} buts en {fmtInt(p.apps)} matchs
                    </span>
                  </span>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </div>
      <details className="table-view">
        <summary>Voir les données en tableau</summary>
        <div className="grid-2">
          {series.map((s) => (
            <div className="table-scroll" key={s.id}>
              <table className="data-table">
                <caption className="sr-only">{s.name} — saisons en club</caption>
                <thead>
                  <tr>
                    <th>Saison</th>
                    <th>Club</th>
                    <th className="num">Matchs</th>
                    <th className="num">Buts</th>
                  </tr>
                </thead>
                <tbody>
                  {s.points.map((p) => (
                    <tr key={p.season}>
                      <td>
                        {p.season}
                        {p.estimated ? '*' : ''}
                      </td>
                      <td>{p.teams.join(' + ')}</td>
                      <td className="num">{fmtInt(p.apps)}</td>
                      <td className="num">{fmtInt(p.goals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <p className="note">* Saison reconstituée par différence entre les totaux par club (valeur indicative).</p>
      </details>
    </section>
  );
}
