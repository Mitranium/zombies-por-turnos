import * as THREE from 'three';

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class MapCameraController {
  readonly camera: THREE.OrthographicCamera;
  private panX = 0;
  private panZ = 0;
  private frustum = 13;
  private aspect = 1;
  private bounds: MapBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  private readonly listeners = new Set<() => void>();
  private readonly minFrustum = 4;
  private readonly maxFrustum = 40;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.camera.position.set(0, 16, 0);
    this.camera.lookAt(0, 0, 0);
    this.applyCamera();
  }

  setBounds(bounds: MapBounds): void {
    this.bounds = bounds;
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    this.panX = cx;
    this.panZ = cz;
    this.applyCamera();
    this.notify();
  }

  setDefaultFrustum(size: number): void {
    this.frustum = size;
    this.applyCamera();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  resize(width: number, height: number): void {
    this.aspect = width / height;
    this.applyCamera();
  }

  getFrustum(): number {
    return this.frustum;
  }

  reset(): void {
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const cz = (this.bounds.minZ + this.bounds.maxZ) / 2;
    this.panX = cx;
    this.panZ = cz;
    this.frustum = 13;
    this.clampPan();
    this.applyCamera();
    this.notify();
  }

  pan(dx: number, dy: number, canvas: HTMLCanvasElement): void {
    const worldPerPixel = (this.frustum * 2) / canvas.clientHeight;
    this.panX -= dx * worldPerPixel;
    this.panZ -= dy * worldPerPixel;
    this.clampPan();
    this.applyCamera();
    this.notify();
  }

  zoomAt(delta: number, clientX: number, clientY: number, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const worldBefore = this.ndcToWorld(ndcX, ndcY);

    const factor = delta > 0 ? 1.08 : 0.92;
    this.frustum = THREE.MathUtils.clamp(this.frustum * factor, this.minFrustum, this.maxFrustum);
    this.applyCamera();

    const worldAfter = this.ndcToWorld(ndcX, ndcY);
    this.panX += worldBefore.x - worldAfter.x;
    this.panZ += worldBefore.z - worldAfter.z;
    this.clampPan();
    this.applyCamera();
    this.notify();
  }

  private ndcToWorld(ndcX: number, ndcY: number): THREE.Vector3 {
    const v = new THREE.Vector3(ndcX, ndcY, 0.5);
    v.unproject(this.camera);
    return v;
  }

  private clampPan(): void {
    const halfW = (this.frustum * this.aspect) / 2;
    const halfH = this.frustum / 2;
    const pad = 2;
    this.panX = THREE.MathUtils.clamp(
      this.panX,
      this.bounds.minX - halfW + pad,
      this.bounds.maxX + halfW - pad,
    );
    this.panZ = THREE.MathUtils.clamp(
      this.panZ,
      this.bounds.minZ - halfH + pad,
      this.bounds.maxZ + halfH - pad,
    );
  }

  private applyCamera(): void {
    const halfW = (this.frustum * this.aspect) / 2;
    const halfH = this.frustum / 2;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.position.set(this.panX, 16, this.panZ);
    this.camera.lookAt(this.panX, 0, this.panZ);
    this.camera.updateProjectionMatrix();
  }

  projectWorld(x: number, z: number, width: number, height: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, 0.5, z);
    v.project(this.camera);
    return {
      x: ((v.x + 1) / 2) * width,
      y: ((-v.y + 1) / 2) * height,
    };
  }
}
