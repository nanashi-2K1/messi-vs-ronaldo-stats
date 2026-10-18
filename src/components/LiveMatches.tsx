import type { GoalZone, MatchTeam, PlayerMatch, PlayerState } from '../../shared/types.ts';
import { fmtInt } from '../lib/format.ts';

export const ZONE_LABELS: Record<GoalZone, string> = {
  insideBox: 'dans la surface',
  outsideBox: 'hors surface',
  freeKick: 'coup franc',
  penalty: 'penalty',
};

const BODY_LABELS = { left: 'pied gauche', right: 'pied droit', head: 'tête' } as const;

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

/** « 21' (coup franc, pied gauche), 71' (dans la surface, pied gauche) » */
export function goalSummary(m: PlayerMatch): string {
  return m.goalDetails
    .map((g) => {
      const how = [g.zone ? ZONE_LABELS[g.zone] : null, g.bodyPart ? BODY_LABELS[g.bodyPart] : null].filter(Boolean).join(', ');
      return how ? `${g.minute} (${how})` : g.minute;
    })
    .join(', ');
}

function LiveCard({ player }: { player: PlayerState }) {
  const m = player.live;
  if (!m) return null;
  const [home, away] = m.homeAway === 'home' ? [m.team, m.opponent] : [m.opponent, m.team];
  const status = !m.inSquad ? 'absent de la feuille de match' : !m.played ? 'sur le banc' : m.starter ? 'titulaire' : 'entré en jeu';
  return (
    <article className={`card live-card ${player.baseline.id}`} aria-live="polite">
      <div className="live-top">
        <span className="live-badge">
          <span className="status-icon good" aria-hidden /> EN DIRECT {m.clock ? `· ${m.clock}` : ''}
        </span>
        <span>{m.competition}</span>
      </div>
      <div className="scoreline">
        <Team team={home} side="home" />
        <span className="score">
          {home.score ?? '–'}–{away.score ?? '–'}
        </span>
        <Team team={away} side="away" />
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        <strong>{player.baseline.name}</strong> : {status}
        {m.goalDetails.length > 0 ? ` — buts : ${goalSummary(m)}` : ''}
      </p>
      <div className="live-stats" style={{ marginTop: 10 }}>
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

export function LiveMatches({ players }: { players: PlayerState[] }) {
  const live = players.filter((p) => p.live);
  if (live.length === 0) return null;
  return (
    <section className="section" aria-labelledby="live-title">
      <div className="section-head">
        <h2 id="live-title">En ce moment</h2>
        <p>Les totaux de la page incluent déjà ce qui se passe sur le terrain.</p>
      </div>
      <div className="live-grid">
        {live.map((p) => (
          <LiveCard key={p.baseline.id} player={p} />
        ))}
      </div>
    </section>
  );
}
