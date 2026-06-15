/**
 * The alley floor: a flat sheet of rain-slicked asphalt with glassy puddles and
 * a raised curb along each wall. The road is the one big walkable surface, so it
 * carries the LocomotionEnvironment that teleport/slide locomotion lands on.
 *
 * The floor is flat (y = 0), so unlike the desert there's no height function —
 * everything that sits on the ground just uses FLOOR_Y.
 */

import {
  type World,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  CircleGeometry,
  Color,
  MeshStandardMaterial,
  EnvironmentType,
  LocomotionEnvironment,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeRng } from './paper.js';

export const FLOOR_Y = 0;

const A = CONFIG.alley;
/** Convenience: the alley runs front→back along Z, ±halfWidth across X. */
export const ALLEY = {
  halfWidth: A.halfWidth,
  front: A.front,
  back: A.back,
  length: A.back - A.front,
  midZ: (A.front + A.back) / 2,
};

export function buildStreet(world: World): void {
  const rng = makeRng(A.seed * 3 + 5);
  const margin = 0.8;
  const w = (A.halfWidth + margin) * 2;
  const len = ALLEY.length + 4;

  // --- Wet asphalt: dark and a little glossy so the cool sky reflects in it. ---
  const road = new MeshStandardMaterial({
    color: new Color(CONFIG.palette.asphalt),
    roughness: 0.42,
    metalness: 0.1,
    envMapIntensity: 1.6,
  });
  const geo = new PlaneGeometry(w, len, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const floor = new Mesh(geo, road);
  floor.position.set(0, FLOOR_Y, ALLEY.midZ);
  floor.receiveShadow = true;
  world
    .createTransformEntity(floor)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // --- Glassy puddles: near-mirror dark water catching the cool IBL. ---
  const puddleMat = new MeshStandardMaterial({
    color: new Color(CONFIG.palette.puddle),
    roughness: 0.14,
    metalness: 0.25,
    envMapIntensity: 2.2,
  });
  for (let i = 0; i < 14; i++) {
    const puddle = new Mesh(new CircleGeometry(1, 10), puddleMat);
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(0.5 + rng() * 1.3, 0.4 + rng() * 0.9, 1);
    puddle.rotation.z = rng() * Math.PI;
    const x = (rng() * 2 - 1) * (A.halfWidth - 0.6);
    const z = A.front + rng() * ALLEY.length;
    puddle.position.set(x, FLOOR_Y + 0.012, z);
    puddle.receiveShadow = true;
    world.createTransformEntity(puddle);
  }

  // --- Raised curbs hugging each wall base. ---
  const curbMat = makePaper(CONFIG.palette.curb, 0.95);
  for (const side of [-1, 1]) {
    const curb = new Mesh(new BoxGeometry(0.8, 0.14, len), curbMat);
    curb.position.set(side * (A.halfWidth - 0.4), FLOOR_Y + 0.07, ALLEY.midZ);
    curb.castShadow = true;
    curb.receiveShadow = true;
    world.createTransformEntity(curb);
  }
}
