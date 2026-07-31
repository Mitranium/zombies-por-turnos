import * as THREE from 'three';

export type AnimType = 'hit' | 'heal';

export interface ActiveCombatAnim {
  type: AnimType;
  attackerId: string;
  targetId: string;
  elapsed: number;
  duration: number;
  done: boolean;
}

export function createHitAnim(attackerId: string, targetId: string): ActiveCombatAnim {
  return { type: 'hit', attackerId, targetId, elapsed: 0, duration: 0.38, done: false };
}

export function createHealAnim(healerId: string): ActiveCombatAnim {
  return { type: 'heal', attackerId: healerId, targetId: healerId, elapsed: 0, duration: 0.35, done: false };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
      mat.dispose();
      return false;
    }
    return true;
  });
}
