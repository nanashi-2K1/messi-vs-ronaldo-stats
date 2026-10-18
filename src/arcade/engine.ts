import * as THREE from 'three';

/*
 * Moteur commun aux scènes 3D (portage de la maquette arcade) : une seule boucle
 * d'animation, rendu en basse résolution agrandi sans lissage (look 8-bit), mise en
 * pause des scènes hors écran, bulles de texte et confettis en surcouche HTML.
 *
 * three.js récent applique la gestion des couleurs et un éclairage physique : on les
 * neutralise pour retrouver le rendu de la maquette (r128).
 */
THREE.ColorManagement.enabled = false;
/** Facteur d'intensité pour retrouver l'éclairage « historique » de three.js. */
export const LEGACY = Math.PI;

/** Champ vertical de la caméra (°) et format en dessous duquel il est élargi. */
const BASE_FOV = 38;
const MIN_ASPECT = 1.2;

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------- Textures -------------------------------- */

export function texFn(w: number, h: number, fn: (x: number, y: number) => string | null | undefined): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = fn(x, y);
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

export const texRows = (rows: string[], pal: Record<string, string>) =>
  texFn(rows[0]!.length, rows.length, (x, y) => pal[rows[y]![x]!]);

export const texMat = (t: THREE.Texture) => new THREE.MeshLambertMaterial({ map: t });

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: string): THREE.MeshLambertMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}

type Mat = string | THREE.Material | THREE.Material[];

/** Pavé voxel (largeur, hauteur, profondeur, matière, position) ajouté au parent. */
export function vox(w: number, h: number, d: number, m: Mat, x: number, y: number, z: number, parent?: THREE.Object3D): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}

/* --------------------------------- Scènes --------------------------------- */

export interface SceneHandle {
  wrap: HTMLElement;
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  visible: boolean;
  update: (t: number) => void;
  dispose: () => void;
}

interface Bubble {
  scene: SceneHandle;
  obj: THREE.Object3D;
  el: HTMLElement;
}

export class Engine {
  private readonly scenes: SceneHandle[] = [];
  private readonly bubbles: Bubble[] = [];
  private last = 0;
  private frame = 0;
  private sim = 0;
  paused = false;
  pixelSize = 3;

  /** Temps de simulation (s), figé pendant la pause. */
  get now() {
    return this.sim;
  }

  addScene(wrap: HTMLElement): SceneHandle {
    const canvas = document.createElement('canvas');
    wrap.prepend(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(1);
    const handle: SceneHandle = {
      wrap,
      canvas,
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 100),
      visible: true,
      update: () => {},
      dispose: () => {},
    };
    const io = new IntersectionObserver((e) => (handle.visible = e[0]?.isIntersecting ?? true));
    io.observe(wrap);
    const ro = new ResizeObserver(() => this.size(handle));
    ro.observe(wrap);
    handle.dispose = () => {
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
      canvas.remove();
      const i = this.scenes.indexOf(handle);
      if (i >= 0) this.scenes.splice(i, 1);
    };
    this.scenes.push(handle);
    this.size(handle);
    if (!this.frame) this.loop();
    return handle;
  }

  size(h: SceneHandle): void {
    const w = h.wrap.clientWidth;
    const ht = h.wrap.clientHeight;
    if (!w || !ht) return;
    h.renderer.setSize(Math.ceil(w / this.pixelSize), Math.ceil(ht / this.pixelSize), false);
    h.camera.aspect = w / ht;
    // Écran étroit (portrait) : on élargit le champ vertical pour garder toute la largeur de la scène.
    const k = Math.max(1, MIN_ASPECT / h.camera.aspect);
    h.camera.fov = (2 * Math.atan(Math.tan((BASE_FOV * Math.PI) / 360) * k) * 180) / Math.PI;
    h.camera.updateProjectionMatrix();
  }

  setPixelSize(px: number): void {
    this.pixelSize = px;
    for (const s of this.scenes) this.size(s);
  }

  /** Coordonnées normalisées (-1 → 1) d'un évènement pointeur dans la scène. */
  ndc(h: SceneHandle, e: PointerEvent | MouseEvent): THREE.Vector2 {
    const b = h.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  }

