import { useEffect, useState } from 'react';
import { ArenaSection } from './components/ArenaSection.tsx';
import { Footer } from './components/Footer.tsx';
import { Header, Tabs } from './components/Header.tsx';
import { LiveSection } from './components/LiveSection.tsx';
import { SeasonsSection } from './components/SeasonsSection.tsx';
import { StatsSection } from './components/StatsSection.tsx';
import { TrophySection } from './components/TrophySection.tsx';
import { ZonesSection } from './components/ZonesSection.tsx';
import { useAppState, useNow } from './hooks/useAppState.ts';
import { useTheme } from './hooks/useArcade.ts';

const DEFAULT_PIXEL = 3;

export function App() {
  const { state, connection } = useAppState();
  const now = useNow();
  const [theme, toggleTheme] = useTheme();
  const [pixelSize, setPixelSize] = useState(DEFAULT_PIXEL);
  const [paused, setPaused] = useState(false);
  const { messi, ronaldo } = state.players;
  const liveConnected = connection !== 'offline' && (state.live.status === 'ok' || state.live.status === 'degraded');

  // Réglages du rendu 3D (taille des pixels, pause) appliqués au moteur partagé.
  useEffect(() => {
    let cancelled = false;
    import('./arcade/index.ts')
      .then((A) => {
        if (cancelled) return;
        const engine = A.getEngine();
        engine.setPixelSize(pixelSize);
        engine.paused = paused;
      })
      .catch(() => {
        // Sans 3D, ces réglages n'ont pas d'effet.
      });
    return () => {
      cancelled = true;
    };
  }, [pixelSize, paused]);

  return (
    <div className="wrap">
      <Header
        connection={connection}
        live={state.live}
        asOf={state.baselineAsOf}
        now={now}
        theme={theme}
        onToggleTheme={toggleTheme}
        pixelSize={pixelSize}
        onPixelSize={setPixelSize}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
      />
      <Tabs />
      <main>
        <ArenaSection messi={messi} ronaldo={ronaldo} theme={theme} now={now} liveConnected={liveConnected} />
        <LiveSection messi={messi} ronaldo={ronaldo} asOf={state.baselineAsOf} />
        <StatsSection messi={messi} ronaldo={ronaldo} />
        <ZonesSection messi={messi} ronaldo={ronaldo} theme={theme} asOf={state.baselineAsOf} />
        <SeasonsSection messi={messi} ronaldo={ronaldo} />
        <TrophySection messi={messi} ronaldo={ronaldo} theme={theme} />
      </main>
      <Footer asOf={state.baselineAsOf} sources={state.sources} live={state.live} />
    </div>
  );
}
