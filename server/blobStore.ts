import { get, put } from '@vercel/blob';
import { emptyStore, parseStore, type Store } from './store.ts';

/**
 * Stockage Vercel Blob (privé) : un seul fichier JSON, relu au plus une fois par
 * cycle de découverte et réécrit seulement quand un match se termine ou qu'un
 * appel API-Football a été fait. Authentification : BLOB_READ_WRITE_TOKEN.
 */
export function blobStore(pathname = 'cache/store.json'): Store {
  return {
    async load() {
      const result = await get(pathname, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200) return emptyStore();
      return parseStore(await new Response(result.stream).text());
    },
    async save(data) {
      await put(pathname, JSON.stringify(data), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
    },
  };
}
