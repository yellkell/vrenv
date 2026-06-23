/**
 * factory.ts
 *
 * Procedurally builds a big papercraft industrial factory floor and wires it
 * into an IWSDK world. Like the rest of the project it's folded entirely out of
 * flat-shaded Three.js primitives (see ./papercraft.ts) — no external assets.
 *
 * The room is deliberately huge with a wide-open central work floor so games
 * built on top get a real arena. Around the edges sit factory dressing
 * (conveyors, machines, pallet racking, drums, a gantry crane), and a steel
 * catwalk / mezzanine wraps three walls — the same balcony idea as before, now
 * industrial grating and yellow handrails.
 *
 * Layout (looking down, +Z is the entrance, -Z is the back wall):
 *
 *        -Z  ┌──────── racking / machines ────────┐
 *            │   catwalk runs along N / E / W      │
 *            │                                     │
 *            │        ( open work floor )          │
 *            │          ⚙ gear emblem              │
 *            │                                     │
 *        +Z  └──────────  ⇤ bay doors ⇥ ──────────┘
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
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PointLight,
} from 'three';
import { BayDoor } from './doors.js';
import { box, paper, place, post } from './papercraft.js';

// ----------------------------------------------------------------------------
// Dimensions & palette
// ----------------------------------------------------------------------------

const ROOM = {
  half: 18, // interior half-extent (36m x 36m footprint)
  height: 11,
  wall: 0.4,
  catwalkY: 5, // mezzanine height
  catwalkDepth: 2.6,
};

const BAY = {
  halfWidth: 3.5, // 7m-wide vehicle bay doorway
  height: 5,
};

// Keep equipment outside this central square so the work floor stays open.
const WORK_HALF = 9;

const C = {
  concrete: '#9b9b92',
  concreteAlt: '#8d8d83',
  hazard: '#e6c233',
  hazardDark: '#1d1d1d',
  steel: '#70757a',
  steelDark: '#4a4e52',
  steelLight: '#9aa0a5',
  wall: '#b1b6ba',
  wallRib: '#a2a7ab',
  wainscot: '#565b5f',
  trim: '#33373c',
  rail: '#e0b016',
  grating: '#646a6e',
  machine: '#3b6781',
  machineBody: '#7c8186',
  screen: '#1b2a33',
  crate: '#b9824a',
  crateAlt: '#a06a36',
  drumRed: '#bd4633',
  drumBlue: '#37618f',
  drumYellow: '#d2a531',
  pipe: '#878c90',
  pipeHot: '#a8593a',
  window: '#bcdfeb',
  panel: '#2b2f35',
  led: '#7ee0a0',
  ledRed: '#e06a5a',
  exterior: '#454e58',
};

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

/** Builds the whole factory floor and registers it with the world. */
export function buildFactory(world: World): void {
  const env = new Group();
  env.name = 'PapercraftFactory';

  buildShell(env);
  buildFloor(env);
  buildWalls(env);
  buildRoof(env);
  buildColumns(env);
  buildCatwalk(env);
  buildConveyors(env);
  buildMachines(env);
  buildRacking(env);
  buildClutter(env);
  buildGantryCrane(env);
  buildPipes(env);
  buildHighBayLights(env);
  buildLights(env);

  // The static set is one locomotion environment so teleport / smooth
  // locomotion can use its floor and surfaces as walkable geometry.
  world
    .createTransformEntity(env)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // Moving / grabbable pieces are their own entities.
  buildDoors(world);
  buildProps(world);
}

// ----------------------------------------------------------------------------
// Cool exterior backdrop visible through windows & the bay doors
// ----------------------------------------------------------------------------

function buildShell(env: Group): void {
  const shell = new Mesh(
    new BoxGeometry(120, 80, 120),
    new MeshBasicMaterial({ color: C.exterior, side: BackSide }),
  );
  shell.position.set(0, 20, 0);
  env.add(shell);
}

// ----------------------------------------------------------------------------
// Floor: concrete slab + painted safety lanes + central gear emblem
// ----------------------------------------------------------------------------

