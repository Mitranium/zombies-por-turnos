import * as THREE from 'three';
import { canvasTexture } from '../util/canvas';
import { mulberry32 } from '../util/random';

function makeSkyTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1a1430');
    g.addColorStop(0.32, '#3a2450');
    g.addColorStop(0.58, '#7a3f52');
    g.addColorStop(0.76, '#c56a3e');
    g.addColorStop(1, '#e8944a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    const rnd = mulberry32(77);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * 512;
      const y = rnd() * 260;
      const r = rnd() * 1.1 + 0.2;
      ctx.globalAlpha = 0.25 + rnd() * 0.55;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(390, 110);
    const moonGlow = ctx.createRadialGradient(0, 0, 5, 0, 0, 70);
    moonGlow.addColorStop(0, 'rgba(255,244,214,0.55)');
    moonGlow.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(-70, -70, 140, 140);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,170,140,0.35)';
    ctx.beginPath();
    ctx.arc(-9, -6, 5, 0, Math.PI * 2);
    ctx.arc(7, 8, 3.5, 0, Math.PI * 2);
    ctx.arc(2, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(30,20,35,0.4)';
    for (const [cx, cy, r] of [[80, 150, 60], [180, 190, 80], [300, 160, 70]] as const) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makeSkylineTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 320, (ctx) => {
    const rnd = mulberry32(303);
    ctx.clearRect(0, 0, 1024, 320);
    for (let layer = 0; layer < 2; layer++) {
      const baseY = 320;
      const shade = layer === 0 ? '#221a2c' : '#150f1e';
      let x = -20;
      ctx.fillStyle = shade;
      while (x < 1044) {
        const w = 40 + rnd() * 70;
        const h = 70 + rnd() * (layer === 0 ? 150 : 110);
        const y = baseY - h;
        ctx.fillRect(x, y, w, h + 10);
        if (layer === 0) {
          ctx.fillStyle = 'rgba(255,200,120,0.85)';
          const cols = Math.max(1, Math.floor(w / 11));
          const rows = Math.max(1, Math.floor(h / 14));
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              if (rnd() < 0.24) {
                ctx.fillRect(x + 4 + cx * 11, y + 6 + cy * 14, 4, 6);
              }
            }
          }
          ctx.fillStyle = shade;
        }
        x += w + 6 + rnd() * 10;
      }
    }
  });
}

function makeBrickTexture(tint: string, graffiti: boolean, seed: number): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const rnd = mulberry32(seed);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(10,8,8,0.5)';
    ctx.lineWidth = 3;
    const rowH = 28;
    for (let row = 0, y = 0; y < 512; row++, y += rowH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : 32;
      for (let x = offset - 64; x < 512 + 64; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowH);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 30, 1 + rnd());
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 5; i++) {
      const sx = rnd() * 512;
      ctx.fillRect(sx, 0, 3 + rnd() * 4, 512);
    }

    if (graffiti) {
      ctx.save();
      ctx.translate(70 + rnd() * 260, 300 + rnd() * 120);
      ctx.rotate((rnd() - 0.5) * 0.12);
      ctx.font = "italic 900 46px 'Segoe UI', sans-serif";
      ctx.fillStyle = 'rgba(220,60,110,0.75)';
      ctx.fillText('ZPT', 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeText('ZPT', 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(40 + rnd() * 90, 90 + rnd() * 60);
      ctx.strokeStyle = 'rgba(210,220,230,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(20, -18);
      ctx.lineTo(40, 4);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < 3; i++) {
      const wx = 60 + rnd() * 380;
      const wy = 60 + rnd() * 300;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,206,120,0.85)' : 'rgba(20,20,25,0.85)';
      ctx.fillRect(wx, wy, 46, 62);
      ctx.strokeStyle = 'rgba(15,12,10,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, 46, 62);
      ctx.beginPath();
      ctx.moveTo(wx + 23, wy);
      ctx.lineTo(wx + 23, wy + 62);
      ctx.moveTo(wx, wy + 31);
      ctx.lineTo(wx + 46, wy + 31);
      ctx.stroke();
    }
  });
}

function makeGroundTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 640, (ctx) => {
    const rnd = mulberry32(511);
    ctx.fillStyle = '#4a4744';
    ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = '#403d3a';
    ctx.fillRect(0, 0, 1024, 300);

    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1024; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 300);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 150);
    ctx.lineTo(1024, 150);
    ctx.stroke();

    ctx.fillStyle = '#2f2c2c';
    ctx.fillRect(0, 300, 1024, 340);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(rnd() * 1024, 300 + rnd() * 340, 1, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 24; i++) {
      const x = rnd() * 1024;
      const y = 310 + rnd() * 320;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) ctx.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 40);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(230, 470);
    ctx.fillStyle = '#1c1b1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 19);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(30,20,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(760, 520, 90, 40, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(560, 400);
    ctx.rotate(-0.08);
    ctx.font = "italic 900 24px 'Segoe UI', sans-serif";
    ctx.fillStyle = 'rgba(230,230,230,0.14)';
    ctx.fillText('ZOMBIES POR TURNOS', 0, 0);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(70 + i * 40, 570, 26, 8);
    }
  });
}

function glowSprite(color: string): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

function makeNeonTexture(): THREE.CanvasTexture {
  return canvasTexture(400, 160, (ctx) => {
    ctx.clearRect(0, 0, 400, 160);
    ctx.textAlign = 'center';
    ctx.font = "900 54px 'Segoe UI', sans-serif";
    const draw = (blur: number, alpha: number, color: string) => {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillText('CANTINA', 200, 60);
      ctx.font = "700 26px 'Segoe UI', sans-serif";
      ctx.fillText('ABIERTO TODA LA NOCHE', 200, 100);
      ctx.font = "900 54px 'Segoe UI', sans-serif";
    };
    draw(28, 0.5, '#ff3d81');
    draw(10, 0.9, '#ff8fc0');
    draw(2, 1, '#fff2f8');
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  });
}

interface SmokeParticle {
  mesh: THREE.Sprite;
  life: number;
  maxLife: number;
  vel: THREE.Vector3;
}

export interface CombatScenery {
  group: THREE.Group;
  fireLight: THREE.PointLight;
  update: (dt: number) => void;
  dispose: () => void;
}

