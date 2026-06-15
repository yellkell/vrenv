/**
 * The density pass: everything that makes the alley feel crusted with decades of
 * city. It's almost all bolted to the walls or pushed to the curbs, so the centre
 * path stays clear to walk — junction boxes, pasted bills and graffiti, satellite
 * dishes, drainpipes, little balconies, glowing vending machines, wall screens
 * that blink, strings of bulbs, bollards, cones, manholes and road markings.
 *
 * The repeated pieces are instanced (one draw call each). The wall screens and a
 * scatter of "feature windows" carry NeonToggle, so lights switch on and off in
 * different places as time passes.
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
  CircleGeometry,
  Object3D,
  Color,
  type Material,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeNeon, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';
import { NeonToggle } from './neon.js';

const P = CONFIG.palette;
const HW = ALLEY.halfWidth;
const D = CONFIG.detail;
const dummy = new Object3D();

/** Random z somewhere down the alley. */
function railZ(rng: () => number): number {
  return ALLEY.front + 2 + rng() * (ALLEY.length - 4);
}

/** Bake a flush-on-wall transform (facing the alley) into the dummy's matrix. */
function flush(side: number, x: number, y: number, z: number, sw: number, sh: number) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, -side * (Math.PI / 2), 0);
  dummy.scale.set(sw, sh, 1);
  dummy.updateMatrix();
  return dummy.matrix;
}

