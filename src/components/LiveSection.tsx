import { ratio } from '../../shared/metrics.ts';
import type { MatchTeam, PlayerMatch, PlayerState } from '../../shared/types.ts';
import { fmtDate, fmtDec, fmtInt, fmtPct, fmtShortDate } from '../lib/format.ts';
import { goalSummary, playerLine, resultOf, scoreText } from '../lib/matchText.ts';

function Team({ team, side }: { team: MatchTeam; side: 'home' | 'away' }) {
  const logo = team.logo ? (
    <img
      src={team.logo}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : null;
  return (
    <div className={`team ${side}`}>
      {side === 'home' ? logo : null}
      <span>{team.name}</span>
      {side === 'away' ? logo : null}
    </div>
  );
}

function LiveCard({ player }: { player: PlayerState }) {
  const m = player.live!;
  const [home, away] = m.homeAway === 'home' ? [m.team, m.opponent] : [m.opponent, m.team];
  const status = !m.inSquad ? 'absent de la feuille de match' : !m.played ? 'sur le banc' : m.starter ? 'titulaire' : 'entré en jeu';
  const side = player.baseline.id === 'messi' ? 'm' : 'r';
  return (
    <article className={`card livecard ${side}`} aria-live="polite">
      <div className="card-head">
        <span className="kicker" style={{ margin: 0, color: 'var(--ok)' }}>
          ● EN DIRECT{m.clock ? ` · ${m.clock}` : ''}
        </span>
        <span className="pl">{m.competition}</span>
      </div>
      <div className="scoreline">
        <Team team={home} side="home" />
        <span className="score">
          {home.score ?? '–'}–{away.score ?? '–'}
        </span>
        <Team team={away} side="away" />
      </div>
      <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
        <strong style={{ color: 'var(--text)' }}>{player.baseline.name}</strong> : {status}
        {m.goalDetails.length > 0 ? ` — buts : ${goalSummary(m)}` : ''}
        {m.extra?.rating != null ? ` — note ${fmtDec(m.extra.rating, 1)} (API-Football)` : ''}
      </p>
      <div className="tiles">
        <div>
          <strong>{fmtInt(m.goals)}</strong>
          <span>buts</span>
        </div>
        <div>
          <strong>{fmtInt(m.assists)}</strong>
          <span>passes déc.</span>
        </div>
        <div>
          <strong>{m.shots == null ? '—' : `${m.shotsOnTarget ?? 0}/${m.shots}`}</strong>
          <span>tirs cadrés</span>
        </div>
        <div>
          <strong>{m.minutes == null ? '—' : `${m.minutes}'`}</strong>
          <span>temps de jeu</span>
        </div>
      </div>
    </article>
  );
}

function MatchList({ player, asOf }: { player: PlayerState; asOf: string }) {
  const d = player.delta;
  const side = player.baseline.id === 'messi' ? 'm' : 'r';
  const matches: PlayerMatch[] = player.live ? [player.live, ...player.recent] : player.recent;
  return (
    <div className="card">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className={`sw ${side}`} aria-hidden /> {player.baseline.name}
      </h3>
      <p className="sub">
        {d.apps > 0
          ? `${fmtInt(d.goals)} but${d.goals > 1 ? 's' : ''} et ${fmtInt(d.assists)} passe${d.assists > 1 ? 's' : ''} déc. en ${fmtInt(d.apps)} match${d.apps > 1 ? 's' : ''}`
          : 'En attente du prochain match'}
        {d.shots > 0
          ? ` · ${fmtInt(d.shots)} tirs, ${fmtPct(ratio(d.shotsOnTarget, d.shots))} cadrés, ${fmtPct(ratio(d.shotSampleGoals, d.shots))} transformés`
          : ''}
      </p>
      {matches.length === 0 ? (
        <p className="empty-note">Aucun match officiel enregistré depuis le {fmtDate(asOf)}. Chaque nouveau match apparaîtra ici automatiquement.</p>
      ) : (
        <ul className="matches">
          {matches.slice(0, 8).map((m) => {
            const res = resultOf(m);
            return (
              <li className="match" key={m.eventId}>
                <span className="when">{m.state === 'in' ? <span style={{ color: 'var(--ok)' }}>● {m.clock ?? 'LIVE'}</span> : fmtShortDate(m.date)}</span>
                <span className="who">
                  <strong>{scoreText(m)}</strong>
                  <span>{m.competition}</span>
                </span>
                <span className="res" aria-label={{ V: 'victoire', N: 'match nul', D: 'défaite', '': '' }[res]}>
                  {res}
                </span>
                <span className="line">{playerLine(m)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LiveSection({ messi, ronaldo, asOf }: { messi: PlayerState; ronaldo: PlayerState; asOf: string }) {
  const live = [messi, ronaldo].filter((p) => p.live);
  return (
    <section id="s-live" className="lvl" aria-labelledby="live-title">
      <div className="sh">
        <div>
          <span className="kicker">NIVEAU 2</span>
          <h2 id="live-title">Direct et derniers matchs</h2>
          <p>
            Chaque match joué depuis le {fmtDate(asOf)} est ajouté aux compteurs de la page, but par but, y compris pendant la
            rencontre.
          </p>
        </div>
      </div>
      {live.length > 0 ? (
        <div className="grid2" style={{ marginBottom: 32 }}>
          {live.map((p) => (
            <LiveCard key={p.baseline.id} player={p} />
          ))}
        </div>
      ) : null}
      <div className="grid2">
        <MatchList player={messi} asOf={asOf} />
        <MatchList player={ronaldo} asOf={asOf} />
      </div>
    </section>
  );
}
