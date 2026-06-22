/**
 * saloon.ts
 *
 * Procedurally builds a big papercraft Western-saloon arena and wires it into an
 * IWSDK world. Nothing here depends on external 3D assets — the whole set is
 * folded out of flat-shaded Three.js primitives (see ./papercraft.ts).
 *
 * Layout (looking down, +Z is the entrance/front, -Z is the bar/back):
 *
 *        -Z  ┌─────────── BAR ───────────┐
 *            │  stage                     │   balcony runs along
 *            │        ( open arena )      │   the N / E / W walls
 *            │     ◦  central emblem  ◦   │
 *        +Z  └────────  ⟂ batwing doors ──┘
 *
 * The central ~10m circle is left completely clear so games built on top of
 * this scene have a real arena to play in; all furniture is pushed to the edges.
 */

import {
  DistanceGrabbable,
  EnvironmentType,
  Interactable,
  LocomotionEnvironment,
  MovementMode,
  type World,
} from '@iwsdk/core';
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
  SpotLight,
} from 'three';
import { Batwing } from './doors.js';
import { box, paper, place, post } from './papercraft.js';

// ----------------------------------------------------------------------------
// Dimensions & palette
// ----------------------------------------------------------------------------

const ROOM = {
  half: 9, // interior half-width / half-depth (18m x 18m footprint)
  height: 7,
  wall: 0.3,
  balconyY: 3.4,
  balconyDepth: 2.2,
};

const DOOR = {
  halfWidth: 1.2, // doorway gap is 2.4m wide
  height: 2.2,
};

const ARENA_RADIUS = 5; // clear play circle in the middle

const C = {
  floor: '#b5854b',
  floorAlt: '#a4743c',
  arena: '#946233',
  emblem: '#7c4a22',
  wainscot: '#5d3a21',
  plaster: '#e7d6ad',
  plasterAlt: '#dcc899',
  trim: '#3f2a18',
  beam: '#4a3018',
  bar: '#6a3f24',
  barTop: '#6f4527',
  brass: '#c9a44a',
  green: '#2f6b3a',
  amber: '#b8721f',
  red: '#8d2b2b',
  blue: '#3a5d7a',
  cream: '#efe2c0',
  mirror: '#7d8a8f',
  felt: '#1f5e3a',
  windowGlow: '#ffd98a',
  dusk: '#2a2336',
};

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

/** Builds the whole saloon arena and registers it with the world. */
export function buildSaloon(world: World): void {
  const env = new Group();
  env.name = 'PapercraftSaloon';

  buildShell(env);
  buildFloor(env);
  buildWalls(env);
  buildCeiling(env);
  buildBalcony(env);
  buildBar(env);
  buildStage(env);
  buildFurniture(env);
  buildChandeliers(env);
  buildLights(env);

  // The static set is a single locomotion environment so teleport / smooth
  // locomotion can use its floor and surfaces as walkable geometry.
  world
    .createTransformEntity(env)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // Moving / grabbable pieces are their own entities.
  buildDoors(world);
  buildProps(world);
}

// ----------------------------------------------------------------------------
// Warm dusk backdrop visible through windows & over the batwing doors
// ----------------------------------------------------------------------------

function buildShell(env: Group): void {
  const shell = new Mesh(
    // a big inverted cube around everything
    new BoxGeometry(60, 40, 60),
    new MeshBasicMaterial({ color: C.dusk, side: BackSide }),
  );
  shell.position.set(0, 10, 0);
  env.add(shell);
}

// ----------------------------------------------------------------------------
// Floor: planks + worn arena circle + center emblem
// ----------------------------------------------------------------------------

