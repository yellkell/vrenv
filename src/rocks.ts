/**
 * Rocks of the desert: low-poly faceted boulders scattered across the sand
 * (one instanced draw call), and the big layered-cardstock mesas that make the
 * classic western horizon. Plus a few small grab-able paper rocks.
 */

import {
  type World,
  Group,
  Mesh,
  InstancedMesh,
  IcosahedronGeometry,
  CylinderGeometry,
  Object3D,
  Color,
  Interactable,
  DistanceGrabbable,
  MovementMode,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeRng } from './paper.js';
import { desertHeight } from './terrain.js';

const P = CONFIG.palette;
const dummy = new Object3D();

function trs(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number) {
  dummy.position.set(x, y, z);
  dummy.scale.set(sx, sy, sz);
  dummy.rotation.set(0, ry, 0);
  dummy.updateMatrix();
  return dummy.matrix;
}

/** Faceted boulders strewn across the dunes. */
export function buildBoulders(world: World): void {
  const rng = makeRng(CONFIG.terrain.seed * 7 + 1);
  const n = CONFIG.rocks.boulders;
  const half = CONFIG.terrain.size / 2 - 6;
  const cols = P.boulder.map((c) => new Color(c));
  const mesh = new InstancedMesh(new IcosahedronGeometry(1, 0), makePaper('#ffffff', 0.98), n);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    const s = 0.4 + rng() * rng() * 2.2; // mostly small, occasional big
    const y = desertHeight(x, z) + s * 0.45; // sit half-buried
    mesh.setMatrixAt(i, trs(x, y, z, s, s * (0.7 + rng() * 0.4), s, rng() * Math.PI));
    mesh.setColorAt(i, cols[(rng() * cols.length) | 0]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  world.createTransformEntity(mesh);
}

/** A single layered-strata mesa (stacked faceted slabs, flat top). */
function makeMesa(rng: () => number, height: number): Group {
  const g = new Group();
  const layers = 4 + ((rng() * 3) | 0);
  let y = 0;
  let radius = height * (0.45 + rng() * 0.2);
  for (let i = 0; i < layers; i++) {
    const h = height / layers;
    const slab = new Mesh(
      new CylinderGeometry(radius * 0.92, radius, h, 6 + ((rng() * 2) | 0)),
      makePaper(P.rockStrata[i % P.rockStrata.length], 0.98),
    );
    slab.position.y = y + h / 2;
    slab.rotation.y = rng() * Math.PI;
    slab.castShadow = true;
    g.add(slab);
    y += h;
    radius *= 0.82 + rng() * 0.08; // taper upward into a butte
  }
  return g;
}

/** A ring of mesas out toward the horizon — the western silhouette. */
export function buildMesas(world: World): void {
  const rng = makeRng(CONFIG.terrain.seed * 13 + 3);
  const { mesas, mesaRingMin, mesaRingMax } = CONFIG.rocks;
  for (let i = 0; i < mesas; i++) {
    const a = (i / mesas) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const r = mesaRingMin + rng() * (mesaRingMax - mesaRingMin);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const height = 16 + rng() * 26;
    const mesa = makeMesa(rng, height);
    mesa.position.set(x, desertHeight(x, z) - 1, z);
    world.createTransformEntity(mesa);
  }
}

/** Small paper rocks near the spawn you can pick up and toss. */
export function buildGrabRocks(world: World): void {
  const rng = makeRng(CONFIG.terrain.seed * 17 + 9);
  const cols = P.boulder;
  for (let i = 0; i < CONFIG.decor.grabRocks; i++) {
    const a = (i / CONFIG.decor.grabRocks) * Math.PI * 2 + rng();
    const r = 3 + rng() * 4;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const s = 0.18 + rng() * 0.12;
    const rock = new Mesh(new IcosahedronGeometry(s, 0), makePaper(cols[(rng() * cols.length) | 0], 0.98));
    rock.castShadow = true;
    rock.position.set(x, desertHeight(x, z) + s, z);
    rock.rotation.set(rng(), rng(), rng());
    world
      .createTransformEntity(rock)
      .addComponent(Interactable)
      .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
  }
}
