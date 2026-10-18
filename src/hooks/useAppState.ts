import { useEffect, useState } from 'react';
import { baseline } from '../../shared/baseline.ts';
import { buildAppState, emptyLiveData } from '../../shared/merge.ts';
import type { AppState } from '../../shared/types.ts';

/** stream : flux SSE ouvert · polling : requêtes périodiques · offline : serveur injoignable. */
export type Connection = 'connecting' | 'stream' | 'polling' | 'offline';

const POLL_MS = 30_000;

function localState(): AppState {
  return buildAppState(baseline, emptyLiveData(), {
    provider: 'ESPN',
    status: 'starting',
    lastSuccessAt: null,
    lastError: null,
    refreshSeconds: null,
  });
}

function isAppState(x: unknown): x is AppState {
  return typeof x === 'object' && x != null && 'players' in x && 'live' in x;
}

/**
 * État de l'application : affiche immédiatement les données de référence, puis
 * se branche sur le flux temps réel du serveur (SSE), avec repli sur des
 * requêtes périodiques si le flux n'est pas disponible.
 */
export function useAppState(): { state: AppState; connection: Connection } {
  const [state, setState] = useState<AppState>(localState);
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch('/api/state', { headers: { accept: 'application/json' } });
        const body: unknown = res.ok && res.headers.get('content-type')?.includes('json') ? await res.json() : null;
        if (!isAppState(body)) throw new Error('Réponse inattendue');
        if (!cancelled) {
          setState(body);
          setConnection('polling');
        }
      } catch {
        if (!cancelled) {
          setState((s) => (s.live.status === 'starting' ? { ...s, live: { ...s.live, status: 'offline' } } : s));
          setConnection('offline');
        }
      } finally {
        if (!cancelled) pollTimer = setTimeout(poll, POLL_MS);
      }
    };

    if (typeof EventSource === 'undefined') {
      void poll();
    } else {
      source = new EventSource('/api/stream');
      source.addEventListener('state', (e) => {
        const body: unknown = JSON.parse((e as MessageEvent<string>).data);
        if (!isAppState(body)) return;
        setState(body);
        setConnection('stream');
      });
      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          // Pas de flux SSE (hébergement statique, proxy…) : repli sur des requêtes périodiques.
          source = null;
          void poll();
        } else {
          setConnection((c) => (c === 'stream' ? 'connecting' : c));
        }
      };
    }

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
