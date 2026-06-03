/**
 * The stylised white city far below — Mirror's Edge by way of instancing.
 *
 * Each visual layer (tower bodies, roof parapets, rooftop mechanical boxes,
 * water towers) is its own InstancedMesh, so the whole skyline is a handful of
 * draw calls. A seeded RNG keeps it identical every reload; value-noise gives a
 * believable downtown-to-suburbs falloff; a clearing under your tower lets you
 * look straight down into the void.
 */

import {
  type World,
  Mesh,
  InstancedMesh,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  CircleGeometry,
  Object3D,
  Color,
  FogExp2,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makeMatte, makeRng, valueNoise2D } from './glass.js';

const P = CONFIG.palette;

type Lot = { x: number; z: number; h: number; w: number; d: number; yaw: number; color: Color };

export function buildCity(world: World): void {
  const c = CONFIG.city;
  const base = -CONFIG.mood.altitude;
  const rng = makeRng(c.seed);
  const noise = valueNoise2D(rng, 16);
  const white = new Color(P.white);

  // --- Pass 1: lay out the lots. ---
  const lots: Lot[] = [];
  for (let x = -c.extent; x <= c.extent; x += c.spacing) {
    for (let z = -c.extent; z <= c.extent; z += c.spacing) {
      if (Math.hypot(x, z) < c.clearing) continue; // void under your feet
      if (rng() < 0.1) continue; // plazas / gaps

      const px = x + (rng() - 0.5) * c.jitter;
      const pz = z + (rng() - 0.5) * c.jitter;
      const n = noise(px / 90 + 8, pz / 90 + 8);
      const downtown = Math.exp(-((px - 70) ** 2 + (pz + 50) ** 2) / (150 * 150));
      const h = c.minHeight + Math.pow(n, 1.6) * (c.maxHeight - c.minHeight) + downtown * 60;
      const w = c.spacing * (0.5 + rng() * 0.28);
      const d = c.spacing * (0.5 + rng() * 0.28);
      const yaw = (rng() - 0.5) * 0.18;

      // Mostly white with faint variation; a sparse few painted a bold accent.
      let color: Color;
      if (rng() < c.accentChance) {
        color = new Color(P.accents[(rng() * P.accents.length) | 0]);
      } else {
        color = white.clone().multiplyScalar(0.9 + rng() * 0.1);
      }
      lots.push({ x: px, z: pz, h, w, d, yaw, color });
    }
  }

  const dummy = new Object3D();
  const setTRS = (x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, yaw, 0);
    dummy.updateMatrix();
    return dummy.matrix;
  };

  // --- Layer 1: tower bodies. ---
  const bodies = new InstancedMesh(new BoxGeometry(1, 1, 1), makeMatte(P.white, 0.78), lots.length);
  lots.forEach((lot, i) => {
    bodies.setMatrixAt(i, setTRS(lot.x, base + lot.h / 2, lot.z, lot.w, lot.h, lot.d, lot.yaw));
    bodies.setColorAt(i, lot.color);
  });
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  bodies.frustumCulled = false;
  world.createTransformEntity(bodies);

  // --- Layer 2: roof parapets (a light-grey slab that defines every rooftop). ---
  const parapets = new InstancedMesh(new BoxGeometry(1, 1, 1), makeMatte(P.roof, 0.7), lots.length);
  lots.forEach((lot, i) => {
    parapets.setMatrixAt(i, setTRS(lot.x, base + lot.h + 0.6, lot.z, lot.w + 0.6, 1.2, lot.d + 0.6, lot.yaw));
  });
  parapets.instanceMatrix.needsUpdate = true;
  parapets.frustumCulled = false;
  world.createTransformEntity(parapets);

  // --- Layer 3: rooftop mechanical boxes (only on the taller buildings). ---
  const mechLots = lots.filter((l) => l.h > c.minHeight + 30 && rng() < 0.7);
  if (mechLots.length) {
    const mech = new InstancedMesh(new BoxGeometry(1, 1, 1), makeMatte(P.roof, 0.75), mechLots.length);
    mechLots.forEach((lot, i) => {
      const mw = lot.w * (0.3 + rng() * 0.25);
      const md = lot.d * (0.3 + rng() * 0.25);
      const mh = 2 + rng() * 4;
      mech.setMatrixAt(i, setTRS(lot.x, base + lot.h + 1.2 + mh / 2, lot.z, mw, mh, md, lot.yaw));
    });
    mech.instanceMatrix.needsUpdate = true;
    mech.frustumCulled = false;
    world.createTransformEntity(mech);
  }

  // --- Layer 4: iconic water towers on a sparse handful of roofs. ---
  const towerLots = lots.filter(() => rng() < c.waterTowerChance);
  if (towerLots.length) {
    const tankMat = makeMatte('#c9cfd6', 0.75);
    const tanks = new InstancedMesh(new CylinderGeometry(1, 1, 1, 12), tankMat, towerLots.length);
    const roofs = new InstancedMesh(new ConeGeometry(1, 1, 12), makeMatte(P.roof, 0.7), towerLots.length);
    towerLots.forEach((lot, i) => {
      const r = 1.4 + rng() * 0.8;
      const th = 2.6 + rng() * 1.4;
      const y = base + lot.h + 1.2 + th / 2;
      tanks.setMatrixAt(i, setTRS(lot.x, y, lot.z, r, th, r));
      roofs.setMatrixAt(i, setTRS(lot.x, y + th / 2 + r * 0.4, lot.z, r * 1.1, r * 0.9, r * 1.1));
    });
    tanks.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    tanks.frustumCulled = false;
    roofs.frustumCulled = false;
    world.createTransformEntity(tanks);
    world.createTransformEntity(roofs);
  }

  // --- Ground the city sits on. ---
  const ground = new Mesh(new CircleGeometry(c.extent * 1.6, 64), makeMatte(P.concrete, 0.9));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = base;
  world.createTransformEntity(ground);

  // --- Light, crisp haze fading the far skyline into the bright horizon. ---
  const fogColor = new Color(CONFIG.sky.horizon);
  world.scene.fog = new FogExp2(fogColor.getHex(), 0.0004 + CONFIG.mood.haze * 0.0006);
}
