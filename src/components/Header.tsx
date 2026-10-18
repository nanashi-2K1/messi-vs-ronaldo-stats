import { useEffect, useState } from 'react';
import type { LiveInfo } from '../../shared/types.ts';
import type { ThemeChoice } from '../hooks/useArcade.ts';
import type { Connection } from '../hooks/useAppState.ts';
import { fmtDate, fmtRelative } from '../lib/format.ts';

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

function statusView(connection: Connection, live: LiveInfo, asOf: string, now: number): { tone: Tone; title: string; detail: string } {
  const reference = `données au ${fmtDate(asOf)}`;
  if (connection === 'offline') return { tone: 'neutral', title: 'HORS LIGNE', detail: `serveur injoignable — ${reference}` };
  if (live.status === 'disabled') return { tone: 'neutral', title: 'DIRECT COUPÉ', detail: reference };
  if (live.status === 'starting' || connection === 'connecting') return { tone: 'neutral', title: 'CONNEXION…', detail: reference };
  const updated = `mis à jour ${fmtRelative(live.lastSuccessAt, now)}`;
  if (live.status === 'ok') return { tone: 'good', title: 'EN DIRECT', detail: updated };
  if (live.status === 'degraded') return { tone: 'warning', title: 'FLUX PARTIEL', detail: updated };
  return { tone: 'critical', title: 'FLUX INJOIGNABLE', detail: reference };
}

interface Props {
  connection: Connection;
  live: LiveInfo;
  asOf: string;
  now: number;
  theme: ThemeChoice;
  onToggleTheme: () => void;
  pixelSize: number;
  onPixelSize: (px: number) => void;
  paused: boolean;
  onPause: () => void;
}

export function Header(p: Props) {
  const s = statusView(p.connection, p.live, p.asOf, p.now);
  return (
    <header className="top">
      <div>
        <h1>
          <span className="m">MESSI</span> <span className="vs">VS</span> <span className="r">RONALDO</span>
        </h1>
        <p>Statistiques de carrière en temps réel · version arcade 3D</p>
      </div>
      <div className="ctrl">
        <span className="status" role="status" title={p.live.lastError ?? undefined}>
          <span className={`sq ${s.tone}`} aria-hidden />
          <b>{s.title}</b>
          <span>{s.detail}</span>
        </span>
        <label title="Taille des pixels du rendu 3D">
          HD
          <input type="range" min={1} max={6} value={p.pixelSize} onChange={(e) => p.onPixelSize(Number(e.target.value))} aria-label="Taille des pixels" />
          8-BIT
        </label>
        <button type="button" className="pbtn" aria-pressed={p.paused} onClick={p.onPause}>
          {p.paused ? 'Reprendre' : 'Pause'}
        </button>
        <button
          type="button"
          className="pbtn"
          onClick={p.onToggleTheme}
          aria-label={p.theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
        >
          <span className="ico" aria-hidden>
            {p.theme === 'dark' ? '☀' : '☾'}
          </span>{' '}
          {p.theme === 'dark' ? 'Clair' : 'Sombre'}
        </button>
      </div>
    </header>
  );
}

const TABS = [
  ['s-arena', 'Arène'],
  ['s-live', 'Direct'],
  ['s-stats', 'Chiffres'],
  ['s-zones', 'Zones de but'],
  ['s-seasons', 'Saisons & clubs'],
  ['s-vault', 'Trophées'],
  ['s-sources', 'Sources'],
] as const;

/** Onglets collants ; l'onglet de la section visible est mis en avant. */
export function Tabs() {
  const [current, setCurrent] = useState<string>(TABS[0][0]);
  useEffect(() => {
    const onScroll = () => {
      let cur: string = TABS[0][0];
      for (const [id] of TABS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 120) cur = id;
      }
      setCurrent(cur);
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className="tabs" aria-label="Sections">
      {TABS.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={current === id ? 'on' : undefined} aria-current={current === id ? 'true' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
