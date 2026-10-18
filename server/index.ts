import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppState } from '../shared/types.ts';
import { createTracker, liveEnabled, loadDotEnv, log, stateOf } from './runtime.ts';
import { fileStore } from './store.ts';

loadDotEnv();

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = isProd ? resolve(here, '../..') : resolve(here, '..');
const clientDir = resolve(projectRoot, 'dist/client');

const tracker = createTracker(fileStore(process.env.CACHE_DIR ?? resolve(projectRoot, '.cache')));

/* ------------------------------ État et diffusion ------------------------------ */

let state: AppState = build();
let fingerprint = fingerprintOf(state);
const streams = new Set<ServerResponse>();

function build(): AppState {
  // Serveur Node : les mises à jour sont poussées en SSE.
  return stateOf(tracker, true);
}

function fingerprintOf(s: AppState): string {
  const { generatedAt: _ignored, ...rest } = s;
  return JSON.stringify(rest);
}

function sendEvent(res: ServerResponse, s: AppState) {
  res.write(`event: state\ndata: ${JSON.stringify(s)}\n\n`);
}

tracker?.onChange(() => {
  const next = build();
  const fp = fingerprintOf(next);
  state = next;
  if (fp === fingerprint) return;
  fingerprint = fp;
  for (const res of streams) sendEvent(res, state);
});

setInterval(() => {
  for (const res of streams) res.write(': ping\n\n');
}, 25_000).unref();

/* ---------------------------------- HTTP ---------------------------------- */

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function handleStream(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  sendEvent(res, state);
  streams.add(res);
  req.on('close', () => streams.delete(res));
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function serveStatic(res: ServerResponse, pathname: string, headOnly: boolean) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { error: 'Adresse invalide' });
  }
  let file = resolve(clientDir, `.${decoded}`);
  if (file !== clientDir && !file.startsWith(clientDir + sep)) return sendJson(res, 403, { error: 'Accès refusé' });
  let info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) {
    // Application monopage : toute route inconnue renvoie index.html.
    file = join(clientDir, 'index.html');
    info = await stat(file).catch(() => null);
    if (!info) return sendJson(res, 404, { error: 'Interface non construite : lancez « npm run build ».' });
  }
  const immutable = pathname.startsWith('/assets/');
  res.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (headOnly) return res.end();
  createReadStream(file).pipe(res);
}

const vite = isProd
  ? null
  : await (await import('vite')).createServer({ root: projectRoot, server: { middlewareMode: true }, appType: 'spa' });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  try {
    if (url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { error: 'Méthode non autorisée' });
      if (url.pathname === '/api/state') return sendJson(res, 200, state);
      if (url.pathname === '/api/stream') return handleStream(req, res);
      if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true, live: state.live });
      return sendJson(res, 404, { error: 'Route inconnue' });
    }
    if (vite) return vite.middlewares(req, res, () => sendJson(res, 404, { error: 'Introuvable' }));
    if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { error: 'Méthode non autorisée' });
    await serveStatic(res, url.pathname, method === 'HEAD');
  } catch (e) {
    log(`Erreur sur ${url.pathname} : ${e instanceof Error ? e.message : String(e)}`);
    if (!res.headersSent) sendJson(res, 500, { error: 'Erreur interne' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  log(`Messi vs Ronaldo prêt sur http://localhost:${PORT} (${isProd ? 'production' : 'développement'})`);
  log(liveEnabled() ? `Suivi en direct : ${tracker?.info.provider}` : 'Suivi en direct désactivé (LIVE_PROVIDER=off)');
  tracker?.start();
});

function shutdown() {
  tracker?.stop();
  for (const res of streams) res.end();
  server.close(() => process.exit(0));
  void vite?.close();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
