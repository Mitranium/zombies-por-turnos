import * as THREE from 'three';
import type { DiceRollResult } from '../game/types';
import { canvasTexture } from '../util/canvas';
import { easeOutBack, easeOutQuad } from './animations';

interface FaceInfo {
  centroid: THREE.Vector3;
  normal: THREE.Vector3;
}

interface DieShape {
  geometry: THREE.BufferGeometry;
  faces: FaceInfo[];
  numbers: number[];
  decalSize: number;
}

function buildFromFaceLoops(faceLoops: THREE.Vector3[][]): { geometry: THREE.BufferGeometry; faces: FaceInfo[] } {
  const positions: number[] = [];
  const faces: FaceInfo[] = [];

  for (const loop of faceLoops) {
    const centroid = loop
      .reduce((acc, v) => acc.add(v), new THREE.Vector3())
      .multiplyScalar(1 / loop.length);

    let ordered = loop;
    let normal = new THREE.Vector3()
      .subVectors(loop[1], loop[0])
      .cross(new THREE.Vector3().subVectors(loop[2], loop[0]));
    if (normal.dot(centroid) < 0) {
      ordered = [...loop].reverse();
      normal = new THREE.Vector3()
        .subVectors(ordered[1], ordered[0])
        .cross(new THREE.Vector3().subVectors(ordered[2], ordered[0]));
    }
    normal.normalize();

    for (let i = 1; i < ordered.length - 1; i++) {
      const p0 = ordered[0];
      const p1 = ordered[i];
      const p2 = ordered[i + 1];
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }
    faces.push({ centroid, normal });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry, faces };
}

function cubeShape(): DieShape {
  const h = 0.3;
  const c = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);
  const faceLoops = [
    [c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), c(1, -1, 1)],
    [c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1), c(-1, -1, -1)],
    [c(-1, 1, -1), c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1)],
    [c(-1, -1, 1), c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1)],
    [c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1), c(-1, -1, 1)],
    [c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1), c(1, -1, -1)],
  ];
  const { geometry, faces } = buildFromFaceLoops(faceLoops);
  return { geometry, faces, numbers: [1, 6, 2, 5, 3, 4], decalSize: 0.32 };
}

function tetraShape(): DieShape {
  const k = 0.36;
  const v0 = new THREE.Vector3(1, 1, 1).multiplyScalar(k);
  const v1 = new THREE.Vector3(1, -1, -1).multiplyScalar(k);
  const v2 = new THREE.Vector3(-1, 1, -1).multiplyScalar(k);
  const v3 = new THREE.Vector3(-1, -1, 1).multiplyScalar(k);
  const faceLoops = [
    [v1, v2, v3],
    [v0, v3, v2],
    [v0, v1, v3],
    [v0, v2, v1],
  ];
  const { geometry, faces } = buildFromFaceLoops(faceLoops);
  return { geometry, faces, numbers: [1, 2, 3, 4], decalSize: 0.22 };
}

function octaShape(): DieShape {
  const r = 0.42;
  const faceLoops: THREE.Vector3[][] = [];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        faceLoops.push([
          new THREE.Vector3(sx * r, 0, 0),
          new THREE.Vector3(0, sy * r, 0),
          new THREE.Vector3(0, 0, sz * r),
        ]);
      }
    }
  }
  const { geometry, faces } = buildFromFaceLoops(faceLoops);
  return { geometry, faces, numbers: [1, 2, 3, 4, 5, 6, 7, 8], decalSize: 0.22 };
}

function bipyramidShape(): DieShape {
  const H = 0.45;
  const R = 0.33;
  const top = new THREE.Vector3(0, H, 0);
  const bottom = new THREE.Vector3(0, -H, 0);
  const equator: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    equator.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
  }
  const faceLoops: THREE.Vector3[][] = [];
  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    faceLoops.push([top, equator[i], equator[j]]);
  }
  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    faceLoops.push([bottom, equator[j], equator[i]]);
  }
  const { geometry, faces } = buildFromFaceLoops(faceLoops);
  return { geometry, faces, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], decalSize: 0.19 };
}

function shapeForSides(sides: number): DieShape {
  if (sides <= 4) return tetraShape();
  if (sides <= 6) return cubeShape();
  if (sides <= 8) return octaShape();
  return bipyramidShape();
}

