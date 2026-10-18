import type { LiveInfo, Source } from '../../shared/types.ts';
import { fmtDate, fmtInt } from '../lib/format.ts';

const every = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

export function Footer({ asOf, sources, live }: { asOf: string; sources: Source[]; live: LiveInfo }) {
  const q = live.quota;
  return (
    <footer className="foot lvl" id="s-sources" aria-labelledby="sources-title">
      <div className="sh">
        <div>
          <span className="kicker">GAME OVER ?</span>
          <h2 id="sources-title">Méthodologie et sources</h2>
        </div>
      </div>
      <p>
        Les totaux de référence sont arrêtés au {fmtDate(asOf)} : matchs officiels en club et en sélection (amicaux de club exclus).
        Chaque match joué depuis est récupéré automatiquement auprès d’ESPN (calendrier, score, composition, fil d’actions) et ajouté
        aux totaux : matchs, buts, passes décisives, triplés, temps de jeu, zone et surface de contact de chaque but déduites du
        commentaire, tirs tentés par zone pour les taux de réussite.
        {live.refreshSeconds ? ` Rafraîchissement actuel : toutes les ${every(live.refreshSeconds)}.` : ''}
      </p>
      <p>
        API-Football complète les matchs en cours et terminés (minutes exactes, note, passes clés, penalties) sous un budget strict :
        au plus {q ? fmtInt(q.cap) : 80} requêtes par jour sur les {q ? fmtInt(q.limit) : 100} du forfait, quota vérifié gratuitement
        avant chaque appel, et résultats mémorisés côté serveur. Ouvrir ou recharger la page ne déclenche jamais de requête : tous les
        visiteurs partagent la même réponse mise en cache.
        {q ? ` Aujourd’hui : ${fmtInt(q.used)} requête${q.used > 1 ? 's' : ''} utilisée${q.used > 1 ? 's' : ''} sur ${fmtInt(q.cap)}.` : ''}
      </p>
      <p>
        Les sites spécialisés ne comptent pas tous de la même manière, en particulier les passes décisives : de petits écarts d’une
        source à l’autre sont normaux. Les répartitions détaillées (zones, pied/tête) sont des ordres de grandeur.
      </p>
      <ul>
        {sources.map((s) => (
          <li key={s.label}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.label}
              </a>
            ) : (
              s.label
            )}
          </li>
        ))}
        <li>Direct : ESPN (site.api.espn.com, flux public non officiel){q ? ' et API-Football (api-sports.io)' : ''}</li>
      </ul>
      <p className="copyright">© {new Date().getFullYear()} nanashi — Messi vs Ronaldo</p>
    </footer>
  );
}
