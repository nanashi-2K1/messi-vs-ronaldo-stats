import * as THREE from 'three';
import { addOrbit, LEGACY, mat, texMat, texRows, vox, type Engine } from './engine.ts';
import { animatePlayer, buildPlayer, LOOKS, type Player } from './players.ts';

export type Side = 'm' | 'r';
export type Theme = 'dark' | 'light';

export interface ArenaOptions {
  colors: Record<Side, string>;
  shouts: Record<Side, string>;
  /** Survol d'un joueur (null quand le pointeur quitte les joueurs). */
  onHover: (side: Side | null, e: PointerEvent) => void;
}

export interface Arena {
  celebrate(side: Side): void;
  react(side: Side, type: 'pump' | 'sad'): void;
  setPasses(on: boolean): void;
  setTheme(theme: Theme): void;
  setColors(colors: Record<Side, string>): void;
  confetti(side: Side): void;
  dispose(): void;
}

const other = (k: Side): Side => (k === 'm' ? 'r' : 'm');

/** Scène 1 : le terrain, les deux joueurs qui se font des passes, les tribunes et les projecteurs. */
export function createArena(engine: Engine, wrap: HTMLElement, opts: ArenaOptions): Arena {
  const H = engine.addScene(wrap);
  let colors = opts.colors;
  const fog = new THREE.Fog(0x0b0d17, 13, 28);
  H.scene.fog = fog;
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x2a3b20, 0.9 * LEGACY);
  H.scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.7 * LEGACY);
  sun.position.set(4, 8, 6);
  H.scene.add(sun);

  // Pelouse rayée et lignes.
  const grass = texRows(['ab'], { a: '#2f8f3a', b: '#287d33' });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(10, 1);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshLambertMaterial({ map: grass }));
  field.rotation.x = -Math.PI / 2;
  H.scene.add(field);
  vox(0.06, 0.01, 12, '#e9f1e6', 0, 0.006, 0, H.scene);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.6, 20), mat('#e9f1e6'));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.007;
  H.scene.add(ring);

  // Projecteurs et tribune en voxels.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0 });
  for (const x of [-7, 7]) {
    vox(0.2, 5, 0.2, '#3a4060', x, 2.5, -5, H.scene);
    vox(1.2, 0.5, 0.3, lampMat, x, 5.1, -5, H.scene);
  }
  const crowd = ['#3b8cff', '#ec5a2c', '#f4f7ff', '#2a3150'];
  for (let i = 0; i < 34; i++) {
    const x = -10 + i * 0.6;
    for (let r = 0; r < 3; r++) vox(0.45, 0.45, 0.45, crowd[(i * 7 + r * 3) % 4]!, x, 0.5 + r * 0.6, -6 - r * 0.5, H.scene);
  }

  const PL: Record<Side, Player> = { m: buildPlayer(LOOKS.m), r: buildPlayer(LOOKS.r) };
  PL.m.g.position.set(-1.8, 0, 0.2);
  PL.r.g.position.set(1.8, 0, 0.2);
  H.scene.add(PL.m.g, PL.r.g);

  const ball = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34),
    texMat(texRows(['wwwwww', 'wkwwkw', 'wwkkww', 'wwkkww', 'wkwwkw', 'wwwwww'], { w: '#f4f4f4', k: '#1a1a1a' })),
  );
  ball.position.set(0, 0.17, 0.9);
  H.scene.add(ball);
  const orbit = addOrbit(H, new THREE.Vector3(0, 1.45, 0), 9, 0.3, 0.25, () => engine.now);

  const game: {
    passes: boolean;
    owner: Side;
    next: number;
    fly: { from: THREE.Vector3; to: THREE.Vector3; toKey: Side; t0: number; dur: number } | null;
    launch: { t: number; from: Side } | null;
  } = { passes: true, owner: 'r', next: 1.2, fly: null, launch: null };

  const footPos = (k: Side) => {
    const g = PL[k].g;
    return new THREE.Vector3(g.position.x + Math.sin(g.rotation.y) * 0.6, 0.17, g.position.z + Math.cos(g.rotation.y) * 0.6);
  };
  const kick = (k: Side) => {
    PL[k].anim = { type: 'kick', t0: engine.now, dur: 0.6 };
    game.launch = { t: engine.now + 0.27, from: k };
    game.next = Infinity;
  };

  H.update = (t) => {
    for (const k of ['m', 'r'] as const) {
      const p = PL[k];
      animatePlayer(p, t, engine, H);
      const celebrating = p.anim != null && p.anim.type !== 'kick';
      const target = game.passes && !celebrating ? (k === 'm' ? 1.05 : -1.05) : k === 'm' ? 0.4 : -0.4;
      p.g.rotation.y += (target - p.g.rotation.y) * 0.08;
    }
    if (game.launch && t >= game.launch.t) {
      const to = other(game.launch.from);
      game.fly = { from: ball.position.clone(), to: footPos(to), toKey: to, t0: t, dur: 0.85 };
      game.launch = null;
    }
    if (game.fly) {
      const f = game.fly;
      const k = (t - f.t0) / f.dur;
      if (k >= 1) {
        game.fly = null;
        game.owner = f.toKey;
        game.next = t + 0.8 + Math.random() * 0.8;
      } else {
        ball.position.lerpVectors(f.from, f.to, k);
        ball.position.y = 0.17 + 1.3 * 4 * k * (1 - k);
        ball.rotation.x += 0.35;
        ball.rotation.z += 0.2;
      }
    } else if (game.passes) {
      const tg = footPos(game.owner);
      ball.position.x += (tg.x - ball.position.x) * 0.2;
      ball.position.z += (tg.z - ball.position.z) * 0.2;
      ball.position.y = 0.17 + Math.abs(Math.sin(t * 6)) * 0.05;
      if (t > game.next && !PL.m.anim && !PL.r.anim) kick(game.owner);
    } else {
      ball.position.x += (0 - ball.position.x) * 0.05;
      ball.position.z += (0.9 - ball.position.z) * 0.05;
      ball.position.y = 0.17 + Math.abs(Math.sin(t * 3)) * 0.6;
      ball.rotation.y += 0.03;
    }
    orbit.update(t);
  };

  // Interactions : survol = fiche, clic = célébration.
  const ray = new THREE.Raycaster();
  const pick = (e: PointerEvent | MouseEvent): Side | null => {
    ray.setFromCamera(engine.ndc(H, e), H.camera);
    for (const k of ['m', 'r'] as const) if (ray.intersectObject(PL[k].g, true).length) return k;
    return null;
  };
  const onMove = (e: PointerEvent) => {
    if (orbit.drag) return opts.onHover(null, e);
    const k = pick(e);
    H.canvas.style.cursor = k ? 'pointer' : 'grab';
    opts.onHover(k, e);
  };
  const onLeave = (e: PointerEvent) => opts.onHover(null, e);
  const onClick = (e: MouseEvent) => {
    if (orbit.moved > 6) return;
    const k = pick(e);
    if (k) api.celebrate(k);
  };
  H.canvas.addEventListener('pointermove', onMove);
  H.canvas.addEventListener('pointerleave', onLeave);
  H.canvas.addEventListener('click', onClick);

  const api: Arena = {
    celebrate(k) {
      PL[k].anim =
        k === 'm'
          ? { type: 'point', t0: engine.now, dur: 2.4, shout: opts.shouts.m, color: colors.m }
          : { type: 'siu', t0: engine.now, dur: 2.8, shout: opts.shouts.r, color: colors.r };
    },
    react(k, type) {
      PL[k].anim = { type, t0: engine.now, dur: type === 'sad' ? 2.4 : 1.2 };
    },
    setPasses(on) {
      game.passes = on;
      game.next = engine.now + 0.5;
    },
    setTheme(theme) {
      // Nocturne : brouillard bleu nuit ; de jour : ciel clair et lumière plus franche.
      const day = theme === 'light';
      fog.color.set(day ? 0xdcefff : 0x0b0d17);
      fog.near = day ? 16 : 13;
      fog.far = day ? 34 : 28;
      hemi.intensity = (day ? 1.05 : 0.9) * LEGACY;
      sun.intensity = (day ? 0.85 : 0.7) * LEGACY;
      lampMat.color.set(day ? 0xd9dce6 : 0xfff6d0);
    },
    setColors(c) {
      colors = c;
    },
    confetti(k) {
      engine.confetti(wrap, k === 'm' ? [colors.m, '#f4f7ff', '#ffd23f'] : [colors.r, '#1f6d3c', '#ffd23f']);
    },
    dispose() {
      H.canvas.removeEventListener('pointermove', onMove);
      H.canvas.removeEventListener('pointerleave', onLeave);
      H.canvas.removeEventListener('click', onClick);
      H.dispose();
    },
  };
  return api;
}
