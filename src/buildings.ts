/**
 * The buildings that wall in the alley, plus the megacity skyline beyond the
 * open end.
 *
 * Two rows of flat-shaded concrete facades run the length of the alley. Every
 * facade is peppered with a grid of windows — most glowing warm, some neon-lit,
 * some dark — and the lit ones are batched into a handful of InstancedMeshes
 * (one per colour) so the thousands of windows cost only a few draw calls.
 * Rooftops get water tanks / AC clusters / antennas for a jagged silhouette,
 * and a few buildings get a glowing street-level shopfront.
 */

import {
  type World,
  Group,
  Mesh,
  InstancedMesh,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  ConeGeometry,
  Object3D,
  Matrix4,
  Color,
  MeshStandardMaterial,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeNeon, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

const B = CONFIG.buildings;
const W = CONFIG.windows;
const P = CONFIG.palette;

const dummy = new Object3D();
function mat4(
  x: number,
  y: number,
  z: number,
  rotY: number,
  sx = 1,
  sy = 1,
  sz = 1,
): Matrix4 {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, rotY, 0);
  dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

/** Collected window placements, bucketed by glow colour. */
type Buckets = { warm: Matrix4[]; cyan: Matrix4[]; magenta: Matrix4[]; off: Matrix4[] };

/** A rooftop detail for a jagged skyline silhouette. */
function rooftopDetail(rng: () => number, topY: number, x: number, z: number): Group {
  const g = new Group();
  const metal = makePaper(P.metal, 0.95);
  const dark = makePaper(P.metalDark, 0.95);
  const pick = rng();
  if (pick < 0.4) {
    // Water tank on legs.
    const r = 0.9 + rng() * 0.6;
    const h = 1.6 + rng() * 1.2;
    const tank = new Mesh(new CylinderGeometry(r, r, h, 8), metal);
    tank.position.set(x, topY + 1 + h / 2, z);
    const cap = new Mesh(new ConeGeometry(r * 1.05, 0.6, 8), dark);
    cap.position.set(x, topY + 1 + h + 0.3, z);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = new Mesh(new BoxGeometry(0.12, 1.1, 0.12), dark);
        leg.position.set(x + sx * r * 0.6, topY + 0.55, z + sz * r * 0.6);
        g.add(leg);
      }
    g.add(tank, cap);
  } else if (pick < 0.75) {
    // Cluster of AC / utility boxes.
    const n = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const bw = 0.8 + rng() * 0.8;
      const bh = 0.5 + rng() * 0.6;
      const box = new Mesh(new BoxGeometry(bw, bh, bw), i % 2 ? metal : dark);
      box.position.set(x + (rng() - 0.5) * 3, topY + bh / 2, z + (rng() - 0.5) * 3);
      g.add(box);
    }
  } else {
    // Antenna mast with cross-arms.
    const h = 3 + rng() * 4;
    const mast = new Mesh(new CylinderGeometry(0.06, 0.09, h, 5), dark);
    mast.position.set(x, topY + h / 2, z);
    g.add(mast);
    for (let i = 0; i < 3; i++) {
      const arm = new Mesh(new BoxGeometry(1.2 - i * 0.3, 0.05, 0.05), dark);
      arm.position.set(x, topY + h * (0.5 + i * 0.15), z);
      g.add(arm);
    }
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** A glowing street-level shopfront set into the wall base. */
function shopfront(side: number, innerX: number, z: number, rng: () => number): Group {
  const g = new Group();
  const colors = [P.neon.cyan, P.neon.magenta, P.neon.amber, P.neon.green];
  const col = colors[(rng() * colors.length) | 0];
  // The lit doorway/window, flush with the wall, facing the alley.
  const face = new Mesh(new PlaneGeometry(2.4, 2.0), makeNeon(col, 0.9, true));
  face.position.set(innerX - side * 0.04, FLOOR_Y + 1.05, z);
  face.rotation.y = -side * (Math.PI / 2);
  // A little awning jutting over it.
  const awning = new Mesh(new BoxGeometry(0.7, 0.08, 2.8), makePaper(P.metalDark, 0.95));
  awning.position.set(innerX - side * 0.35, FLOOR_Y + 2.2, z);
  awning.rotation.z = side * 0.12;
  awning.castShadow = true;
  g.add(face, awning);
  return g;
}

/** Build one row of facades down one side of the alley, filling window buckets. */
function buildSide(
  world: World,
  side: number,
  rng: () => number,
  buckets: Buckets,
): void {
  const innerBase = side * ALLEY.halfWidth;
  let z = ALLEY.front;
  while (z < ALLEY.back - 1) {
    const depth = B.depthMin + rng() * (B.depthMax - B.depthMin);
    const outward = B.outwardMin + rng() * (B.outwardMax - B.outwardMin);
    const height = B.minHeight + rng() * (B.maxHeight - B.minHeight);
    const recess = rng() < 0.4 ? rng() * 0.5 : 0; // some doorway alcoves
    const innerX = innerBase + side * recess;
    const cz = z + depth / 2;

    // The facade block.
    const facade = new Mesh(
      new BoxGeometry(outward, height, depth),
      makePaper(P.concrete[(rng() * P.concrete.length) | 0], 0.97),
    );
    facade.position.set(side * (ALLEY.halfWidth + recess + outward / 2), FLOOR_Y + height / 2, cz);
    facade.castShadow = true;
    facade.receiveShadow = true;
    world.createTransformEntity(facade);

    // A vertical concrete pilaster on the corner for a little relief.
    const pil = new Mesh(new BoxGeometry(0.3, height, 0.3), makePaper(P.trim, 0.96));
    pil.position.set(innerX - side * 0.1, FLOOR_Y + height / 2, z + 0.4);
    pil.castShadow = true;
    world.createTransformEntity(pil);

    // Window grid on the inner (alley-facing) face.
    const rotY = -side * (Math.PI / 2);
    const proudX = innerX - side * 0.03;
    for (let wy = 1.6; wy < height - 1.2; wy += W.spacing) {
      for (let wz = z + 0.9; wz < z + depth - 0.6; wz += W.spacing) {
        const m = mat4(proudX, FLOOR_Y + wy, wz, rotY, W.width, W.height, 1);
        if (rng() < W.litChance) {
          const r = rng();
          if (r < 0.62) buckets.warm.push(m);
          else if (r < 0.82) buckets.cyan.push(m);
          else buckets.magenta.push(m);
        } else {
          buckets.off.push(m);
        }
      }
    }

    // Some buildings get a glowing shopfront at street level.
    if (rng() < 0.4) world.createTransformEntity(shopfront(side, innerX, cz, rng));

    // Rooftop silhouette.
    world.createTransformEntity(
      rooftopDetail(rng, FLOOR_Y + height, side * (ALLEY.halfWidth + recess + outward * 0.4), cz),
    );

    z += depth;
  }
}

/** Turn a window bucket into a single InstancedMesh. */
function instanceWindows(world: World, mats: Matrix4[], material: MeshStandardMaterial): void {
  if (mats.length === 0) return;
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  world.createTransformEntity(mesh);
}

/** The dead-end wall that caps the alley behind you. */
function buildDeadEnd(world: World, rng: () => number): void {
  const height = B.maxHeight;
  const wall = new Mesh(
    new BoxGeometry(ALLEY.halfWidth * 2 + 6, height, 3),
    makePaper(P.concrete[1], 0.97),
  );
  wall.position.set(0, FLOOR_Y + height / 2, ALLEY.back + 1.5);
  wall.castShadow = true;
  wall.receiveShadow = true;
  world.createTransformEntity(wall);
  world.createTransformEntity(
    rooftopDetail(rng, FLOOR_Y + height, 0, ALLEY.back + 1.5),
  );
}

/** The fogged megacity beyond the open end — instanced towers + window dots. */
function buildSkyline(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 31 + 7);
  const S = CONFIG.skyline;
  type Tower = { x: number; z: number; w: number; h: number; d: number };
  const towers: Tower[] = [];

  const towerMesh = new InstancedMesh(
    new BoxGeometry(1, 1, 1),
    makePaper('#15151f', 0.98),
    S.towers,
  );
  for (let i = 0; i < S.towers; i++) {
    const x = (rng() * 2 - 1) * (S.spreadX / 2);
    const z = S.nearZ - rng() * (S.nearZ - S.farZ);
    const w = 6 + rng() * 14;
    const d = 6 + rng() * 14;
    const h = 20 + rng() * 75;
    towers.push({ x, z, w, h, d });
    towerMesh.setMatrixAt(i, mat4(x, FLOOR_Y + h / 2, z, rng() * Math.PI, w, h, d));
  }
  towerMesh.instanceMatrix.needsUpdate = true;
  towerMesh.castShadow = false;
  towerMesh.receiveShadow = false;
  world.createTransformEntity(towerMesh);

  // Lit window dots on the tower fronts (facing the alley, +Z).
  const warm = makeNeon(P.windowWarm, 1.0, true);
  const cyan = makeNeon(P.windowCyan, 1.1, true);
  const warmMats: Matrix4[] = [];
  const cyanMats: Matrix4[] = [];
  for (let i = 0; i < S.windowDots; i++) {
    const t = towers[(rng() * towers.length) | 0];
    const dx = (rng() - 0.5) * t.w * 0.85;
    const dy = 2 + rng() * (t.h - 3);
    const fz = t.z + t.d / 2 + 0.1; // front face toward the player
    const m = mat4(t.x + dx, FLOOR_Y + dy, fz, 0, 0.5, 0.7, 1);
    if (rng() < 0.72) warmMats.push(m);
    else cyanMats.push(m);
  }
  instanceWindows(world, warmMats, warm);
  instanceWindows(world, cyanMats, cyan);
}

export function buildBuildings(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 11 + 1);
  const buckets: Buckets = { warm: [], cyan: [], magenta: [], off: [] };

  buildSide(world, -1, rng, buckets);
  buildSide(world, 1, rng, buckets);
  buildDeadEnd(world, rng);

  instanceWindows(world, buckets.warm, makeNeon(P.windowWarm, 1.1, true));
  instanceWindows(world, buckets.cyan, makeNeon(P.windowCyan, 1.25, true));
  instanceWindows(world, buckets.magenta, makeNeon(P.windowMagenta, 1.25, true));
  instanceWindows(world, buckets.off, makePaper(P.windowOff, 0.95));

  buildSkyline(world);
}
