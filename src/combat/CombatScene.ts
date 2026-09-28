import * as THREE from 'three';
import type { CombatState, DeploymentState, Lang, Unit, UnitRole } from '../game/types';
import {
  type ActiveCombatAnim,
  type DeathAnim,
  type Popup,
  createDeathAnim,
  createHealAnim,
  createHitAnim,
  easeInOutQuad,
  easeOutQuad,
  type Particle,
  spawnComicBurst,
  spawnHealParticles,
  spawnHitParticles,
  updateParticles,
  updatePopups,
} from './animations';
import { diceLabelForRole, rollEventKey } from './dice';
import { canvasTexture } from '../util/canvas';
import { hashStr, mulberry32, pickFrom } from '../util/random';
import { t } from '../i18n/strings';
import { ROLE_THEME } from '../ui/combatActions';
import { buildCombatScenery, type CombatScenery } from './scenery';
import { DiceRig } from './diceRig';
import {
  GRID_SIZE,
  HEX_RADIUS,
  gridToWorld,
  defaultGridForRole,
  isValidGridCell,
  type GridSide,
} from './hexGrid';

const ZOMBIE_SKIN = 0x6a8a5a;
const OUTLINE_COLOR = 0x100d0a;
const HEAL_GLOW_HEX = 0x44cc88;

/** Honor the OS-level motion preference: skip camera shake/punch effects. */
const REDUCED_MOTION = typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NAMEPLATE_SCALE_X = 1.22;
const NAMEPLATE_SCALE_Y = 0.42;
const NAMEPLATE_Y = 1.98;
const HP_BAR_Y = 1.64;
const HP_BAR_W = 0.68;
const HP_BAR_H = 0.075;
const HP_FILL_H = 0.058;

interface UnitVisual {
  group: THREE.Group;
  characterGroup: THREE.Group;
  pickTargets: THREE.Object3D[];
  hpFill: THREE.Mesh;
  hpBg: THREE.Mesh;
  nameplate: THREE.Sprite;
  nameplateKey: string;
  shadow: THREE.Mesh;
  targetRing: THREE.Mesh;
  unitId: string;
  basePos: THREE.Vector3;
  dying: boolean;
  deathAnim: DeathAnim | null;
}

/** Free every geometry, material and texture owned by an object subtree. */
function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line) && !(child instanceof THREE.Sprite)) return;
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) geometries.add(child.geometry);
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of list) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    material.dispose();
  }
}

interface EmissiveBase {
  hex: number;
  intensity: number;
}

/** userData stamped on hex tiles so ray hits can be mapped back to a cell. */
interface HexTileData {
  hexCol: number;
  hexRow: number;
  hexSide: GridSide;
}

/** userData stamped on pickable unit meshes. */
interface UnitPickData {
  unitId?: string;
  isOutline?: boolean;
}

/** Materials are per-character; remember their authored glow so flashes/heals can restore it. */
function emissiveBase(material: THREE.MeshStandardMaterial): EmissiveBase {
  const data = material.userData as { emissiveBase?: EmissiveBase };
  if (!data.emissiveBase) {
    data.emissiveBase = { hex: material.emissive.getHex(), intensity: material.emissiveIntensity };
  }
  return data.emissiveBase;
}

function makeNameplateTexture(name: string, hp: number, maxHp: number, die: string, roleCss: string): THREE.CanvasTexture {
  return canvasTexture(280, 94, (ctx) => {
    const w = 280;
    const h = 94;

    ctx.fillStyle = 'rgba(5,5,8,0.96)';
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 7);
    ctx.fill();
    ctx.strokeStyle = roleCss;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f0f0e8';
    ctx.font = '900 24px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, w / 2, 31, w - 22);

    ctx.fillStyle = '#a8b0a0';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText(`${hp} / ${maxHp}`, w / 2, 56);

    ctx.fillStyle = '#e8c95a';
    ctx.font = 'bold 14px Consolas, monospace';
    ctx.fillText(`⚀ ${die}`, w / 2, 80);
  });
}

function nameplateSignature(unit: Unit, lang: Lang): string {
  return `${t(unit.nameKey, lang)}|${unit.hp}/${unit.maxHp}|${diceLabelForRole(unit.role)}|${ROLE_THEME[unit.role].css}`;
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

function addMesh(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

const SKIN_TONES = [0xc9a882, 0xdcb894, 0xa8794f, 0x8a5a3a, 0xecd0ab];
const HAIR_TONES = [0x1c140f, 0x3a2418, 0x0f0f0f, 0x5a3a20, 0x7a7a7a];

/** Small tiling canvas texture that adds worn/mottled character to a flat color via default box UVs. */
function makeGrimeTexture(seed: number, baseHex: number, blotchAlpha = 0.22): THREE.CanvasTexture {
  const size = 64;
  return canvasTexture(size, size, (ctx) => {
    const rnd = mulberry32(seed);
    ctx.fillStyle = hexToCss(baseHex);
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = `rgba(0,0,0,${blotchAlpha})`;
    for (let i = 0; i < 16; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 2 + rnd() * 7;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + rnd() * 0.7), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 8; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 1 + rnd() * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function matTex(color: number, tex: THREE.Texture, rough = 0.6, metal = 0.06): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map: tex,
    roughness: rough,
    metalness: metal,
    emissive: color,
    emissiveIntensity: 0.05,
  });
}

function addEyes(g: THREE.Group, cx: number, cy: number, cz: number, r: number, colorHex: number, glow: boolean): void {
  const eyeMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: glow ? 1.6 : 0.1,
    roughness: 0.35,
  });
  const eyeR = r * 0.15;
  addMesh(g, new THREE.SphereGeometry(eyeR, 6, 6), eyeMat, cx - r * 0.42, cy + r * 0.05, cz + r * 0.86);
  addMesh(g, new THREE.SphereGeometry(eyeR, 6, 6), eyeMat, cx + r * 0.42, cy + r * 0.05, cz + r * 0.86);
}

