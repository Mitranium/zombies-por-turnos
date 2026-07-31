import * as THREE from 'three';
import type { DistrictNode, GameState, LandmarkPoi, SaavedraMapData } from '../game/types';
import { getPlayerSquad } from '../game/state';
import { MapCameraController } from './MapCameraController';

function getNodeNeighbors(state: GameState, nodeId: string): string[] {
  return state.district.find((n) => n.id === nodeId)?.neighbors ?? [];
}

const POI_COLOR: Record<string, number> = {
  mall: 0x8b5a3c,
  hospital: 0x4a7a8a,
  police: 0x3a5080,
};

const BA_COLORS = {
  concrete: 0x6a6e72,
  taxi: 0xf0c040,
  colectivo: 0x2a6a4a,
};

const LANDMARK_COLORS: Record<string, number> = {
  restaurant: 0xe08040,
  cafe: 0xc07030,
  bar: 0xa05020,
  school: 0x5080c0,
  park: 0x3a8a4a,
  playground: 0x4a9a5a,
  place_of_worship: 0x9080c0,
  bank: 0x6080a0,
  pharmacy: 0x40a0a0,
  supermarket: 0xd0a040,
  station: 0x606080,
  default: 0x888888,
};

function decorMat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}

function addLamp(parent: THREE.Object3D, x: number, z: number): void {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6), decorMat(0x2a2a2a));
  pole.position.set(x, 0.8, z);
  parent.add(pole);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa44, emissiveIntensity: 0.6 }),
  );
  head.position.set(x, 1.65, z);
  parent.add(head);
}

function addTree(parent: THREE.Object3D, x: number, z: number): void {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6), decorMat(0x4a3020));
  trunk.position.set(x, 0.25, z);
  parent.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), decorMat(0x2a5a2a));
  crown.position.set(x, 0.7, z);
  parent.add(crown);
}

function buildPoiDecor(poi: string, group: THREE.Group): void {
  if (poi === 'mall') {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.2), decorMat(0x9a7a5a));
    arch.position.set(0, 0.55, 0.9);
    group.add(arch);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      decorMat(0x6a8aaa),
    );
    dome.position.set(0, 1.1, 0.9);
    group.add(dome);
  } else if (poi === 'hospital') {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), decorMat(0xffffff));
    cross.position.set(0, 1.2, 0.8);
    group.add(cross);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.15), decorMat(0xffffff));
    crossH.position.set(0, 1.2, 0.8);
    group.add(crossH);
  } else if (poi === 'police') {
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), decorMat(0x74acdf));
    flag.position.set(0, 1.2, 0.9);
    group.add(flag);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), decorMat(0x888888));
    mast.position.set(-0.1, 0.65, 0.9);
    group.add(mast);
  }
}

function landmarkColor(category: string): number {
  const key = category.replace(/^shop:/, '');
  return LANDMARK_COLORS[key] ?? LANDMARK_COLORS.default;
}

