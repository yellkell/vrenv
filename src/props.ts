/**
 * Street clutter that makes the alley feel lived-in: dumpsters and trash, stacked
 * crates and barrels (a few leaking toxic green), wall-bolted AC units and pipe
 * runs, zig-zag fire escapes, cables sagging overhead with paper lanterns strung
 * along them, a warm little ramen stall to stand by, and a handful of glowing
 * objects you can pick up.
 *
 * The repeated stuff (crates, barrels, trash, lanterns) is instanced, so the
 * whole mess stays cheap.
 */

import {
  type World,
  Group,
  Mesh,
  InstancedMesh,
  BoxGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector3,
  Object3D,
  Color,
  PointLight,
  Interactable,
  DistanceGrabbable,
  MovementMode,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeNeon, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

const P = CONFIG.palette;
const HW = ALLEY.halfWidth;
const dummy = new Object3D();

function instMat(x: number, y: number, z: number, s: number, ry: number, sy = s) {
  dummy.position.set(x, y, z);
  dummy.scale.set(s, sy, s);
  dummy.rotation.set(0, ry, 0);
  dummy.updateMatrix();
  return dummy.matrix;
}

/** A dumpster shoved against the wall. */
function dumpster(side: number, z: number, rng: () => number): Group {
  const g = new Group();
  const body = new Mesh(new BoxGeometry(1.6, 1.0, 1.0), makePaper(P.rust, 0.95));
  body.position.y = 0.5;
  const lid = new Mesh(new BoxGeometry(1.65, 0.1, 1.05), makePaper(P.metalDark, 0.95));
  lid.position.set(0, 1.05, -0.1 - rng() * 0.2);
  lid.rotation.x = -0.25 - rng() * 0.3; // propped half-open
  g.add(body, lid);
  g.traverse((o) => (o.castShadow = true));
  g.position.set(side * (HW - 0.9), FLOOR_Y, z);
  g.rotateY((rng() - 0.5) * 0.3);
  return g;
}

/** Instanced wooden/metal crates piled in the corners. */
function buildCrates(world: World, rng: () => number): void {
  const n = CONFIG.props.crates;
  const cols = ['#6b4a2b', '#7a5a35', '#3a3a44', '#2c2c34'].map((c) => new Color(c));
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), makePaper('#ffffff', 0.97), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const s = 0.4 + rng() * 0.45;
    const x = side * (HW - 0.5 - rng() * 0.8);
    const z = ALLEY.front + 2 + rng() * (ALLEY.length - 4);
    const stack = rng() < 0.4 ? s : 0; // sometimes stacked two high
    const y = FLOOR_Y + s / 2 + stack;
    mesh.setMatrixAt(i, instMat(x, y, z, s, rng() * Math.PI));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** Instanced steel drums. */
function buildBarrels(world: World, rng: () => number): void {
  const n = CONFIG.props.barrels;
  const cols = [P.metal, P.rust, P.metalDark].map((c) => new Color(c));
  const mesh = new InstancedMesh(new CylinderGeometry(0.32, 0.32, 0.92, 9), makePaper('#ffffff', 0.95), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (HW - 0.5 - rng() * 0.9);
    const z = ALLEY.front + 2 + rng() * (ALLEY.length - 4);
    mesh.setMatrixAt(i, instMat(x, FLOOR_Y + 0.46, z, 1, rng() * Math.PI));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** A few drums leaking glowing toxic sludge. */
function buildToxicBarrels(world: World, rng: () => number): void {
  for (let i = 0; i < CONFIG.props.toxicBarrels; i++) {
    const g = new Group();
    const body = new Mesh(new CylinderGeometry(0.32, 0.32, 0.92, 9), makePaper(P.metalDark, 0.9));
    body.position.y = 0.46;
    body.castShadow = true;
    const goo = new Mesh(new CylinderGeometry(0.3, 0.3, 0.06, 9), makeNeon(P.neon.green, 1.8));
    goo.position.y = 0.93;
    g.add(body, goo);
    const side = rng() < 0.5 ? -1 : 1;
    g.position.set(side * (HW - 0.6 - rng() * 0.6), FLOOR_Y, ALLEY.front + 3 + rng() * (ALLEY.length - 6));
    world.createTransformEntity(g);
  }
}

/** Instanced lumpy trash bags. */
function buildTrash(world: World, rng: () => number): void {
  const n = CONFIG.props.trashBags;
  const cols = ['#1a1a20', '#23202a', '#15161c'].map((c) => new Color(c));
  const mesh = new InstancedMesh(new IcosahedronGeometry(0.3, 0), makePaper('#ffffff', 0.98), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (HW - 0.4 - rng() * 1.0);
    const z = ALLEY.front + 2 + rng() * (ALLEY.length - 4);
    const s = 0.7 + rng() * 0.7;
    mesh.setMatrixAt(i, instMat(x, FLOOR_Y + 0.22 * s, z, s, rng() * Math.PI, s * (0.7 + rng() * 0.3)));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** A wall-bolted AC unit with a recessed fan facing the alley. */
function acUnit(side: number, y: number, z: number): Group {
  const g = new Group();
  const innerX = side * HW;
  const box = new Mesh(new BoxGeometry(0.5, 0.7, 0.9), makePaper(P.metal, 0.95));
  box.position.set(innerX - side * 0.28, y, z);
  const fan = new Mesh(new CylinderGeometry(0.22, 0.22, 0.06, 10), makePaper(P.metalDark, 0.9));
  fan.rotation.z = Math.PI / 2; // axis along X, face the alley
  fan.position.set(innerX - side * 0.54, y, z);
  g.add(box, fan);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** A horizontal pipe run along a wall, with a vertical drop. */
function pipeRun(side: number, y: number, z: number, len: number): Group {
  const g = new Group();
  const innerX = side * HW;
  const mat = makePaper(P.metal, 0.92);
  const run = new Mesh(new CylinderGeometry(0.08, 0.08, len, 7), mat);
  run.rotation.x = Math.PI / 2; // lie along Z
  run.position.set(innerX - side * 0.2, y, z);
  const drop = new Mesh(new CylinderGeometry(0.08, 0.08, y - 0.5, 7), mat);
  drop.position.set(innerX - side * 0.2, (y + 0.5) / 2 - 0.25, z - len / 2);
  const elbow = new Mesh(new IcosahedronGeometry(0.12, 0), mat);
  elbow.position.set(innerX - side * 0.2, y, z - len / 2);
  g.add(run, drop, elbow);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** A zig-zag fire escape bolted to a wall. */
function fireEscape(side: number, z: number): Group {
  const g = new Group();
  const innerX = side * HW;
  const metal = makePaper(P.metalDark, 0.92);
  const floors = 2;
  const floorH = 3.2;
  const px = innerX - side * 0.7; // platform centre, jutting into the alley
  for (let f = 0; f < floors; f++) {
    const y = 3 + f * floorH;
    const platform = new Mesh(new BoxGeometry(0.9, 0.08, 2.2), metal);
    platform.position.set(px, y, z);
    g.add(platform);
    // Outer + side railings.
    const railF = new Mesh(new BoxGeometry(0.05, 0.5, 2.2), metal);
    railF.position.set(px - side * 0.42, y + 0.3, z);
    g.add(railF);
    for (const sz of [-1, 1]) {
      const post = new Mesh(new BoxGeometry(0.9, 0.5, 0.05), metal);
      post.position.set(px, y + 0.3, z + sz * 1.05);
      g.add(post);
    }
    // Ladder up to the next floor.
    for (const rx of [-0.18, 0.18]) {
      const rail = new Mesh(new BoxGeometry(0.04, floorH, 0.04), metal);
      rail.position.set(px + rx, y + floorH / 2, z + 0.8);
      g.add(rail);
    }
    for (let r = 0; r < 4; r++) {
      const rung = new Mesh(new BoxGeometry(0.4, 0.04, 0.04), metal);
      rung.position.set(px, y + 0.4 + r * 0.7, z + 0.8);
      g.add(rung);
    }
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Cables sagging across the alley, with paper lanterns strung along them. */
function buildCablesAndLanterns(world: World, rng: () => number): void {
  const lanternPts: Vector3[] = [];
  const wire = makePaper(P.metalDark, 0.95);
  for (let i = 0; i < CONFIG.props.cables; i++) {
    const z = ALLEY.front + 2 + (i / CONFIG.props.cables) * (ALLEY.length - 4) + rng();
    const yL = 9 + rng() * 4;
    const yR = 9 + rng() * 4;
    const sag = 1.5 + rng() * 2.5;
    const curve = new CatmullRomCurve3([
      new Vector3(-HW - 0.5, yL, z),
      new Vector3((rng() - 0.5) * 1.5, Math.min(yL, yR) - sag, z + (rng() - 0.5)),
      new Vector3(HW + 0.5, yR, z),
    ]);
    const tube = new TubeGeometry(curve, 14, 0.03, 4, false);
    world.createTransformEntity(new Mesh(tube, wire));
    // Hang a couple of lanterns near the sagging middle.
    const perCable = Math.ceil(CONFIG.props.lanterns / CONFIG.props.cables);
    for (let k = 0; k < perCable; k++) {
      const t = 0.3 + rng() * 0.4;
      const p = curve.getPoint(t);
      lanternPts.push(new Vector3(p.x, p.y - 0.22, p.z));
    }
  }

  // Instanced glowing lanterns — warm amber strung along the wires.
  const n = lanternPts.length;
  const mesh = new InstancedMesh(new IcosahedronGeometry(0.13, 0), makeNeon(P.neon.amber, 1.6), n);
  for (let i = 0; i < n; i++) {
    const p = lanternPts[i];
    dummy.position.copy(p);
    dummy.scale.setScalar(0.8 + rng() * 0.6);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** A warm ramen stall to stand beside — the cosy pocket in all the cold neon. */
function buildStall(world: World): void {
  const side = -1;
  const z = ALLEY.front + ALLEY.length * 0.45;
  const baseX = side * (HW - 1.0);
  const g = new Group();
  const wood = makePaper('#6a4326', 0.95);
  const counter = new Mesh(new BoxGeometry(0.8, 0.9, 2.6), wood);
  counter.position.set(baseX, 0.45, z);
  const roof = new Mesh(new BoxGeometry(1.4, 0.1, 3.0), makePaper(P.rust, 0.95));
  roof.position.set(baseX - side * 0.2, 2.15, z);
  roof.rotation.z = side * 0.12;
  // Warm interior glow against the wall behind the counter.
  const glow = new Mesh(new BoxGeometry(0.1, 1.4, 2.6), makeNeon(P.windowWarm, 1.0, true));
  glow.position.set(side * HW - side * 0.12, 1.3, z);
  // A little red sign hanging off the front of the roof.
  const sign = new Mesh(new BoxGeometry(0.08, 0.5, 1.4), makeNeon(P.neon.red, 2.0));
  sign.position.set(baseX - side * 0.85, 1.7, z);
  g.add(counter, roof, glow, sign);
  for (const sz of [-0.7, 0.7]) {
    const stool = new Mesh(new CylinderGeometry(0.18, 0.2, 0.5, 8), makePaper(P.metalDark, 0.9));
    stool.position.set(baseX - side * 0.9, 0.25, z + sz);
    g.add(stool);
  }
  g.traverse((o) => (o.castShadow = true));
  world.createTransformEntity(g);
  // A cosy warm light inside the stall.
  const light = new PointLight(new Color(P.windowWarm), 5, 7, 2);
  light.position.set(baseX, 1.5, z);
  world.createTransformEntity(light);
}

/** Glowing odds and ends near the spawn you can pick up and toss. */
function buildGrabbables(world: World, rng: () => number): void {
  const colors = [P.neon.cyan, P.neon.magenta, P.neon.green, P.neon.amber, P.neon.blue];
  for (let i = 0; i < CONFIG.props.grab; i++) {
    const color = colors[i % colors.length];
    const kind = i % 3;
    let mesh: Mesh;
    if (kind === 0) mesh = new Mesh(new BoxGeometry(0.18, 0.18, 0.18), makeNeon(color, 1.6));
    else if (kind === 1) mesh = new Mesh(new CylinderGeometry(0.06, 0.06, 0.18, 8), makeNeon(color, 1.6));
    else mesh = new Mesh(new IcosahedronGeometry(0.12, 0), makeNeon(color, 1.6));
    mesh.castShadow = true;
    const a = (i / CONFIG.props.grab) * Math.PI * 2 + rng();
    const r = 1.4 + rng() * 1.6;
    mesh.position.set(
      Math.cos(a) * r,
      FLOOR_Y + 0.5 + rng() * 0.4,
      ALLEY.front + ALLEY.length * 0.62 + Math.sin(a) * r,
    );
    mesh.rotation.set(rng(), rng(), rng());
    world
      .createTransformEntity(mesh)
      .addComponent(Interactable)
      .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveTowardsTarget });
  }
}

export function buildProps(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 23 + 5);

  buildCrates(world, rng);
  buildBarrels(world, rng);
  buildToxicBarrels(world, rng);
  buildTrash(world, rng);
  buildCablesAndLanterns(world, rng);
  buildStall(world);
  buildGrabbables(world, rng);

  // A handful of dumpsters, AC units, and pipe runs scattered down the alley.
  for (let i = 0; i < 3; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    world.createTransformEntity(
      dumpster(side, ALLEY.front + 5 + (i / 3) * (ALLEY.length - 10), rng),
    );
  }
  for (let i = 0; i < 6; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    world.createTransformEntity(
      acUnit(side, 3 + rng() * 4, ALLEY.front + 3 + rng() * (ALLEY.length - 6)),
    );
  }
  for (const side of [-1, 1]) {
    world.createTransformEntity(pipeRun(side, 4 + rng() * 3, ALLEY.front + ALLEY.length * 0.4, 12));
    world.createTransformEntity(
      fireEscape(side, ALLEY.front + ALLEY.length * (0.5 + side * 0.18)),
    );
  }
}