function addOutlines(character: THREE.Group): void {
  const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  const clones: THREE.Mesh[] = [];
  character.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const outline = new THREE.Mesh(child.geometry, outlineMat);
      outline.position.copy(child.position);
      outline.rotation.copy(child.rotation);
      outline.scale.copy(child.scale).multiplyScalar(1.1);
      outline.userData.isOutline = true;
      clones.push(outline);
    }
  });
  for (const c of clones) character.add(c);
}

function buildSurvivor(role: UnitRole, color: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const skinTone = pickFrom(rnd, SKIN_TONES);
  const skin = mat(skinTone, 0.85, 0);
  const hair = mat(pickFrom(rnd, HAIR_TONES), 0.75, 0);
  const pants = mat(0x2a2a2e, 0.8);
  const shoe = mat(0x171717, 0.55);
  const clothTex = makeGrimeTexture(seed * 7 + 3, color, 0.18);

  if (role === 'athlete') {
    const cloth = matTex(color, clothTex, 0.55, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.5, 0.55, 0.32), cloth, 0, 0.72, 0);
    addMesh(g, new THREE.BoxGeometry(0.62, 0.14, 0.36), cloth, 0, 0.98, 0);
    // sweatband + hair fringe + head + face
    addMesh(g, new THREE.SphereGeometry(0.2, 10, 8), skin, 0, 1.22, 0);
    addEyes(g, 0, 1.22, 0, 0.2, 0x1c140f, false);
    addMesh(g, new THREE.SphereGeometry(0.205, 10, 8), hair, 0, 1.27, -0.03, 1, 0.5, 1);
    addMesh(g, new THREE.CylinderGeometry(0.205, 0.205, 0.07, 12, 1, true), mat(0xffffff, 0.5), 0, 1.24, 0);
    // arms + wristbands + fists
    addMesh(g, new THREE.BoxGeometry(0.14, 0.42, 0.14), skin, -0.34, 0.82, 0);
    addMesh(g, new THREE.BoxGeometry(0.14, 0.42, 0.14), skin, 0.34, 0.82, 0);
    addMesh(g, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8), mat(0xffffff, 0.5), -0.34, 0.63, 0);
    addMesh(g, new THREE.SphereGeometry(0.09, 6, 6), skin, -0.34, 0.58, 0);
    addMesh(g, new THREE.SphereGeometry(0.09, 6, 6), skin, 0.34, 0.58, 0);
    // legs + sneakers
    addMesh(g, new THREE.BoxGeometry(0.16, 0.5, 0.16), pants, -0.14, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.5, 0.16), pants, 0.14, 0.28, 0);
    addMesh(g, new THREE.BoxGeometry(0.19, 0.1, 0.27), mat(0xf0ece0, 0.5), -0.14, 0.05, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.19, 0.1, 0.27), mat(0xf0ece0, 0.5), 0.14, 0.05, 0.04);
    // bat
    addMesh(g, new THREE.CylinderGeometry(0.035, 0.05, 0.58, 8), mat(0x8a6a3a, 0.55), 0.5, 0.82, 0);
    addMesh(g, new THREE.CylinderGeometry(0.055, 0.055, 0.05, 8), mat(0x5a3f22, 0.6), 0.5, 0.55, 0);
  } else if (role === 'medic') {
    const vest = matTex(color, clothTex, 0.5, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.4, 0.52, 0.3), mat(0xe4ece8, 0.55), 0, 0.7, 0);
    addMesh(g, new THREE.BoxGeometry(0.32, 0.36, 0.2), vest, 0, 0.72, 0.13);
    // medical cross on chest
    addMesh(g, new THREE.BoxGeometry(0.16, 0.05, 0.02), mat(0xc0392b, 0.4), 0, 0.74, 0.24);
    addMesh(g, new THREE.BoxGeometry(0.05, 0.16, 0.02), mat(0xc0392b, 0.4), 0, 0.74, 0.24);
    // head, glasses, tied-back hair
    addMesh(g, new THREE.SphereGeometry(0.175, 10, 8), skin, 0, 1.16, 0);
    addEyes(g, 0, 1.16, 0, 0.175, 0x1c140f, false);
    addMesh(g, new THREE.BoxGeometry(0.24, 0.03, 0.05), mat(0x141414, 0.4, 0.6), 0, 1.16, 0.16);
    addMesh(g, new THREE.SphereGeometry(0.09, 8, 6), hair, 0, 1.14, -0.16);
    // stethoscope loop
    addMesh(g, new THREE.TorusGeometry(0.14, 0.014, 6, 12, Math.PI), mat(0x2a2a2a, 0.4), 0, 0.98, 0.05, 1, 1, 1, Math.PI / 2, 0, 0);
    // legs + shoes
    addMesh(g, new THREE.BoxGeometry(0.13, 0.46, 0.13), pants, -0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.46, 0.13), pants, 0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.09, 0.22), shoe, -0.11, 0.045, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.09, 0.22), shoe, 0.11, 0.045, 0.04);
    // arms + medkit satchel
    addMesh(g, new THREE.BoxGeometry(0.11, 0.4, 0.11), mat(0xe4ece8, 0.55), -0.26, 0.8, 0);
    addMesh(g, new THREE.BoxGeometry(0.11, 0.4, 0.11), mat(0xe4ece8, 0.55), 0.26, 0.8, 0);
    addMesh(g, new THREE.SphereGeometry(0.07, 6, 6), skin, -0.26, 0.58, 0);
    addMesh(g, new THREE.SphereGeometry(0.07, 6, 6), skin, 0.26, 0.58, 0);
    addMesh(g, new THREE.BoxGeometry(0.24, 0.28, 0.14), mat(0xb8d8c8, 0.55), 0, 0.52, -0.17);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.04, 0.02), mat(0xc0392b, 0.4), 0, 0.55, -0.24);
    addMesh(g, new THREE.BoxGeometry(0.04, 0.12, 0.02), mat(0xc0392b, 0.4), 0, 0.55, -0.24);
  } else if (role === 'criminal') {
    const hoodie = matTex(color, clothTex, 0.6, 0.05);
    addMesh(g, new THREE.BoxGeometry(0.42, 0.52, 0.3), mat(0x1a1a1a, 0.65), 0, 0.7, 0);
    addMesh(g, new THREE.BoxGeometry(0.34, 0.3, 0.22), hoodie, 0, 0.86, 0.06);
    // hood draped at the back of the neck + cap
    addMesh(g, new THREE.SphereGeometry(0.16, 8, 6), hoodie, 0, 0.98, -0.14, 1.1, 0.7, 1);
    addMesh(g, new THREE.CylinderGeometry(0.2, 0.22, 0.11, 8), mat(0x141414, 0.5), 0, 1.28, 0);
    addMesh(g, new THREE.CylinderGeometry(0.23, 0.23, 0.03, 8), mat(0x141414, 0.5), 0, 1.22, 0.08);
    // head + bandana mask + eyes peeking
    addMesh(g, new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 1.12, 0.04);
    addEyes(g, 0, 1.14, 0.04, 0.16, 0x1c140f, false);
    addMesh(g, new THREE.BoxGeometry(0.18, 0.09, 0.15), mat(0x2a2a2a, 0.5), 0, 1.06, 0.1);
    // chain necklace
    addMesh(g, new THREE.TorusGeometry(0.1, 0.01, 6, 12), mat(0xd4b83a, 0.3, 0.7), 0, 0.98, 0.08, 1, 1, 1, Math.PI / 2, 0, 0);
    // baggy legs + sneakers
    addMesh(g, new THREE.BoxGeometry(0.16, 0.46, 0.16), mat(0x24242a, 0.75), -0.13, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.46, 0.16), mat(0x24242a, 0.75), 0.13, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.19, 0.1, 0.26), mat(0xdadada, 0.5), -0.13, 0.05, 0.04);
    addMesh(g, new THREE.BoxGeometry(0.19, 0.1, 0.26), mat(0xdadada, 0.5), 0.13, 0.05, 0.04);
    // arms + brass-knuckle fist + shiv
    addMesh(g, new THREE.BoxGeometry(0.13, 0.42, 0.13), hoodie, -0.13, 0.44, 0, 1, 1, 1, 0, 0, 0.18);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.42, 0.13), hoodie, 0.3, 0.7, 0, 1, 1, 1, 0, 0, -0.12);
    addMesh(g, new THREE.SphereGeometry(0.08, 6, 6), skin, 0.42, 0.85, 0.1);
    addMesh(g, new THREE.BoxGeometry(0.03, 0.16, 0.03), mat(0xcccccc, 0.3, 0.7), 0.42, 0.98, 0.1);
    addMesh(g, new THREE.ConeGeometry(0.04, 0.1, 4), mat(0xdddddd, 0.25, 0.75), 0.42, 1.08, 0.1);
  } else {
    const cloth = matTex(color, clothTex, 0.6, 0.05);
    addMesh(g, new THREE.BoxGeometry(0.42, 0.5, 0.3), cloth, 0, 0.7, 0);
    addMesh(g, new THREE.CylinderGeometry(0.2, 0.22, 0.1, 8), mat(0x2a2a2a, 0.5), 0, 1.24, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 10, 8), skin, 0, 1.14, 0);
    addEyes(g, 0, 1.14, 0, 0.17, 0x1c140f, false);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.4, 0.13), skin, -0.28, 0.82, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.4, 0.13), skin, 0.28, 0.82, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.44, 0.13), pants, -0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.44, 0.13), pants, 0.11, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.17, 0.09, 0.24), shoe, -0.11, 0.045, 0.03);
    addMesh(g, new THREE.BoxGeometry(0.17, 0.09, 0.24), shoe, 0.11, 0.045, 0.03);
  }
  addOutlines(g);
  return g;
}

