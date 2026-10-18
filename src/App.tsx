import { efficiency } from '../shared/metrics.ts';
import type { PlayerState } from '../shared/types.ts';
import { BodyParts } from './components/BodyParts.tsx';
import { CompareRows, type CompareItem } from './components/CompareRows.tsx';
import { Footer } from './components/Footer.tsx';
import { GoalZones } from './components/GoalZones.tsx';
import { Header } from './components/Header.tsx';
import { Honours } from './components/Honours.tsx';
import { LiveMatches } from './components/LiveMatches.tsx';
import { PlayerCard } from './components/PlayerCard.tsx';
import { RecentMatches } from './components/RecentMatches.tsx';
import { SeasonChart } from './components/SeasonChart.tsx';
import { Teams } from './components/Teams.tsx';
import { useAppState, useNow } from './hooks/useAppState.ts';
import { fmtDec, fmtInt, fmtPct } from './lib/format.ts';

const national = (p: PlayerState, k: 'apps' | 'goals') => p.teams.filter((t) => t.kind === 'national').reduce((s, t) => s + t[k], 0);
const honour = (p: PlayerState, label: string) => p.baseline.honours.find((h) => h.label === label)?.count ?? null;

function keyFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  return [
    { label: 'Matchs joués', messi: m.totals.apps, ronaldo: r.totals.apps, messiDelta: m.delta.apps, ronaldoDelta: r.delta.apps },
    { label: 'Buts', messi: m.totals.goals, ronaldo: r.totals.goals, messiDelta: m.delta.goals, ronaldoDelta: r.delta.goals },
    {
      label: 'Passes décisives',
      messi: m.totals.assists,
      ronaldo: r.totals.assists,
      messiDelta: m.delta.assists,
      ronaldoDelta: r.delta.assists,
    },
    {
      label: 'Buts + passes déc.',
      messi: m.totals.goals + m.totals.assists,
      ronaldo: r.totals.goals + r.totals.assists,
    },
    { label: 'Minutes jouées', messi: m.totals.minutes, ronaldo: r.totals.minutes },
    {
      label: 'Triplés',
      hint: m.baseline.hatTricks.approximate || r.baseline.hatTricks.approximate ? '3 buts ou plus · approx.' : '3 buts ou plus',
      messi: m.totals.hatTricks,
      ronaldo: r.totals.hatTricks,
    },
    {
      label: 'Buts en club',
      messi: m.totals.goals - national(m, 'goals'),
      ronaldo: r.totals.goals - national(r, 'goals'),
    },
    { label: 'Sélections', messi: national(m, 'apps'), ronaldo: national(r, 'apps') },
    { label: 'Buts en sélection', messi: national(m, 'goals'), ronaldo: national(r, 'goals') },
    { label: 'Ballons d’Or', messi: honour(m, 'Ballon d’Or'), ronaldo: honour(r, 'Ballon d’Or') },
  ];
}

function efficiencyFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  const em = efficiency(m);
  const er = efficiency(r);
  const dec = (n: number) => fmtDec(n);
  return [
    { label: 'Buts par match', messi: em.goalsPerMatch, ronaldo: er.goalsPerMatch, format: dec },
    { label: 'Passes déc. par match', messi: em.assistsPerMatch, ronaldo: er.assistsPerMatch, format: dec },
    { label: 'Buts + passes par match', messi: em.contributionsPerMatch, ronaldo: er.contributionsPerMatch, format: dec },
    { label: 'Buts par 90 minutes', messi: em.goalsPer90, ronaldo: er.goalsPer90, format: dec },
    {
      label: 'Minutes par but',
      hint: 'moins = mieux',
      messi: em.minutesPerGoal,
      ronaldo: er.minutesPerGoal,
      format: (n) => fmtInt(Math.round(n)),
      better: 'lower',
    },
    {
      label: 'Minutes par but ou passe',
      hint: 'moins = mieux',
      messi: em.minutesPerContribution,
      ronaldo: er.minutesPerContribution,
      format: (n) => fmtInt(Math.round(n)),
      better: 'lower',
    },
    { label: 'Buts hors penalty', hint: 'estimation', messi: em.nonPenaltyGoals, ronaldo: er.nonPenaltyGoals },
    {
      label: 'Part des buts sur penalty',
      messi: em.penaltyShare,
      ronaldo: er.penaltyShare,
      format: (n) => fmtPct(n),
      better: 'none',
    },
    { label: 'Buts par match en club', messi: em.clubGoalsPerMatch, ronaldo: er.clubGoalsPerMatch, format: dec },
    { label: 'Buts par match en sélection', messi: em.internationalGoalsPerMatch, ronaldo: er.internationalGoalsPerMatch, format: dec },
  ];
}

function competitionFigures(m: PlayerState, r: PlayerState): CompareItem[] {
  return m.baseline.competitions.flatMap((c, i) => {
    const rc = r.baseline.competitions[i]!;
    const rows: CompareItem[] = [{ label: c.label, hint: 'buts', messi: c.goals, ronaldo: rc.goals }];
    if (c.apps != null && rc.apps != null) rows.push({ label: c.label, hint: 'matchs', messi: c.apps, ronaldo: rc.apps });
    return rows;
  });
}

export function App() {
  const { state, connection } = useAppState();
  const now = useNow();
  const { messi, ronaldo } = state.players;
  const liveConnected = connection !== 'offline' && (state.live.status === 'ok' || state.live.status === 'degraded');

  return (
    <div className="app">
      <Header connection={connection} live={state.live} asOf={state.baselineAsOf} now={now} />

      <section className="players" aria-label="Les deux joueurs">
        <PlayerCard player={messi} now={now} asOf={state.baselineAsOf} liveConnected={liveConnected} />
        <span className="versus" aria-hidden>
          VS
        </span>
        <PlayerCard player={ronaldo} now={now} asOf={state.baselineAsOf} liveConnected={liveConnected} />
      </section>

      <LiveMatches players={[messi, ronaldo]} />

      <div className="grid-2 section">
        <section className="card" aria-labelledby="key-title">
          <div className="section-head">
            <h2 id="key-title">Chiffres clés</h2>
            <p>Carrière, club et sélection</p>
          </div>
          <CompareRows items={keyFigures(messi, ronaldo)} />
        </section>
        <section className="card" aria-labelledby="eff-title">
          <div className="section-head">
            <h2 id="eff-title">Efficacité</h2>
            <p>Ratios sur l’ensemble de la carrière</p>
          </div>
          <CompareRows items={efficiencyFigures(messi, ronaldo)} />
        </section>
      </div>

      <GoalZones messi={messi} ronaldo={ronaldo} />

      <div className="grid-2 section">
        <BodyParts messi={messi} ronaldo={ronaldo} />
        <section className="card" aria-labelledby="comp-title">
          <div className="section-head">
            <h2 id="comp-title">Grandes compétitions</h2>
            <p>Valeurs de référence</p>
          </div>
          <CompareRows items={competitionFigures(messi, ronaldo)} />
        </section>
      </div>

      <div className="section">
        <SeasonChart messi={messi} ronaldo={ronaldo} />
      </div>

      <div className="section">
        <Teams messi={messi} ronaldo={ronaldo} />
      </div>

      <div className="section">
        <RecentMatches messi={messi} ronaldo={ronaldo} asOf={state.baselineAsOf} />
      </div>

      <div className="section">
        <Honours messi={messi} ronaldo={ronaldo} />
      </div>

      <Footer asOf={state.baselineAsOf} sources={state.sources} refreshSeconds={state.live.refreshSeconds} />
    </div>
  );
}