export class MapScene {
  readonly scene = new THREE.Scene();
  readonly cameraController = new MapCameraController();
  readonly raycaster = new THREE.Raycaster();
  readonly pointer = new THREE.Vector2();
  private readonly pickMeshes = new Map<string, THREE.Mesh>();
  private readonly nodeRoots = new Map<string, THREE.Group>();
  private readonly tokenMeshes = new Map<string, THREE.Mesh>();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly pulseMeshes: THREE.Mesh[] = [];
  private pulseTime = 0;
  private mapRoot = new THREE.Group();
  private landmarks: LandmarkPoi[] = [];
  private landmarkPoints: THREE.Points | null = null;
  private landmarkPositions: Float32Array | null = null;
  private visibleLandmarkIndices: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b0e0c, 1);
    this.scene.add(this.mapRoot);
    this.scene.fog = new THREE.FogExp2(0x0b0e0c, 0.012);

    const ambient = new THREE.AmbientLight(0x3a4a38, 0.55);
    const moon = new THREE.DirectionalLight(0x9ab0c4, 0.35);
    moon.position.set(-6, 12, 4);
    this.scene.add(ambient, moon);
  }

  get camera(): THREE.OrthographicCamera {
    return this.cameraController.camera;
  }

  onCameraChange(cb: () => void): () => void {
    return this.cameraController.onChange(cb);
  }

  pan(dx: number, dy: number, canvas: HTMLCanvasElement): void {
    this.cameraController.pan(dx, dy, canvas);
  }

  zoomAt(delta: number, clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    this.cameraController.zoomAt(delta, clientX, clientY, canvas);
    this.updateLandmarkLod();
  }

  resetCamera(): void {
    this.cameraController.reset();
    this.updateLandmarkLod();
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width, height);
    this.updateLandmarkLod();
  }

  buildFromMapData(data: SaavedraMapData): void {
    this.landmarks = data.landmarks;
    this.cameraController.setBounds(data.meta.bounds);
    const span = Math.max(
      data.meta.bounds.maxX - data.meta.bounds.minX,
      data.meta.bounds.maxZ - data.meta.bounds.minZ,
    );
    this.cameraController.setDefaultFrustum(span * 0.55);

    while (this.mapRoot.children.length) {
      const child = this.mapRoot.children[0];
      this.mapRoot.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }

    if (data.boundary.length >= 3) {
      const shape = new THREE.Shape();
      shape.moveTo(data.boundary[0][0], data.boundary[0][1]);
      for (let i = 1; i < data.boundary.length; i++) {
        shape.lineTo(data.boundary[i][0], data.boundary[i][1]);
      }
      shape.closePath();
      const ground = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: BA_COLORS.concrete, roughness: 0.95, side: THREE.DoubleSide }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      this.mapRoot.add(ground);

      const edgePts: THREE.Vector3[] = data.boundary.map(([x, z]) => new THREE.Vector3(x, 0.05, z));
      edgePts.push(edgePts[0].clone());
      const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
      const edge = new THREE.Line(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x74acdf, transparent: true, opacity: 0.5 }),
      );
      this.mapRoot.add(edge);
    }

    const streetMat = new THREE.LineBasicMaterial({ color: 0x4a4a50, transparent: true, opacity: 0.45 });
    for (const line of data.streetLines) {
      if (line.length < 2) continue;
      const pts = line.map(([x, z]) => new THREE.Vector3(x, 0.04, z));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.mapRoot.add(new THREE.Line(geo, streetMat));
    }

    this.buildLandmarkPoints();
    this.buildDistrict(data.nodes);
  }

  buildDistrict(nodes: DistrictNode[]): void {
    for (const [, group] of this.nodeRoots) this.mapRoot.remove(group);
    this.nodeRoots.clear();
    this.pickMeshes.clear();
    this.pulseMeshes.length = 0;

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.95 });

    for (const node of nodes) {
      for (const neighborId of node.neighbors) {
        if (node.id > neighborId) continue;
        const neighbor = nodes.find((n) => n.id === neighborId);
        if (!neighbor) continue;
        const dx = neighbor.x - node.x;
        const dz = neighbor.z - node.z;
        const len = Math.hypot(dx, dz);
        const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.75), roadMat);
        road.position.set((node.x + neighbor.x) / 2, 0.03, (node.z + neighbor.z) / 2);
        road.rotation.y = Math.atan2(dx, dz);
        this.mapRoot.add(road);
      }
    }

    for (const node of nodes) {
      const group = new THREE.Group();
      group.position.set(node.x, 0, node.z);

      const isPoi = !!node.poi;
      const radius = isPoi ? 1.2 : 0.85;

      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.06, 24),
        new THREE.MeshStandardMaterial({
          color: isPoi ? (POI_COLOR[node.poi!] ?? 0x555555) : BA_COLORS.concrete,
          roughness: 0.9,
          metalness: 0.05,
        }),
      );
      pad.position.y = 0.03;
      pad.userData.nodeId = node.id;
      pad.userData.isPad = true;
      pad.userData.baseColor = (pad.material as THREE.MeshStandardMaterial).color.getHex();
      group.add(pad);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 0.3, radius + 0.3, 0.5, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.y = 0.25;
      hit.userData.nodeId = node.id;
      group.add(hit);
      this.pickMeshes.set(node.id, hit);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius + 0.06, radius + 0.14, 32),
        new THREE.MeshBasicMaterial({ color: 0xc8e6a0, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.07;
      ring.userData.isRing = true;
      group.add(ring);
      this.pulseMeshes.push(ring);

      if (isPoi) {
        const h = node.poi === 'mall' ? 1.5 : 1.1;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, h, 1.3),
          new THREE.MeshStandardMaterial({
            color: POI_COLOR[node.poi!],
            roughness: 0.85,
            emissive: POI_COLOR[node.poi!],
            emissiveIntensity: 0.08,
          }),
        );
        building.position.y = h / 2 + 0.06;
        group.add(building);
        buildPoiDecor(node.poi!, group);
      } else {
        addLamp(group, -0.7, 0.3);
        if (Math.random() > 0.6) addTree(group, 0.5, -0.4);
      }

      this.mapRoot.add(group);
      this.nodeRoots.set(node.id, group);
    }
  }

  private buildLandmarkPoints(): void {
    if (this.landmarkPoints) {
      this.mapRoot.remove(this.landmarkPoints);
      this.landmarkPoints.geometry.dispose();
      (this.landmarkPoints.material as THREE.Material).dispose();
    }

    const count = this.landmarks.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const lm = this.landmarks[i];
      positions[i * 3] = lm.x;
      positions[i * 3 + 1] = 0.12;
      positions[i * 3 + 2] = lm.z;
      const c = new THREE.Color(landmarkColor(lm.category));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    this.landmarkPositions = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.landmarkPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.22, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85 }),
    );
    this.mapRoot.add(this.landmarkPoints);
    this.updateLandmarkLod();
  }

  private updateLandmarkLod(): void {
    if (!this.landmarkPoints || !this.landmarkPositions) return;
    const frustum = this.cameraController.getFrustum();
    const clusterCell = frustum > 14 ? 3 : frustum > 9 ? 1.5 : 0;
    const visible: number[] = [];

    if (clusterCell === 0) {
      for (let i = 0; i < this.landmarks.length; i++) visible.push(i);
    } else {
      const cells = new Map<string, number>();
      for (let i = 0; i < this.landmarks.length; i++) {
        const lm = this.landmarks[i];
        const cx = Math.floor(lm.x / clusterCell);
        const cz = Math.floor(lm.z / clusterCell);
        const key = `${cx},${cz}`;
        if (!cells.has(key)) cells.set(key, i);
      }
      visible.push(...cells.values());
    }

    this.visibleLandmarkIndices = visible;
    const pos = new Float32Array(visible.length * 3);
    const col = new Float32Array(visible.length * 3);
    const attr = this.landmarkPoints.geometry.getAttribute('color') as THREE.BufferAttribute;

    for (let vi = 0; vi < visible.length; vi++) {
      const i = visible[vi];
      pos[vi * 3] = this.landmarkPositions[i * 3];
      pos[vi * 3 + 1] = this.landmarkPositions[i * 3 + 1];
      pos[vi * 3 + 2] = this.landmarkPositions[i * 3 + 2];
      col[vi * 3] = attr.array[i * 3];
      col[vi * 3 + 1] = attr.array[i * 3 + 1];
      col[vi * 3 + 2] = attr.array[i * 3 + 2];
    }

    this.landmarkPoints.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.landmarkPoints.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.landmarkPoints.geometry.attributes.position.needsUpdate = true;
    this.landmarkPoints.geometry.attributes.color.needsUpdate = true;

    const mat = this.landmarkPoints.material as THREE.PointsMaterial;
    mat.size = frustum > 14 ? 0.35 : frustum > 9 ? 0.28 : 0.2;
  }

  syncState(state: GameState): void {
    for (const [, mesh] of this.tokenMeshes) this.mapRoot.remove(mesh);
    this.tokenMeshes.clear();

    const player = getPlayerSquad(state);
    const reachable = new Set<string>();
    if (state.phase === 'move') {
      reachable.add(player.nodeId);
      getNodeNeighbors(state, player.nodeId).forEach((id) => reachable.add(id));
    }

    for (const [nodeId, group] of this.nodeRoots) {
      const pad = group.children.find((c) => c.userData.isPad) as THREE.Mesh | undefined;
      const ring = group.children.find((c) => c.userData.isRing) as THREE.Mesh | undefined;
      if (!pad || !ring) continue;

      const mat = pad.material as THREE.MeshStandardMaterial;
      const base = (pad.userData.baseColor as number) ?? 0x222824;
      mat.color.setHex(base);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;

      const node = state.district.find((n) => n.id === nodeId);
      const isReachable = reachable.has(nodeId);
      const isHovered = state.hoveredNodeId === nodeId;

      if (isReachable && state.phase === 'move') {
        mat.emissive.setHex(0x5a7040);
        mat.emissiveIntensity = isHovered ? 0.28 : 0.14;
        if (isHovered) mat.color.offsetHSL(0, 0, 0.1);

        const ringMat = ring.material as THREE.MeshBasicMaterial;
        ringMat.opacity = isHovered ? 0.7 : 0.3;
        ringMat.color.setHex(isHovered ? 0x74acdf : 0x5a90c0);
      } else {
        (ring.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      if (node?.poi && state.poiOwners[nodeId]) {
        const owner = state.squads.find((s) => s.id === state.poiOwners[nodeId]);
        mat.emissive.setHex(owner?.isPlayer ? 0xc8a832 : 0x993333);
        mat.emissiveIntensity = 0.2;
      }
    }

    for (const squad of state.squads.filter((s) => !s.eliminated)) {
      const node = state.district.find((n) => n.id === squad.nodeId);
      if (!node) continue;
      const color = squad.isPlayer ? 0xd4a017 : squad.id === 'rival_1' ? 0xc0392b : 0x7d5ba6;
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.5, 6),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.6 }),
      );
      const offsetX = squad.isPlayer ? -0.45 : squad.id === 'rival_1' ? 0.45 : 0;
      const offsetZ = squad.isPlayer ? 0 : squad.id === 'rival_1' ? 0 : 0.45;
      mesh.position.set(node.x + offsetX, 0.4, node.z + offsetZ);
      this.mapRoot.add(mesh);
      this.tokenMeshes.set(squad.id, mesh);
    }

    for (const pack of state.zombiePacks) {
      if (!pack.units.some((u) => u.alive)) continue;
      const node = state.district.find((n) => n.id === pack.nodeId);
      if (!node) continue;
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({ color: 0x4a7a3a, emissive: 0x2a4a1a, emissiveIntensity: 0.4, roughness: 0.5 }),
      );
      mesh.position.set(node.x + 0.45, 0.45, node.z - 0.35);
      this.mapRoot.add(mesh);
      this.tokenMeshes.set(`z_${pack.nodeId}`, mesh);
    }
  }

  projectNode(nodeId: string, district: DistrictNode[], width: number, height: number): { x: number; y: number } | null {
    const node = district.find((n) => n.id === nodeId);
    if (!node) return null;
    return this.cameraController.projectWorld(node.x, node.z, width, height);
  }

  projectLandmark(index: number, width: number, height: number): { x: number; y: number } | null {
    const lm = this.landmarks[index];
    if (!lm) return null;
    return this.cameraController.projectWorld(lm.x, lm.z, width, height);
  }

  pickNode(canvas: HTMLCanvasElement, clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.pickMeshes.values()]);
    if (!hits.length) return null;
    return (hits[0].object.userData.nodeId as string) ?? null;
  }

  pickLandmark(canvas: HTMLCanvasElement, clientX: number, clientY: number): number | null {
    if (!this.landmarkPoints) return null;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points = { threshold: 0.35 };
    const hits = this.raycaster.intersectObject(this.landmarkPoints);
    if (!hits.length || hits[0].index === undefined) return null;
    const visIdx = hits[0].index;
    return this.visibleLandmarkIndices[visIdx] ?? null;
  }

  getLandmark(index: number): LandmarkPoi | null {
    return this.landmarks[index] ?? null;
  }

  getLandmarks(): LandmarkPoi[] {
    return this.landmarks;
  }

  update(dt: number): void {
    this.pulseTime += dt;
    for (const ring of this.pulseMeshes) {
      const mat = ring.material as THREE.MeshBasicMaterial;
      if (mat.opacity > 0) {
        mat.opacity = 0.35 + Math.sin(this.pulseTime * 4) * 0.15;
      }
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
