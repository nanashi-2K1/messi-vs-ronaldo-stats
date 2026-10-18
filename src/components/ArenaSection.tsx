import { useEffect, useMemo, useRef, useState } from 'react';
import { ageAt } from '../../shared/metrics.ts';
import type { PlayerState } from '../../shared/types.ts';
import type { Arena, Side } from '../arcade/index.ts';
import { PLAYER_COLORS, useCountUp, type ThemeChoice } from '../hooks/useArcade.ts';
import { fmtInt, fmtKickoff } from '../lib/format.ts';
import { duelFigures, leader, type CompareItem } from '../lib/figures.ts';
import { fixtureText, goalSummary, scoreText } from '../lib/matchText.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';

const GOAL_TARGET = 1000;
const SHOUTS: Record<Side, string> = { m: 'VAMOS!', r: 'SIUUU!' };
const SHORT: Record<Side, string> = { m: 'Messi', r: 'Ronaldo' };

interface Props {
  messi: PlayerState;
  ronaldo: PlayerState;
  theme: ThemeChoice;
  now: number;
  liveConnected: boolean;
}

function facts(p: PlayerState, now: number): [string, string][] {
  const b = p.baseline;
  return [
    ['Âge', `${ageAt(b.birthDate, new Date(now))} ans`],
    ['Club', b.currentClub],
    ['Nationalité', b.nationality],
    ['Poste', b.position],
    ['Pied fort', b.preferredFoot],
    ['Taille', `${(b.heightCm / 100).toFixed(2).replace('.', ',')} m`],
  ];
}

function PlayerHud({ side, player, bump }: { side: Side; player: PlayerState; bump: number }) {
  const goals = player.totals.goals;
  const shown = useCountUp(goals, bump ? 500 : 1400);
  const [bumping, setBumping] = useState(false);
  useEffect(() => {
    if (!bump) return;
    setBumping(true);
    const t = setTimeout(() => setBumping(false), 520);
    return () => clearTimeout(t);
  }, [bump]);
  const club = `${player.baseline.currentClub.replace(' CF', '')} · #${side === 'm' ? 10 : 7}`;
  const live = player.liveDelta.goals;
  const remaining = Math.max(0, GOAL_TARGET - goals);
  const tag = live > 0 ? <span className="livetag">+{live} EN DIRECT</span> : null;
  return (
    <div className={`hud pc pc-${side}`}>
      <div className="pn">
        {side === 'm' ? (
          <>
            MESSI <small>{club}</small>
          </>
        ) : (
          <>
            <small>{club}</small> RONALDO
          </>
        )}
      </div>
      <div className={`goals${bumping ? ' bump' : ''}`} aria-label={`${fmtInt(goals)} buts en carrière`}>
        {fmtInt(Math.round(shown))}
      </div>
      <div className="pl">
        {side === 'r' ? tag : null}buts en carrière{side === 'm' ? tag : null}
      </div>
      <div
        className="pbar"
        role="progressbar"
        aria-label={`${SHORT[side]} : ${goals} buts sur ${GOAL_TARGET}`}
        aria-valuemin={0}
        aria-valuemax={GOAL_TARGET}
        aria-valuenow={Math.min(goals, GOAL_TARGET)}
      >
        <i style={{ width: `${Math.min(100, (goals / GOAL_TARGET) * 100)}%` }} />
      </div>
      <div className="pl">{remaining > 0 ? `encore ${fmtInt(remaining)} avant 1 000` : 'Objectif 1 000 atteint !'}</div>
    </div>
  );
}