function buildFloor(env: Group): void {
  const span = ROOM.half * 2;
  const plankW = 1;
  const matA = paper(C.floor);
  const matB = paper(C.floorAlt);

  for (let i = 0; i < span / plankW; i++) {
    const x = -ROOM.half + plankW / 2 + i * plankW;
    place(env, box(plankW * 0.96, 0.2, span, i % 2 ? matA : matB), x, -0.1, 0);
  }

  // Worn arena circle inlaid into the planks.
  place(env, post(ARENA_RADIUS, ARENA_RADIUS, 0.04, C.arena, 16), 0, 0.02, 0);
  // Darker ring outline.
  const ring = post(ARENA_RADIUS, ARENA_RADIUS, 0.05, C.emblem, 16);
  ring.scale.set(1.04, 1, 1.04);
  place(env, ring, 0, 0.015, 0);
  place(env, post(ARENA_RADIUS - 0.18, ARENA_RADIUS - 0.18, 0.06, C.arena, 16), 0, 0.02, 0);

  // Center emblem: a small disc with a sunburst of planks.
  place(env, post(1.5, 1.5, 0.05, C.emblem, 12), 0, 0.05, 0);
  const ray = paper(C.brass);
  for (let i = 0; i < 8; i++) {
    const spoke = box(0.18, 0.06, 2.8, ray);
    spoke.rotation.y = (i / 8) * Math.PI * 2;
    place(env, spoke, 0, 0.06, 0);
  }
  place(env, post(0.5, 0.5, 0.08, C.brass, 8), 0, 0.07, 0);
}

// ----------------------------------------------------------------------------
// Walls: dark wainscot + cream plaster, doorway gap, windows
// ----------------------------------------------------------------------------

function wallPanel(env: Group, length: number, x: number, z: number, rotY: number): void {
  const g = new Group();
  // wainscot (lower third)
  g.add(box(length, 2, ROOM.wall, C.wainscot).translateY(1));
  // plaster (upper)
  g.add(box(length, ROOM.height - 2, ROOM.wall, C.plaster).translateY(2 + (ROOM.height - 2) / 2));
  // trim rail between them
  g.add(box(length, 0.2, ROOM.wall + 0.1, C.trim).translateY(2));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  env.add(g);
}

function windowOn(env: Group, x: number, z: number, rotY: number): void {
  const g = new Group();
  g.add(box(1.7, 2.1, 0.08, C.windowGlow)); // warm glow pane
  g.add(box(1.9, 0.18, 0.16, C.trim).translateY(1.05));
  g.add(box(1.9, 0.18, 0.16, C.trim).translateY(-1.05));
  g.add(box(0.18, 2.3, 0.16, C.trim).translateX(0.85));
  g.add(box(0.18, 2.3, 0.16, C.trim).translateX(-0.85));
  g.add(box(1.7, 0.1, 0.16, C.trim)); // muntin
  g.add(box(0.1, 2.1, 0.16, C.trim));
  g.position.set(x, 3.1, z);
  g.rotation.y = rotY;
  env.add(g);
}

function buildWalls(env: Group): void {
  const h = ROOM.half;

  // Back (north, -Z) and side walls are solid.
  wallPanel(env, h * 2, 0, -h, 0);
  wallPanel(env, h * 2, -h, 0, Math.PI / 2);
  wallPanel(env, h * 2, h, 0, Math.PI / 2);

  // Front (south, +Z) wall split around the doorway.
  const sideLen = h - DOOR.halfWidth;
  wallPanel(env, sideLen, -(DOOR.halfWidth + sideLen / 2), h, 0);
  wallPanel(env, sideLen, DOOR.halfWidth + sideLen / 2, h, 0);
  // Header above the doors.
  place(
    env,
    box(DOOR.halfWidth * 2 + 0.2, ROOM.height - DOOR.height, ROOM.wall, C.plaster),
    0,
    DOOR.height + (ROOM.height - DOOR.height) / 2,
    h,
  );

  // SALOON sign plank above the entrance.
  place(env, box(3.2, 0.7, 0.18, C.trim), 0, 2.55, h - 0.2);
  place(env, box(2.9, 0.45, 0.06, C.cream), 0, 2.55, h - 0.31);

  // Windows on the side walls.
  windowOn(env, -h + 0.18, -4, Math.PI / 2);
  windowOn(env, -h + 0.18, 4, Math.PI / 2);
  windowOn(env, h - 0.18, -4, Math.PI / 2);
  windowOn(env, h - 0.18, 4, Math.PI / 2);
}

// ----------------------------------------------------------------------------
// Ceiling + exposed beams
// ----------------------------------------------------------------------------

function buildCeiling(env: Group): void {
  place(env, box(ROOM.half * 2, 0.3, ROOM.half * 2, C.plasterAlt), 0, ROOM.height, 0);
  const beamMat = paper(C.beam);
  for (let i = -2; i <= 2; i++) {
    place(env, box(0.3, 0.4, ROOM.half * 2, beamMat), i * 3.5, ROOM.height - 0.35, 0);
  }
}

