# Messi vs Ronaldo — stats en temps réel

Comparateur « arcade 3D » des statistiques de carrière de Lionel Messi et Cristiano Ronaldo : buts, matchs, passes décisives, efficacité, zones de but et taux de réussite par zone, pied/tête, saisons, clubs, grandes compétitions et salle des trophées. Les totaux se mettent à jour **pendant les matchs**, sans recharger la page.

© 2026 nanashi

## Ce que montre l'application

| Niveau | Contenu |
| --- | --- |
| 1 · Arène | Scène 3D voxel : les deux joueurs, compteur de buts animé, progression vers 1 000 buts, match en cours ou prochain match. Mode **duel** (un clic sur une statistique : le meilleur célèbre), passes entre joueurs, célébration automatique à chaque but marqué en direct. Fiches joueur (âge, club, poste, pied fort, taille). |
| 2 · Direct | Score et minute du match en cours, buts / passes / tirs cadrés / temps de jeu du joueur, puis la liste des matchs joués depuis la date de référence. |
| 3 · Chiffres clés | Totaux de carrière, efficacité (buts par match, par 90 min, minutes par but, réussite aux penalties…), grandes compétitions. |
| 4 · Zones de but | Terrain pixel avec deux modes : **Répartition** (d'où partent les buts) et **Réussite** (part des tentatives transformées par zone, avec la meilleure ★ et la plus faible ▼ zone de chaque joueur). Répartition pied gauche / pied droit / tête. |
| 5 · Saisons & clubs | Courbe saison par saison (buts, matchs, buts par match ; survol ou flèches du clavier, vue tableau) et bilan club par club. |
| 6 · Trophées | Vitrine 3D par catégorie (Ballon d'Or, Coupe du monde, Ligue des champions, championnats…), années au survol, visite automatique. |
| Sources | Méthodologie, sources, quota API-Football du jour. |

Réglages en haut de page : thème **sombre / clair** (suit le système par défaut, choix mémorisé), curseur **HD ↔ 8-bit** (taille des pixels du rendu 3D), **pause** des animations. three.js n'est chargé qu'après le premier affichage ; sans WebGL, tous les chiffres restent disponibles. Interface en français, adaptée au mobile, compatible clavier et `prefers-reduced-motion`.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install
npm run dev          # http://localhost:8787 (serveur + interface avec rechargement à chaud)
```

En production :

```bash
npm run build
npm start            # interface construite + API sur http://localhost:8787
```

Avec Docker :

```bash
docker build -t messi-vs-ronaldo .
docker run -p 8787:8787 messi-vs-ronaldo
```

Pour activer API-Football en local, créer un fichier `.env` (ignoré par git) :

```
API_FOOTBALL_KEY=votre_clé
```

## Comment fonctionne le temps réel

```
ESPN (calendriers, compositions, fil d'actions)      API-Football (complément, budget limité)
        │  calendrier toutes les 10 min,                    │  minutes exactes, note, passes clés,
        │  match en cours toutes les 30 s                   │  penalties (matchs en cours et terminés)
        ▼                                                   ▼
                     server/tracker.ts  ──►  données de référence + nouveaux matchs (shared/merge.ts)
                              │
             ┌────────────────┴─────────────────┐
             ▼                                  ▼
  serveur Node : SSE (/api/stream)     Vercel : /api/state mis en cache par le CDN
             └────────────────┬─────────────────┘
                              ▼
            navigateur : la page se met à jour à chaque changement
```

1. **Données de référence** (`shared/baseline.ts`) : totaux de carrière arrêtés au **18 octobre 2026**, compilés à partir de sources publiques (liste dans l'application et dans le fichier).
2. **Suivi ESPN** (`server/tracker.ts`) : le serveur lit les calendriers de l'Inter Miami, d'Al Nassr et du Portugal dans chaque compétition suivie, puis la feuille de chaque match joué après la date de référence. Il en déduit matchs, buts, passes décisives, tirs, temps de jeu, triplés, zone et surface de contact de chaque but, et chaque tentative par zone (commentaire Opta) pour les taux de réussite.
3. **Complément API-Football** (`server/apiFootball.ts`) : utilisé uniquement pour les matchs en cours ou terminés, sous un budget strict (voir plus bas).
4. **Diffusion** : en local, l'état est poussé aux navigateurs par SSE. Sur Vercel, la page interroge `/api/state` (toutes les 30 s pendant un match, 5 min sinon) ; la réponse est partagée par tous les visiteurs via le cache du CDN.

Les matchs terminés et l'historique des appels API-Football sont enregistrés (`.cache/store.json` en local, Vercel Blob en ligne) : un redémarrage ne redemande jamais un match déjà traité. Si ESPN est injoignable ou change de format, l'application continue d'afficher les données de référence et l'indicateur en haut de page le signale.

## Budget API-Football (100 requêtes / jour)

Le plan gratuit autorise 100 requêtes par jour. L'application :

- **ne fait aucun appel à l'ouverture de la page** : les visiteurs lisent l'état déjà calculé par le serveur (et, sur Vercel, la même réponse en cache CDN) ;
- s'impose un plafond de **80 requêtes / jour** (`API_FOOTBALL_DAILY_CAP`), vérifié avant chaque appel via `/status`, qui ne compte pas dans le quota ;
- n'interroge API-Football **que si ESPN signale un match** de Messi ou de Ronaldo : recherche du match au plus toutes les 15 min (4 fois maximum), feuille du match en cours au plus toutes les 10 min, puis au plus 3 lectures après le coup de sifflet final ;
- mémorise chaque appel : un match terminé n'est plus jamais redemandé, même après un redémarrage ou un nouveau déploiement.

Un match complet coûte ainsi moins d'une vingtaine de requêtes. Le quota consommé du jour est affiché dans la section Sources.

## Déploiement sur Vercel

Le projet produit directement le format de sortie Vercel (`scripts/build-vercel.mjs`) :

- `static/` : l'interface construite par Vite ;
- `functions/api/state.func` : une fonction Node qui exécute un cycle de suivi (au plus une fois par fenêtre de cache) et renvoie l'état avec `Cache-Control: s-maxage=30` pendant un match, `300` sinon.

Configuration côté Vercel :

| Variable | Rôle |
| --- | --- |
| `API_FOOTBALL_KEY` | Clé API-Football (variable *sensible*, jamais dans le dépôt) |
| `BLOB_READ_WRITE_TOKEN` | Ajoutée automatiquement en reliant un store **Vercel Blob** (privé) au projet ; sans elle, l'état n'est conservé qu'en mémoire |
| `API_FOOTBALL_DAILY_CAP` | Optionnel, 80 par défaut |

`vercel.json` lance `npm run build:vercel` ; tout push sur la branche reliée redéploie le site.

## Configuration du serveur

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8787` | Port HTTP |
| `HOST` | `0.0.0.0` | Interface d'écoute |
| `LIVE_PROVIDER` | `espn` | `off` désactive le suivi en direct |
| `DISCOVERY_INTERVAL_MS` | `600000` | Fréquence de lecture des calendriers |
| `LIVE_INTERVAL_MS` | `30000` | Fréquence de rafraîchissement d'un match en cours |
| `CACHE_DIR` | `.cache` | Dossier de l'état enregistré |
| `ESPN_BASE_URL` | API ESPN | Pour pointer vers un miroir ou un faux serveur de test |
| `API_FOOTBALL_KEY` | — | Active le complément API-Football |
| `API_FOOTBALL_DAILY_CAP` | `80` | Plafond quotidien de requêtes API-Football |

Équipes, compétitions et identifiants suivis : `server/config.ts` (à modifier en cas de transfert : la nouvelle équipe apparaît alors automatiquement dans « Club par club »).

## API

| Route | Description |
| --- | --- |
| `GET /api/state` | État complet (JSON) : données de référence + matchs récents + match en cours |
| `GET /api/stream` | Même état en Server-Sent Events, envoyé à chaque changement (serveur Node uniquement) |
| `GET /api/health` | État du suivi en direct (serveur Node uniquement) |

## Mettre à jour les données de référence

Modifier `shared/baseline.ts` (totaux, équipes, saisons, zones, taux de réussite, palmarès) et avancer `asOf` : seuls les matchs joués après cette date sont ajoutés par le suivi, ce qui évite de compter deux fois un match. `npm test` vérifie la cohérence (somme des équipes = totaux, somme des saisons = total par club, zones et surfaces = total des buts, taux de réussite plausibles).

## Fiabilité des chiffres

- Totaux principaux (matchs, buts, passes, minutes) : une seule source pour rester cohérents (messivsronaldo.app). Les passes décisives varient d'un site à l'autre selon la méthode de comptage.
- Taux de réussite : penalties sur toute la carrière (hors séances de tirs au but) et coups francs directs en championnat d'après les sources ; dans la surface et hors surface, aucune source publique ne détaille les tentatives sur toute une carrière, ces taux se construisent tir par tir depuis la date de référence et ne sont classés qu'à partir de 15 tentatives.
- Temps de jeu des nouveaux matchs : minutes exactes d'API-Football quand elles sont disponibles, sinon estimées à partir des remplacements et cartons rouges.
- Championnat saoudien : ESPN n'y publie ni commentaire détaillé ni tirs ; tirs et penalties viennent alors d'API-Football, la zone des buts reste déduite du texte de l'action quand il la mentionne.

## Développement

```bash
npm test             # tests unitaires (parseur ESPN, suivi, budget API-Football, fusion, cohérence des données)
npm run typecheck
npm run check        # typecheck + tests + build
npm run build:vercel # sortie Vercel dans .vercel/output
```

Structure :

```
shared/      types, données de référence, fusion et calculs (serveur et interface)
server/      serveur HTTP, suivi en direct, clients ESPN et API-Football, stockage, fonction Vercel
src/         interface React (sections, graphiques SVG, infobulles)
src/arcade/  scènes three.js (arène, vitrine des trophées), chargées à la demande
tests/       tests Vitest et réponses ESPN simulées
```

## Licence

MIT — © 2026 nanashi. Trophées 3D stylisés génériques (aucune reproduction des trophées officiels).
