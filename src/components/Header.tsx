import { useEffect, useState } from 'react';
import type { LiveInfo } from '../../shared/types.ts';
import type { Connection } from '../hooks/useAppState.ts';
import { fmtDate, fmtRelative } from '../lib/format.ts';

type Tone = 'good' | 'warning' | 'critical' | 'neutral';

function statusView(connection: Connection, live: LiveInfo, asOf: string, now: number): { tone: Tone; title: string; detail: string } {
  const reference = `données au ${fmtDate(asOf)}`;
  if (connection === 'offline') return { tone: 'neutral', title: 'Hors ligne', detail: `serveur injoignable — ${reference}` };
  if (live.status === 'disabled') return { tone: 'neutral', title: 'Suivi en direct désactivé', detail: reference };
  if (live.status === 'starting' || connection === 'connecting')
    return { tone: 'neutral', title: 'Connexion au direct…', detail: reference };
  const updated = `mis à jour ${fmtRelative(live.lastSuccessAt, now)}`;
  if (live.status === 'ok') return { tone: 'good', title: 'En direct', detail: updated };
  if (live.status === 'degraded') return { tone: 'warning', title: 'Flux partiel', detail: updated };
  return { tone: 'critical', title: `Flux ${live.provider} injoignable`, detail: reference };
}

type Theme = 'light' | 'dark';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Stockage indisponible (navigation privée, aperçu…) : on suit le système.
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Préférence non mémorisée, sans conséquence.
    }
  }, [theme]);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="icon-button" onClick={() => setTheme(next)} aria-label={next === 'dark' ? 'Passer en thème sombre' : 'Passer en thème clair'}>
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function Header({ connection, live, asOf, now }: { connection: Connection; live: LiveInfo; asOf: string; now: number }) {
  const s = statusView(connection, live, asOf, now);
  return (
    <header className="topbar">
      <div className="brand">
        <div>
          <h1>
            Messi <span className="vs">vs</span> Ronaldo
          </h1>
          <p>Statistiques de carrière en temps réel · matchs officiels, club et sélection</p>
        </div>
      </div>
      <div className="toolbar">
        <span className="pill" role="status" title={live.lastError ?? undefined}>
          <span className={`status-icon ${s.tone}`} aria-hidden />
          <strong>{s.title}</strong>
          <span>{s.detail}</span>
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
