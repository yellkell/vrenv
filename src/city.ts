/**
 * The stylised glass city far below. Hundreds of towers, but a single
 * InstancedMesh = one draw call, so it stays VR-friendly. A seeded RNG keeps
 * the skyline identical every reload, and value-noise gives it a believable
 * downtown-to-suburbs falloff. A clearing under your tower lets you look
 * straight down into the void.
 */

import {
  type World,
  Mesh,
  InstancedMesh,
  BoxGeometry,
  CircleGeometry,
  Object3D,
  Color,
  FogExp2,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makeSolidGlass, makeRng, valueNoise2D } from './glass.js';

export function buildCity(world: World): void {
  const { seed, extent, spacing, clearing, maxHeight, minHeight, jitter } = CONFIG.city;
  const base = -CONFIG.mood.altitude; // ground level of the city
  const rng = makeRng(seed);
  const noise = valueNoise2D(rng, 16);
  const tints = CONFIG.palette.glassTints;

  // First pass: collect lots so we know how many instances to allocate.
  type Lot = { x: number; z: number; h: number; w: number; d: number; yaw: number; tint: Color };
  const lots: Lot[] = [];
  for (let x = -extent; x <= extent; x += spacing) {
    for (let z = -extent; z <= extent; z += spacing) {
      const r = Math.hypot(x, z);
      if (r < clearing) continue; // keep the void under your feet
      if (rng() < 0.12) continue; // random gaps = plazas / parks

      const px = x + (rng() - 0.5) * jitter;
      const pz = z + (rng() - 0.5) * jitter;

      // Skyline: noise^1.6 makes most buildings short with rare supertalls.
      const n = noise(px / 90 + 8, pz / 90 + 8);
      // Downtown bump: a soft cluster of very tall towers off-centre.
      const downtown = Math.exp(-((px - 60) ** 2 + (pz + 40) ** 2) / (140 * 140));
      const h = minHeight + Math.pow(n, 1.6) * (maxHeight - minHeight) + downtown * 70;

      const w = spacing * (0.45 + rng() * 0.3);
      const d = spacing * (0.45 + rng() * 0.3);
      const yaw = (rng() - 0.5) * 0.25;

      // Mostly soft pastel glass; a few lit toward the accent for night windows.
      const tint = new Color(tints[(rng() * tints.length) | 0]);
      if (rng() < 0.15) tint.lerp(new Color(CONFIG.palette.accent), 0.5);

      lots.push({ x: px, z: pz, h, w, d, yaw, tint });
    }
  }

  // Build the instanced towers.
  const geo = new BoxGeometry(1, 1, 1);
  const mat = makeSolidGlass('#ffffff', 0.14);
  const towers = new InstancedMesh(geo, mat, lots.length);
  const dummy = new Object3D();
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i];
    dummy.position.set(lot.x, base + lot.h / 2, lot.z);
    dummy.scale.set(lot.w, lot.h, lot.d);
    dummy.rotation.y = lot.yaw;
    dummy.updateMatrix();
    towers.setMatrixAt(i, dummy.matrix);
    towers.setColorAt(i, lot.tint);
  }
  towers.instanceMatrix.needsUpdate = true;
  if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
  // The city never moves; skip per-frame frustum recompute.
  towers.frustumCulled = false;
  world.createTransformEntity(towers);

  // Ground plane the city sits on, so there's no infinite void below it.
  const ground = new Mesh(
    new CircleGeometry(extent * 1.6, 64),
    makeSolidGlass('#2a2540', 0.0),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = base;
  world.createTransformEntity(ground);

  // Atmospheric haze: fades the far skyline into the sunset horizon colour.
  const fogColor = new Color(CONFIG.sky.horizon).lerp(new Color(CONFIG.sky.top), 0.35);
  const density = 0.0011 + CONFIG.mood.haze * 0.0014;
  world.scene.fog = new FogExp2(fogColor.getHex(), density);
}
