/**
 * The interactive objects inside the room: a clean rotating centerpiece and a
 * handful of grab-able floating ME-red cubes you can pick up and toss around.
 */

import {
  type World,
  Group,
  Mesh,
  BoxGeometry,
  Interactable,
  DistanceGrabbable,
  MovementMode,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makeMatte, makeGloss, makeAccent, makeRng } from './glass.js';
import { Floating } from './floating.js';
import { SlowSpin } from './spin.js';

const P = CONFIG.palette;

export function buildDecor(world: World): void {
  const rng = makeRng(CONFIG.city.seed * 31 + 5);

  // --- Centerpiece: a white monolith with a glowing red cap, slowly turning. ---
  const pedestal = new Mesh(new BoxGeometry(0.9, 0.25, 0.9), makeGloss(P.white, 0.3));
  pedestal.position.y = 0.125;
  pedestal.receiveShadow = true;
  world.createTransformEntity(pedestal);

  const monolith = new Group();
  const shaft = new Mesh(new BoxGeometry(0.5, 1.4, 0.5), makeMatte(P.structure, 0.5));
  shaft.position.y = 0.7;
  const cap = new Mesh(new BoxGeometry(0.56, 0.18, 0.56), makeAccent(P.red, 0.35));
  cap.position.y = 1.5;
  monolith.add(shaft, cap);
  monolith.traverse((o) => (o.castShadow = true));
  monolith.position.set(0, 0.25, 0);
  world.createTransformEntity(monolith).addComponent(SlowSpin, { speed: 0.1 });

  // --- Floating grab-able red cubes scattered around the room. ---
  const { radius } = CONFIG.room;
  for (let i = 0; i < CONFIG.decor.cubes; i++) {
    const a = (i / CONFIG.decor.cubes) * Math.PI * 2 + rng() * 0.4;
    const r = radius * (0.4 + rng() * 0.45);
    const s = 0.16 + rng() * 0.08;
    const cube = new Mesh(new BoxGeometry(s, s, s), makeAccent(P.red, 0.3));
    cube.castShadow = true;
    cube.position.set(Math.cos(a) * r, 1.0 + rng() * 0.7, Math.sin(a) * r);
    world
      .createTransformEntity(cube)
      .addComponent(Interactable)
      .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget })
      .addComponent(Floating, { phase: rng() * Math.PI * 2, spin: 0.2 + rng() * 0.6 });
  }
}