function buildZombie(role: UnitRole, color: number, seed = 1): THREE.Group {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const fleshTone = ZOMBIE_SKIN + (Math.floor(rnd() * 3) - 1) * 0x040404;
  const flesh = mat(fleshTone, 0.92, 0);
  const gore = mat(0x6a1414, 0.5, 0);
  const eyeGlow = pickFrom(rnd, [0xd8e030, 0xd84a2a, 0xe0e0a0]);
  const clothTex = makeGrimeTexture(seed * 11 + 5, color, 0.32);
  const rot = matTex(color, clothTex, 0.85, 0.02);

  if (role === 'shambler') {
    g.rotation.z = 0.08;
    addMesh(g, new THREE.BoxGeometry(0.45, 0.5, 0.3), rot, 0, 0.65, 0, 1, 1.05, 1);
    // torn hem strips
    addMesh(g, new THREE.BoxGeometry(0.08, 0.14, 0.06), rot, -0.14, 0.36, 0.14, 1, 1, 1, 0.2, 0, 0.1);
    addMesh(g, new THREE.BoxGeometry(0.07, 0.12, 0.06), rot, 0.1, 0.35, -0.13, 1, 1, 1, -0.15, 0, -0.05);
    // exposed rib hint
    addMesh(g, new THREE.BoxGeometry(0.22, 0.05, 0.03), gore, 0.02, 0.7, 0.16);
    addMesh(g, new THREE.BoxGeometry(0.2, 0.04, 0.03), gore, 0.01, 0.62, 0.16);
    // lolling head
    addMesh(g, new THREE.SphereGeometry(0.2, 8, 7), flesh, 0.05, 1.1, 0.05, 1, 1, 1, 0.2, 0, 0.15);
    addEyes(g, 0.05, 1.1, 0.05, 0.2, eyeGlow, true);
    addMesh(g, new THREE.BoxGeometry(0.16, 0.05, 0.02), gore, 0.08, 1.0, 0.2, 1, 1, 1, 0.2, 0, 0);
    // dragging/bent legs, one bone-thin
    addMesh(g, new THREE.BoxGeometry(0.14, 0.48, 0.14), flesh, -0.2, 0.28, 0.1, 1, 1, 1, 0, 0, 0.05);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.4, 0.1), flesh, 0.18, 0.26, -0.08, 1, 1, 1, 0, 0, -0.08);
    // one raised, one snapped-looking arm
    addMesh(g, new THREE.BoxGeometry(0.22, 0.08, 0.08), flesh, 0.35, 0.78, 0.15, 1, 1, 1, 0, 0, 0.5);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.3, 0.1), flesh, -0.3, 0.6, -0.05, 1, 1, 1, 0, 0, -0.9);
    addMesh(g, new THREE.SphereGeometry(0.06, 6, 6), flesh, 0.44, 0.9, 0.15);
  } else if (role === 'screamer') {
    addMesh(g, new THREE.BoxGeometry(0.26, 0.6, 0.2), rot, 0, 0.76, 0, 1, 1.12, 1);
    // ragged gown fringe
    addMesh(g, new THREE.BoxGeometry(0.3, 0.1, 0.22), rot, 0, 0.5, 0, 1, 1, 1, 0.05, 0, 0);
    // stretched neck + head thrown back
    addMesh(g, new THREE.CylinderGeometry(0.06, 0.08, 0.16, 6), flesh, 0, 1.1, 0.02, 1, 1, 1, -0.3, 0, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 8, 7), flesh, 0, 1.28, -0.04, 1, 1.1, 1, -0.35, 0, 0);
    addEyes(g, 0, 1.3, -0.02, 0.17, eyeGlow, true);
    // gaping screaming mouth
    addMesh(g, new THREE.TorusGeometry(0.055, 0.028, 6, 10), gore, 0, 1.24, 0.14, 1, 1.3, 1, 1.55, 0, 0);
    // arms thrown up as it screams
    addMesh(g, new THREE.BoxGeometry(0.09, 0.46, 0.09), flesh, -0.28, 0.98, 0, 1, 1, 1, 0, 0, -0.58);
    addMesh(g, new THREE.BoxGeometry(0.09, 0.46, 0.09), flesh, 0.28, 1.0, -0.04, 1, 1, 1, 0, 0, 0.62);
    addMesh(g, new THREE.BoxGeometry(0.11, 0.42, 0.11), flesh, -0.09, 0.24, 0);
    addMesh(g, new THREE.BoxGeometry(0.11, 0.42, 0.11), flesh, 0.09, 0.24, 0);
  } else if (role === 'ripper') {
    addMesh(g, new THREE.BoxGeometry(0.34, 0.44, 0.24), rot, 0, 0.7, 0.02, 1, 1, 1, 0.25, 0, 0);
    addMesh(g, new THREE.BoxGeometry(0.4, 0.16, 0.28), rot, 0, 0.86, -0.06, 1, 1, 1, 0.25, 0, 0);
    // hunched sprinter head, forward-jutting
    addMesh(g, new THREE.SphereGeometry(0.165, 8, 7), flesh, 0, 1.02, 0.16, 1, 1, 1, 0.3, 0, 0);
    addEyes(g, 0, 1.02, 0.16, 0.165, eyeGlow, true);
    // elongated blade-claw arms
    addMesh(g, new THREE.BoxGeometry(0.1, 0.32, 0.1), flesh, -0.26, 0.72, 0.08, 1, 1, 1, 0, 0, 0.3);
    addMesh(g, new THREE.BoxGeometry(0.09, 0.3, 0.09), flesh, -0.4, 0.46, 0.2, 1, 1, 1, 0, 0, 0.15);
    addMesh(g, new THREE.ConeGeometry(0.045, 0.28, 4), mat(0xd8d8d8, 0.3, 0.6), -0.44, 0.28, 0.24, 1, 1, 1, 0, 0, 0.1);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.32, 0.1), flesh, 0.26, 0.7, -0.02, 1, 1, 1, 0, 0, -0.35);
    addMesh(g, new THREE.BoxGeometry(0.09, 0.3, 0.09), flesh, 0.4, 0.44, -0.14, 1, 1, 1, 0, 0, -0.2);
    addMesh(g, new THREE.ConeGeometry(0.045, 0.28, 4), mat(0xd8d8d8, 0.3, 0.6), 0.44, 0.26, -0.18, 1, 1, 1, 0, 0, -0.1);
    // sprinting crouched legs
    addMesh(g, new THREE.BoxGeometry(0.13, 0.4, 0.13), flesh, -0.1, 0.24, 0.08, 1, 1, 1, -0.2, 0, 0);
    addMesh(g, new THREE.BoxGeometry(0.13, 0.36, 0.13), flesh, 0.1, 0.24, -0.12, 1, 1, 1, 0.3, 0, 0);
  } else {
    addMesh(g, new THREE.BoxGeometry(0.4, 0.5, 0.28), rot, 0, 0.7, 0);
    addMesh(g, new THREE.SphereGeometry(0.17, 8, 7), flesh, 0, 1.12, 0);
    addEyes(g, 0, 1.12, 0, 0.17, eyeGlow, true);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.42, 0.12), flesh, -0.24, 0.78, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.42, 0.12), flesh, 0.24, 0.78, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.44, 0.12), flesh, -0.1, 0.26, 0);
    addMesh(g, new THREE.BoxGeometry(0.12, 0.44, 0.12), flesh, 0.1, 0.26, 0);
  }
  addOutlines(g);
  return g;
}