// ----------------------------------------------------------------------------
// Balcony / mezzanine around three sides, with stairs
// ----------------------------------------------------------------------------

function railing(length: number): Group {
  const g = new Group();
  g.add(box(length, 0.12, 0.12, C.trim).translateY(0.6)); // top rail
  g.add(box(length, 0.12, 0.12, C.trim).translateY(0.05)); // bottom rail
  const count = Math.floor(length / 0.4);
  const balMat = paper(C.beam);
  for (let i = 0; i <= count; i++) {
    const x = -length / 2 + (i / count) * length;
    g.add(box(0.08, 0.55, 0.08, balMat).translateX(x).translateY(0.32));
  }
  return g;
}

function buildBalcony(env: Group): void {
  const h = ROOM.half;
  const y = ROOM.balconyY;
  const depth = ROOM.balconyDepth;
  const deckMat = paper(C.floorAlt);

  // Decks: north, east, west (leave the entrance side open).
  place(env, box(h * 2, 0.2, depth, deckMat), 0, y, -h + depth / 2);
  place(env, box(depth, 0.2, h * 2, deckMat), h - depth / 2, y, 0);
  place(env, box(depth, 0.2, h * 2, deckMat), -h + depth / 2, y, 0);

  // Inner railings.
  const rN = railing(h * 2);
  place(env, rN, 0, y + 0.1, -h + depth);
  const rE = railing(h * 2);
  rE.rotation.y = Math.PI / 2;
  place(env, rE, h - depth, y + 0.1, 0);
  const rW = railing(h * 2);
  rW.rotation.y = Math.PI / 2;
  place(env, rW, -h + depth, y + 0.1, 0);

  // Support posts down to the floor along the inner balcony edge.
  const postMat = paper(C.beam);
  const postXs = [-6, -3, 0, 3, 6];
  for (const x of postXs) {
    place(env, post(0.2, 0.22, y, postMat, 8), x, y / 2, -h + depth);
  }
  for (const z of [-6, -3, 0, 3, 6]) {
    place(env, post(0.2, 0.22, y, postMat, 8), h - depth, y / 2, z);
    place(env, post(0.2, 0.22, y, postMat, 8), -h + depth, y / 2, z);
  }

  // Staircase up the west wall to the balcony.
  const steps = 10;
  const stairMat = paper(C.wainscot);
  for (let i = 0; i < steps; i++) {
    const sy = (i + 1) * (y / steps) - y / (2 * steps);
    const sz = 6 - i * 0.6;
    place(env, box(1.8, y / steps, 0.6, stairMat), -h + 1.1, sy, sz);
  }
  // Stair railing posts.
  for (let i = 0; i <= steps; i += 2) {
    const sy = i * (y / steps);
    const sz = 6.3 - i * 0.6;
    place(env, post(0.07, 0.07, 0.9, postMat, 6), -h + 2.1, sy + 0.45, sz);
  }
}

// ----------------------------------------------------------------------------
// Bar: counter, foot rail, back-bar shelves of bottles, big mirror
// ----------------------------------------------------------------------------

function bottle(color: string): Group {
  const g = new Group();
  g.add(post(0.05, 0.07, 0.28, color, 6).translateY(0.14)); // body
  g.add(post(0.025, 0.04, 0.12, color, 6).translateY(0.34)); // neck
  return g;
}

function buildBar(env: Group): void {
  const z = -ROOM.half + 1.4;
  const len = 9;

  // Counter body + overhanging top.
  place(env, box(len, 1.1, 0.7, C.bar), 0, 0.55, z + 0.6);
  place(env, box(len + 0.3, 0.12, 0.9, C.barTop), 0, 1.16, z + 0.6);
  // Brass foot rail.
  place(env, post(0.04, 0.04, len, C.brass, 6).rotateZ(Math.PI / 2), 0, 0.15, z + 0.95);

  // Back-bar cabinet against the wall.
  place(env, box(len, 2.6, 0.4, C.wainscot), 0, 1.3, z - 0.4);
  // Big mirror.
  place(env, box(len - 2, 1.8, 0.06, C.mirror), 0, 1.7, z - 0.18);
  place(env, box(len - 1.8, 0.14, 0.12, C.brass), 0, 2.65, z - 0.2);

  // Two shelves of faceted bottles.
  const colors = [C.green, C.amber, C.red, C.blue, C.cream];
  for (const shelfY of [0.95, 1.5]) {
    place(env, box(len - 2.2, 0.08, 0.28, C.beam), 0, shelfY - 0.05, z - 0.28);
    for (let i = 0; i < 18; i++) {
      const b = bottle(colors[i % colors.length]);
      place(env, b, -3.4 + i * 0.4, shelfY, z - 0.28);
    }
  }
}

