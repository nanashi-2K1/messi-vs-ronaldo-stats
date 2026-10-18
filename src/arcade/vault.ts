import * as THREE from 'three';
import type { TrophyKind } from '../../shared/types.ts';
import { addOrbit, LEGACY, mat, reducedMotion, texFn, texRows, vox, type Engine } from './engine.ts';
import type { Side, Theme } from './arena.ts';

export interface VaultCategory {
  id: TrophyKind;
  label: string;
  m: string[];
  r: string[];
}

export interface TrophyInfo {
  side: Side;
  label: string;
  item: string;
}

export interface VaultOptions {
  onHover: (info: TrophyInfo | null, e: PointerEvent) => void;
}

export interface Vault {
  show(cat: VaultCategory): void;
  /** Met en avant un trophée (survol d'une année dans la liste), ou aucun. */
  highlight(side: Side, index: number | null): void;
  setTheme(theme: Theme): void;
  dispose(): void;
}

const SIDE_X: Record<Side, number> = { m: -2.7, r: 2.7 };

/** Scène 2 : deux estrades et des trophées stylisés génériques qui tombent en rebondissant. */
export function createVault(engine: Engine, wrap: HTMLElement, opts: VaultOptions): Vault {
  const V = engine.addScene(wrap);
  const fog = new THREE.Fog(0x0a0c14, 11, 24);
  V.scene.fog = fog;
  const ambient = new THREE.AmbientLight(0x6070a0, 0.55 * LEGACY);
  V.scene.add(ambient);
  const front = new THREE.DirectionalLight(0xffffff, 0.45 * LEGACY);
  front.position.set(0, 6, 8);
  V.scene.add(front);

  const floorTex = texRows(['ab', 'ba'], { a: '#161c33', b: '#11162a' });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(12, 8);
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), floorMat);
  floor.rotation.x = -Math.PI / 2;
  V.scene.add(floor);
  const wallTex = texFn(8, 8, (x, y) => (y % 4 === 0 || x === (y < 4 ? 0 : 4) ? '#151a30' : '#20274a'));
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(12, 4);
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 8), wallMat);
  wall.position.set(0, 4, -3.2);
  V.scene.add(wall);

  const spots = {} as Record<Side, THREE.SpotLight>;
  for (const k of ['m', 'r'] as const) {
    const s = new THREE.SpotLight(k === 'm' ? 0x9cc6ff : 0xffb49c, 1.4 * LEGACY, 16, 0.55, 0.6, 0);
    s.position.set(SIDE_X[k], 7, 5);
    s.target.position.set(SIDE_X[k], 0.5, 0);
    V.scene.add(s, s.target);
    spots[k] = s;
    const ped = new THREE.Group();
    ped.position.x = SIDE_X[k];
    V.scene.add(ped);
    for (let r = 0; r < 4; r++) {
      const h = 0.25 + r * 0.3;
      vox(3.4, h, 0.75, k === 'm' ? '#1c3f7a' : '#7a2e1c', 0, h / 2, 0.9 - r * 0.75, ped);
      vox(3.42, 0.04, 0.06, '#c9a227', 0, h, 0.9 - r * 0.75 + 0.36, ped);
    }
  }

  const GOLD = new THREE.MeshPhongMaterial({ color: 0xffc533, emissive: 0x3a2600, specular: 0xffffff, shininess: 80, flatShading: true });
  const SILVER = new THREE.MeshPhongMaterial({ color: 0xd7dde8, emissive: 0x1a1d24, specular: 0xffffff, shininess: 90, flatShading: true });
  const DARK = mat('#22283d');
  const GREEN = new THREE.MeshPhongMaterial({ color: 0x1f8a4c, flatShading: true, shininess: 40 });
  const Box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const Cyl = (a: number, b: number, h: number, s: number) => new THREE.CylinderGeometry(a, b, h, s);
  const mk = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, g: THREE.Group, rx = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.x = rx;
    g.add(o);
    return o;
  };
  const cup = (g: THREE.Group, m: THREE.Material, s: number) => {
    mk(Box(0.3, 0.1, 0.3), DARK, 0, 0.05, 0, g);
    mk(Cyl(0.05, 0.09, 0.18, 6), m, 0, 0.19, 0, g);
    const by = 0.28 + 0.16 * s;
    mk(Cyl(0.24 * s, 0.1, 0.32 * s, 8), m, 0, by, 0, g);
    for (const sx of [-1, 1]) mk(new THREE.TorusGeometry(0.09 * s + (s > 1.1 ? 0.05 : 0), 0.03, 4, 8), m, sx * (0.24 * s + 0.05), by + 0.02, 0, g);
  };
  const BUILD: Record<TrophyKind, (g: THREE.Group) => void> = {
    ballon: (g) => {
      mk(Box(0.34, 0.12, 0.34), DARK, 0, 0.06, 0, g);
      mk(Cyl(0.05, 0.08, 0.12, 6), GOLD, 0, 0.18, 0, g);
      mk(new THREE.IcosahedronGeometry(0.22, 0), GOLD, 0, 0.44, 0, g);
    },
    wc: (g) => {
      mk(Cyl(0.17, 0.2, 0.12, 6), GREEN, 0, 0.06, 0, g);
      mk(Cyl(0.09, 0.15, 0.36, 6), GOLD, 0, 0.3, 0, g);
      mk(new THREE.IcosahedronGeometry(0.17, 0), GOLD, 0, 0.6, 0, g);
    },
    cont: (g) => cup(g, SILVER, 1),
    ucl: (g) => cup(g, SILVER, 1.25),
    cwc: (g) => cup(g, GOLD, 0.9),
    league: (g) => {
      mk(Box(0.12, 0.3, 0.12), DARK, 0, 0.15, 0, g);
      mk(Cyl(0.28, 0.28, 0.05, 8), SILVER, 0, 0.48, 0, g, Math.PI / 2);
      mk(Cyl(0.17, 0.17, 0.07, 8), GOLD, 0, 0.48, 0, g, Math.PI / 2);
    },
    boot: (g) => {
      mk(Box(0.42, 0.1, 0.26), DARK, 0, 0.05, 0, g);
      mk(Box(0.44, 0.07, 0.2), GOLD, 0, 0.14, 0, g);
      mk(Box(0.22, 0.24, 0.2), GOLD, -0.11, 0.29, 0, g);
      mk(Box(0.24, 0.12, 0.2), GOLD, 0.1, 0.23, 0, g);
    },
    olym: (g) => {
      mk(Box(0.3, 0.06, 0.2), DARK, 0, 0.03, 0, g);
      mk(Cyl(0.18, 0.18, 0.05, 10), GOLD, 0, 0.3, 0, g, Math.PI / 2);
      mk(Box(0.07, 0.3, 0.02), mat('#3b8cff'), -0.07, 0.6, 0, g).rotation.z = -0.35;
      mk(Box(0.07, 0.3, 0.02), mat('#f4f7ff'), 0.07, 0.6, 0, g).rotation.z = 0.35;
    },
  };

  const groups: Record<Side, THREE.Group> = { m: new THREE.Group(), r: new THREE.Group() };
  for (const k of ['m', 'r'] as const) {
    groups[k].position.x = SIDE_X[k];
    V.scene.add(groups[k]);
  }
  const empties = {} as Record<Side, { box: THREE.LineSegments; el: HTMLElement }>;
  for (const k of ['m', 'r'] as const) {
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(Box(0.7, 0.9, 0.7)), new THREE.LineBasicMaterial({ color: 0x4a5375 }));
    box.position.set(SIDE_X[k], 0.7, 0.9);
    V.scene.add(box);
    const el = document.createElement('div');
    el.className = 'empty';
    el.textContent = 'VITRINE VIDE';
    wrap.appendChild(el);
    empties[k] = { box, el };
  }

  // Étincelles autour du leader de la catégorie.
  const SPK = 70;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(SPK * 3);
  for (let i = 0; i < SPK; i++) {
    spPos[i * 3] = (Math.random() - 0.5) * 3.6;
    spPos[i * 3 + 1] = Math.random() * 3;
    spPos[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
  }
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ color: 0xffd23f, size: 0.07 }));
  V.scene.add(sparks);

  const orbit = addOrbit(V, new THREE.Vector3(0, 0.9, 0), 9.5, 0.32, 0.3, () => engine.now);
  const reduced = reducedMotion();
  let hovered: THREE.Object3D | null = null;
  const bounce = (x: number) => {
    const n = 7.5625;
    const d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };

  interface TrophyData {
    info: TrophyInfo;
    baseY: number;
    t0: number;
    idx: number;
    spin: number;
  }

  V.update = (t) => {
    for (const k of ['m', 'r'] as const) {
      for (const g of groups[k].children) {
        const u = g.userData as TrophyData;
        const kk = (t - u.t0) / 0.7;
        if (kk < 0) {
          g.visible = false;
          continue;
        }
        g.visible = true;
        g.position.y = u.baseY + (1 - bounce(Math.min(kk, 1))) * 4;
        const spin = Math.max(0, 1 - (t - u.spin) / 1.2);
        g.rotation.y = (reduced ? 0 : t * 0.6) + u.idx * 0.5 + spin * spin * Math.PI * 4;
        const s = g === hovered ? 1.5 : 1.15;
        g.scale.setScalar(g.scale.x + (s - g.scale.x) * 0.2);
      }
    }
    if (sparks.visible) {
      for (let i = 0; i < SPK; i++) {
        spPos[i * 3 + 1]! += 0.012;
        if (spPos[i * 3 + 1]! > 3) spPos[i * 3 + 1] = 0;
      }
      spGeo.attributes.position!.needsUpdate = true;
    }
    for (const k of ['m', 'r'] as const) {
      const e = empties[k];
      if (!e.box.visible) continue;
      const p = engine.toScreen(V, e.box.position);
      e.el.style.left = `${p.x}px`;
      e.el.style.top = `${p.y}px`;
      e.box.rotation.y = t * 0.4;
    }
    orbit.update(t);
  };

  const ray = new THREE.Raycaster();
  const pick = (e: PointerEvent | MouseEvent): THREE.Object3D | null => {
    ray.setFromCamera(engine.ndc(V, e), V.camera);
    const hit = ray.intersectObjects([...groups.m.children, ...groups.r.children], true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !(o.userData as Partial<TrophyData>).info) o = o.parent;
    return o;
  };
  const onMove = (e: PointerEvent) => {
    if (orbit.drag) return opts.onHover(null, e);
    const o = pick(e);
    hovered = o;
    V.canvas.style.cursor = o ? 'pointer' : 'grab';
    opts.onHover(o ? (o.userData as TrophyData).info : null, e);
  };
  const onLeave = (e: PointerEvent) => {
    hovered = null;
    opts.onHover(null, e);
  };
  const onClick = (e: MouseEvent) => {
    if (orbit.moved > 6) return;
    const o = pick(e);
    if (o) (o.userData as TrophyData).spin = engine.now;
  };
  V.canvas.addEventListener('pointermove', onMove);
  V.canvas.addEventListener('pointerleave', onLeave);
  V.canvas.addEventListener('click', onClick);

  return {
    show(cat) {
      for (const k of ['m', 'r'] as const) {
        const G = groups[k];
        while (G.children.length) G.remove(G.children[0]!);
        const items = cat[k];
        items.forEach((item, idx) => {
          const row = Math.floor(idx / 4);
          const inRow = Math.min(4, items.length - row * 4);
          const col = idx % 4;
          const g = new THREE.Group();
          BUILD[cat.id](g);
          g.scale.setScalar(1.15);
          const baseY = 0.25 + row * 0.3;
          g.position.set((col - (inRow - 1) / 2) * 0.8, baseY + 4, 0.9 - row * 0.75);
          g.visible = false;
          const data: TrophyData = { info: { side: k, label: cat.label, item }, baseY, t0: engine.now + 0.15 + idx * 0.08, idx, spin: -9 };
          g.userData = data;
          G.add(g);
        });
        empties[k].box.visible = items.length === 0;
        empties[k].el.style.display = items.length ? 'none' : 'block';
      }
      const lead = cat.m.length === cat.r.length ? null : cat.m.length > cat.r.length ? 'm' : 'r';
      sparks.visible = lead != null;
      if (lead) sparks.position.x = SIDE_X[lead];
      spots.m.intensity = (lead === 'm' ? 2.1 : 1.1) * LEGACY;
      spots.r.intensity = (lead === 'r' ? 2.1 : 1.1) * LEGACY;
    },
    highlight(side, index) {
      hovered = index == null ? null : (groups[side].children[index] ?? null);
    },
    setTheme(theme) {
      const day = theme === 'light';
      fog.color.set(day ? 0xe6e8f0 : 0x0a0c14);
      ambient.intensity = (day ? 0.95 : 0.55) * LEGACY;
      floorMat.color.set(day ? 0xb8c0d8 : 0xffffff);
      wallMat.color.set(day ? 0xc4cbe0 : 0xffffff);
    },
    dispose() {
      V.canvas.removeEventListener('pointermove', onMove);
      V.canvas.removeEventListener('pointerleave', onLeave);
      V.canvas.removeEventListener('click', onClick);
      for (const k of ['m', 'r'] as const) empties[k].el.remove();
      V.dispose();
    },
  };
}
