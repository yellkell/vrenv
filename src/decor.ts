/**
 * The playful glass objects inside the room: a rotating centerpiece sculpture
 * and a handful of grab-able floating crystals you can pick up and toss around.
 */

import {
  type World,
  Group,
  Mesh,
  IcosahedronGeometry,
  OctahedronGeometry,
  CylinderGeometry,
  Interactable,
  DistanceGrabbable,
  MovementMode,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makeGlass, makeRng } from './glass.js';
import { Floating } from './floating.js';
import { SlowSpin } from './spin.js';

export function buildDecor(world: World): void {
  const tints = CONFIG.palette.glassTints;
  const rng = makeRng(CONFIG.city.seed * 31 + 5);

  // --- Centerpiece: a cluster of glass shards on a pedestal, slowly turning. ---
  const pedestal = new Mesh(
    new CylinderGeometry(0.35, 0.5, 0.9, 24),
    makeGlass({ tint: CONFIG.palette.structure, opacity: 0.85, frost: 0.4, glow: 0.05 }),
  );
  pedestal.position.y = 0.45;
  world.createTransformEntity(pedestal);

  const cluster = new Group();
  for (let i = 0; i < 7; i++) {
    const shard = new Mesh(
      new IcosahedronGeometry(0.18 + rng() * 0.22, 0),
      makeGlass({
        tint: tints[(rng() * tints.length) | 0],
        opacity: 0.45,
        frost: 0.12,
        glow: 0.35,
        doubleSided: true,
        envIntensity: 2,
      }),
    );
    shard.position.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5);
    shard.scale.setScalar(0.7 + rng() * 0.8);
    cluster.add(shard);
  }
  cluster.position.set(0, 1.5, 0);
  world.createTransformEntity(cluster).addComponent(SlowSpin, { speed: 0.12 });

  // --- Floating grab-able crystals scattered around the room. ---
  const { radius } = CONFIG.room;
  for (let i = 0; i < CONFIG.decor.crystals; i++) {
    const a = (i / CONFIG.decor.crystals) * Math.PI * 2 + rng() * 0.4;
    const r = radius * (0.4 + rng() * 0.45);
    const geom =
      rng() < 0.5
        ? new IcosahedronGeometry(0.12 + rng() * 0.08, 0)
        : new OctahedronGeometry(0.13 + rng() * 0.08, 0);
    const crystal = new Mesh(
      geom,
      makeGlass({
        tint: tints[(rng() * tints.length) | 0],
        opacity: 0.5,
        frost: 0.1,
        glow: 0.4,
        doubleSided: true,
        envIntensity: 2.2,
      }),
    );
    crystal.position.set(Math.cos(a) * r, 1.0 + rng() * 0.7, Math.sin(a) * r);
    world
      .createTransformEntity(crystal)
      .addComponent(Interactable)
      .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget })
      .addComponent(Floating, { phase: rng() * Math.PI * 2, spin: 0.2 + rng() * 0.6 });
  }
}
