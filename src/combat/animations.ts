import * as THREE from 'three';
import type { Lang } from '../game/types';
import { canvasTexture } from '../util/canvas';

export type AnimType = 'hit' | 'heal';

export interface ActiveCombatAnim {
  type: AnimType;
  attackerId: string;
  targetId: string;
  elapsed: number;
  duration: number;
}

export function createHitAnim(attackerId: string, targetId: string): ActiveCombatAnim {
  return { type: 'hit', attackerId, targetId, elapsed: 0, duration: 0.42 };
}

export function createHealAnim(healerId: string): ActiveCombatAnim {
  return { type: 'heal', attackerId: healerId, targetId: healerId, elapsed: 0, duration: 0.4 };
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export function spawnHitParticles(scene: THREE.Scene, pos: THREE.Vector3): Particle[] {
  const parts: Particle[] = [];
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xff6644, transparent: true, opacity: 0.9 }),
    );
    mesh.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 1.5 + 0.5,
      (Math.random() - 0.5) * 2,
    );
    scene.add(mesh);
    parts.push({ mesh, vel, life: 0.4 + Math.random() * 0.2 });
  }
  return parts;
}

export function spawnHealParticles(scene: THREE.Scene, pos: THREE.Vector3): Particle[] {
  const parts: Particle[] = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x6ecfc0, transparent: true, opacity: 0.85 }),
    );
    mesh.position.copy(pos);
    const vel = new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 1.2 + 0.8, (Math.random() - 0.5) * 0.5);
    scene.add(mesh);
    parts.push({ mesh, vel, life: 0.5 });
  }
  return parts;
}

export function updateParticles(parts: Particle[], dt: number): Particle[] {
  return parts.filter((p) => {
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= dt * 2;
    const mat = p.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, p.life * 2);
    if (p.life <= 0) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.geometry.dispose();
      mat.dispose();
      return false;
    }
    return true;
  });
}

// Universal comic-book onomatopoeias: kept in English regardless of language,
// since these are globally recognized pulp/comic conventions (POW, BAM, etc.)
// rather than region-specific words.
const BURST_WORDS = ['POW!', 'BAM!', 'CRASH!', 'WHACK!', 'BOOM!', 'SMASH!', 'KO!'];

function makeBurstTexture(word: string): THREE.CanvasTexture {
  const w = 300;
  const h = 200;
  return canvasTexture(w, h, (ctx) => {
    ctx.translate(w / 2, h / 2);
    ctx.rotate((Math.random() - 0.5) * 0.3);

    const spikes = 11;
    const outer = 88;
    const inner = 52;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.72;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#fff4d0';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#161311';
    ctx.stroke();

    ctx.fillStyle = '#e8402c';
    ctx.font = "900 40px 'Segoe UI', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#161311';
    ctx.strokeText(word, 0, 4);
    ctx.fillText(word, 0, 4);
  });
}

export interface Popup {
  mesh: THREE.Sprite;
  life: number;
  maxLife: number;
  kind: 'burst' | 'roll';
  baseScale: number;
}

export function spawnComicBurst(scene: THREE.Scene, pos: THREE.Vector3, lang: Lang): Popup {
  void lang;
  const word = BURST_WORDS[Math.floor(Math.random() * BURST_WORDS.length)];
  const tex = makeBurstTexture(word);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const baseScale = 1.5;
  sprite.scale.set(0.05, 0.03, 1);
  sprite.position.copy(pos);
  sprite.renderOrder = 25;
  scene.add(sprite);
  return { mesh: sprite, life: 0.85, maxLife: 0.85, kind: 'burst', baseScale };
}

export function updatePopups(popups: Popup[], dt: number): Popup[] {
  return popups.filter((p) => {
    p.life -= dt;
    const t = 1 - p.life / p.maxLife;
    if (p.kind === 'burst') {
      const pop = t < 0.22 ? easeOutBack(t / 0.22) : 1;
      const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      const s = p.baseScale * pop * (0.85 + fade * 0.15);
      p.mesh.scale.set(s, s * 0.66, 1);
      (p.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, fade);
      p.mesh.position.y += dt * 0.35;
    } else {
      p.mesh.position.y += dt * 0.5;
      (p.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, p.life);
    }
    if (p.life <= 0) {
      p.mesh.parent?.remove(p.mesh);
      p.mesh.material.dispose();
      p.mesh.material.map?.dispose();
      return false;
    }
    return true;
  });
}

export interface DeathAnim {
  elapsed: number;
  duration: number;
  fallDir: number;
}

export function createDeathAnim(): DeathAnim {
  return { elapsed: 0, duration: 0.7, fallDir: Math.random() < 0.5 ? -1 : 1 };
}
