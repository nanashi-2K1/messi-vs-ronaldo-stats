/*
 * Infobulle unique de la page (graphiques, terrain, scènes 3D). Le contenu est
 * construit avec textContent : aucune donnée n'est interprétée comme du HTML.
 */

export interface TipLine {
  label?: string;
  value: string;
  color?: string;
}

let el: HTMLDivElement | null = null;

function node(): HTMLDivElement {
  if (!el) {
    el = document.createElement('div');
    el.className = 'tip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
  }
  return el;
}

export function showTip(title: string, lines: TipLine[], x: number, y: number, titleColor?: string): void {
  const tip = node();
  tip.replaceChildren();
  const b = document.createElement('b');
  b.textContent = title;
  if (titleColor) b.style.color = titleColor;
  tip.appendChild(b);
  for (const line of lines) {
    const div = document.createElement('div');
    if (line.label) {
      const l = document.createElement('span');
      l.className = 'l';
      l.textContent = `${line.label} : `;
      div.appendChild(l);
    }
    const v = document.createElement('span');
    v.textContent = line.value;
    if (line.color) v.style.color = line.color;
    div.appendChild(v);
    tip.appendChild(div);
  }
  tip.style.display = 'block';
  tip.style.left = `${Math.min(x + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${Math.min(y + 14, window.innerHeight - tip.offsetHeight - 8)}px`;
}

export function hideTip(): void {
  if (el) el.style.display = 'none';
}
