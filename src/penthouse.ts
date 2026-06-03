/**
 * The rooftop room you start inside: a clean white Mirror's Edge interior with
 * clear floor-to-ceiling glazing, the signature red railing and pipework, and a
 * red "runner's path" stripe leading your eye to the view. The see-through
 * glass floor band at the windows is still the hook — walk to it and the drop
 * hits you.
 */

import {
  type World,
  type Object3D,
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
import { makeMatte, makeGloss, makeAccent, makeGlass } from './glass.js';

const P = CONFIG.palette;

/** Mark a mesh (and children) to cast/receive shadows for crisp ME contact. */
function shadow(obj: Object3D, cast = true, receive = false): void {
  obj.traverse((o) => {
    o.castShadow = cast;
    o.receiveShadow = receive;
  });
}

export function buildPenthouse(world: World): void {
  const { radius, wallHeight, ringWidth, columns } = CONFIG.room;
  const outerR = radius + ringWidth;
  const whiteMat = makeMatte(P.white);
  const trimMat = makeMatte(P.structure, 0.6);
  const redMat = makeAccent(P.red);

  // --- Glossy white inner floor you stand on (receives the hard shadows). ---
  const floor = new Mesh(new CircleGeometry(radius, 64), makeGloss(P.white, 0.34));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world
    .createTransformEntity(floor)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // --- Red "runner's path" stripe across the white floor toward the windows. ---
  const stripe = new Mesh(new BoxGeometry(0.55, 0.015, radius + ringWidth), redMat);
  stripe.position.set(0, 0.012, 0);
  shadow(stripe, false, true);
  world.createTransformEntity(stripe);

  // --- See-through glass floor band at the windows (the vertigo moment). ---
  const glassRing = new Mesh(
    new RingGeometry(radius, outerR, 64),
    makeGlass({ opacity: 0.16, doubleSided: true, envIntensity: 2.2 }),
  );
  glassRing.rotation.x = -Math.PI / 2;
  glassRing.position.y = 0.001;
  world
    .createTransformEntity(glassRing)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // --- Bright white ceiling. ---
  const ceiling = new Mesh(new CircleGeometry(outerR, 64), makeMatte(P.structure, 0.85));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  world.createTransformEntity(ceiling);

  // --- Clean clear curtain glazing you see the white city through. ---
  const wall = new Mesh(
    new CylinderGeometry(outerR, outerR, wallHeight, 64, 1, true),
    makeGlass({ opacity: 0.1, doubleSided: true, envIntensity: 2.4 }),
  );
  wall.position.y = wallHeight / 2;
  world.createTransformEntity(wall);

  // --- White mullions around the glazing, with red conduits on a few. ---
  const frames = new Group();
  for (let i = 0; i < columns; i++) {
    const a = (i / columns) * Math.PI * 2;
    const bar = new Mesh(new BoxGeometry(0.14, wallHeight, 0.14), trimMat);
    bar.position.set(Math.cos(a) * outerR, wallHeight / 2, Math.sin(a) * outerR);
    frames.add(bar);
    if (i % 4 === 0) {
      const pipe = new Mesh(
        new CylinderGeometry(0.05, 0.05, wallHeight * 0.96, 12),
        redMat,
      );
      pipe.position.set(Math.cos(a) * (outerR - 0.16), wallHeight / 2, Math.sin(a) * (outerR - 0.16));
      frames.add(pipe);
    }
  }
  shadow(frames, true, false);
  world.createTransformEntity(frames);

  // --- White trim rings top and bottom; red glass railing at the edge. ---
  for (const y of [0.06, wallHeight]) {
    const beam = new Mesh(new TorusGeometry(outerR, 0.05, 8, 80), whiteMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.y = y;
    world.createTransformEntity(beam);
  }
  const railing = new Mesh(new TorusGeometry(outerR - 0.05, 0.05, 10, 90), redMat);
  railing.rotation.x = Math.PI / 2;
  railing.position.y = 1.1;
  shadow(railing, true, false);
  world.createTransformEntity(railing);
  // Thin vertical balusters under the railing.
  const balusters = new Group();
  for (let i = 0; i < columns * 2; i++) {
    const a = (i / (columns * 2)) * Math.PI * 2;
    const b = new Mesh(new BoxGeometry(0.04, 1.1, 0.04), redMat);
    b.position.set(Math.cos(a) * (outerR - 0.05), 0.55, Math.sin(a) * (outerR - 0.05));
    balusters.add(b);
  }
  world.createTransformEntity(balusters);

  // --- A red door frame on the back wall — classic ME wayfinding. ---
  const door = new Group();
  const jambGeo = new BoxGeometry(0.16, 2.2, 0.16);
  const left = new Mesh(jambGeo, redMat);
  left.position.set(-0.6, 1.1, 0);
  const right = new Mesh(jambGeo, redMat);
  right.position.set(0.6, 1.1, 0);
  const lintel = new Mesh(new BoxGeometry(1.36, 0.16, 0.16), redMat);
  lintel.position.set(0, 2.2, 0);
  door.add(left, right, lintel);
  door.position.set(0, 0, -(radius - 0.2));
  shadow(door, true, false);
  world.createTransformEntity(door);

  // --- Your own tower shaft plunging into the city, to sell the height. ---
  const shaft = new Mesh(
    new CylinderGeometry(radius * 0.9, radius * 1.15, CONFIG.mood.altitude, 48, 1, true),
    makeMatte(P.white, 0.8),
  );
  shaft.position.y = -CONFIG.mood.altitude / 2;
  world.createTransformEntity(shaft);

  const underFloor = new Mesh(new CircleGeometry(radius * 1.05, 48), makeMatte(P.roof, 0.8));
  underFloor.rotation.x = Math.PI / 2;
  underFloor.position.y = -0.05;
  world.createTransformEntity(underFloor);
}
