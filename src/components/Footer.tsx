import type { Source } from '../../shared/types.ts';
import { fmtDate } from '../lib/format.ts';

export function Footer({ asOf, sources, refreshSeconds }: { asOf: string; sources: Source[]; refreshSeconds: number | null }) {
  return (
    <footer className="footer card">
      <h2>Méthodologie et sources</h2>
      <p>
        Les totaux de référence sont arrêtés au {fmtDate(asOf)} : matchs officiels en club et en sélection (amicaux de club exclus).
        Chaque match joué depuis est récupéré automatiquement auprès d’ESPN (calendrier, score, composition, fil d’actions) et
        ajouté aux totaux : matchs, buts, passes décisives, triplés, temps de jeu estimé à partir des remplacements, zone et surface
        de contact de chaque but déduites du commentaire.
        {refreshSeconds
          ? ` Rafraîchissement actuel : toutes les ${refreshSeconds >= 60 ? `${Math.round(refreshSeconds / 60)} min` : `${refreshSeconds} s`}.`
          : ''}
      </p>
      <p>
        Les sites spécialisés ne comptent pas tous de la même manière, en particulier les passes décisives : les écarts d’une source
        à l’autre sont normaux. Les répartitions détaillées (zones, pied/tête, triplés, saisons marquées « estimées ») sont des
        ordres de grandeur.
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
        <li>Direct : ESPN (site.api.espn.com, flux public non officiel)</li>
      </ul>
    </footer>
  );
}