function Fiche({ side, player, now, liveConnected }: { side: Side; player: PlayerState; now: number; liveConnected: boolean }) {
  const live = player.live;
  const next = player.next;
  return (
    <article className={`card fiche ${side}`} aria-labelledby={`fiche-${side}`}>
      <h3 id={`fiche-${side}`}>{player.baseline.name.toUpperCase()}</h3>
      <div className="pl">{player.baseline.fullName}</div>
      <dl className="facts">
        {facts(player, now).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="nextline">
        {live ? (
          <>
            <b className="live">EN DIRECT{live.clock ? ` · ${live.clock}` : ''}</b>
            <strong>{scoreText(live)}</strong> · {live.competition}
          </>
        ) : next ? (
          <>
            <b>PROCHAIN MATCH</b>
            <strong>{fixtureText(next)}</strong>
            <br />
            {fmtKickoff(next.date)} · {next.competition}
          </>
        ) : (
          <>
            <b>PROCHAIN MATCH</b>
            {liveConnected ? 'aucun match programmé dans les 3 prochaines semaines' : 'disponible quand le suivi en direct répond'}
          </>
        )}
      </div>
    </article>
  );
}

export function ArenaSection({ messi, ronaldo, theme, now, liveConnected }: Props) {
  const players = useMemo(() => ({ m: messi, r: ronaldo }) as Record<Side, PlayerState>, [messi, ronaldo]);
  const latest = useRef(players);
  latest.current = players;
  const stageRef = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<Arena | null>(null);
  const [scene, setScene] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [passes, setPasses] = useState(true);
  const [duel, setDuel] = useState<{ item: CompareItem; key: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [bumps, setBumps] = useState<Record<Side, number>>({ m: 0, r: 0 });

  // Scène 3D chargée à la demande (three.js est dans un fichier séparé).
  useEffect(() => {
    let disposed = false;
    let arena: Arena | null = null;
    import('../arcade/index.ts')
      .then((A) => {
        if (disposed || !stageRef.current) return;
        if (!A.webglAvailable()) return setScene('unavailable');
        arena = A.createArena(A.getEngine(), stageRef.current, {
          colors: PLAYER_COLORS[theme],
          shouts: SHOUTS,
          onHover: (side, e) => {
            if (!side) return hideTip();
            const p = latest.current[side];
            showTip(
              p.baseline.name.toUpperCase(),
              facts(p, Date.now()).map(([label, value]) => ({ label, value })),
              e.clientX,
              e.clientY,
              PLAYER_COLORS[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'][side],
            );
          },
        });
        arenaRef.current = arena;
        setScene('ready');
      })
      .catch(() => setScene('unavailable'));
    return () => {
      disposed = true;
      arena?.dispose();
      arenaRef.current = null;
      hideTip();
    };
    // La scène est créée une seule fois ; le thème est appliqué par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    arenaRef.current?.setTheme(theme);
    arenaRef.current?.setColors(PLAYER_COLORS[theme]);
  }, [theme, scene]);

  useEffect(() => arenaRef.current?.setPasses(passes), [passes, scene]);

  // Un but marqué pendant un match en cours déclenche la célébration du buteur.
  const previous = useRef<Record<Side, { eventId: string | null; goals: number }> | null>(null);
  useEffect(() => {
    const current = {
      m: { eventId: messi.live?.eventId ?? null, goals: messi.liveDelta.goals },
      r: { eventId: ronaldo.live?.eventId ?? null, goals: ronaldo.liveDelta.goals },
    };
    const before = previous.current;
    previous.current = current;
    if (!before) return;
    for (const side of ['m', 'r'] as const) {
      const c = current[side];
      const b = before[side];
      if (!c.eventId || c.eventId !== b.eventId || c.goals <= b.goals) continue;
      const other: Side = side === 'm' ? 'r' : 'm';
      arenaRef.current?.celebrate(side);
      arenaRef.current?.react(other, 'pump');
      arenaRef.current?.confetti(side);
      setBumps((x) => ({ ...x, [side]: x[side] + 1 }));
      setFlash(`${SHORT[side]} marque son ${fmtInt(players[side].totals.goals)}e but en carrière`);
    }
  }, [messi, ronaldo, players]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 12_000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!duel) return;
    const t = setTimeout(() => setDuel(null), 4200);
    return () => clearTimeout(t);
  }, [duel]);

  const duelItems = duelFigures(messi, ronaldo);
  const playDuel = (item: CompareItem) => {
    setDuel({ item, key: Date.now() });
    const w = leader(item);
    if (!w) return;
    const side: Side = w === 'messi' ? 'm' : 'r';
    arenaRef.current?.celebrate(side);
    arenaRef.current?.react(side === 'm' ? 'r' : 'm', 'sad');
  };

  // Bandeau : match en cours, sinon prochains matchs.
  const lives = (['m', 'r'] as const).filter((s) => players[s].live);
  let ticker: React.ReactNode;
  if (flash) {
    ticker = (
      <>
        <span className="sq good" aria-hidden />
        <b className="live">BUT !</b>
        <span>{flash}</span>
      </>
    );
  } else if (lives.length > 0) {
    ticker = lives.map((s) => {
      const m = players[s].live!;
      const goals = goalSummary(m);
      return (
        <span key={s} style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="sq good" aria-hidden />
          <b className="live">EN DIRECT{m.clock ? ` · ${m.clock}` : ''}</b>
          <span>
            {scoreText(m)} · {m.competition}
            {goals ? ` · ${SHORT[s]} : ${goals}` : ''}
          </span>
        </span>
      );
    });
  } else {
    const next = (['m', 'r'] as const).filter((s) => players[s].next);
    ticker = (
      <>
        <b>{next.length ? 'PROCHAINS MATCHS' : 'PAS DE MATCH EN COURS'}</b>
        <span>
          {next.length
            ? next.map((s) => `${SHORT[s]} : ${fmtKickoff(players[s].next!.date)} — ${fixtureText(players[s].next!)}`).join(' · ')
            : liveConnected
              ? 'Les compteurs se mettront à jour dès le prochain coup d’envoi.'
              : 'Le suivi en direct n’est pas joignable : affichage des données de référence.'}
        </span>
      </>
    );
  }

  return (
    <section id="s-arena" className="lvl" aria-label="Arène">
      <div className="ticker" role="status" style={{ ['--tick' as string]: lives.length || flash ? 'var(--ok)' : 'var(--r)' }}>
        {ticker}
      </div>

      <div ref={stageRef} className="stage" aria-label="Arène 3D : Messi et Ronaldo">
        <PlayerHud side="m" player={messi} bump={bumps.m} />
        <PlayerHud side="r" player={ronaldo} bump={bumps.r} />
        <div className="hud vs">VS</div>
        {duel ? <DuelResult key={duel.key} item={duel.item} theme={theme} /> : null}
        {scene === 'unavailable' ? <div className="fallback">3D indisponible sur cet appareil · les compteurs restent à jour</div> : null}
        <div className="hint">Glisser pour tourner · cliquer un joueur pour le faire célébrer</div>
      </div>

      <div className="duel">
        <span className="dl">DUEL :</span>
        <div className="chips">
          {duelItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`chip${duel?.item.label === item.label ? ' on' : ''}`}
              aria-pressed={duel?.item.label === item.label}
              onClick={() => playDuel(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="pbtn" aria-pressed={passes} onClick={() => setPasses((p) => !p)}>
          Passes : {passes ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="fiches">
        <Fiche side="m" player={messi} now={now} liveConnected={liveConnected} />
        <Fiche side="r" player={ronaldo} now={now} liveConnected={liveConnected} />
      </div>
    </section>
  );
}

function DuelResult({ item, theme }: { item: CompareItem; theme: ThemeChoice }) {
  const w = leader(item);
  const fmt = item.format ?? fmtInt;
  const colors = PLAYER_COLORS[theme];
  return (
    <div className="hud duelres" aria-live="polite">
      <div className="k">{item.label.toUpperCase()}</div>
      <div className="row">
        <span style={{ color: colors.m }} className={w === 'messi' ? 'w' : w ? 'lo' : undefined}>
          {item.messi == null ? '—' : fmt(item.messi)}
        </span>
        <span style={{ color: colors.r }} className={w === 'ronaldo' ? 'w' : w ? 'lo' : undefined}>
          {item.ronaldo == null ? '—' : fmt(item.ronaldo)}
        </span>
      </div>
      {item.hint ? <div className="nt">{item.hint}</div> : null}
    </div>
  );
}
