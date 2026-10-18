import type { IncomingMessage, ServerResponse } from 'node:http';
import { blobStore } from './blobStore.ts';
import { createTracker, log, stateOf } from './runtime.ts';
import { memoryStore } from './store.ts';
import type { Tracker } from './tracker.ts';

/*
 * Fonction Vercel servie sur /api/state.
 *
 * La réponse est mise en cache par le CDN de Vercel (s-maxage) : quel que soit le
 * nombre de visiteurs, la fonction ne tourne qu'une fois par période (30 s pendant
 * un match, 5 min sinon), et le suivi — donc les appels ESPN et API-Football — ne
 * se fait qu'à ces moments-là. L'état utile (matchs terminés, appels API-Football
 * déjà faits) est conservé dans Vercel Blob pour survivre aux redémarrages.
 */

const TICK_TIMEOUT_MS = 20_000;
let tracker: Tracker | null | undefined;

function getTracker(): Tracker | null {
  if (tracker === undefined) {
    const store = process.env.BLOB_READ_WRITE_TOKEN ? blobStore() : memoryStore();
    tracker = createTracker(store);
  }
  return tracker;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', allow: 'GET, HEAD' });
    res.end(JSON.stringify({ error: 'Méthode non autorisée' }));
    return;
  }

  const t = getTracker();
  if (t) {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, TICK_TIMEOUT_MS).unref());
    await Promise.race([t.tick().catch((e) => log(`Suivi : ${e instanceof Error ? e.message : String(e)}`)), timeout]);
  }

  const state = stateOf(t, false);
  const active = t?.hasActiveEvents() ?? false;
  const ttl = active ? 30 : 300;
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    // Le navigateur revalide toujours ; le CDN partage la même réponse entre tous les visiteurs.
    'cache-control': `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  });
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(state));
}
