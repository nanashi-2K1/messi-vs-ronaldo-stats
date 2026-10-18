import { useEffect, useState } from 'react';
import { baseline } from '../../shared/baseline.ts';
import { buildAppState, emptyLiveData } from '../../shared/merge.ts';
import type { AppState } from '../../shared/types.ts';

/** stream : flux SSE ouvert · polling : requêtes périodiques · offline : serveur injoignable. */
export type Connection = 'connecting' | 'stream' | 'polling' | 'offline';

const MIN_POLL_S = 30;
const MAX_POLL_S = 300;

function localState(): AppState {
  return buildAppState(baseline, emptyLiveData(), {
    provider: 'ESPN',
    status: 'starting',
    lastSuccessAt: null,
    lastError: null,
    refreshSeconds: null,
    push: false,
    quota: null,
  });
}

function isAppState(x: unknown): x is AppState {
  return typeof x === 'object' && x != null && 'players' in x && 'live' in x;
}

/** Délai avant la prochaine requête : celui que le serveur annonce, borné. */
function pollDelay(state: AppState): number {
  const s = state.live.refreshSeconds ?? 60;
  return Math.min(MAX_POLL_S, Math.max(MIN_POLL_S, s)) * 1000;
}

/**
 * État de l'application : affiche immédiatement les données de référence, puis
 * se branche sur le serveur. Serveur Node : flux temps réel (SSE). Vercel : requêtes
 * périodiques sur /api/state, servies par le cache du CDN (aucun appel aux API de
 * football n'est déclenché par l'ouverture de la page).
 */
export function useAppState(): { state: AppState; connection: Connection } {
  const [state, setState] = useState<AppState>(localState);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const openStream = () => {
      source = new EventSource('/api/stream');
      source.addEventListener('state', (e) => {
        const body: unknown = JSON.parse((e as MessageEvent<string>).data);
        if (!isAppState(body)) return;
        setState(body);
        setConnection('stream');
      });
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          source = null;
          pollTimer = setTimeout(poll, MIN_POLL_S * 1000);
        } else {
          setConnection((c) => (c === 'stream' ? 'connecting' : c));
        }
      };
    };

    const poll = async () => {
      let next = MIN_POLL_S * 1000;
      try {
        const res = await fetch('/api/state', { headers: { accept: 'application/json' } });
        const body: unknown = res.ok && res.headers.get('content-type')?.includes('json') ? await res.json() : null;
        if (!isAppState(body)) throw new Error('Réponse inattendue');
        if (cancelled) return;
        setState(body);
        if (body.live.push && typeof EventSource !== 'undefined' && !source) {
          openStream();
          return;
        }
        setConnection('polling');
        next = pollDelay(body);
      } catch {
        if (cancelled) return;
        setState((s) => (s.live.status === 'starting' ? { ...s, live: { ...s.live, status: 'offline' } } : s));
        setConnection('offline');
        next = MAX_POLL_S * 1000;
      }
      if (!cancelled) pollTimer = setTimeout(poll, next);
    };

    void poll();
    return () => {
      cancelled = true;
      source?.close();
      clearTimeout(pollTimer);
    };
  }, []);

  return { state, connection };
}

/** Horloge pour les durées relatives (« il y a 12 s »). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