// ----------------------------------------------------------------------------
// Stage with an upright papercraft piano (back-left corner)
// ----------------------------------------------------------------------------

function buildStage(env: Group): void {
  const x = -ROOM.half + 2.6;
  const z = -ROOM.half + 3.4;
  place(env, box(4.5, 0.4, 3.5, C.wainscot), x, 0.2, z);
  place(env, box(4.7, 0.1, 3.7, C.barTop), x, 0.42, z);

  // Upright piano.
  const piano = new Group();
  piano.add(box(1.6, 1.2, 0.6, C.trim).translateY(0.6));
  piano.add(box(1.7, 0.15, 0.7, C.beam).translateY(1.25));
  piano.add(box(1.4, 0.12, 0.35, C.cream).translateY(0.78).translateZ(0.28)); // keys
  piano.position.set(x - 0.8, 0.4, z - 0.8);
  piano.rotation.y = 0.5;
  env.add(piano);
  // Stool.
  place(env, post(0.25, 0.25, 0.5, C.beam, 8), x + 0.1, 0.65, z - 0.4);
}

// ----------------------------------------------------------------------------
// Edge furniture: poker tables, stools, barrels (kept out of the arena circle)
// ----------------------------------------------------------------------------

function pokerTable(): Group {
  const g = new Group();
  g.add(post(0.7, 0.7, 0.1, C.beam, 8).translateY(0.74)); // table rim
  g.add(post(0.62, 0.62, 0.04, C.felt, 8).translateY(0.8)); // felt top
  g.add(post(0.12, 0.16, 0.74, C.wainscot, 6).translateY(0.37)); // pedestal
  g.add(post(0.5, 0.5, 0.06, C.wainscot, 6).translateY(0.03)); // base
  return g;
}

function stool(): Group {
  const g = new Group();
  g.add(post(0.22, 0.22, 0.08, C.beam, 8).translateY(0.5));
  g.add(post(0.04, 0.05, 0.5, C.wainscot, 6).translateY(0.25));
  return g;
}

function barrel(): Group {
  const g = new Group();
  g.add(post(0.32, 0.28, 0.85, C.bar, 8).translateY(0.42));
  g.add(post(0.34, 0.34, 0.06, C.brass, 8).translateY(0.2));
  g.add(post(0.34, 0.34, 0.06, C.brass, 8).translateY(0.64));
  return g;
}

function buildFurniture(env: Group): void {
  // Poker tables with stools, tucked between the arena and the side walls.
  const tableSpots: Array<[number, number]> = [
    [6.5, -5],
    [6.5, 2],
    [-6.5, 5],
    [-6.5, -2],
    [0, 6.6],
  ];
  for (const [x, z] of tableSpots) {
    place(env, pokerTable(), x, 0, z);
    place(env, stool(), x + 1, 0, z);
    place(env, stool(), x - 1, 0, z);
  }

  // Barrels clustered near the corners.
  const barrelSpots: Array<[number, number]> = [
    [7.6, 7.6],
    [7.0, 7.6],
    [-7.6, 7.6],
  ];
  for (const [x, z] of barrelSpots) {
    place(env, barrel(), x, 0, z);
  }
}

// ----------------------------------------------------------------------------
// Hanging chandeliers (these carry the warm key lights)
// ----------------------------------------------------------------------------