function buildCharacter(unit: Unit): THREE.Group {
  const color = ROLE_THEME[unit.role]?.hex ?? 0xaaaaaa;
  const isZombie = ['shambler', 'screamer', 'ripper'].includes(unit.role);
  const seed = hashStr(unit.id) || 1;
  return isZombie ? buildZombie(unit.role, color, seed) : buildSurvivor(unit.role, color, seed);
}

export class CombatScene {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly unitVisuals = new Map<string, UnitVisual>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private popups: Popup[] = [];
  private lastRollKey = '';
  private activeAnim: ActiveCombatAnim | null = null;
  private onAnimComplete: (() => void) | null = null;
  private animQueue: Array<{ anim: ActiveCombatAnim; onComplete: () => void }> = [];
  private idleWaiters: Array<() => void> = [];
  private particles: Particle[] = [];
  private cameraBase = new THREE.Vector3(0, 3.8, 10);
  private readonly baseFov = 40;
  private viewFov = 40;
  private shakeIntensity = 0;
  private punchIntensity = 0;
  private isAnimating = false;
  private targetableIds = new Set<string>();
  private keyboardFocusId: string | null = null;
  private pulseTime = 0;
  private readonly scenery: CombatScenery;
  private readonly diceRig = new DiceRig();
  private readonly hexGridGroup = new THREE.Group();
  private readonly hexTiles = new Map<string, THREE.Mesh>();
  private deploymentHighlight: THREE.Mesh | null = null;

