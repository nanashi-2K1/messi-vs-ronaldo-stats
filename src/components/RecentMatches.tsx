import type { PlayerMatch, PlayerState } from '../../shared/types.ts';
import { ratio } from '../../shared/metrics.ts';
import { fmtDate, fmtInt, fmtPct, fmtShortDate, plural } from '../lib/format.ts';
import { goalSummary } from './LiveMatches.tsx';
import { scoreText } from './PlayerCard.tsx';

function result(m: PlayerMatch) {
  if (m.state !== 'post' || m.team.score == null || m.opponent.score == null) return '';
  return m.team.score > m.opponent.score ? 'V' : m.team.score < m.opponent.score ? 'D' : 'N';
}

function playerLine(m: PlayerMatch) {
  if (!m.inSquad) return m.lineupsAvailable ? 'Absent de la feuille de match' : 'Composition indisponible';
  if (!m.played) return 'Resté sur le banc';
  const parts = [plural(m.goals, 'but', 'buts'), plural(m.assists, 'passe déc.', 'passes déc.')];
  if (m.shots != null) parts.push(`${m.shotsOnTarget ?? 0}/${m.shots} tirs cadrés`);
  if (m.minutes != null) parts.push(`${m.minutes} min jouées`);
  if (!m.starter) parts.push('entré en jeu');
  const goals = goalSummary(m);
  return parts.join(' · ') + (goals ? ` — buts : ${goals}` : '');
}

function PlayerMatches({ player, asOf }: { player: PlayerState; asOf: string }) {
  const d = player.delta;
  const accuracy = ratio(d.shotsOnTarget, d.shots);
  const conversion = ratio(d.shotSampleGoals, d.shots);
  const matches = player.live ? [player.live, ...player.recent] : player.recent;
  return (
    <div>
      <h3 style={{ margin: '0 0 6px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`swatch ${player.baseline.id}-bg`} aria-hidden /> {player.baseline.name}
      </h3>
      {d.shots > 0 ? (
        <p className="note" style={{ margin: '0 0 6px' }}>
          Devant le but : {fmtInt(d.shots)} tirs, {fmtPct(accuracy)} cadrés, {fmtPct(conversion)} transformés en buts.
        </p>
      ) : null}
      {matches.length === 0 ? (
        <p className="empty">Aucun match officiel enregistré depuis le {fmtDate(asOf)}. Chaque nouveau match apparaîtra ici automatiquement.</p>
      ) : (
        <ul className="matches">
          {matches.slice(0, 8).map((m) => (
            <li className="match" key={m.eventId}>
              <span className="when">
                {m.state === 'in' ? (
                  <span className="live-badge">
                    <span className="status-icon good" aria-hidden /> {m.clock ?? 'direct'}
                  </span>
                ) : (
                  fmtShortDate(m.date)
                )}
              </span>
              <span className="who">
                <strong>{scoreText(m)}</strong>
                <span>{m.competition}</span>
              </span>
              <span className="res" aria-label={{ V: 'victoire', N: 'match nul', D: 'défaite', '': '' }[result(m)]}>
                {result(m)}
              </span>
              <span className="line">{playerLine(m)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecentMatches({ messi, ronaldo, asOf }: { messi: PlayerState; ronaldo: PlayerState; asOf: string }) {
  return (
    <section className="card" aria-labelledby="recent-title">
      <div className="section-head">
        <h2 id="recent-title">Matchs depuis le {fmtDate(asOf)}</h2>
        <p>Ajoutés en temps réel aux totaux de la page, match en cours compris</p>
      </div>
      <div className="grid-2">
        <PlayerMatches player={messi} asOf={asOf} />
        <PlayerMatches player={ronaldo} asOf={asOf} />
      </div>
    </section>
  );
}
