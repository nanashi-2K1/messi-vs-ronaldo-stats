import type { Fixture, PlayerMatch, PlayerState } from '../../shared/types.ts';
import { ageAt } from '../../shared/metrics.ts';
import { fmtInt, fmtKickoff, fmtShortDate } from '../lib/format.ts';

const GOAL_TARGET = 1000;

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
}

export function scoreText(m: { homeAway: 'home' | 'away'; team: { name: string; score: number | null }; opponent: { name: string; score: number | null } }) {
  const [home, away] = m.homeAway === 'home' ? [m.team, m.opponent] : [m.opponent, m.team];
  const score = home.score != null && away.score != null ? ` ${home.score}–${away.score} ` : ' – ';
  return `${home.name}${score}${away.name}`;
}

function fixtureText(f: Fixture) {
  const [home, away] = f.homeAway === 'home' ? [f.team, f.opponent] : [f.opponent, f.team];
  return `${home.name} – ${away.name}`;
}

function MatchLine({ live, next, liveConnected }: { live: PlayerMatch | null; next: Fixture | null; liveConnected: boolean }) {
  if (live) {
    return (
      <div className="match-line">
        <span className="live-badge">
          <span className="status-icon good" aria-hidden /> EN DIRECT {live.clock ? `· ${live.clock}` : ''}
        </span>
        <div>
          <strong>{scoreText(live)}</strong> · {live.competition}
        </div>
      </div>
    );
  }
  if (next) {
    return (
      <div className="match-line">
        Prochain match : <strong>{fixtureText(next)}</strong>
        <div>
          {fmtKickoff(next.date)} · {next.competition}
        </div>
      </div>
    );
  }
  return (
    <div className="match-line">
      Prochain match : {liveConnected ? 'aucun match programmé dans les 3 prochaines semaines' : 'disponible avec le suivi en direct'}
    </div>
  );
}

interface Props {
  player: PlayerState;
  now: number;
  asOf: string;
  liveConnected: boolean;
}

export function PlayerCard({ player, now, asOf, liveConnected }: Props) {
  const b = player.baseline;
  const goals = player.totals.goals;
  const remaining = Math.max(0, GOAL_TARGET - goals);
  return (
    <article className={`card player ${b.id}`} aria-labelledby={`${b.id}-name`}>
      <div className="player-head">
        <div className="monogram" aria-hidden>
          {initials(b.name)}
        </div>
        <div>
          <h2 id={`${b.id}-name`}>{b.name}</h2>
          <p>{b.fullName}</p>
        </div>
      </div>

      <div>
        <div className="hero-number">
          <span className="value">{fmtInt(goals)}</span>
          <span className="label">buts en carrière</span>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {player.liveDelta.goals > 0 ? (
            <span className="chip live">
              <span className="status-icon good" aria-hidden /> +{player.liveDelta.goals} en direct
            </span>
          ) : null}
          {player.delta.apps > 0 ? (
            <span className="chip">
              +{player.delta.goals} but{player.delta.goals > 1 ? 's' : ''} en {player.delta.apps} match{player.delta.apps > 1 ? 's' : ''} depuis
              le {fmtShortDate(asOf)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="meter">
        <div className="meter-top">
          <span>Objectif 1 000 buts</span>
          <span>{remaining > 0 ? `encore ${fmtInt(remaining)}` : 'atteint'}</span>
        </div>
        <div
          className="meter-track"
          role="progressbar"
          aria-label={`${b.name} : ${goals} buts sur 1000`}
          aria-valuemin={0}
          aria-valuemax={GOAL_TARGET}
          aria-valuenow={Math.min(goals, GOAL_TARGET)}
        >
          <div className="meter-fill" style={{ width: `${Math.min(100, (goals / GOAL_TARGET) * 100)}%` }} />
        </div>
      </div>

      <dl className="facts">
        <div>
          <dt>Âge</dt>
          <dd>{ageAt(b.birthDate, new Date(now))} ans</dd>
        </div>
        <div>
          <dt>Club</dt>
          <dd>{b.currentClub}</dd>
        </div>
        <div>
          <dt>Nationalité</dt>
          <dd>{b.nationality}</dd>
        </div>
        <div>
          <dt>Poste</dt>
          <dd>{b.position}</dd>
        </div>
        <div>
          <dt>Pied fort</dt>
          <dd>{b.preferredFoot}</dd>
        </div>
        <div>
          <dt>Taille</dt>
          <dd>{(b.heightCm / 100).toFixed(2).replace('.', ',')} m</dd>
        </div>
      </dl>

      <MatchLine live={player.live} next={player.next} liveConnected={liveConnected} />
    </article>
  );
}