function makeNumberTexture(n: number): THREE.CanvasTexture {
  const size = 96;
  return canvasTexture(size, size, (ctx) => {
    ctx.font = `900 ${Math.round(size * 0.56)}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c1710';
    ctx.fillText(String(n), size / 2, size / 2 + 2);
  });
}

const GRAVITY = -13;
const REST_RADIUS = 0.36;

export class PhysicsDie {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  readonly angVel = new THREE.Vector3();
  readonly quat = new THREE.Quaternion();
  private readonly targetQuat = new THREE.Quaternion();
  private readonly targetPos = new THREE.Vector3();
  private readonly settleStartQuat = new THREE.Quaternion();
  private readonly settleStartPos = new THREE.Vector3();
  private readonly tossDuration: number;
  private readonly settleDuration = 0.34;
  private phase: 'toss' | 'settle' | 'done' = 'toss';
  private elapsed = 0;
  private settleElapsed = 0;
  private readonly disposables: { dispose: () => void }[] = [];

  constructor(sides: number, colorHex: number, value: number, tossDuration: number) {
    this.tossDuration = tossDuration;
    const shape = shapeForSides(sides);
    this.disposables.push(shape.geometry);

    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x100d0a, side: THREE.BackSide });
    this.disposables.push(outlineMat);
    const outline = new THREE.Mesh(shape.geometry, outlineMat);
    outline.scale.setScalar(1.09);
    this.group.add(outline);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.45,
      metalness: 0.12,
      flatShading: true,
      emissive: colorHex,
      emissiveIntensity: 0.14,
    });
    this.disposables.push(bodyMat);
    const body = new THREE.Mesh(shape.geometry, bodyMat);
    this.group.add(body);

    const decalMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    for (let i = 0; i < shape.faces.length; i++) {
      const face = shape.faces[i];
      const tex = makeNumberTexture(shape.numbers[i]);
      this.disposables.push(tex);
      const mat = decalMat.clone();
      mat.map = tex;
      this.disposables.push(mat);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(shape.decalSize, shape.decalSize), mat);
      this.disposables.push(plane.geometry);
      plane.position.copy(face.centroid).addScaledVector(face.normal, 0.012);
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
      this.group.add(plane);
      if (shape.numbers[i] === value) {
        this.targetQuat.setFromUnitVectors(face.normal.clone().normalize(), new THREE.Vector3(0, 0, 1));
      }
    }
  }

  init(startPos: THREE.Vector3, startVel: THREE.Vector3, startAngVel: THREE.Vector3, targetPos: THREE.Vector3): void {
    this.pos.copy(startPos);
    this.vel.copy(startVel);
    this.angVel.copy(startAngVel);
    this.quat.setFromEuler(new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2));
    this.targetPos.copy(targetPos);
    this.phase = 'toss';
    this.elapsed = 0;
    this.settleElapsed = 0;
    this.group.position.copy(this.pos);
    this.group.quaternion.copy(this.quat);
  }

  step(dt: number, floorY: number, bounds: { x: number; zNear: number; zFar: number }): void {
    if (this.phase === 'toss') {
      this.elapsed += dt;
      const substeps = 4;
      const sdt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        this.vel.y += GRAVITY * sdt;
        this.pos.addScaledVector(this.vel, sdt);

        const angle = this.angVel.length() * sdt;
        if (angle > 1e-6) {
          const axis = this.angVel.clone().normalize();
          const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
          this.quat.premultiply(dq);
        }

        if (this.pos.y - REST_RADIUS < floorY && this.vel.y < 0) {
          this.pos.y = floorY + REST_RADIUS;
          this.vel.y = -this.vel.y * 0.4;
          this.vel.x *= 0.72;
          this.vel.z *= 0.72;
          this.angVel.multiplyScalar(0.55);
        }
        if (this.pos.x > bounds.x) {
          this.pos.x = bounds.x;
          this.vel.x *= -0.4;
        } else if (this.pos.x < -bounds.x) {
          this.pos.x = -bounds.x;
          this.vel.x *= -0.4;
        }
        if (this.pos.z > bounds.zFar) {
          this.pos.z = bounds.zFar;
          this.vel.z *= -0.4;
        } else if (this.pos.z < bounds.zNear) {
          this.pos.z = bounds.zNear;
          this.vel.z *= -0.4;
        }
        this.vel.multiplyScalar(0.999);
        this.angVel.multiplyScalar(0.995);
      }
      this.quat.normalize();

      if (this.elapsed >= this.tossDuration) {
        this.phase = 'settle';
        this.settleElapsed = 0;
        this.settleStartQuat.copy(this.quat);
        this.settleStartPos.copy(this.pos);
      }
    } else if (this.phase === 'settle') {
      this.settleElapsed += dt;
      const t = Math.min(1, this.settleElapsed / this.settleDuration);
      this.quat.slerpQuaternions(this.settleStartQuat, this.targetQuat, easeOutQuad(t));
      // Position is a linear space, so a slight easeOutBack overshoot here is
      // safe and reads as a satisfying little settle-bounce onto the target spot.
      this.pos.lerpVectors(this.settleStartPos, this.targetPos, easeOutBack(t));
      if (t >= 1) {
        this.phase = 'done';
        this.quat.copy(this.targetQuat);
        this.pos.copy(this.targetPos);
      }
    }

    this.group.position.copy(this.pos);
    this.group.quaternion.copy(this.quat);
  }

  get isDone(): boolean {
    return this.phase === 'done';
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

export class DiceRig {
  readonly group = new THREE.Group();
  private dice: PhysicsDie[] = [];

  roll(roll: DiceRollResult, colorHex: number): void {
    this.clear();
    const n = roll.rolls.length;
    const tossDuration = 0.8 + n * 0.1;
    for (let i = 0; i < n; i++) {
      const die = new PhysicsDie(roll.sides, colorHex, roll.rolls[i], tossDuration);
      const slotX = (i - (n - 1) / 2) * 0.62;
      const startPos = new THREE.Vector3(slotX + (Math.random() - 0.5) * 0.2, 1.5 + Math.random() * 0.3, -0.25 + (Math.random() - 0.5) * 0.2);
      const startVel = new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.0 + Math.random() * 0.6, -0.65 - Math.random() * 0.45);
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const startAngVel = axis.multiplyScalar(15 + Math.random() * 9);
      const targetPos = new THREE.Vector3(slotX, -0.05, 0.1);
      die.init(startPos, startVel, startAngVel, targetPos);
      this.group.add(die.group);
      this.dice.push(die);
    }
  }

  update(dt: number): void {
    const floorY = -0.7;
    for (const die of this.dice) die.step(dt, floorY, { x: 1.5, zNear: -1.1, zFar: 0.9 });
  }

  isRolling(): boolean {
    return this.dice.length > 0 && this.dice.some((d) => !d.isDone);
  }

  clear(): void {
    for (const die of this.dice) {
      this.group.remove(die.group);
      die.dispose();
    }
    this.dice = [];
  }

  dispose(): void {
    this.clear();
  }
}