export function buildCombatScenery(): CombatScenery {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  const sky = new THREE.Mesh(
    track(new THREE.PlaneGeometry(60, 26)),
    track(new THREE.MeshBasicMaterial({ map: track(makeSkyTexture()), depthWrite: false, fog: false })),
  );
  sky.position.set(0, 8, -14.9);
  group.add(sky);

  const skyline = new THREE.Mesh(
    track(new THREE.PlaneGeometry(46, 7)),
    track(new THREE.MeshBasicMaterial({ map: track(makeSkylineTexture()), transparent: true, depthWrite: false })),
  );
  skyline.position.set(0, 3.1, -12.5);
  group.add(skyline);

  const groundTex = track(makeGroundTexture());
  const ground = new THREE.Mesh(
    track(new THREE.PlaneGeometry(20, 13)),
    track(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.92 })),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0.5);
  group.add(ground);

  const wetSheen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(20, 13)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x101820,
        roughness: 0.18,
        metalness: 0.15,
        transparent: true,
        opacity: 0.1,
      }),
    ),
  );
  wetSheen.rotation.x = -Math.PI / 2;
  wetSheen.position.set(0, 0.008, 0.5);
  group.add(wetSheen);

  const wallColors = ['#7a6a5c', '#5c5850', '#8a7566'];
  const leftWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9, 6)),
    track(
      new THREE.MeshStandardMaterial({
        map: track(makeBrickTexture(wallColors[0], true, 21)),
        roughness: 0.95,
      }),
    ),
  );
  leftWall.position.set(-8.6, 3, -3.5);
  leftWall.rotation.y = Math.PI / 2 - 0.22;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9, 6)),
    track(
      new THREE.MeshStandardMaterial({
        map: track(makeBrickTexture(wallColors[1], false, 88)),
        roughness: 0.95,
      }),
    ),
  );
  rightWall.position.set(8.6, 3, -3.5);
  rightWall.rotation.y = -Math.PI / 2 + 0.22;
  group.add(rightWall);

  const backWall = new THREE.Mesh(
    track(new THREE.PlaneGeometry(17, 6.2)),
    track(
      new THREE.MeshStandardMaterial({
        map: track(makeBrickTexture(wallColors[2], true, 155)),
        roughness: 0.95,
      }),
    ),
  );
  backWall.position.set(0, 3, -6.8);
  group.add(backWall);

  for (const x of [-8.6, 8.6]) {
    const roofEdge = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.3, 0.3, 7)),
      track(new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 })),
    );
    roofEdge.position.set(x * 0.985, 6.1, -3.5);
    group.add(roofEdge);
    const tank = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 10)),
      track(new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.85 })),
    );
    tank.position.set(x * 0.9, 6.7, -3.5);
    group.add(tank);
  }

  const fireEscapeMat = track(new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.6, metalness: 0.5 }));
  for (let i = 0; i < 3; i++) {
    const platform = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.05, 0.7)), fireEscapeMat);
    platform.position.set(-8.3, 1.6 + i * 1.5, -1.5 - i * 0.3);
    group.add(platform);
    const rail = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.35, 0.04)), fireEscapeMat);
    rail.position.set(-8.3, 1.85 + i * 1.5, -1.15 - i * 0.3);
    group.add(rail);
  }

  const neonPanel = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.6, 1.05)),
    track(
      new THREE.MeshBasicMaterial({
        map: track(makeNeonTexture()),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  neonPanel.position.set(4.3, 4.35, -6.6);
  group.add(neonPanel);
  const neonBoardMat = track(new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8 }));
  const neonBoard = new THREE.Mesh(track(new THREE.BoxGeometry(2.9, 1.3, 0.08)), neonBoardMat);
  neonBoard.position.set(4.3, 4.35, -6.72);
  group.add(neonBoard);

  const poleMat = track(new THREE.MeshStandardMaterial({ color: 0x232120, roughness: 0.75, metalness: 0.3 }));
  const lampHeadMat = track(new THREE.MeshStandardMaterial({ color: 0xffdd99, emissive: 0xffaa44, emissiveIntensity: 0.9 }));
  const lampPositions: [number, number][] = [-5.6, 5.6].map((x) => [x, 3]);
  const lampGlows: THREE.Sprite[] = [];
  for (const [x] of lampPositions) {
    const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.06, 3, 6)), poleMat);
    pole.position.set(x, 1.5, 3);
    group.add(pole);
    const arm = new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6)), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x - Math.sign(x) * 0.35, 2.95, 3);
    group.add(arm);
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 8, 8)), lampHeadMat);
    head.position.set(x - Math.sign(x) * 0.7, 2.9, 3);
    group.add(head);

    const glow = new THREE.Sprite(
      track(new THREE.SpriteMaterial({ map: track(glowSprite('rgba(255,200,120,0.65)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
    );
    glow.scale.set(2.4, 2.4, 1);
    glow.position.set(x - Math.sign(x) * 0.7, 2.9, 3);
    group.add(glow);
    lampGlows.push(glow);
  }

  const cableGeo = track(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5.6, 2.95, 3),
    new THREE.Vector3(-1.5, 2.3, 1.2),
    new THREE.Vector3(2, 2.4, 1.4),
    new THREE.Vector3(5.6, 2.95, 3),
  ]));
  const cable = new THREE.Line(cableGeo, track(new THREE.LineBasicMaterial({ color: 0x1a1816 })));
  group.add(cable);

  const propMat = (color: number, rough = 0.85): THREE.MeshStandardMaterial => track(new THREE.MeshStandardMaterial({ color, roughness: rough }));
  const binMat = propMat(0x2e3a2e);
  for (const [x, z] of [[-0.9, 3.4], [1.0, 3.5]] as const) {
    const bin = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.24, 0.55, 10)), binMat);
    bin.position.set(x, 0.28, z);
    group.add(bin);
    const lid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10)), binMat);
    lid.position.set(x, 0.56, z);
    group.add(lid);
  }

  const crateMat = propMat(0x5a4632);
  for (let i = 0; i < 2; i++) {
    const crate = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.4, 0.5)), crateMat);
    crate.position.set(-0.9 + i * 0.55, 0.2, -2.4);
    crate.rotation.y = i * 0.4;
    group.add(crate);
  }

  const barrelGroup = new THREE.Group();
  const barrelMat = propMat(0x36302a, 0.6);
  const barrel = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.28, 0.62, 12, 1, true)), barrelMat);
  barrel.position.y = 0.31;
  barrelGroup.add(barrel);
  const barrelRimTop = new THREE.Mesh(track(new THREE.TorusGeometry(0.31, 0.025, 6, 16)), barrelMat);
  barrelRimTop.rotation.x = Math.PI / 2;
  barrelRimTop.position.y = 0.62;
  barrelGroup.add(barrelRimTop);
  barrelGroup.position.set(0, 0, 2.65);
  group.add(barrelGroup);

  const fireLight = new THREE.PointLight(0xff7733, 1.6, 6.5, 2);
  fireLight.position.set(0, 0.9, 2.65);
  group.add(fireLight);

  const flameSprite = new THREE.Sprite(
    track(new THREE.SpriteMaterial({ map: track(glowSprite('rgba(255,150,60,0.95)')), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  flameSprite.position.set(0, 0.7, 2.65);
  flameSprite.scale.set(0.8, 1.1, 1);
  group.add(flameSprite);

  const smokeTex = track(glowSprite('rgba(140,140,140,0.35)'));
  const smokeParticles: SmokeParticle[] = [];
  let smokeAccum = 0;

  let flicker = 0;
  let neonFlicker = 0;
  const neonMat = neonPanel.material as THREE.MeshBasicMaterial;

  function update(dt: number): void {
    flicker += dt;
    const f = 1 + Math.sin(flicker * 9) * 0.12 + Math.sin(flicker * 23) * 0.06;
    fireLight.intensity = 1.6 * f;
    flameSprite.scale.set(0.75 + Math.sin(flicker * 14) * 0.08, 1.05 + Math.sin(flicker * 11) * 0.12, 1);
    flameSprite.material.rotation = Math.sin(flicker * 3) * 0.15;

    for (const glow of lampGlows) {
      const s = 2.3 + Math.sin(flicker * 5 + glow.position.x) * 0.15;
      glow.scale.set(s, s, 1);
    }

    neonFlicker += dt;
    let opacity = 0.95;
    if (Math.sin(neonFlicker * 0.7) > 0.96 || Math.sin(neonFlicker * 2.3) > 0.985) {
      opacity = 0.35 + Math.random() * 0.3;
    }
    neonMat.opacity = opacity;

    smokeAccum += dt;
    if (smokeAccum > 0.35) {
      smokeAccum = 0;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0.4, depthWrite: false }),
      );
      sprite.position.set((Math.random() - 0.5) * 0.15, 0.75, 2.65 + (Math.random() - 0.5) * 0.15);
      sprite.scale.set(0.3, 0.3, 1);
      group.add(sprite);
      smokeParticles.push({ mesh: sprite, life: 2.2, maxLife: 2.2, vel: new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.55, (Math.random() - 0.5) * 0.1) });
    }
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const p = smokeParticles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.maxLife;
      const scale = 0.3 + t * 1.1;
      p.mesh.scale.set(scale, scale, 1);
      (p.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, 0.4 * (1 - t));
      if (p.life <= 0) {
        group.remove(p.mesh);
        p.mesh.material.dispose();
        smokeParticles.splice(i, 1);
      }
    }
  }

  function dispose(): void {
    for (const d of disposables) d.dispose();
    for (const p of smokeParticles) p.mesh.material.dispose();
  }

  return { group, fireLight, update, dispose };
}