function buildFloor(env: Group): void {
  const span = ROOM.half * 2;

  // Concrete slab in two-tone tiles for a poured-bay look.
  const tile = 6;
  const matA = paper(C.concrete, { roughness: 0.98 });
  const matB = paper(C.concreteAlt, { roughness: 0.98 });
  for (let ix = 0; ix < span / tile; ix++) {
    for (let iz = 0; iz < span / tile; iz++) {
      const x = -ROOM.half + tile / 2 + ix * tile;
      const z = -ROOM.half + tile / 2 + iz * tile;
      place(env, box(tile * 0.99, 0.2, tile * 0.99, (ix + iz) % 2 ? matA : matB), x, -0.1, z);
    }
  }

  // Yellow safety lane outlining the central work zone.
  const lane = paper(C.hazard);
  const L = WORK_HALF;
  for (const [w, d, x, z] of [
    [L * 2, 0.2, 0, -L],
    [L * 2, 0.2, 0, L],
    [0.2, L * 2, -L, 0],
    [0.2, L * 2, L, 0],
  ] as Array<[number, number, number, number]>) {
    place(env, box(w, 0.04, d, lane), x, 0.02, z);
  }

  // Hazard chevrons in front of the bay doors.
  const chevron = paper(C.hazardDark);
  for (let i = -3; i <= 3; i++) {
    const c = box(0.6, 0.04, 2.2, chevron);
    c.rotation.y = Math.PI / 4;
    place(env, c, i * 1.0, 0.03, ROOM.half - 4);
  }

  // Central gear emblem (a faceted hub with teeth).
  place(env, post(2.4, 2.4, 0.05, C.steelDark, 12), 0, 0.04, 0);
  place(env, post(2.0, 2.0, 0.06, C.steel, 12), 0, 0.05, 0);
  const tooth = paper(C.steelDark);
  for (let i = 0; i < 12; i++) {
    const t = box(0.5, 0.07, 0.7, tooth);
    t.rotation.y = (i / 12) * Math.PI * 2;
    t.position.set(Math.sin((i / 12) * Math.PI * 2) * 2.3, 0.05, Math.cos((i / 12) * Math.PI * 2) * 2.3);
    env.add(t);
  }
  place(env, post(0.6, 0.6, 0.08, C.hazard, 8), 0, 0.07, 0);
}

// ----------------------------------------------------------------------------
// Walls: ribbed metal cladding + clerestory windows + bay-door opening
// ----------------------------------------------------------------------------

function claddedWall(env: Group, length: number, x: number, z: number, rotY: number): void {
  const g = new Group();
  // dark base / wainscot
  g.add(box(length, 1.4, ROOM.wall, C.wainscot).translateY(0.7));
  // main panel
  g.add(box(length, ROOM.height - 1.4, ROOM.wall, C.wall).translateY(1.4 + (ROOM.height - 1.4) / 2));
  // vertical ribs
  const ribMat = paper(C.wallRib);
  const ribs = Math.floor(length / 1.5);
  for (let i = 0; i <= ribs; i++) {
    const rx = -length / 2 + (i / ribs) * length;
    g.add(box(0.12, ROOM.height - 1.6, 0.08, ribMat).translateX(rx).translateY(ROOM.height / 2 + 0.2).translateZ(ROOM.wall / 2));
  }
  // eave trim
  g.add(box(length, 0.3, ROOM.wall + 0.15, C.trim).translateY(ROOM.height - 0.15));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  env.add(g);
}

function clerestory(env: Group, length: number, x: number, z: number, rotY: number): void {
  // A continuous band of high windows just under the eaves.
  const g = new Group();
  const panes = Math.floor(length / 2.2);
  const glass = paper(C.window, { roughness: 0.4 });
  for (let i = 0; i < panes; i++) {
    const px = -length / 2 + length / panes / 2 + (i / panes) * length;
    g.add(box(length / panes - 0.2, 1.4, 0.1, glass).translateX(px));
    g.add(box(0.12, 1.6, 0.16, C.trim).translateX(px - length / panes / 2));
  }
  g.add(box(length, 0.16, 0.18, C.trim).translateY(0.8));
  g.add(box(length, 0.16, 0.18, C.trim).translateY(-0.8));
  g.position.set(x, ROOM.height - 1.6, z);
  g.rotation.y = rotY;
  env.add(g);
}