  get animating(): boolean {
    return this.isAnimating || this.diceRig.isRolling();
  }

  /** Run `callback` once no combat animation or dice roll is in flight. */
  whenIdle(callback: () => void): void {
    if (!this.animating) {
      callback();
      return;
    }
    this.idleWaiters.push(callback);
  }

  playHit(attackerId: string, targetId: string, onComplete: () => void, crit = false): void {
    this.enqueueAnim(createHitAnim(attackerId, targetId, crit), onComplete);
  }

  playHeal(healerId: string, onComplete: () => void): void {
    this.enqueueAnim(createHealAnim(healerId), onComplete);
  }

  private enqueueAnim(anim: ActiveCombatAnim, onComplete: () => void): void {
    this.animQueue.push({ anim, onComplete });
    this.isAnimating = true;
    this.pumpAnims();
  }

  private pumpAnims(): void {
    if (this.activeAnim || !this.animQueue.length) return;
    const next = this.animQueue.shift();
    if (!next) return;
    this.activeAnim = next.anim;
    this.onAnimComplete = next.onComplete;
    this.isAnimating = true;

    const anim = next.anim;
    const atk = this.unitVisuals.get(anim.attackerId);
    const tgt = this.unitVisuals.get(anim.targetId);
    if (anim.type === 'hit') {
      this.shakeIntensity = REDUCED_MOTION ? 0 : (anim.crit ? 0.22 : 0.12);
      this.punchIntensity = REDUCED_MOTION ? 0 : (anim.crit ? 1.4 : 1);
      if (atk && tgt) {
        const mid = atk.basePos.clone().lerp(tgt.basePos, 0.5);
        mid.y = 1;
        this.particles.push(...spawnHitParticles(this.scene, mid));
        const burstPos = tgt.basePos.clone();
        burstPos.y = 1.5;
        this.popups.push(spawnComicBurst(this.scene, burstPos, this.lastLang, anim.crit));
      }
    } else if (atk) {
      const pos = atk.basePos.clone();
      pos.y = 1;
      this.particles.push(...spawnHealParticles(this.scene, pos));
    }
  }

  private flushIdleWaiters(): void {
    if (this.animating || !this.idleWaiters.length) return;
    const waiters = this.idleWaiters.splice(0);
    for (const waiter of waiters) {
      if (this.animating) {
        this.idleWaiters.push(waiter);
        continue;
      }
      waiter();
    }
  }

  private lastLang: Lang = 'en';

  setTargetable(ids: string[]): void {
    this.targetableIds = new Set(ids);
    this.applyTargetRings();
  }

  setKeyboardFocus(id: string | null): void {
    this.keyboardFocusId = id;
    this.applyTargetRings();
  }

  private applyTargetRings(): void {
    for (const [id, vis] of this.unitVisuals) {
      const ringMat = vis.targetRing.material as THREE.MeshBasicMaterial;
      if (this.keyboardFocusId === id) {
        ringMat.color.setHex(0x66d4ff);
        ringMat.opacity = 1;
      } else if (this.targetableIds.has(id)) {
        ringMat.color.setHex(0xffd24a);
        ringMat.opacity = 0.75;
      } else {
        ringMat.opacity = 0;
      }
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x1a1430, 1);

    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.1, 100);
    this.camera.position.set(0, 3.8, 10);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.fog = new THREE.FogExp2(0x241a30, 0.028);

    const ambient = new THREE.AmbientLight(0x4a4560, 0.55);
    const key = new THREE.DirectionalLight(0xffcc88, 0.95);
    key.position.set(4, 8, 6);
    const fill = new THREE.DirectionalLight(0x8a6ad0, 0.4);
    fill.position.set(-5, 4, 2);
    this.scene.add(ambient, key, fill);

    this.scenery = buildCombatScenery();
    this.scene.add(this.scenery.group);
    this.buildHexGrids();
    this.scene.add(this.hexGridGroup);