function buildChandeliers(env: Group): void {
  const spots: Array<[number, number]> = [
    [-3.2, 0],
    [3.2, 0],
  ];
  for (const [x, z] of spots) {
    const ch = new Group();
    ch.add(box(0.06, 2.3, 0.06, C.beam).translateY(1.15)); // chain to ceiling
    ch.add(post(0.6, 0.6, 0.08, C.trim, 8)); // wheel
    ch.add(post(0.55, 0.55, 0.05, C.beam, 8).translateY(0.02));
    // candles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cx = Math.cos(a) * 0.5;
      const cz = Math.sin(a) * 0.5;
      ch.add(post(0.04, 0.05, 0.18, C.cream, 6).translateX(cx).translateY(0.13).translateZ(cz));
      ch.add(post(0.0, 0.045, 0.1, C.windowGlow, 6).translateX(cx).translateY(0.27).translateZ(cz));
    }
    ch.position.set(x, 4.5, z);
    env.add(ch);

    const light = new PointLight(0xffd9a0, 22, 18, 2);
    light.position.set(x, 4.3, z);
    env.add(light);
  }
}

// ----------------------------------------------------------------------------
// Ambient / fill lighting
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  env.add(new HemisphereLight(0xfff2d8, 0x3a2a1c, 0.55));
  env.add(new AmbientLight(0xffe9c8, 0.25));

  // Warm spot washing the central arena from above.
  const spot = new SpotLight(0xfff0d0, 30, 30, Math.PI / 4, 0.5, 1.5);
  spot.position.set(0, ROOM.height - 0.5, 0);
  const target = new Object3D();
  target.position.set(0, 0, 0);
  env.add(target);
  spot.target = target;
  env.add(spot);

  // A cool dusk glow leaking through each window.
  for (const x of [-ROOM.half + 0.5, ROOM.half - 0.5]) {
    for (const z of [-4, 4]) {
      const l = new PointLight(0xffe2a0, 4, 7, 2);
      l.position.set(x, 3.1, z);
      env.add(l);
    }
  }
}

// ----------------------------------------------------------------------------
// Batwing doors (animated by BatwingSystem in ./doors.ts)
// ----------------------------------------------------------------------------

function batwingPanel(): Group {
  // A louvered half-door: top & bottom rails with horizontal slats between.
  const g = new Group();
  const w = DOOR.halfWidth - 0.05;
  const mat = paper('#6a4a2a');
  g.add(box(w, 0.12, 0.08, mat).translateX(w / 2).translateY(1.9)); // top rail
  g.add(box(w, 0.12, 0.08, mat).translateX(w / 2).translateY(0.9)); // bottom rail
  for (let i = 0; i < 6; i++) {
    g.add(box(w - 0.1, 0.1, 0.05, mat).translateX(w / 2).translateY(1.05 + i * 0.15));
  }
  return g;
}

function buildDoors(world: World): void {
  const z = ROOM.half - 0.1;

  // Hinge posts on each side of the doorway.
  // Left door: hinge at -halfWidth, panel swings into the gap.
  const left = new Group();
  left.add(batwingPanel());
  left.position.set(-DOOR.halfWidth, 0, z);
  left.userData.sign = 1;
  left.userData.cur = 0;
  world.createTransformEntity(left).addComponent(Batwing);

  // Right door: hinge at +halfWidth, mirrored.
  const right = new Group();
  const rp = batwingPanel();
  rp.scale.x = -1; // mirror so slats extend toward the center
  right.add(rp);
  right.position.set(DOOR.halfWidth, 0, z);
  right.userData.sign = -1;
  right.userData.cur = 0;
  world.createTransformEntity(right).addComponent(Batwing);
}

// ----------------------------------------------------------------------------
// Grabbable props the player can pick up around the arena
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  const barZ = -ROOM.half + 1.4 + 0.6;

  // A whiskey bottle and a glass on the bar.
  grabbable(world, bottle(C.amber), -1.5, 1.25, barZ);
  grabbable(world, post(0.05, 0.04, 0.12, C.cream, 6), -1.1, 1.25, barZ);

  // A short stack of poker chips on the nearest table.
  const chips = new Group();
  const chipColors = [C.red, C.blue, C.cream, C.green];
  for (let i = 0; i < 5; i++) {
    chips.add(post(0.06, 0.06, 0.02, chipColors[i % chipColors.length], 12).translateY(i * 0.022));
  }
  grabbable(world, chips, 6.5, 0.86, -5);

  // A sheriff's star badge resting on the arena emblem.
  const badge = new Group();
  badge.add(post(0.12, 0.12, 0.02, C.brass, 5).translateY(0.01));
  badge.add(post(0.05, 0.05, 0.025, C.cream, 5).translateY(0.02));
  grabbable(world, badge, 0, 0.12, 1.5);
}