function buildWalls(env: Group): void {
  const h = ROOM.half;

  // Back (north) and side walls are solid.
  claddedWall(env, h * 2, 0, -h, 0);
  claddedWall(env, h * 2, -h, 0, Math.PI / 2);
  claddedWall(env, h * 2, h, 0, Math.PI / 2);

  // Front (south) wall split around the bay doorway.
  const sideLen = h - BAY.halfWidth;
  claddedWall(env, sideLen, -(BAY.halfWidth + sideLen / 2), h, 0);
  claddedWall(env, sideLen, BAY.halfWidth + sideLen / 2, h, 0);
  // Header above the bay doors.
  place(
    env,
    box(BAY.halfWidth * 2 + 0.4, ROOM.height - BAY.height, ROOM.wall, C.wall),
    0,
    BAY.height + (ROOM.height - BAY.height) / 2,
    h,
  );

  // Clerestory windows along the three solid walls.
  clerestory(env, h * 2 - 1, 0, -h + 0.1, 0);
  clerestory(env, h * 2 - 1, -h + 0.1, 0, Math.PI / 2);
  clerestory(env, h * 2 - 1, h - 0.1, 0, Math.PI / 2);

  // Factory name board above the entrance.
  place(env, box(6, 1.0, 0.2, C.trim), 0, BAY.height + 0.7, h - 0.3);
  place(env, box(5.4, 0.6, 0.06, C.hazard), 0, BAY.height + 0.7, h - 0.42);
}

// ----------------------------------------------------------------------------
// Roof: sawtooth-ish trusses under a flat deck
// ----------------------------------------------------------------------------

function truss(span: number): Group {
  const g = new Group();
  const chord = paper(C.steelDark);
  g.add(box(span, 0.18, 0.18, chord)); // bottom chord
  g.add(box(span, 0.18, 0.18, chord).translateY(1.1)); // top chord
  const bays = Math.floor(span / 2);
  for (let i = 0; i <= bays; i++) {
    const x = -span / 2 + (i / bays) * span;
    g.add(box(0.1, 1.1, 0.1, chord).translateX(x).translateY(0.55)); // vertical
    if (i < bays) {
      const diag = box(0.08, 1.35, 0.08, chord);
      diag.position.set(x + span / bays / 2, 0.55, 0);
      diag.rotation.z = 0.7;
      g.add(diag);
    }
  }
  return g;
}

function buildRoof(env: Group): void {
  // Flat roof deck.
  place(env, box(ROOM.half * 2, 0.3, ROOM.half * 2, C.steelDark), 0, ROOM.height, 0);
  // Trusses spanning X at intervals along Z.
  for (let i = -3; i <= 3; i++) {
    const t = truss(ROOM.half * 2);
    place(env, t, 0, ROOM.height - 1.5, i * 4.5);
  }
}

// ----------------------------------------------------------------------------
// Steel I-beam columns ringing the work floor (carry catwalk + roof)
// ----------------------------------------------------------------------------

function iBeam(height: number, color = C.steel): Group {
  const g = new Group();
  const mat = paper(color);
  g.add(box(0.07, height, 0.3, mat)); // web
  g.add(box(0.36, height, 0.07, mat).translateZ(0.15)); // flange
  g.add(box(0.36, height, 0.07, mat).translateZ(-0.15)); // flange
  // base + cap plates
  g.add(box(0.5, 0.08, 0.5, C.steelDark).translateY(-height / 2 + 0.04));
  g.add(box(0.5, 0.08, 0.5, C.steelDark).translateY(height / 2 - 0.04));
  return g;
}

function buildColumns(env: Group): void {
  const inner = ROOM.half - ROOM.catwalkDepth;
  const h = ROOM.height;
  const positions: Array<[number, number, number]> = [];

  // Along the three catwalk walls.
  for (let i = -3; i <= 3; i++) {
    positions.push([i * 4.5, 0, -inner]); // north line
  }
  for (let i = -2; i <= 3; i++) {
    positions.push([-inner, 0, i * 4.5]); // west line
    positions.push([inner, 0, i * 4.5]); // east line
  }

  for (const [x, , z] of positions) {
    place(env, iBeam(h), x, h / 2, z);
  }
}

// ----------------------------------------------------------------------------
// Catwalk / mezzanine — the "balcony", now steel grating + yellow handrails
// ----------------------------------------------------------------------------

