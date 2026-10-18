# Messi vs Ronaldo — stats en temps réel

Comparateur des statistiques de carrière de Lionel Messi et Cristiano Ronaldo : buts, matchs, passes décisives, efficacité, zones de but, pied/tête, clubs, saisons, grandes compétitions et palmarès. Les totaux se mettent à jour **pendant les matchs**, sans recharger la page.

## Ce que montre l'application

| Section | Contenu |
| --- | --- |
| Cartes joueurs | Buts en carrière, progression vers les 1 000 buts, âge, club, poste, pied fort, taille, match en cours ou prochain match |
| En ce moment | Score en direct, minute, buts / passes / tirs cadrés / temps de jeu du joueur dans le match |
| Chiffres clés | Matchs, buts, passes décisives, buts + passes, minutes, triplés, buts en club, sélections, buts en sélection, Ballons d'Or |
| Efficacité | Buts, passes et contributions par match, buts par 90 min, minutes par but, buts hors penalty, part des penalties, ratios club / sélection |
| Zones de but | Demi-terrain : dans la surface, hors surface, coups francs directs, penalties |
| Pied / tête | Répartition pied gauche, pied droit, tête |
| Grandes compétitions | Ligue des champions, Coupe du monde, Copa América / Euro, Liga |
| Saison par saison | Courbe buts / matchs / buts par match en club (survol ou flèches du clavier, vue tableau) |
| Club par club | Matchs, buts et ratio par équipe |
| Matchs depuis la date de référence | Chaque nouveau match, avec la ligne de stats du joueur et le détail de ses buts |
| Palmarès | Ballon d'Or, Coupe du monde, titres continentaux, Ligue des champions, championnats, etc. |

Interface en français, thème clair/sombre, adaptée au mobile.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install
npm run dev          # http://localhost:8787 (serveur + interface avec rechargement à chaud)
```

En production :

```bash
npm run build
npm start            # sert l'interface construite et l'API sur http://localhost:8787
```

Avec Docker :

```bash
docker build -t messi-vs-ronaldo .
docker run -p 8787:8787 messi-vs-ronaldo
```

## Comment fonctionne le temps réel

```
ESPN (scores, compositions, fil d'actions)
        │  interrogé par le serveur Node : calendrier toutes les 10 min,
        │  match en cours toutes les 30 s
        ▼
server/tracker.ts ──► données de référence + matchs récents (shared/merge.ts)
        │
        ▼  Server-Sent Events (/api/stream)
navigateur : la page se met à jour à chaque changement
```

1. **Données de référence** (`shared/baseline.ts`) : totaux de carrière arrêtés au **16 octobre 2026**, compilés à partir de sources publiques (liste dans l'application et dans le fichier).
2. **Suivi en direct** (`server/tracker.ts`) : le serveur repère les matchs de l'Inter Miami et d'Al Nassr (et du Portugal) joués après cette date, lit la composition et le fil d'actions de chaque match, et en déduit matchs, buts, passes décisives, tirs, temps de jeu estimé, triplés, zone et surface de contact de chaque but.
3. **Diffusion** : l'état consolidé est poussé aux navigateurs par SSE. Si le flux n'est pas disponible, la page interroge `/api/state` toutes les 30 s ; sans serveur, elle affiche les données de référence.

Les matchs terminés sont mis en cache dans `.cache/matches.json` pour ne pas être redemandés au redémarrage. Les compétitions qui ne répondent pas (hors saison, identifiant inconnu) sont ignorées pendant 6 h.

Le flux ESPN utilisé (`site.api.espn.com`) est public mais non officiel et non documenté. Le parseur (`server/espn/parse.ts`) est volontairement tolérant : si le format change ou si le service est injoignable, l'application continue d'afficher les données de référence et l'indicateur en haut de page le signale.

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `8787` | Port HTTP |
| `HOST` | `0.0.0.0` | Interface d'écoute |
| `LIVE_PROVIDER` | `espn` | `off` désactive le suivi en direct |
| `DISCOVERY_INTERVAL_MS` | `600000` | Fréquence de recherche des matchs (calendrier, résultats) |
| `LIVE_INTERVAL_MS` | `30000` | Fréquence de rafraîchissement d'un match en cours |
| `CACHE_DIR` | `.cache` | Dossier du cache des matchs terminés |
| `ESPN_BASE_URL` | API ESPN | Pour pointer vers un miroir ou un faux serveur de test |

Équipes et compétitions suivies : `server/config.ts` (à modifier en cas de transfert : la nouvelle équipe apparaît alors automatiquement dans « Club par club »).

## API

| Route | Description |
| --- | --- |
| `GET /api/state` | État complet (JSON) : données de référence + matchs récents + match en cours |
| `GET /api/stream` | Même état en Server-Sent Events, envoyé à chaque changement |
| `GET /api/health` | État du suivi en direct |

## Mettre à jour les données de référence

Modifier `shared/baseline.ts` (totaux, équipes, saisons, zones, palmarès) et avancer `asOf` : seuls les matchs joués après cette date sont ajoutés par le suivi en direct, ce qui évite de compter deux fois un match. `npm test` vérifie la cohérence (somme des équipes = totaux, somme des saisons = total par club, zones = total des buts).

## Fiabilité des chiffres

- Totaux principaux (matchs, buts, passes, minutes) : une seule source pour rester cohérents (messivsronaldo.app). Les passes décisives varient sensiblement d'un site à l'autre selon la méthode de comptage.
- Zones, pied/tête et triplés : compilations de plusieurs sources, affichées comme ordres de grandeur.
- Saisons marquées « estimées » : reconstituées par différence entre les totaux par club.
- Temps de jeu des nouveaux matchs : estimé à partir des remplacements et cartons rouges du fil d'actions.
- Si ESPN ne publie pas la composition d'un match, seuls les buts et passes du fil d'actions sont comptés : le match n'est compté comme joué que si le joueur y a été décisif (le serveur redemande la composition pendant 48 h).

## Développement

```bash
npm test             # tests unitaires (parseur ESPN, suivi, fusion, cohérence des données)
npm run typecheck
npm run check        # typecheck + tests + build
```

Structure :

```
shared/   types, données de référence, fusion et calculs (utilisés par le serveur et l'interface)
server/   serveur HTTP, suivi en direct, client et parseur ESPN, cache
src/      interface React (composants, graphiques SVG)
tests/    tests Vitest et réponses ESPN simulées
```

## Licence

MIT
