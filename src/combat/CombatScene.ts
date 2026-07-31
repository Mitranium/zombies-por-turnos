import * as THREE from 'three';
import type { CombatState, Lang, Unit, UnitRole } from '../game/types';
import {
  type ActiveCombatAnim,
  createHealAnim,
  createHitAnim,
  easeInOutQuad,
  easeOutQuad,
  type Particle,
  spawnHealParticles,
  spawnHitParticles,
  updateParticles,
} from './animations';
import { diceLabelForRole } from './dice';
import { t } from '../i18n/strings';

const ROLE_COLORS: Record<string, number> = {
  athlete: 0xd4a017,
  medic: 0x4a9e8c,
  criminal: 0xc0392b,
  shambler: 0x4a7a3a,
  screamer: 0xb8860b,
  ripper: 0x9b2c6a,
  rival: 0x7d5ba6,
};

const SKIN = 0xc9a882;
const ZOMBIE_SKIN = 0x6a8a5a;

interface UnitVisual {
  group: THREE.Group;
  characterGroup: THREE.Group;
  pickTargets: THREE.Object3D[];
  hpFill: THREE.Mesh;
  hpBg: THREE.Mesh;
  nameplate: THREE.Sprite;
  shadow: THREE.Mesh;
  unitId: string;
  basePos: THREE.Vector3;
}

function makeNameplateTexture(name: string, hp: number, maxHp: number, die: string): THREE.CanvasTexture {
  const w = 220;
  const h = 88;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(6,8,6,0.88)';
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, h - 8, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,230,74,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#e8ece4';
  ctx.font = 'bold 22px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, w / 2, 28);

  ctx.fillStyle = '#a8b0a0';
  ctx.font = '16px Consolas, monospace';
  ctx.fillText(`${hp} / ${maxHp}`, w / 2, 52);

  ctx.fillStyle = '#c8e64a';
  ctx.font = 'bold 15px Consolas, monospace';
  ctx.fillText(`🎲 ${die}`, w / 2, 74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeRollTexture(rollStr: string, damage: number): THREE.CanvasTexture {
  const w = 160;
  const h = 80;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(30,8,8,0.92)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = '#ff8866';
  ctx.font = 'bold 26px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(rollStr, w / 2, 32);
  ctx.fillStyle = '#ffcc44';
  ctx.font = 'bold 22px Consolas, monospace';
  ctx.fillText(`= ${damage}`, w / 2, 62);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function mat(color: number, rough = 0.7, metal = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    emissive: color,
    emissiveIntensity: 0.06,
  });
}

function addMesh(group: THREE.Group, geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  group.add(m);
  return m;
}

function buildSurvivor(role: UnitRole, color: number): THREE.Group {
  const g = new THREE.Group();
  const cloth = mat(color);
  const pants = mat(0x2a2a2e);
  const skin = mat(SKIN, 0.85);

  if (role === 'athlete') {
    addMesh(g, new THREE.BoxGeometry(0.5, 0.55, 0.32), cloth, 0, 0.72, 0);
    addMesh(g, new THREE.BoxGeometry(0.62, 0.14, 0.36), cloth, 0, 0.98, 0);
    addMesh(g, new THREE.SphereGeometry(0.2, 8, 8), skin, 0, 1.22, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.5, 0.16), pants, -0.14, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.5, 0.16), pants, 0.14, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.14, 0.42, 0.14), skin, -0.34, 0.82, 0);
    addMesh(g, new THREE.BoxGeometry(0.14, 0.42, 0.14), skin, 0.34, 0.82, 0);
  } else if (role === 'medic') {
    addMesh(g, new THREE.BoxGeometry(0.38, 0.5, 0.28), mat(0xd8e8e4), 0, 0.7, 0);
    addMesh(g, new THREE.BoxGeometry(0.3, 0.35, 0.18), mat(color), 0, 0.72, 0.12);
    addMesh(g, new THREE.SphereGeometry(0.17, 8, 8), skin, 0, 1.15, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.45, 0.12), pants, -0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.45, 0.12), pants, 0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.2, 0.22, 0.12), mat(0xffffff, 0.5), -0.28, 0.78, 0);
    addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), mat(0xcc4444), -0.28, 0.88, 0.08, 1, 1, 1);
  } else if (role === 'criminal') {
    addMesh(g, new THREE.BoxGeometry(0.4, 0.5, 0.3), mat(0x1a1a1a), 0, 0.7, 0);
    addMesh(g, new THREE.CylinderGeometry(0.2, 0.22, 0.12, 8), mat(0x1a1a1a), 0, 1.28, 0);
    addMesh(g, new THREE.SphereGeometry(0.16, 8, 8), skin, 0, 1.12, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.44, 0.13), mat(0x1a1a1a), -0.12, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.44, 0.13), mat(0x1a1a1a), 0.12, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.28, 0.1, 0.1), mat(0x333333, 0.3, 0.6), 0.32, 0.85, 0.1);
    addMesh(g, new THREE.BoxGeometry(0.08, 0.08, 0.2), mat(color, 0.4, 0.3), 0.42, 0.85, 0.1);
  } else {
    addMesh(g, new THREE.BoxGeometry(0.4, 0.5, 0.28), cloth, 0, 0.7, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 8, 8), skin, 0, 1.14, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.44, 0.12), pants, -0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.44, 0.12), pants, 0.11, 0.26, 0);
  }
  return g;
}