function handrail(length: number): Group {
  const g = new Group();
  const mat = paper(C.rail);
  g.add(box(length, 0.08, 0.08, mat).translateY(1.1)); // top rail
  g.add(box(length, 0.08, 0.08, mat).translateY(0.55)); // mid rail
  g.add(box(length, 0.18, 0.04, C.trim).translateY(0.09)); // toe board
  const count = Math.floor(length / 1.4);
  for (let i = 0; i <= count; i++) {
    const x = -length / 2 + (i / count) * length;
    g.add(box(0.07, 1.15, 0.07, mat).translateX(x).translateY(0.57)); // post
  }
  return g;
}

function buildCatwalk(env: Group): void {
  const h = ROOM.half;
  const y = ROOM.catwalkY;
  const depth = ROOM.catwalkDepth;
  const deck = paper(C.grating, { roughness: 0.9 });

  // North run spans the full width; the side runs start exactly where it ends,
  // so the three decks butt together at the corners with no overlap.
  const sideLen = h * 2 - depth;
  const sideCenterZ = depth / 2; // midpoint of [-h+depth, h]

  place(env, box(h * 2, 0.18, depth, deck), 0, y, -h + depth / 2);
  place(env, box(depth, 0.18, sideLen, deck), h - depth / 2, y, sideCenterZ);
  place(env, box(depth, 0.18, sideLen, deck), -h + depth / 2, y, sideCenterZ);

  // Inner handrails. The north rail stops short of each corner so you can step
  // onto the side runs; the side rails cover their full inner edge.
  const rN = handrail(h * 2 - 2 * depth);
  place(env, rN, 0, y + 0.09, -h + depth);
  const rE = handrail(sideLen);
  rE.rotation.y = Math.PI / 2;
  place(env, rE, h - depth, y + 0.09, sideCenterZ);
  const rW = handrail(sideLen);
  rW.rotation.y = Math.PI / 2;
  place(env, rW, -h + depth, y + 0.09, sideCenterZ);

  // Under-deck support brackets at the wall.
  const bracket = paper(C.steelDark);
  for (let i = -3; i <= 3; i++) {
    place(env, box(depth, 0.16, 0.16, bracket), i * 4.5, y - 0.2, -h + depth / 2);
  }

  // Industrial switchback stair from the floor up to the west deck.
  buildStair(env, -h + 1.6, 0, y, 6, Math.PI);
}

function buildStair(env: Group, x: number, _z: number, topY: number, run: number, _rotY: number): void {
  const steps = 14;
  const stepMat = paper(C.steelDark);
  const railMat = paper(C.rail);
  for (let i = 0; i < steps; i++) {
    const sy = (i + 1) * (topY / steps) - topY / (2 * steps);
    const sz = run - (i / steps) * (run * 1.3);
    place(env, box(1.8, 0.08, 0.7, stepMat), x, sy, sz);
  }
  // Stringer handrails.
  for (let i = 0; i <= steps; i += 2) {
    const sy = i * (topY / steps);
    const sz = run + 0.35 - (i / steps) * (run * 1.3);
    place(env, box(0.06, 1.0, 0.06, railMat), x + 0.95, sy + 0.5, sz);
    place(env, box(0.06, 1.0, 0.06, railMat), x - 0.95, sy + 0.5, sz);
  }
}

// ----------------------------------------------------------------------------
// Conveyor belts
// ----------------------------------------------------------------------------

function conveyor(length: number): Group {
  const g = new Group();
  g.add(box(length, 0.12, 0.9, C.steel).translateY(0.9)); // frame
  g.add(box(length - 0.2, 0.06, 0.78, C.trim).translateY(0.99)); // belt
  // rollers
  const roller = paper(C.steelLight);
  for (let i = 0; i <= length; i += 0.6) {
    g.add(post(0.06, 0.06, 0.84, roller, 8).translateX(-length / 2 + i).translateY(1.0).rotateX(Math.PI / 2));
  }
  // legs
  for (const lx of [-length / 2 + 0.5, 0, length / 2 - 0.5]) {
    g.add(box(0.12, 0.9, 0.12, C.steelDark).translateX(lx).translateY(0.45).translateZ(0.35));
    g.add(box(0.12, 0.9, 0.12, C.steelDark).translateX(lx).translateY(0.45).translateZ(-0.35));
  }
  // a couple of crates riding the belt
  for (const cx of [-length / 3, length / 4]) {
    g.add(box(0.5, 0.5, 0.5, C.crate).translateX(cx).translateY(1.27));
  }
  return g;
}

