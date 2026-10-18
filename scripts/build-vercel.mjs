// Construit .vercel/output (Build Output API v3) : l'interface statique et la fonction /api/state.
// Utilisé par Vercel via « npm run build:vercel » (voir vercel.json).
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const out = '.vercel/output';
const fn = `${out}/functions/api/state.func`;

await rm(out, { recursive: true, force: true });
await mkdir(fn, { recursive: true });
await cp('dist/client', `${out}/static`, { recursive: true });

await build({
  entryPoints: ['server/vercel.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: `${fn}/index.mjs`,
  // Certaines dépendances utilisent encore require() : on le fournit en ESM.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
});

const json = (value) => JSON.stringify(value, null, 2);
await writeFile(
  `${fn}/.vc-config.json`,
  json({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }),
);
await writeFile(
  `${out}/config.json`,
  json({
    version: 3,
    routes: [
      { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
      { handle: 'filesystem' },
      { src: '^/api/.*$', status: 404 },
      { src: '^/(.*)$', dest: '/index.html' },
    ],
  }),
);
console.log(`Sortie Vercel prête dans ${out}`);