function buildZombie(role: UnitRole, color: number): THREE.Group {
  const g = new THREE.Group();
  const flesh = mat(ZOMBIE_SKIN, 0.9);
  const rot = mat(color);

  if (role === 'shambler') {
    g.rotation.z = 0.08;
    addMesh(g, new THREE.BoxGeometry(0.45, 0.5, 0.3), rot, 0, 0.65, 0, 1, 1.05, 1);
    addMesh(g, new THREE.SphereGeometry(0.2, 6, 6), flesh, 0.05, 1.1, 0.05);
    addMesh(g, new THREE.BoxGeometry(0.14, 0.48, 0.14), flesh, -0.2, 0.28, 0.1);
    addMesh(g, new THREE.BoxGeometry(0.14, 0.4, 0.14), flesh, 0.18, 0.3, -0.08);
    addMesh(g, new THREE.BoxGeometry(0.22, 0.08, 0.08), flesh, 0.35, 0.75, 0.15);
  } else if (role === 'screamer') {
    addMesh(g, new THREE.BoxGeometry(0.28, 0.65, 0.22), rot, 0, 0.78, 0, 1, 1.15, 1);
    addMesh(g, new THREE.SphereGeometry(0.18, 6, 6), flesh, 0, 1.28, 0);
    addMesh(g, new THREE.ConeGeometry(0.1, 0.2, 4), mat(0x4a1010), 0, 1.2, 0.12, 1, 1, 0.6);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.5, 0.1), flesh, -0.12, 0.3, 0);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.5, 0.1), flesh, 0.12, 0.3, 0);
  } else if (role === 'ripper') {
    addMesh(g, new THREE.BoxGeometry(0.38, 0.45, 0.28), rot, 0, 0.68, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 6, 6), flesh, 0, 1.12, 0);
    addMesh(g, new THREE.ConeGeometry(0.06, 0.25, 4), mat(0xcccccc, 0.3, 0.7), -0.28, 0.8, 0.1, 1, 1, 1);
    addMesh(g, new THREE.ConeGeometry(0.06, 0.25, 4), mat(0xcccccc, 0.3, 0.7), 0.28, 0.8, 0.1, 1, 1, 1);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.42, 0.12), flesh, -0.1, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.38, 0.12), flesh, 0.1, 0.28, 0);
  } else {
    addMesh(g, new THREE.BoxGeometry(0.4, 0.5, 0.28), rot, 0, 0.7, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 6, 6), flesh, 0, 1.12, 0);
  }
  return g;
}

function buildCharacter(unit: Unit): THREE.Group {
  const color = ROLE_COLORS[unit.role] ?? 0xaaaaaa;
  const isZombie = ['shambler', 'screamer', 'ripper'].includes(unit.role);
  return isZombie ? buildZombie(unit.role, color) : buildSurvivor(unit.role, color);
}