function buildConveyors(env: Group): void {
  const c1 = conveyor(8);
  place(env, c1, 11, 0, -6);
  const c2 = conveyor(8);
  c2.rotation.y = Math.PI / 2;
  place(env, c2, -12, 0, 5);
}

// ----------------------------------------------------------------------------
// Machines with control panels
// ----------------------------------------------------------------------------

function machine(): Group {
  const g = new Group();
  g.add(box(1.8, 1.6, 1.2, C.machineBody).translateY(0.8)); // body
  g.add(box(1.9, 0.2, 1.3, C.steelDark).translateY(1.7)); // top
  g.add(box(0.9, 1.0, 0.1, C.panel).translateX(1.0).translateY(1.0)); // control panel
  g.add(box(0.7, 0.4, 0.06, C.screen).translateX(1.04).translateY(1.25)); // screen
  // buttons
  g.add(post(0.06, 0.06, 0.06, C.led, 8).translateX(1.05).translateY(0.95).rotateX(Math.PI / 2));
  g.add(post(0.06, 0.06, 0.06, C.ledRed, 8).translateX(1.05).translateY(0.78).rotateX(Math.PI / 2));
  // a stack light
  g.add(post(0.08, 0.08, 0.5, C.steelDark, 8).translateX(-0.7).translateY(2.0));
  g.add(post(0.1, 0.1, 0.14, C.ledRed, 8).translateX(-0.7).translateY(2.15));
  return g;
}

function buildMachines(env: Group): void {
  for (const [x, z, r] of [
    [13, 6, -Math.PI / 2],
    [13, 11, -Math.PI / 2],
    [-13, -7, Math.PI / 2],
  ] as Array<[number, number, number]>) {
    const m = machine();
    m.rotation.y = r;
    place(env, m, x, 0, z);
  }
}

// ----------------------------------------------------------------------------
// Pallet racking with crates
// ----------------------------------------------------------------------------

function palletRack(bays: number): Group {
  const g = new Group();
  const upright = paper(C.machine);
  const beam = paper(C.pipeHot);
  const bayW = 2.4;
  const totalW = bays * bayW;
  const height = 4.2;
  // uprights
  for (let i = 0; i <= bays; i++) {
    const x = -totalW / 2 + i * bayW;
    g.add(box(0.14, height, 1.1, upright).translateX(x).translateY(height / 2));
  }
  // shelf beams + crates at two levels
  for (const sy of [1.4, 2.8]) {
    g.add(box(totalW, 0.12, 0.1, beam).translateY(sy).translateZ(0.45));
    g.add(box(totalW, 0.12, 0.1, beam).translateY(sy).translateZ(-0.45));
    for (let b = 0; b < bays; b++) {
      const cx = -totalW / 2 + bayW / 2 + b * bayW;
      g.add(box(1.8, 1.0, 0.9, b % 2 ? C.crate : C.crateAlt).translateX(cx).translateY(sy + 0.55));
    }
  }
  return g;
}

function buildRacking(env: Group): void {
  const rack = palletRack(5);
  place(env, rack, 0, 0, -ROOM.half + 1.4);

  const rack2 = palletRack(4);
  rack2.rotation.y = Math.PI / 2;
  place(env, rack2, ROOM.half - 1.4, 0, -12);
}

// ----------------------------------------------------------------------------
// Loose clutter: stacked crates, pallets, oil drums
// ----------------------------------------------------------------------------

function pallet(): Group {
  const g = new Group();
  const mat = paper(C.crateAlt);
  g.add(box(1.2, 0.06, 1.0, mat).translateY(0.14));
  for (const lx of [-0.5, 0, 0.5]) {
    g.add(box(0.16, 0.14, 1.0, mat).translateX(lx).translateY(0.07));
  }
  return g;
}

function drum(color: string): Group {
  const g = new Group();
  g.add(post(0.32, 0.32, 0.9, color, 10).translateY(0.45));
  g.add(post(0.34, 0.34, 0.05, C.steelDark, 10).translateY(0.25));
  g.add(post(0.34, 0.34, 0.05, C.steelDark, 10).translateY(0.65));
  return g;
}

