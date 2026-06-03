/**
 * The interior you start inside: a circular glassmorphic penthouse perched on
 * top of a tower. The trick of the whole piece is the see-through glass floor
 * band at the windows — walk to it and you realise you're hundreds of metres up.
 */

import {
  type World,
  Group,
  Mesh,
  CircleGeometry,
  RingGeometry,
  CylinderGeometry,
  BoxGeometry,
  TorusGeometry,
  EnvironmentType,
  LocomotionEnvironment,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makeGlass, makeSolidGlass } from './glass.js';

export function buildPenthouse(world: World): void {
  const { radius, wallHeight, ringWidth, columns } = CONFIG.room;
  const outerR = radius + ringWidth;
  const structureMat = makeSolidGlass(CONFIG.palette.structure, 0.05);

  // --- Solid inner floor: an opaque frosted disc you stand on. ---
  const floor = new Mesh(
    new CircleGeometry(radius, 64),
    makeGlass({ tint: '#dfe8ff', opacity: 0.96, frost: 0.5, glow: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  world
    .createTransformEntity(floor)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // --- See-through glass floor band at the windows (the vertigo moment). ---
  const glassRing = new Mesh(
    new RingGeometry(radius, outerR, 64),
    makeGlass({ tint: '#bfe9ff', opacity: 0.18, frost: 0.08, doubleSided: true, envIntensity: 2 }),
  );
  glassRing.rotation.x = -Math.PI / 2;
  glassRing.position.y = 0.001;
  // Still walkable — stepping out over the void is the point.
  world
    .createTransformEntity(glassRing)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // --- Ceiling: frosted disc with a brighter skylight feel. ---
  const ceiling = new Mesh(
    new CircleGeometry(outerR, 64),
    makeGlass({ tint: '#eef4ff', opacity: 0.5, frost: 0.6, doubleSided: true, glow: 0.06 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  world.createTransformEntity(ceiling);

  // --- Curtain glass wall: a tall translucent cylinder you see the city through. ---
  const wall = new Mesh(
    new CylinderGeometry(outerR, outerR, wallHeight, 64, 1, true),
    makeGlass({ tint: '#cfe9ff', opacity: 0.12, frost: 0.12, doubleSided: true, envIntensity: 2.2 }),
  );
  wall.position.y = wallHeight / 2;
  world.createTransformEntity(wall);

  // --- Vertical mullions evenly around the wall (structure + rhythm). ---
  const mullions = new Group();
  for (let i = 0; i < columns; i++) {
    const a = (i / columns) * Math.PI * 2;
    const bar = new Mesh(new BoxGeometry(0.12, wallHeight, 0.12), structureMat);
    bar.position.set(Math.cos(a) * outerR, wallHeight / 2, Math.sin(a) * outerR);
    mullions.add(bar);
  }
  world.createTransformEntity(mullions);

  // --- Ring beams top and bottom, plus a glass railing at the floor edge. ---
  const ringMeshes: Array<[number, number, number]> = [
    [0.06, 0.05, outerR], // floor edge trim
    [wallHeight, 0.05, outerR], // ceiling trim
  ];
  for (const [y, tube, r] of ringMeshes) {
    const beam = new Mesh(new TorusGeometry(r, tube, 8, 80), structureMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.y = y;
    world.createTransformEntity(beam);
  }
  const railing = new Mesh(
    new TorusGeometry(outerR - 0.05, 0.04, 8, 80),
    makeGlass({ tint: CONFIG.palette.accent, opacity: 0.7, frost: 0.1, glow: 0.5 }),
  );
  railing.rotation.x = Math.PI / 2;
  railing.position.y = 1.1;
  world.createTransformEntity(railing);

  // --- Your own tower shaft, plunging into the city to sell the height. ---
  const shaft = new Mesh(
    new CylinderGeometry(radius * 0.9, radius * 1.15, CONFIG.mood.altitude, 48, 1, true),
    makeSolidGlass(CONFIG.palette.structure, 0.04),
  );
  shaft.position.y = -CONFIG.mood.altitude / 2;
  world.createTransformEntity(shaft);

  // A cap under the floor so you don't see through into the hollow shaft top.
  const underFloor = new Mesh(
    new CircleGeometry(radius * 1.05, 48),
    makeSolidGlass('#c2cde6', 0.03),
  );
  underFloor.rotation.x = Math.PI / 2;
  underFloor.position.y = -0.05;
  world.createTransformEntity(underFloor);
}
