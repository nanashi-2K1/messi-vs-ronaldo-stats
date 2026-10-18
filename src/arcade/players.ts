import * as THREE from 'three';
import { mat, texFn, texMat, texRows, vox, type Engine, type SceneHandle } from './engine.ts';

/* Silhouettes voxel génériques (couleurs, numéro, coiffure), d'après la maquette arcade. */

const DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '7': ['111', '001', '001', '010', '010'],
};

function backTex(num: number, bg: string, fg: string, collar: string) {
  const s = String(num);
  const ox = Math.floor((12 - (s.length * 4 - 1)) / 2);
  return texFn(12, 12, (x, y) => {
    for (let i = 0; i < s.length; i++) {
      const dx = x - ox - i * 4;
      const dy = y - 3;
      if (dx >= 0 && dx < 3 && dy >= 0 && dy < 5 && DIGITS[s[i]!]![dy]![dx] === '1') return fg;
    }
    return y === 0 ? collar : bg;
  });
}

export interface Look {
  num: number;
  shirt: string;
  collar: string;
  shorts: string;
  socks: string;
  boots: string;
  skin: string;
  hair: string;
  beard?: string;
  scale?: number;
  front: (x: number, y: number) => string;
  face: string[];
}

export type AnimType = 'point' | 'siu' | 'kick' | 'pump' | 'sad';

export interface Anim {
  type: AnimType;
  t0: number;
  dur: number;
  shout?: string;
  color?: string;
  said?: boolean;
}

export interface Player {
  g: THREE.Group;
  body: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Mesh;
  anim: Anim | null;
  ph: number;
}

export function buildPlayer(c: Look): Player {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shirt = mat(c.shirt);
  const leg = (x: number) => {
    const l = new THREE.Group();
    l.position.set(x, 1.2, 0);
    body.add(l);
    vox(0.38, 0.55, 0.42, c.shorts, 0, -0.27, 0, l);
    vox(0.32, 0.5, 0.34, c.socks, 0, -0.8, 0, l);
    vox(0.36, 0.18, 0.56, c.boots, 0, -1.11, 0.08, l);
    return l;
  };
  const legL = leg(-0.22);
  const legR = leg(0.22);
  vox(
    0.9,
    0.9,
    0.5,
    [shirt, shirt, shirt, mat(c.shorts), texMat(texFn(12, 12, c.front)), texMat(backTex(c.num, c.shirt, '#ffffff', c.collar))],
    0,
    1.65,
    0,
    body,
  );
  const arm = (x: number) => {
    const a = new THREE.Group();
    a.position.set(x, 2.05, 0);
    body.add(a);
    vox(0.3, 0.36, 0.36, shirt, 0, -0.15, 0, a);
    vox(0.24, 0.52, 0.26, c.skin, 0, -0.57, 0, a);
    return a;
  };
  const armL = arm(-0.6);
  const armR = arm(0.6);
  const pal = { h: c.hair, s: c.skin, e: '#141420', m: '#7a2f22', b: c.beard ?? c.skin };
  const side = texMat(texFn(8, 8, (_x, y) => (y < 2 ? c.hair : c.beard && y >= 6 ? c.beard : c.skin)));
  const head = vox(
    0.72,
    0.72,
    0.72,
    [side, side, mat(c.hair), mat(c.skin), texMat(texRows(c.face, pal)), texMat(texFn(8, 8, (_x, y) => (y < 6 ? c.hair : (c.beard ?? c.skin))))],
    0,
    2.5,
    0,
    body,
  );
  vox(0.78, 0.14, 0.78, c.hair, 0, 2.89, -0.02, body);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);
  g.scale.setScalar(c.scale ?? 1);
  return { g, body, legL, legR, armL, armR, head, anim: null, ph: Math.random() * 6 };
}