function buildClutter(env: Group): void {
  // Crate + pallet stacks near the corners.
  const stacks: Array<[number, number]> = [
    [15, 14],
    [-15, 13],
    [-15, -14],
  ];
  for (const [x, z] of stacks) {
    place(env, pallet(), x, 0, z);
    place(env, box(1.0, 1.0, 1.0, C.crate), x, 0.65, z);
    place(env, box(0.8, 0.8, 0.8, C.crateAlt), x + 0.1, 1.55, z);
    place(env, box(1.0, 1.0, 1.0, C.crate), x + 1.3, 0.65, z);
  }

  // A cluster of oil drums.
  const drumColors = [C.drumRed, C.drumBlue, C.drumYellow];
  const drumSpots: Array<[number, number]> = [
    [16, -13],
    [16.7, -13],
    [16.3, -13.7],
    [15.6, -13.5],
  ];
  drumSpots.forEach(([x, z], i) => place(env, drum(drumColors[i % 3]), x, 0, z));
}

// ----------------------------------------------------------------------------
// Overhead gantry crane spanning the floor
// ----------------------------------------------------------------------------

function buildGantryCrane(env: Group): void {
  const y = 7.2;
  const span = ROOM.half * 2 - 2;
  // bridge girder
  place(env, box(span, 0.5, 0.7, C.rail), 0, y, -2);
  place(env, box(span, 0.2, 0.9, C.steelDark), 0, y + 0.3, -2);
  // end trucks
  place(env, box(1.2, 0.7, 1.4, C.steelDark), -span / 2, y, -2);
  place(env, box(1.2, 0.7, 1.4, C.steelDark), span / 2, y, -2);
  // trolley + hook block
  const trolley = new Group();
  trolley.add(box(1.0, 0.6, 1.0, C.machine).translateY(0));
  trolley.add(box(0.08, 2.4, 0.08, C.trim).translateY(-1.3)); // cable
  trolley.add(box(0.4, 0.4, 0.4, C.steelDark).translateY(-2.6)); // hook block
  trolley.add(post(0.06, 0.12, 0.4, C.steelLight, 6).translateY(-2.95)); // hook
  place(env, trolley, 3, y - 0.3, -2);
  // rails the crane rides on, atop the columns
  place(env, box(0.2, 0.2, ROOM.half * 2, C.steelDark), -ROOM.half + ROOM.catwalkDepth, y + 0.4, 0);
  place(env, box(0.2, 0.2, ROOM.half * 2, C.steelDark), ROOM.half - ROOM.catwalkDepth, y + 0.4, 0);
}

// ----------------------------------------------------------------------------
// Wall pipework
// ----------------------------------------------------------------------------

function buildPipes(env: Group): void {
  const z = -ROOM.half + 0.5;
  for (const [y, color] of [
    [3.6, C.pipe],
    [3.9, C.pipeHot],
    [4.2, C.pipe],
  ] as Array<[number, string]>) {
    place(env, post(0.1, 0.1, ROOM.half * 2 - 2, color, 8).rotateZ(Math.PI / 2), 0, y, z);
  }
  // a couple of vertical risers
  for (const x of [-6, 7]) {
    place(env, post(0.1, 0.1, 3.5, C.pipe, 8), x, 1.8, z);
  }
}

// ----------------------------------------------------------------------------
// Hanging high-bay light fixtures (carry the key lighting)
// ----------------------------------------------------------------------------

function buildHighBayLights(env: Group): void {
  const spots: Array<[number, number]> = [
    [-7, -7],
    [7, -7],
    [-7, 7],
    [7, 7],
    [0, 0],
  ];
  for (const [x, z] of spots) {
    const fx = new Group();
    fx.add(box(0.06, 1.4, 0.06, C.trim).translateY(0.7)); // drop rod
    fx.add(post(0.5, 0.32, 0.4, C.steelDark, 8)); // reflector shade
    fx.add(post(0.34, 0.34, 0.06, C.window, 8).translateY(-0.2)); // bright lens
    fx.position.set(x, ROOM.height - 2.2, z);
    env.add(fx);

    const light = new PointLight(0xeaf2ff, 26, 26, 2);
    light.position.set(x, ROOM.height - 2.6, z);
    env.add(light);
  }
}