export class CombatScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly unitVisuals = new Map<string, UnitVisual>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private rollSprites: { mesh: THREE.Sprite; life: number }[] = [];
  private lastRollKey = '';
  private activeAnim: ActiveCombatAnim | null = null;
  private onAnimComplete: (() => void) | null = null;
  private particles: Particle[] = [];
  private cameraBase = new THREE.Vector3(0, 3.8, 10);
  private shakeIntensity = 0;
  private isAnimating = false;

  get animating(): boolean {
    return this.isAnimating;
  }

  playHit(attackerId: string, targetId: string, onComplete: () => void): void {
    this.activeAnim = createHitAnim(attackerId, targetId);
    this.onAnimComplete = onComplete;
    this.isAnimating = true;
    this.shakeIntensity = 0.12;
    const atk = this.unitVisuals.get(attackerId);
    const tgt = this.unitVisuals.get(targetId);
    if (atk && tgt) {
      const mid = atk.basePos.clone().lerp(tgt.basePos, 0.5);
      mid.y = 1;
      this.particles.push(...spawnHitParticles(this.scene, mid));
    }
  }

  playHeal(healerId: string, onComplete: () => void): void {
    this.activeAnim = createHealAnim(healerId);
    this.onAnimComplete = onComplete;
    this.isAnimating = true;
    const healer = this.unitVisuals.get(healerId);
    if (healer) {
      const pos = healer.basePos.clone();
      pos.y = 1;
      this.particles.push(...spawnHealParticles(this.scene, pos));
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x060806, 1);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 3.8, 10);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.035);

    const ambient = new THREE.AmbientLight(0x3a4a55, 0.5);
    const key = new THREE.DirectionalLight(0xffcc88, 1);
    key.position.set(4, 8, 6);
    const fill = new THREE.DirectionalLight(0x74acdf, 0.4);
    fill.position.set(-5, 4, 2);
    const lampL = new THREE.PointLight(0xffaa44, 0.6, 10);
    lampL.position.set(-6, 3, 2);
    const lampR = new THREE.PointLight(0xffaa44, 0.6, 10);
    lampR.position.set(6, 3, 2);
    this.scene.add(ambient, key, fill, lampL, lampR);

    const sidewalk = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7),
      new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.92 }),
    );
    sidewalk.rotation.x = -Math.PI / 2;
    this.scene.add(sidewalk);

    const curb = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.8 }),
    );
    curb.rotation.x = -Math.PI / 2;
    curb.position.set(0, 0.01, 3.2);
    this.scene.add(curb);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, 4.5);
    this.scene.add(road);

    for (const x of [-5.5, 5.5]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.05, 2.8, 6),
        mat(0x2a2a2a, 0.8),
      );
      pole.position.set(x, 1.4, 3);
      this.scene.add(pole);
      const lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 0.8 }),
      );
      lampHead.position.set(x, 2.85, 3);
      this.scene.add(lampHead);
    }

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 5),
      new THREE.MeshStandardMaterial({ color: 0x1a1c20 }),
    );
    back.position.set(0, 2.5, -3.5);
    this.scene.add(back);

    for (let i = 0; i < 4; i++) {
      const debris = new THREE.Mesh(
        new THREE.BoxGeometry(0.4 + Math.random() * 0.3, 0.12, 0.3),
        mat(0x4a4a48, 1),
      );
      debris.position.set(-4 + i * 2.5, 0.06, -1 + (i % 2) * 0.4);
      debris.rotation.y = Math.random();
      this.scene.add(debris);
    }
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  syncCombat(combat: CombatState, lang: Lang): void {
    const allUnits = [...combat.playerUnits, ...combat.enemyUnits].filter((u) => u.alive);
    const aliveIds = new Set(allUnits.map((u) => u.id));

    for (const [id, vis] of this.unitVisuals) {
      if (!aliveIds.has(id)) {
        this.scene.remove(vis.group);
        vis.nameplate.material.map?.dispose();
        vis.nameplate.material.dispose();
        this.unitVisuals.delete(id);
      }
    }

    const layout = (units: Unit[], side: 'player' | 'enemy') => {
      const alive = units.filter((u) => u.alive);
      const xBase = side === 'player' ? -3.2 : 3.2;
      const xDir = side === 'player' ? 1 : -1;

      alive.forEach((unit, i) => {
        const z = unit.rank === 'back' ? -0.7 : 0.55;
        const xOff = unit.rank === 'back' ? 0.9 * xDir : 0;
        const pos = new THREE.Vector3(xBase + i * 1.35 * xDir + xOff, 0, z);

        let vis = this.unitVisuals.get(unit.id);
        if (!vis) {
          vis = this.createUnitVisual(unit, lang);
          this.unitVisuals.set(unit.id, vis);
          this.scene.add(vis.group);
        }

        vis.basePos.copy(pos);
        if (!this.isAnimating) {
          vis.group.position.copy(pos);
          vis.characterGroup.position.set(0, 0, 0);
          vis.characterGroup.scale.set(1, 1, 1);
        }
        this.updateHpBar(vis, unit);
        this.updateNameplate(vis, unit, lang);
      });
    };

    layout(combat.playerUnits, 'player');
    layout(combat.enemyUnits, 'enemy');

    if (combat.lastRoll) {
      const key = `${combat.lastRoll.attackerId}:${combat.lastRoll.targetId}:${combat.lastRoll.roll.rolls.join(',')}`;
      if (key !== this.lastRollKey) {
        this.lastRollKey = key;
        const rollStr = combat.lastRoll.roll.rolls.join('+') + (combat.lastRoll.roll.bonus > 0 ? `+${combat.lastRoll.roll.bonus}` : '');
        this.showRollPopup(combat.lastRoll.attackerId, rollStr, combat.lastRoll.damage);
      }
    }
  }

  private createUnitVisual(unit: Unit, lang: Lang): UnitVisual {
    const group = new THREE.Group();
    const basePos = new THREE.Vector3();

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    const characterGroup = new THREE.Group();
    const character = buildCharacter(unit);
    character.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.unitId = unit.id;
    });
    characterGroup.add(character);
    group.add(characterGroup);

    const pickTargets: THREE.Object3D[] = [];
    character.traverse((child) => {
      if (child instanceof THREE.Mesh) pickTargets.push(child);
    });

    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false }),
    );
    hpBg.position.set(0, 1.72, 0);
    hpBg.renderOrder = 5;

    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xc8e64a, depthTest: false }),
    );
    hpFill.position.set(0, 1.72, 0.001);
    hpFill.renderOrder = 6;

    const tex = makeNameplateTexture(t(unit.nameKey, lang), unit.hp, unit.maxHp, diceLabelForRole(unit.role));
    const nameplate = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    nameplate.scale.set(1.35, 0.54, 1);
    nameplate.position.set(0, 2.05, 0);
    nameplate.renderOrder = 12;

    group.add(hpBg, hpFill, nameplate);

    return { group, characterGroup, pickTargets, hpFill, hpBg, nameplate, shadow, unitId: unit.id, basePos };
  }

  private updateNameplate(vis: UnitVisual, unit: Unit, lang: Lang): void {
    const old = vis.nameplate.material as THREE.SpriteMaterial;
    old.map?.dispose();
    old.dispose();
    const tex = makeNameplateTexture(
      t(unit.nameKey, lang),
      unit.hp,
      unit.maxHp,
      diceLabelForRole(unit.role),
    );
    vis.nameplate.material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  }

  private updateHpBar(vis: UnitVisual, unit: Unit): void {
    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    const fullW = 0.8;
    vis.hpFill.scale.x = ratio;
    vis.hpFill.position.x = (-fullW / 2) * (1 - ratio);

    const mat = vis.hpFill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.5) mat.color.setHex(0xc8e64a);
    else if (ratio > 0.25) mat.color.setHex(0xd4a017);
    else mat.color.setHex(0xd64545);
  }

  private showRollPopup(attackerId: string, rollStr: string, damage: number): void {
    const vis = this.unitVisuals.get(attackerId);
    if (!vis) return;

    const tex = makeRollTexture(rollStr, damage);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(1.2, 0.6, 1);
    const worldPos = new THREE.Vector3();
    vis.group.getWorldPosition(worldPos);
    sprite.position.set(worldPos.x, worldPos.y + 2.6, worldPos.z);
    sprite.renderOrder = 20;
    this.scene.add(sprite);
    this.rollSprites.push({ mesh: sprite, life: 1.5 });
  }

  showDamageFlash(unitId: string): void {
    const vis = this.unitVisuals.get(unitId);
    if (!vis) return;
    vis.characterGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = child.material as THREE.MeshStandardMaterial;
        if (m.emissive) {
          m.emissive.setHex(0xff3333);
          m.emissiveIntensity = 0.8;
        }
      }
    });
  }

  private applyHitFlash(unitId: string, intensity: number): void {
    const vis = this.unitVisuals.get(unitId);
    if (!vis) return;
    vis.characterGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = child.material as THREE.MeshStandardMaterial;
        if (m.emissive) m.emissiveIntensity = intensity > 0 ? 0.5 + intensity : 0.06;
      }
    });
  }

  pickUnit(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const vis of this.unitVisuals.values()) meshes.push(...vis.pickTargets);
    const hits = this.raycaster.intersectObjects(meshes);
    if (!hits.length) return null;
    return (hits[0].object.userData.unitId as string) ?? null;
  }

  update(dt: number): void {
    this.particles = updateParticles(this.particles, dt);

    if (this.shakeIntensity > 0) {
      this.shakeIntensity -= dt * 0.5;
      this.camera.position.x = this.cameraBase.x + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y = this.cameraBase.y + (Math.random() - 0.5) * this.shakeIntensity * 0.5;
    } else {
      this.camera.position.copy(this.cameraBase);
    }

    if (this.activeAnim) {
      this.activeAnim.elapsed += dt;
      const t = Math.min(1, this.activeAnim.elapsed / this.activeAnim.duration);
      const atk = this.unitVisuals.get(this.activeAnim.attackerId);
      const tgt = this.unitVisuals.get(this.activeAnim.targetId);

      if (this.activeAnim.type === 'hit' && atk && tgt) {
        const dir = tgt.basePos.clone().sub(atk.basePos);
        const dist = dir.length();
        if (dist > 0.01) dir.normalize();
        const lunge = easeInOutQuad(t < 0.5 ? t * 2 : (1 - t) * 2);
        atk.characterGroup.position.set(dir.x * lunge * 0.55, 0, dir.z * lunge * 0.55);
        if (t > 0.4 && t < 0.55) {
          const knock = easeOutQuad((t - 0.4) / 0.15);
          tgt.characterGroup.position.set(-dir.x * knock * 0.2, 0, -dir.z * knock * 0.2);
          tgt.characterGroup.scale.set(1 - knock * 0.08, 1 + knock * 0.06, 1 - knock * 0.08);
          this.applyHitFlash(tgt.unitId, knock);
        } else if (t >= 0.55) {
          tgt.characterGroup.position.set(0, 0, 0);
          tgt.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(tgt.unitId, 0);
        }
      } else if (this.activeAnim.type === 'heal' && atk) {
        const pulse = Math.sin(t * Math.PI);
        atk.characterGroup.position.y = pulse * 0.15;
        atk.characterGroup.scale.setScalar(1 + pulse * 0.05);
        this.applyHitFlash(atk.unitId, 0);
        atk.characterGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const m = child.material as THREE.MeshStandardMaterial;
            if (m.emissive) {
              m.emissive.setHex(0x44cc88);
              m.emissiveIntensity = 0.1 + pulse * 0.3;
            }
          }
        });
      }

      if (this.activeAnim.elapsed >= this.activeAnim.duration) {
        if (atk) {
          atk.characterGroup.position.set(0, 0, 0);
          atk.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(atk.unitId, 0);
        }
        if (tgt) {
          tgt.characterGroup.position.set(0, 0, 0);
          tgt.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(tgt.unitId, 0);
        }
        this.activeAnim = null;
        this.isAnimating = false;
        const cb = this.onAnimComplete;
        this.onAnimComplete = null;
        cb?.();
      }
    }

    for (let i = this.rollSprites.length - 1; i >= 0; i--) {
      const f = this.rollSprites[i];
      f.life -= dt;
      f.mesh.position.y += dt * 0.5;
      (f.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, f.life);
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        f.mesh.material.map?.dispose();
        this.rollSprites.splice(i, 1);
      }
    }

    for (const vis of this.unitVisuals.values()) {
      vis.hpBg.lookAt(this.camera.position);
      vis.hpFill.lookAt(this.camera.position);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