/** Junction boxes, meters and vents bolted to the walls. */
function buildWallBoxes(world: World, rng: () => number): void {
  const n = D.wallBoxes;
  const cols = [P.metal, P.metalDark, P.rust, '#2a2f3a'].map((c) => new Color(c));
  const mesh = new InstancedMesh(new BoxGeometry(0.5, 0.6, 0.3), makePaper('#ffffff', 0.95), n);
  mesh.castShadow = true;
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const y = 1.4 + rng() * 11;
    const s = 0.5 + rng() * 0.9;
    dummy.position.set(side * (HW - 0.16), y, railZ(rng));
    dummy.rotation.set(0, -side * (Math.PI / 2), 0);
    dummy.scale.set(s, s * (0.7 + rng() * 0.8), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** Pasted bills and graffiti slapped flat on the walls. */
function buildPosters(world: World, rng: () => number): void {
  const n = D.posters;
  const cols = ['#c23a5e', '#2f7fc2', '#caa23a', '#3aca8a', '#7a3aca', '#cf5a2a', '#d8d2c4'].map(
    (c) => new Color(c),
  );
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), makePaper('#ffffff', 0.98), n);
  for (let i = 0; i < n; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const w = 0.5 + rng() * 0.7;
    const h = 0.7 + rng() * 1.0;
    mesh.setMatrixAt(i, flush(side, side * (HW - 0.04), 1.2 + rng() * 5, railZ(rng), w, h));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** Satellite dishes peering off the upper walls. */
function buildDishes(world: World, rng: () => number): void {
  const mount = makePaper(P.metalDark, 0.95);
  const dish = makePaper('#3a3f4a', 0.95);
  for (let i = 0; i < D.dishes; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const g = new Group();
    const arm = new Mesh(new CylinderGeometry(0.04, 0.04, 0.5, 5), mount);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = -side * 0.25;
    const pan = new Mesh(new CylinderGeometry(0.45, 0.45, 0.08, 12), dish);
    pan.rotation.z = Math.PI / 2;
    pan.rotation.y = side * 0.4 + (rng() - 0.5) * 0.4;
    g.add(arm, pan);
    g.position.set(side * (HW - 0.1), 6 + rng() * 7, railZ(rng));
    g.traverse((o) => (o.castShadow = true));
    world.createTransformEntity(g);
  }
}

/** Drainpipes running down the walls. */
function buildDrainpipes(world: World, rng: () => number): void {
  const mat = makePaper(P.metal, 0.93);
  for (let i = 0; i < D.drainpipes; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const h = 6 + rng() * 8;
    const pipe = new Mesh(new CylinderGeometry(0.09, 0.09, h, 6), mat);
    pipe.position.set(side * (HW - 0.12), h / 2, railZ(rng));
    pipe.castShadow = true;
    world.createTransformEntity(pipe);
  }
}

/** Little railed balconies on the upper floors. */
function buildBalconies(world: World, rng: () => number): void {
  const metal = makePaper(P.metalDark, 0.93);
  const green = makePaper(P.neon.green, 0.9);
  for (let i = 0; i < D.balconies; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const g = new Group();
    const px = side * (HW - 0.55);
    const platform = new Mesh(new BoxGeometry(1.0, 0.08, 1.8), metal);
    platform.position.set(px, 0, 0);
    g.add(platform);
    const railF = new Mesh(new BoxGeometry(0.05, 0.55, 1.8), metal);
    railF.position.set(px - side * 0.46, 0.3, 0);
    g.add(railF);
    for (const sz of [-1, 1]) {
      const railS = new Mesh(new BoxGeometry(1.0, 0.55, 0.05), metal);
      railS.position.set(px, 0.3, sz * 0.88);
      g.add(railS);
    }
    if (rng() < 0.6) {
      const plant = new Mesh(new BoxGeometry(0.3, 0.3, 0.6), green);
      plant.position.set(px - side * 0.3, 0.25, (rng() - 0.5) * 1.0);
      g.add(plant);
    }
    g.position.set(0, 5 + rng() * 8, railZ(rng));
    g.traverse((o) => (o.castShadow = true));
    world.createTransformEntity(g);
  }
}

/** Glowing vending machines lined up against the walls. */
function buildVending(world: World, rng: () => number): void {
  const cols = [P.neon.cyan, P.neon.magenta, P.neon.amber, P.neon.green, P.neon.blue];
  const body = makePaper('#26262f', 0.95);
  for (let i = 0; i < D.vending; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const col = cols[(rng() * cols.length) | 0];
    const g = new Group();
    const cab = new Mesh(new BoxGeometry(0.5, 1.7, 1.0), body);
    cab.position.set(side * (HW - 0.5), 0.85, 0);
    const faceMat: Material = makeNeon(col, 0.85, true);
    const face = new Mesh(new PlaneGeometry(0.85, 1.3), faceMat);
    face.position.set(side * (HW - 0.5) - side * 0.52, 0.95, 0);
    face.rotation.y = -side * (Math.PI / 2);
    g.add(cab, face);
    g.position.set(0, FLOOR_Y, railZ(rng));
    g.traverse((o) => (o.castShadow = true));
    world.createTransformEntity(g);
  }
}

/** Wall screens that blink on and off. */
function buildMonitors(world: World, rng: () => number): void {
  const cols = [P.neon.cyan, P.neon.blue, P.neon.green, P.neon.magenta, P.windowWarm];
  for (let i = 0; i < D.monitors; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const col = cols[(rng() * cols.length) | 0];
    const base = 1.3 + rng() * 0.8;
    const w = 0.8 + rng() * 0.9;
    const h = 0.6 + rng() * 0.7;
    const g = new Group();
    const frame = new Mesh(new BoxGeometry(w + 0.12, h + 0.12, 0.08), makePaper(P.metalDark, 0.95));
    const face = new Mesh(new PlaneGeometry(w, h), makeNeon(col, base, true));
    face.position.z = 0.06;
    g.add(frame, face);
    g.position.set(side * (HW - 0.06), 2 + rng() * 6, railZ(rng));
    g.rotation.y = -side * (Math.PI / 2);
    world.createTransformEntity(g).addComponent(NeonToggle, {
      base,
      period: 2 + rng() * 6,
      onFrac: 0.4 + rng() * 0.4,
      phase: rng(),
    });
  }
}

/** Strings of little bulbs slung along the walls. */
function buildFestoon(world: World, rng: () => number): void {
  const n = D.festoon;
  const mesh = new InstancedMesh(new CylinderGeometry(0.05, 0.05, 0.09, 6), makeNeon(P.neon.amber, 1.6), n);
  // A handful of runs, each a sagging row of bulbs at a height near a wall.
  const runs = 8;
  let i = 0;
  for (let r = 0; r < runs && i < n; r++) {
    const side = rng() < 0.5 ? -1 : 1;
    const y = 3.5 + rng() * 5;
    const z0 = railZ(rng);
    const len = 4 + rng() * 6;
    const per = Math.min(n - i, 6 + ((rng() * 4) | 0));
    for (let k = 0; k < per && i < n; k++, i++) {
      const z = z0 + (k / per) * len;
      const sag = Math.sin((k / per) * Math.PI) * 0.4;
      dummy.position.set(side * (HW - 0.2), y - sag, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.8 + rng() * 0.5);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
  }
  // Park any leftover instances out of sight.
  for (; i < n; i++) {
    dummy.position.set(0, -50, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** Bollards and traffic cones along the curbs. */
function buildBollardsAndCones(world: World, rng: () => number): void {
  const posts = new InstancedMesh(new CylinderGeometry(0.08, 0.1, 0.8, 8), makePaper(P.metalDark, 0.9), D.bollards);
  const caps = new InstancedMesh(new CylinderGeometry(0.09, 0.09, 0.08, 8), makeNeon(P.neon.amber, 1.4), D.bollards);
  for (let i = 0; i < D.bollards; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (HW - 0.5);
    const z = railZ(rng);
    dummy.position.set(x, FLOOR_Y + 0.4, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, FLOOR_Y + 0.82, z);
    dummy.updateMatrix();
    caps.setMatrixAt(i, dummy.matrix);
  }
  posts.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  posts.castShadow = true;
  world.createTransformEntity(posts);
  world.createTransformEntity(caps);

  const cones = new InstancedMesh(new ConeGeometry(0.18, 0.5, 8), makePaper('#d8632a', 0.95), D.cones);
  cones.castShadow = true;
  for (let i = 0; i < D.cones; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    dummy.position.set(side * (HW - 0.6 - rng() * 0.5), FLOOR_Y + 0.25, railZ(rng));
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.setScalar(0.8 + rng() * 0.5);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);
  }
  cones.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(cones);
}

/** Manhole covers and faded centre-line dashes on the road. */
function buildRoadMarks(world: World, rng: () => number): void {
  const holes = new InstancedMesh(new CircleGeometry(0.42, 12), makePaper(P.metalDark, 0.9), D.manholes);
  for (let i = 0; i < D.manholes; i++) {
    const x = (rng() * 2 - 1) * (HW - 0.6);
    dummy.position.set(x, FLOOR_Y + 0.015, railZ(rng));
    dummy.rotation.set(-Math.PI / 2, 0, rng() * Math.PI);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    holes.setMatrixAt(i, dummy.matrix);
  }
  holes.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(holes);

  const dashes = 18;
  const dash = new InstancedMesh(new PlaneGeometry(0.14, 0.8), makePaper('#9a8a3a', 0.97), dashes);
  for (let i = 0; i < dashes; i++) {
    const z = ALLEY.front + 2 + (i / dashes) * (ALLEY.length - 4);
    dummy.position.set(0, FLOOR_Y + 0.014, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    dash.setMatrixAt(i, dummy.matrix);
  }
  dash.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(dash);
}

/** A scatter of feature windows that switch on and off in different places. */
function buildToggleWindows(world: World, rng: () => number): void {
  const cols = [P.windowWarm, P.windowCyan, P.windowMagenta, P.neon.amber, P.neon.cyan];
  for (let i = 0; i < D.toggleWindows; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const col = cols[(rng() * cols.length) | 0];
    const base = 1.0 + rng() * 0.6;
    const win = new Mesh(new PlaneGeometry(0.8 + rng() * 0.5, 1.0 + rng() * 0.5), makeNeon(col, base, true));
    win.position.set(side * (HW - 0.05), 2.5 + rng() * 12, railZ(rng));
    win.rotation.y = -side * (Math.PI / 2);
    world.createTransformEntity(win).addComponent(NeonToggle, {
      base,
      period: 3 + rng() * 9,
      onFrac: 0.5 + rng() * 0.35,
      phase: rng(),
    });
  }
}

export function buildDetail(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 37 + 11);
  buildWallBoxes(world, rng);
  buildPosters(world, rng);
  buildDishes(world, rng);
  buildDrainpipes(world, rng);
  buildBalconies(world, rng);
  buildVending(world, rng);
  buildMonitors(world, rng);
  buildFestoon(world, rng);
  buildBollardsAndCones(world, rng);
  buildRoadMarks(world, rng);
  buildToggleWindows(world, rng);
}