export const LOOKS: Record<'m' | 'r', Look> = {
  m: {
    num: 10,
    shirt: '#6fb8ff',
    collar: '#1d2b5a',
    shorts: '#1d2b5a',
    socks: '#f4f7ff',
    boots: '#ff3fa4',
    skin: '#e8b48a',
    hair: '#5a3720',
    beard: '#4a2c18',
    front: (x, y) => (y === 0 ? '#1d2b5a' : Math.floor((x + 1) / 2) % 2 ? '#f4f7ff' : '#6fb8ff'),
    face: ['hhhhhhhh', 'hhhhhhhh', 'ssssssss', 'sesssses', 'ssssssss', 'bssssssb', 'bbbmmbbb', 'bbbbbbbb'],
  },
  r: {
    num: 7,
    shirt: '#e8452c',
    collar: '#1f6d3c',
    shorts: '#1f6d3c',
    socks: '#e8452c',
    boots: '#ffd23f',
    scale: 1.08,
    skin: '#c98d62',
    hair: '#1b1410',
    front: (x, y) => (y === 0 ? '#1f6d3c' : y === 2 && (x === 2 || x === 3) ? '#ffd23f' : x === 11 || x === 0 ? '#c93a24' : '#e8452c'),
    face: ['hhhhhhhh', 'hhhhhhhs', 'ssssssss', 'sesssses', 'ssssssss', 'ssssssss', 'sssmmsss', 'ssssssss'],
  },
};

/** Pose de la frame courante : respiration au repos, ou animation en cours. */
export function animatePlayer(p: Player, t: number, engine: Engine, scene: SceneHandle): void {
  const b = p.body;
  b.position.y = 0;
  b.rotation.set(0, 0, 0);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.armL.rotation.set(0, 0, 0);
  p.armR.rotation.set(0, 0, 0);
  p.head.rotation.set(0, 0, 0);
  const a = p.anim;
  const dt = a ? t - a.t0 : 0;
  if (!a || dt > a.dur) {
    p.anim = null;
    const s = Math.sin(t * 2.2 + p.ph);
    b.position.y = Math.abs(s) * 0.035;
    p.armL.rotation.z = -0.08 - s * 0.04;
    p.armR.rotation.z = 0.08 + s * 0.04;
    p.head.rotation.y = Math.sin(t * 0.6 + p.ph) * 0.25;
    return;
  }
  const say = () => {
    if (!a.said && a.shout) {
      a.said = true;
      engine.bubble(scene, p.head, a.shout, a.color ?? '#fff');
    }
  };
  if (a.type === 'point') {
    // Les deux bras vers le ciel.
    const k = Math.min(1, dt / 0.45);
    b.position.y = dt < 0.7 ? Math.abs(Math.sin(dt * 12)) * 0.18 : 0;
    p.armL.rotation.z = -2.9 * k + Math.sin(dt * 6) * 0.06;
    p.armR.rotation.z = 2.9 * k - Math.sin(dt * 6) * 0.06;
    p.head.rotation.x = -0.4 * k;
    if (dt > 0.3) say();
  } else if (a.type === 'siu') {
    // Demi-tour, saut vrillé, réception jambes écartées.
    if (dt < 0.5) {
      b.rotation.y = Math.PI * (dt / 0.5);
      b.position.y = Math.abs(Math.sin(dt * 14)) * 0.1;
    } else if (dt < 1.1) {
      const k = (dt - 0.5) / 0.6;
      b.position.y = 1.2 * 4 * k * (1 - k);
      b.rotation.y = Math.PI + Math.PI * k;
      p.legL.rotation.x = p.legR.rotation.x = -0.5 * Math.sin(Math.PI * k);
      p.armL.rotation.z = -1.6;
      p.armR.rotation.z = 1.6;
    } else {
      b.position.y = -0.07;
      b.rotation.x = -0.12;
      p.legL.rotation.z = -0.35;
      p.legR.rotation.z = 0.35;
      p.armL.rotation.z = -0.65;
      p.armR.rotation.z = 0.65;
      p.armL.rotation.x = p.armR.rotation.x = 0.35;
      p.head.rotation.x = -0.15;
      say();
    }
  } else if (a.type === 'kick') {
    const r = dt < 0.2 ? (0.9 * dt) / 0.2 : dt < 0.35 ? 0.9 - (2.2 * (dt - 0.2)) / 0.15 : -1.3 + (1.3 * (dt - 0.35)) / 0.25;
    p.legR.rotation.x = r;
    p.armL.rotation.x = -r * 0.5;
    p.armR.rotation.x = r * 0.3;
    b.rotation.x = -r * 0.06;
  } else if (a.type === 'pump') {
    b.position.y = Math.abs(Math.sin(dt * 8)) * 0.2;
    p.armR.rotation.z = 2.5 + Math.sin(dt * 16) * 0.3;
  } else if (a.type === 'sad') {
    const k = Math.min(1, dt / 0.4);
    p.head.rotation.x = 0.5 * k;
    b.rotation.x = 0.12 * k;
    p.armL.rotation.z = 0.05;
    p.armR.rotation.z = -0.05;
    b.position.y = -0.03 * k;
  }
}
