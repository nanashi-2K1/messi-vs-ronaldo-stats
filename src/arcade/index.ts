// Point d'entrée chargé à la demande (import dynamique) : three.js n'alourdit pas le premier affichage.
import { Engine } from './engine.ts';

export { createArena, type Arena, type Side, type Theme } from './arena.ts';
export { createVault, type TrophyInfo, type Vault, type VaultCategory } from './vault.ts';
export { webglAvailable } from './engine.ts';

let engine: Engine | null = null;

/** Moteur partagé par les deux scènes (une seule boucle d'animation). */
export function getEngine(): Engine {
  return (engine ??= new Engine());
}