// ----------------------------------------------------------------------------
// Ambient / fill lighting (big, bright industrial space)
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  env.add(new HemisphereLight(0xeaf1f7, 0x3a3e42, 0.7));
  env.add(new AmbientLight(0xffffff, 0.3));

  const key = new DirectionalLight(0xfff4e2, 0.5);
  key.position.set(8, 16, 10);
  env.add(key);

  // Cool glow leaking through the clerestory windows on three sides.
  for (const [x, z] of [
    [0, -ROOM.half + 0.6],
    [-ROOM.half + 0.6, 0],
    [ROOM.half - 0.6, 0],
  ] as Array<[number, number]>) {
    const l = new PointLight(0xbcdfeb, 6, 12, 2);
    l.position.set(x, ROOM.height - 1.6, z);
    env.add(l);
  }
}

// ----------------------------------------------------------------------------
// Sliding bay doors (animated by BayDoorSystem in ./doors.ts)
// ----------------------------------------------------------------------------

function bayLeaf(): Group {
  // A ribbed roll-up-style door leaf.
  const g = new Group();
  const mat = paper('#8a9094');
  g.add(box(BAY.halfWidth, BAY.height, 0.12, mat).translateY(BAY.height / 2));
  const ribMat = paper('#767c80');
  for (let i = 0; i < 9; i++) {
    g.add(box(BAY.halfWidth - 0.1, 0.12, 0.06, ribMat).translateY(0.4 + i * 0.55).translateZ(0.07));
  }
  // a small vision window strip
  g.add(box(BAY.halfWidth - 1.2, 0.5, 0.06, C.window).translateY(BAY.height - 1.0).translateZ(0.07));
  return g;
}

function buildDoors(world: World): void {
  const z = ROOM.half - 0.05;
  const closed = BAY.halfWidth / 2;
  const travel = BAY.halfWidth; // slides one full leaf-width into the wall

  // Left leaf: closed centered at -closed, slides to -(closed+travel).
  const left = new Group();
  left.add(bayLeaf());
  left.position.set(-closed, 0, z);
  left.userData = { closedX: -closed, openX: -closed - travel, doorwayZ: z, openRadius: 6 };
  world.createTransformEntity(left).addComponent(BayDoor);

  // Right leaf mirrored.
  const right = new Group();
  const rp = bayLeaf();
  rp.scale.x = -1;
  right.add(rp);
  right.position.set(closed, 0, z);
  right.userData = { closedX: closed, openX: closed + travel, doorwayZ: z, openRadius: 6 };
  world.createTransformEntity(right).addComponent(BayDoor);
}

// ----------------------------------------------------------------------------
// Grabbable props scattered around the floor
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  // A workbench to put tools on (static-looking but the tools are grabbable).
  // Wrench.
  const wrench = new Group();
  wrench.add(box(0.5, 0.07, 0.12, C.steelLight));
  wrench.add(post(0.1, 0.1, 0.1, C.steelLight, 6).translateX(0.28).rotateX(Math.PI / 2));
  grabbable(world, wrench, 1.5, 1.0, 4);

  // A gear.
  const gear = new Group();
  gear.add(post(0.2, 0.2, 0.1, C.steel, 8));
  for (let i = 0; i < 8; i++) {
    const t = box(0.08, 0.11, 0.1, C.steelDark);
    t.position.set(Math.sin((i / 8) * Math.PI * 2) * 0.22, 0, Math.cos((i / 8) * Math.PI * 2) * 0.22);
    gear.add(t);
  }
  grabbable(world, gear, -1.5, 1.0, 4);

  // A hard hat.
  const hat = new Group();
  hat.add(post(0.16, 0.18, 0.16, C.hazard, 8));
  hat.add(post(0.26, 0.26, 0.04, C.hazard, 8).translateY(-0.06));
  grabbable(world, hat, 0, 1.0, 5);

  // A crate.
  grabbable(world, box(0.45, 0.45, 0.45, C.crate), 6, 0.3, 8);

  // A loose oil drum.
  grabbable(world, drum(C.drumBlue), -6, 0.0, 8);
}