  toScreen(h: SceneHandle, v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(h.camera);
    return { x: ((p.x + 1) / 2) * h.wrap.clientWidth, y: ((1 - p.y) / 2) * h.wrap.clientHeight };
  }

  /** Bulle de texte accrochée à un objet 3D (texte posé via textContent). */
  bubble(h: SceneHandle, obj: THREE.Object3D, text: string, color: string): void {
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    el.style.setProperty('--c', color);
    h.wrap.appendChild(el);
    const b = { scene: h, obj, el };
    this.bubbles.push(b);
    setTimeout(() => {
      el.remove();
      const i = this.bubbles.indexOf(b);
      if (i >= 0) this.bubbles.splice(i, 1);
    }, 1700);
  }

  confetti(wrap: HTMLElement, colors: string[]): void {
    if (reducedMotion()) return;
    for (let i = 0; i < 50; i++) {
      const d = document.createElement('i');
      d.className = 'cf';
      d.style.left = `${Math.random() * 100}%`;
      d.style.background = colors[i % colors.length]!;
      d.style.animationDuration = `${1.3 + Math.random() * 1.4}s`;
      d.style.animationDelay = `${Math.random() * 0.4}s`;
      d.style.setProperty('--dx', `${Math.random() * 160 - 80}px`);
      wrap.appendChild(d);
      setTimeout(() => d.remove(), 3300);
    }
  }

  private loop = (t = performance.now()): void => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0;
    this.last = t;
    if (!this.paused) this.sim += dt;
    for (const s of this.scenes) {
      if (!s.visible) continue;
      s.update(this.sim);
      s.renderer.render(s.scene, s.camera);
    }
    for (const b of this.bubbles) {
      const v = new THREE.Vector3();
      b.obj.getWorldPosition(v);
      v.y += 0.7;
      const p = this.toScreen(b.scene, v);
      b.el.style.left = `${p.x}px`;
      b.el.style.top = `${p.y}px`;
    }
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    for (const s of [...this.scenes]) s.dispose();
  }
}

/* --------------------------- Caméra en orbite --------------------------- */

export interface Orbit {
  drag: boolean;
  moved: number;
  update: (t: number) => void;
}

/** Caméra orbitale : glisser pour tourner, léger balancement automatique au repos. */
export function addOrbit(h: SceneHandle, target: THREE.Vector3, radius: number, phi0: number, sway = 0.25, now: () => number): Orbit {
  const o = { theta: 0, phi: phi0, drag: false, moved: 0, last: -10, lx: 0, ly: 0 };
  const c = h.canvas;
  c.addEventListener('pointerdown', (e) => {
    o.drag = true;
    o.moved = 0;
    o.lx = e.clientX;
    o.ly = e.clientY;
    c.setPointerCapture(e.pointerId);
    c.style.cursor = 'grabbing';
  });
  c.addEventListener('pointermove', (e) => {
    if (!o.drag) return;
    const dx = e.clientX - o.lx;
    const dy = e.clientY - o.ly;
    o.moved += Math.abs(dx) + Math.abs(dy);
    o.lx = e.clientX;
    o.ly = e.clientY;
    o.theta -= dx * 0.008;
    o.phi = Math.min(1.1, Math.max(0.06, o.phi + dy * 0.005));
    o.last = now();
  });
  const end = () => {
    o.drag = false;
    c.style.cursor = 'grab';
  };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
  const reduced = reducedMotion();
  return {
    get drag() {
      return o.drag;
    },
    get moved() {
      return o.moved;
    },
    update: (t: number) => {
      if (!o.drag && t - o.last > 3) {
        const tg = reduced ? 0 : Math.sin(t * 0.22) * sway;
        o.theta += (tg - o.theta) * 0.02;
        o.phi += (phi0 - o.phi) * 0.02;
      }
      h.camera.position.set(
        target.x + radius * Math.sin(o.theta) * Math.cos(o.phi),
        target.y + radius * Math.sin(o.phi),
        target.z + radius * Math.cos(o.theta) * Math.cos(o.phi),
      );
      h.camera.lookAt(target);
    },
  };
}

/** WebGL disponible (sinon l'interface affiche les compteurs sans la scène 3D). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