    // Dice rig rides along with the camera so it stays anchored to a fixed
    // spot on screen (a "table" in view) regardless of shake/punch effects.
    this.diceRig.group.position.set(0, -0.15, -4.1);
    this.camera.add(this.diceRig.group);
    this.scene.add(this.camera);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    const referenceAspect = 16 / 9;
    const horizontalHalfTan = Math.tan(THREE.MathUtils.degToRad(this.baseFov / 2)) * referenceAspect;
    this.viewFov = Math.max(
      this.baseFov,
      THREE.MathUtils.radToDeg(2 * Math.atan(horizontalHalfTan / this.camera.aspect)),
    );
    this.camera.fov = this.viewFov;
    this.camera.updateProjectionMatrix();
  }

  private buildHexGrids(): void {
    const shape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = HEX_RADIUS * Math.cos(angle);
      const y = HEX_RADIUS * Math.sin(angle);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);

    const borderPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      borderPoints.push(new THREE.Vector3(
        HEX_RADIUS * 1.02 * Math.cos(angle),
        HEX_RADIUS * 1.02 * Math.sin(angle),
        0,
      ));
    }
    borderPoints.push(borderPoints[0].clone());
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);

    for (const side of ['player', 'enemy'] as GridSide[]) {
      // One material pair per side: 18 tiles share them instead of each tile
      // allocating its own two materials.
      const tileMaterial = new THREE.MeshStandardMaterial({
        color: side === 'player' ? 0x3a5a78 : 0x5a3838,
        transparent: true,
        opacity: 0.72,
        roughness: 0.75,
        metalness: 0.08,
        emissive: side === 'player' ? 0x2a5070 : 0x502828,
        emissiveIntensity: 0.35,
        depthWrite: false,
      });
      const borderMaterial = new THREE.LineBasicMaterial({
        color: side === 'player' ? 0x88c8f0 : 0xf08888,
        transparent: true,
        opacity: 0.95,
      });

      for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
          const pos = gridToWorld(col, row, side);

          const tile = new THREE.Mesh(geo, tileMaterial);
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(pos.x, 0.012, pos.z);
          tile.userData = { hexCol: col, hexRow: row, hexSide: side };

          const border = new THREE.Line(borderGeo, borderMaterial);
          border.rotation.x = -Math.PI / 2;
          border.position.set(pos.x, 0.018, pos.z);

          this.hexTiles.set(`${side}:${col},${row}`, tile);
          this.hexGridGroup.add(tile, border);
        }
      }
    }

    const highlightShape = geo.clone();
    this.deploymentHighlight = new THREE.Mesh(
      highlightShape,
      new THREE.MeshBasicMaterial({
        color: 0x66d4ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    this.deploymentHighlight.rotation.x = -Math.PI / 2;
    this.deploymentHighlight.position.y = 0.025;
    this.deploymentHighlight.visible = false;
    this.hexGridGroup.add(this.deploymentHighlight);
  }

  private layoutUnitOnGrid(unit: Unit, side: GridSide, lang: Lang): void {
    const pos = gridToWorld(unit.gridCol, unit.gridRow, side);
    const worldPos = new THREE.Vector3(pos.x, pos.y, pos.z);

    let vis = this.unitVisuals.get(unit.id);
    if (!vis) {
      vis = this.createUnitVisual(unit, lang);
      this.unitVisuals.set(unit.id, vis);
      this.scene.add(vis.group);
    }

    vis.basePos.copy(worldPos);
    if (!this.isAnimating && !vis.dying) {
      vis.group.position.copy(worldPos);
      vis.characterGroup.position.set(0, 0, 0);
      vis.characterGroup.scale.set(1, 1, 1);
    }
    this.updateHpBar(vis, unit);
    this.updateNameplate(vis, unit, lang);
  }

  syncDeployment(deployment: DeploymentState, lang: Lang, selectedUnitId: string | null): void {
    this.lastLang = lang;
    this.hexGridGroup.visible = true;
    const keepIds = new Set(deployment.units.map((unit) => unit.id));

    for (const [id, vis] of this.unitVisuals) {
      if (!keepIds.has(id)) this.removeVisual(id, vis);
    }

    for (const unit of deployment.units) {
      this.layoutUnitOnGrid(unit, 'player', lang);
      const vis = this.unitVisuals.get(unit.id);
      if (vis) {
        const ringMat = vis.targetRing.material as THREE.MeshBasicMaterial;
        ringMat.color.setHex(selectedUnitId === unit.id ? 0x66d4ff : 0x88aacc);
        ringMat.opacity = selectedUnitId === unit.id ? 0.9 : 0.35;
      }
    }

    if (selectedUnitId) {
      const selected = deployment.units.find((unit) => unit.id === selectedUnitId);
      if (selected && this.deploymentHighlight) {
        const pos = gridToWorld(selected.gridCol, selected.gridRow, 'player');
        this.deploymentHighlight.position.set(pos.x, 0.02, pos.z);
        this.deploymentHighlight.visible = true;
      }
    } else if (this.deploymentHighlight) {
      this.deploymentHighlight.visible = false;
    }
  }

  clearBattlefield(): void {
    for (const [id, vis] of [...this.unitVisuals]) {
      this.removeVisual(id, vis);
    }
    if (this.deploymentHighlight) this.deploymentHighlight.visible = false;
  }

  syncTitlePreview(units: Unit[], lang: Lang): void {
    this.lastLang = lang;
    this.hexGridGroup.visible = true;
    if (this.deploymentHighlight) this.deploymentHighlight.visible = false;

    const keepIds = new Set(units.map((unit) => unit.id));
    for (const [id, vis] of this.unitVisuals) {
      if (!keepIds.has(id)) this.removeVisual(id, vis);
    }

    for (const unit of units) {
      let col = unit.gridCol;
      let row = unit.gridRow;
      if (!isValidGridCell(col, row)) {
        const fallback = defaultGridForRole(unit.role);
        col = fallback.col;
        row = fallback.row;
      }
      const positioned = { ...unit, gridCol: col, gridRow: row };
      this.layoutUnitOnGrid(positioned, 'player', lang);
      const vis = this.unitVisuals.get(unit.id);
      if (vis) {
        (vis.targetRing.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  pickHexCell(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    side: GridSide,
  ): { col: number; row: number } | null {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const [key, tile] of this.hexTiles) {
      if (key.startsWith(`${side}:`)) meshes.push(tile);
    }
    const hits = this.raycaster.intersectObjects(meshes);
    if (!hits.length) return null;
    const data = hits[0].object.userData as HexTileData;
    return { col: data.hexCol, row: data.hexRow };
  }

  syncCombat(combat: CombatState, lang: Lang): void {
    this.lastLang = lang;
    this.hexGridGroup.visible = true;
    const fullUnits = [...combat.playerUnits, ...combat.enemyUnits];
    const currentIds = new Set(fullUnits.map((u) => u.id));

    for (const [id, vis] of this.unitVisuals) {
      if (!currentIds.has(id)) {
        this.removeVisual(id, vis);
      }
    }

    for (const unit of fullUnits) {
      if (!unit.alive) {
        const vis = this.unitVisuals.get(unit.id);
        if (vis && !vis.dying) {
          const involvedInActiveAnim =
            this.activeAnim && (this.activeAnim.attackerId === unit.id || this.activeAnim.targetId === unit.id);
          if (!involvedInActiveAnim) {
            vis.dying = true;
            vis.deathAnim = createDeathAnim();
            (vis.targetRing.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        }
      }
    }

    const layout = (units: Unit[], side: 'player' | 'enemy') => {
      for (const unit of units.filter((u) => u.alive)) {
        this.layoutUnitOnGrid(unit, side, lang);
      }
    };

    layout(combat.playerUnits, 'player');
    layout(combat.enemyUnits, 'enemy');

    if (this.deploymentHighlight) this.deploymentHighlight.visible = false;

    const lastRoll = combat.lastRoll;
    if (lastRoll) {
      const key = rollEventKey(lastRoll);
      if (key !== this.lastRollKey) {
        this.lastRollKey = key;
        const attacker = fullUnits.find((u) => u.id === lastRoll.attackerId);
        const colorHex = attacker ? ROLE_THEME[attacker.role]?.hex ?? 0xd8d8d8 : 0xd8d8d8;
        this.diceRig.roll(lastRoll.roll, colorHex);
      }
    } else {
      // No roll in flight: clear the key so an identical future roll re-animates.
      this.lastRollKey = '';
    }
  }

  private removeVisual(id: string, vis: UnitVisual): void {
    this.scene.remove(vis.group);
    disposeObject3D(vis.group);
    this.unitVisuals.delete(id);
  }

  private createUnitVisual(unit: Unit, lang: Lang): UnitVisual {
    const group = new THREE.Group();
    const basePos = new THREE.Vector3();
    const theme = ROLE_THEME[unit.role];

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    group.add(shadow);

    const targetRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.02;
    group.add(targetRing);

    const characterGroup = new THREE.Group();
    const character = buildCharacter(unit);
    character.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isOutline) child.userData.unitId = unit.id;
    });
    characterGroup.add(character);
    group.add(characterGroup);

    const pickTargets: THREE.Object3D[] = [];
    character.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isOutline) pickTargets.push(child);
    });

    const hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false, transparent: true }),
    );
    hpBg.position.set(0, HP_BAR_Y, 0);
    hpBg.renderOrder = 5;

    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(HP_BAR_W - 0.02, HP_FILL_H),
      new THREE.MeshBasicMaterial({ color: 0xc8e64a, depthTest: false, transparent: true }),
    );
    hpFill.position.set(0, HP_BAR_Y, 0.001);
    hpFill.renderOrder = 6;

    const tex = makeNameplateTexture(t(unit.nameKey, lang), unit.hp, unit.maxHp, diceLabelForRole(unit.role), theme.css);
    const nameplate = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    nameplate.scale.set(NAMEPLATE_SCALE_X, NAMEPLATE_SCALE_Y, 1);
    nameplate.position.set(0, NAMEPLATE_Y, 0);
    nameplate.renderOrder = 12;

    group.add(hpBg, hpFill, nameplate);

    return {
      group,
      characterGroup,
      pickTargets,
      hpFill,
      hpBg,
      nameplate,
      nameplateKey: nameplateSignature(unit, lang),
      shadow,
      targetRing,
      unitId: unit.id,
      basePos,
      dying: false,
      deathAnim: null,
    };
  }

  private updateNameplate(vis: UnitVisual, unit: Unit, lang: Lang): void {
    const signature = nameplateSignature(unit, lang);
    if (signature === vis.nameplateKey) return;
    vis.nameplateKey = signature;

    const old = vis.nameplate.material as THREE.SpriteMaterial;
    old.map?.dispose();
    old.dispose();
    const theme = ROLE_THEME[unit.role];
    const tex = makeNameplateTexture(
      t(unit.nameKey, lang),
      unit.hp,
      unit.maxHp,
      diceLabelForRole(unit.role),
      theme.css,
    );
    vis.nameplate.material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  }

  private updateHpBar(vis: UnitVisual, unit: Unit): void {
    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    const fullW = HP_BAR_W - 0.02;
    vis.hpFill.scale.x = ratio;
    vis.hpFill.position.x = (-fullW / 2) * (1 - ratio);

    const mat = vis.hpFill.material as THREE.MeshBasicMaterial;
    if (ratio > 0.5) mat.color.setHex(0xc8e64a);
    else if (ratio > 0.25) mat.color.setHex(0xd4a017);
    else mat.color.setHex(0xd64545);
  }

  private applyHitFlash(unitId: string, intensity: number): void {
    const vis = this.unitVisuals.get(unitId);
    if (!vis) return;
    vis.characterGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isOutline) {
        const m = child.material as THREE.MeshStandardMaterial;
        if (!m.emissive) return;
        const base = emissiveBase(m);
        m.emissive.setHex(base.hex);
        m.emissiveIntensity = intensity > 0 ? 0.5 + intensity : base.intensity;
      }
    });
  }

  private applyHealGlow(unitId: string, pulse: number): void {
    const vis = this.unitVisuals.get(unitId);
    if (!vis) return;
    vis.characterGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isOutline) {
        const m = child.material as THREE.MeshStandardMaterial;
        if (!m.emissive) return;
        m.emissive.setHex(HEAL_GLOW_HEX);
        m.emissiveIntensity = 0.1 + pulse * 0.3;
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
    return (hits[0].object.userData as UnitPickData).unitId ?? null;
  }

  private updateDeathAnims(dt: number): void {
    for (const [id, vis] of [...this.unitVisuals]) {
      if (!vis.dying || !vis.deathAnim) continue;
      vis.deathAnim.elapsed += dt;
      const t = Math.min(1, vis.deathAnim.elapsed / vis.deathAnim.duration);
      const ease = easeOutQuad(t);
      vis.characterGroup.rotation.z = vis.deathAnim.fallDir * ease * (Math.PI / 2.1);
      vis.characterGroup.position.y = -ease * 0.15;
      vis.group.position.x = vis.basePos.x + vis.deathAnim.fallDir * ease * 0.18;
      const fadeStart = 0.55;
      if (t > fadeStart) {
        const fadeT = (t - fadeStart) / (1 - fadeStart);
        const alpha = Math.max(0, 1 - fadeT);
        vis.characterGroup.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const m = child.material as THREE.Material & { transparent?: boolean; opacity?: number };
            m.transparent = true;
            m.opacity = alpha;
          }
        });
        (vis.shadow.material as THREE.MeshBasicMaterial).opacity = 0.4 * alpha;
        (vis.hpBg.material as THREE.MeshBasicMaterial).opacity = alpha;
        (vis.hpFill.material as THREE.MeshBasicMaterial).opacity = alpha;
        (vis.nameplate.material as THREE.SpriteMaterial).opacity = alpha;
      }
      if (t >= 1) {
        this.removeVisual(id, vis);
      }
    }
  }

  update(dt: number): void {
    this.pulseTime += dt;
    this.particles = updateParticles(this.particles, dt);
    this.popups = updatePopups(this.popups, dt);
    this.scenery.update(dt);
    this.updateDeathAnims(dt);
    this.diceRig.update(dt);

    for (const vis of this.unitVisuals.values()) {
      const ringMat = vis.targetRing.material as THREE.MeshBasicMaterial;
      if (this.keyboardFocusId === vis.unitId) {
        ringMat.opacity = 0.75 + Math.sin(this.pulseTime * 8) * 0.25;
      } else if (this.targetableIds.has(vis.unitId)) {
        ringMat.opacity = 0.45 + Math.sin(this.pulseTime * 6) * 0.25;
      }
    }

    let fovOffset = 0;
    if (this.shakeIntensity > 0) {
      this.shakeIntensity -= dt * 2.4;
      this.camera.position.x = this.cameraBase.x + (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y = this.cameraBase.y + (Math.random() - 0.5) * this.shakeIntensity * 0.5;
    } else {
      this.camera.position.x = this.cameraBase.x;
      this.camera.position.y = this.cameraBase.y;
    }
    if (this.punchIntensity > 0) {
      this.punchIntensity -= dt * 3.2;
      fovOffset = -Math.max(0, this.punchIntensity) * 2.5;
    }
    const targetFov = this.viewFov + fovOffset;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.z = this.cameraBase.z;

    if (this.activeAnim) {
      this.activeAnim.elapsed += dt;
      const animT = Math.min(1, this.activeAnim.elapsed / this.activeAnim.duration);
      const atk = this.unitVisuals.get(this.activeAnim.attackerId);
      const tgt = this.unitVisuals.get(this.activeAnim.targetId);

      if (this.activeAnim.type === 'hit' && atk && tgt) {
        const dir = tgt.basePos.clone().sub(atk.basePos);
        const dist = dir.length();
        if (dist > 0.01) dir.normalize();
        const lunge = easeInOutQuad(animT < 0.5 ? animT * 2 : (1 - animT) * 2);
        atk.characterGroup.position.set(dir.x * lunge * 0.55, 0, dir.z * lunge * 0.55);
        if (animT > 0.4 && animT < 0.6) {
          const knock = easeOutQuad((animT - 0.4) / 0.2);
          tgt.characterGroup.position.set(-dir.x * knock * 0.22, 0, -dir.z * knock * 0.22);
          tgt.characterGroup.rotation.z = (Math.random() - 0.5) * 0.12 * knock;
          tgt.characterGroup.scale.set(1 - knock * 0.08, 1 + knock * 0.06, 1 - knock * 0.08);
          this.applyHitFlash(tgt.unitId, knock);
        } else if (animT >= 0.6) {
          tgt.characterGroup.position.set(0, 0, 0);
          tgt.characterGroup.rotation.z = 0;
          tgt.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(tgt.unitId, 0);
        }
      } else if (this.activeAnim.type === 'heal' && atk) {
        const pulse = Math.sin(animT * Math.PI);
        atk.characterGroup.position.y = pulse * 0.15;
        atk.characterGroup.scale.setScalar(1 + pulse * 0.05);
        this.applyHealGlow(atk.unitId, pulse);
      }

      if (this.activeAnim.elapsed >= this.activeAnim.duration) {
        if (atk) {
          atk.characterGroup.position.set(0, 0, 0);
          atk.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(atk.unitId, 0);
        }
        if (tgt) {
          tgt.characterGroup.position.set(0, 0, 0);
          tgt.characterGroup.rotation.z = 0;
          tgt.characterGroup.scale.set(1, 1, 1);
          this.applyHitFlash(tgt.unitId, 0);
        }
        // Hold the turn open until any thrown dice have actually landed, so the
        // physics roll never gets cut off by the next unit's turn starting.
        if (!this.diceRig.isRolling()) {
          this.activeAnim = null;
          this.isAnimating = false;
          const cb = this.onAnimComplete;
          this.onAnimComplete = null;
          cb?.();
          this.pumpAnims();
          this.isAnimating = this.activeAnim !== null || this.animQueue.length > 0;
          this.flushIdleWaiters();
        }
      }
    }

    for (const vis of this.unitVisuals.values()) {
      vis.hpBg.lookAt(this.camera.position);
      vis.hpFill.lookAt(this.camera.position);
    }

    this.flushIdleWaiters();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const [id, vis] of [...this.unitVisuals]) this.removeVisual(id, vis);

    for (const particle of this.particles) {
      particle.mesh.parent?.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      (particle.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];

    for (const popup of this.popups) {
      popup.mesh.parent?.remove(popup.mesh);
      const material = popup.mesh.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
    this.popups = [];

    this.scene.remove(this.hexGridGroup);
    disposeObject3D(this.hexGridGroup);
    this.hexTiles.clear();

    this.animQueue = [];
    this.activeAnim = null;
    this.onAnimComplete = null;
    this.idleWaiters = [];

    this.scenery.dispose();
    this.diceRig.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
