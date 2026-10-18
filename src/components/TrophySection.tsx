import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { PlayerState } from '../../shared/types.ts';
import type { Side, Vault, VaultCategory } from '../arcade/index.ts';
import { PLAYER_COLORS, useCountUp, type ThemeChoice } from '../hooks/useArcade.ts';
import { fmtInt } from '../lib/format.ts';
import { hideTip, showTip } from '../lib/tooltip.ts';

const TOUR_MS = 4000;

/** Une catégorie par type de trophée, dans l'ordre de la référence (Messi puis compléments Ronaldo). */
function categories(messi: PlayerState, ronaldo: PlayerState): VaultCategory[] {
  const ids = [...new Set([...messi.baseline.honours, ...ronaldo.baseline.honours].map((h) => h.id))];
  return ids.map((id) => {
    const m = messi.baseline.honours.find((h) => h.id === id);
    const r = ronaldo.baseline.honours.find((h) => h.id === id);
    return { id, label: (m ?? r)!.label, m: m?.items ?? [], r: r?.items ?? [] };
  });
}

function Count({ side, value, lead }: { side: Side; value: number; lead: boolean }) {
  const shown = useCountUp(value, 600);
  return (
    <div className={`hud vc vc-${side}`}>
      <div className="pn">{side === 'm' ? 'MESSI' : 'RONALDO'}</div>
      <div className="goals">{fmtInt(Math.round(shown))}</div>
      {lead ? <span className="crown">EN TÊTE</span> : null}
    </div>
  );
}

export function TrophySection({ messi, ronaldo, theme }: { messi: PlayerState; ronaldo: PlayerState; theme: ThemeChoice }) {
  const cats = useMemo(() => categories(messi, ronaldo), [messi, ronaldo]);
  const [index, setIndex] = useState(0);
  const [touring, setTouring] = useState(false);
  const [chip, setChip] = useState<{ side: Side; i: number } | null>(null);
  const [scene, setScene] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const stageRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<Vault | null>(null);
  const cat = cats[index % cats.length]!;

  useEffect(() => {
    let disposed = false;
    let vault: Vault | null = null;
    import('../arcade/index.ts')
      .then((A) => {
        if (disposed || !stageRef.current) return;
        if (!A.webglAvailable()) return setScene('unavailable');
        vault = A.createVault(A.getEngine(), stageRef.current, {
          onHover: (info, e) => {
            if (!info) return hideTip();
            const colors = PLAYER_COLORS[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
            showTip(
              info.side === 'm' ? 'MESSI' : 'RONALDO',
              [{ value: info.label }, { value: info.item, color: 'var(--gold-ink)' }],
              e.clientX,
              e.clientY,
              colors[info.side],
            );
          },
        });
        vaultRef.current = vault;
        setScene('ready');
      })
      .catch(() => setScene('unavailable'));
    return () => {
      disposed = true;
      vault?.dispose();
      vaultRef.current = null;
      hideTip();
    };
  }, []);

  useEffect(() => vaultRef.current?.setTheme(theme), [theme, scene]);
  useEffect(() => vaultRef.current?.show(cat), [cat, scene]);
  useEffect(() => {
    if (chip) vaultRef.current?.highlight(chip.side, chip.i);
    else {
      vaultRef.current?.highlight('m', null);
      vaultRef.current?.highlight('r', null);
    }
  }, [chip]);

  useEffect(() => {
    if (!touring) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % cats.length), TOUR_MS);
    return () => clearInterval(t);
  }, [touring, cats.length]);

  const go = (i: number) => {
    setTouring(false);
    setChip(null);
    setIndex((i + cats.length) % cats.length);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    go(index + (e.key === 'ArrowRight' ? 1 : -1));
  };

  const total = { m: cats.reduce((s, c) => s + c.m.length, 0), r: cats.reduce((s, c) => s + c.r.length, 0) };
  const lead: Side | null = cat.m.length === cat.r.length ? null : cat.m.length > cat.r.length ? 'm' : 'r';

  return (
    <section id="s-vault" className="lvl" aria-labelledby="vault-title">
      <div className="sh">
        <div>
          <span className="kicker">NIVEAU 6</span>
          <h2 id="vault-title">Salle des trophées</h2>
          <p>
            Trophées majeurs : <b style={{ color: 'var(--m)' }}>{fmtInt(total.m)}</b> Messi ·{' '}
            <b style={{ color: 'var(--r)' }}>{fmtInt(total.r)}</b> Ronaldo
          </p>
        </div>
      </div>

      <div className="cats" role="group" aria-label="Catégorie de trophées">
        {cats.map((c, i) => {
          const n = c.m.length + c.r.length || 1;
          return (
            <button
              key={c.id}
              type="button"
              className="cat"
              aria-pressed={i === index}
              aria-label={`${c.label} : ${c.m.length} pour Messi, ${c.r.length} pour Ronaldo`}
              onClick={() => go(i)}
            >
              <span className="cn">{c.label}</span>
              <span className="cs">
                <span className="a">{c.m.length}</span>
                <span className="b">{c.r.length}</span>
              </span>
              <span className="cb" aria-hidden>
                <i style={{ width: `${(c.m.length / n) * 100}%` }} />
                <i style={{ width: `${(c.r.length / n) * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={stageRef}
        className="stage vault"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label={`Vitrine 3D des trophées — ${cat.label} : ${cat.m.length} Messi, ${cat.r.length} Ronaldo. Flèches gauche/droite pour changer de catégorie.`}
      >
        <Count side="m" value={cat.m.length} lead={lead === 'm'} />
        <Count side="r" value={cat.r.length} lead={lead === 'r'} />
        <div className="hud vtitle">
          <button type="button" aria-label="Catégorie précédente" onClick={() => go(index - 1)}>
            ◀
          </button>
          <span aria-live="polite">{cat.label.toUpperCase()}</span>
          <button type="button" aria-label="Catégorie suivante" onClick={() => go(index + 1)}>
            ▶
          </button>
        </div>
        {scene === 'unavailable' ? <div className="fallback">3D indisponible sur cet appareil · liste des trophées ci-dessous</div> : null}
        <div className="hint">◀ ▶ changer de catégorie · survoler un trophée = année</div>
      </div>

      <div className="years">
        {(['m', 'r'] as const).map((side) => (
          <div key={side}>
            <h3 className={side}>{side === 'm' ? 'Messi' : 'Ronaldo'}</h3>
            <ul className="ychips" aria-label={`${cat.label} — ${side === 'm' ? 'Messi' : 'Ronaldo'}`}>
              {cat[side].length ? (
                cat[side].map((item, i) => (
                  <li
                    key={`${item}-${i}`}
                    className={`ychip${chip?.side === side && chip.i === i ? ' on' : ''}`}
                    onMouseEnter={() => setChip({ side, i })}
                    onMouseLeave={() => setChip(null)}
                  >
                    {item}
                  </li>
                ))
              ) : (
                <li className="ychip">—</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="vfoot">
        <p>Trophées stylisés génériques (aucune reproduction des trophées officiels).</p>
        <button
          type="button"
          className="pbtn"
          aria-pressed={touring}
          onClick={() => {
            if (touring) return setTouring(false);
            setChip(null);
            setIndex((i) => (i + 1) % cats.length);
            setTouring(true);
          }}
        >
          {touring ? '■ Stop visite' : '▶ Visite auto'}
        </button>
      </div>
    </section>
  );
}
