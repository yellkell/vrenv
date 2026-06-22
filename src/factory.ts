/**
 * factory.ts
 *
 * Procedurally builds a big, *dilapidated* papercraft factory floor and wires it
 * into an IWSDK world. Like the rest of the project it's folded entirely out of
 * flat-shaded Three.js primitives (see ./papercraft.ts) — no external assets.
 *
 * The room is deliberately huge with a wide-open central work floor so games
 * built on top get a real arena. Around the edges sit abandoned factory
 * dressing (dead conveyors, broken machines, leaning racks, spilled drums,
 * rubble), and a rusted steel catwalk / mezzanine wraps three walls — its three
 * runs now meet cleanly at the corners instead of overlapping.
 *
 * Everything is run through a seeded weathering pass (`weather()`), so surfaces
 * are grimy, rust-streaked, and unevenly faded but stable build-to-build.
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
import { box, makeRng, paper, place, post, weather } from './papercraft.js';

// ----------------------------------------------------------------------------
// Dimensions, palette & weathering
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

// Keep big equipment outside this central square so the work floor stays open.
const WORK_HALF = 9;

// Grimy, faded, abandoned palette.
const C = {
  concrete: '#6f6e64',
  concreteAlt: '#5f5d53',
  hazard: '#8f7d2e', // faded paint
  hazardDark: '#16150f',
  steel: '#595650',
  steelDark: '#383631',
  steelLight: '#6f6a60',
  rust: '#7a4326',
  rustDark: '#532e1c',
  wall: '#797668',
  wallRib: '#6c695c',
  wainscot: '#3d3b35',
  trim: '#242320',
  rail: '#897019', // rusted safety yellow
  grating: '#46433d',
  machine: '#3b5460',
  machineBody: '#56534b',
  screen: '#15191b',
  crate: '#86603a',
  crateAlt: '#6b4c2c',
  drumRed: '#7a3a2d',
  drumBlue: '#37516a',
  drumYellow: '#897130',
  pipe: '#5b584f',
  pipeHot: '#6c3c29',
  window: '#7d96a0', // grimy glass
  windowBroken: '#1a1c1d',
  panel: '#202220',
  led: '#5d7a60',
  ledRed: '#7a4038',
  grime: '#1b1a16',
  oil: '#100f0d',
  moss: '#46502f',
  exterior: '#2a2e33', // dim overcast dusk
};

const rng = makeRng(0x5a10);
const rand = (min: number, max: number) => min + (max - min) * rng();

/** Flat-shaded material with a seeded grimy tint. */
function grimy(base: string, amount = 0.3, roughness = 0.96) {
  return paper(weather(base, rng, amount), { roughness });
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

/** Builds the whole dilapidated factory floor and registers it with the world. */
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
  buildDecay(env);
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
// Floor: cracked concrete + faded safety lanes + worn gear emblem
// ----------------------------------------------------------------------------

function buildFloor(env: Group): void {
  const span = ROOM.half * 2;

  // Concrete slab in weathered two-tone tiles.
  const tile = 6;
  for (let ix = 0; ix < span / tile; ix++) {
    for (let iz = 0; iz < span / tile; iz++) {
      const x = -ROOM.half + tile / 2 + ix * tile;
      const z = -ROOM.half + tile / 2 + iz * tile;
      const base = (ix + iz) % 2 ? C.concrete : C.concreteAlt;
      place(env, box(tile * 0.99, 0.2, tile * 0.99, grimy(base, 0.4)), x, -0.1, z);
    }
  }

  // Faded yellow safety lane outlining the central work zone (with worn gaps).
  const L = WORK_HALF;
  const lanes: Array<[number, number, number, number]> = [
    [L * 2, 0.2, 0, -L],
    [L * 2, 0.2, 0, L],
    [0.2, L * 2, -L, 0],
    [0.2, L * 2, L, 0],
  ];
  for (const [w, d, x, z] of lanes) {
    // break each lane into worn dashes; skip some to look scuffed away.
    const along = Math.max(w, d);
    const horiz = w > d;
    const dashes = Math.floor(along / 1.4);
    for (let i = 0; i < dashes; i++) {
      if (rng() < 0.35) continue; // scuffed off
      const t = -along / 2 + 0.7 + i * 1.4;
      const dx = horiz ? x + t : x;
      const dz = horiz ? z : z + t;
      place(env, box(horiz ? 1.0 : 0.2, 0.04, horiz ? 0.2 : 1.0, grimy(C.hazard, 0.45)), dx, 0.02, dz);
    }
  }

  // Worn central gear emblem.
  place(env, post(2.4, 2.4, 0.05, weather(C.steelDark, rng, 0.4), 12), 0, 0.04, 0);
  place(env, post(2.0, 2.0, 0.06, weather(C.steel, rng, 0.4), 12), 0, 0.05, 0);
  const tooth = grimy(C.steelDark, 0.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const t = box(0.5, 0.07, 0.7, tooth);
    t.rotation.y = a;
    t.position.set(Math.sin(a) * 2.3, 0.05, Math.cos(a) * 2.3);
    env.add(t);
  }
  place(env, post(0.6, 0.6, 0.08, weather(C.hazard, rng, 0.5), 8), 0, 0.07, 0);
}

// ----------------------------------------------------------------------------
// Walls: ribbed metal cladding (some ribs gone) + broken clerestory + bay door
// ----------------------------------------------------------------------------

function claddedWall(env: Group, length: number, x: number, z: number, rotY: number): void {
  const g = new Group();
  g.add(box(length, 1.4, ROOM.wall, grimy(C.wainscot, 0.35)).translateY(0.7));
  g.add(box(length, ROOM.height - 1.4, ROOM.wall, grimy(C.wall, 0.35)).translateY(1.4 + (ROOM.height - 1.4) / 2));

  // Vertical ribs — randomly missing/dented.
  const ribs = Math.floor(length / 1.5);
  for (let i = 0; i <= ribs; i++) {
    if (rng() < 0.18) continue; // rib torn off
    const rx = -length / 2 + (i / ribs) * length;
    g.add(box(0.12, ROOM.height - 1.6, 0.08, grimy(C.wallRib, 0.4)).translateX(rx).translateY(ROOM.height / 2 + 0.2).translateZ(ROOM.wall / 2));
  }

  // Rust streaks weeping down the cladding.
  for (let i = 0; i < Math.floor(length / 4); i++) {
    const rx = rand(-length / 2, length / 2);
    const h = rand(1.5, 4);
    g.add(box(rand(0.1, 0.3), h, 0.04, weather(C.rust, rng, 0.2)).translateX(rx).translateY(rand(2, ROOM.height - 2)).translateZ(ROOM.wall / 2 + 0.03));
  }

  g.add(box(length, 0.3, ROOM.wall + 0.15, grimy(C.trim, 0.3)).translateY(ROOM.height - 0.15));
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  env.add(g);
}

function clerestory(env: Group, length: number, x: number, z: number, rotY: number): void {
  // A band of high windows — many cracked, dark, or smashed out.
  const g = new Group();
  const panes = Math.floor(length / 2.2);
  for (let i = 0; i < panes; i++) {
    const px = -length / 2 + length / panes / 2 + (i / panes) * length;
    const roll = rng();
    if (roll < 0.25) {
      // smashed out — leave the opening (exterior shows through), add a few shards
      g.add(box(length / panes - 0.2, 0.25, 0.06, weather(C.window, rng, 0.3)).translateX(px).translateY(0.5));
    } else {
      const mat = roll < 0.6 ? weather(C.windowBroken, rng, 0.2) : weather(C.window, rng, 0.35);
      g.add(box(length / panes - 0.2, 1.4, 0.1, mat).translateX(px));
    }
    g.add(box(0.12, 1.6, 0.16, grimy(C.trim, 0.3)).translateX(px - length / panes / 2));
  }
  g.add(box(length, 0.16, 0.18, grimy(C.trim, 0.3)).translateY(0.8));
  g.add(box(length, 0.16, 0.18, grimy(C.trim, 0.3)).translateY(-0.8));
  g.position.set(x, ROOM.height - 1.6, z);
  g.rotation.y = rotY;
  env.add(g);
}

function buildWalls(env: Group): void {
  const h = ROOM.half;

  claddedWall(env, h * 2, 0, -h, 0);
  claddedWall(env, h * 2, -h, 0, Math.PI / 2);
  claddedWall(env, h * 2, h, 0, Math.PI / 2);

  const sideLen = h - BAY.halfWidth;
  claddedWall(env, sideLen, -(BAY.halfWidth + sideLen / 2), h, 0);
  claddedWall(env, sideLen, BAY.halfWidth + sideLen / 2, h, 0);
  place(
    env,
    box(BAY.halfWidth * 2 + 0.4, ROOM.height - BAY.height, ROOM.wall, grimy(C.wall, 0.35)),
    0,
    BAY.height + (ROOM.height - BAY.height) / 2,
    h,
  );

  clerestory(env, h * 2 - 1, 0, -h + 0.1, 0);
  clerestory(env, h * 2 - 1, -h + 0.1, 0, Math.PI / 2);
  clerestory(env, h * 2 - 1, h - 0.1, 0, Math.PI / 2);

  // Faded, peeling name board above the entrance (hanging askew).
  const board = box(6, 1.0, 0.2, grimy(C.trim, 0.3));
  board.rotation.z = 0.05;
  place(env, board, 0, BAY.height + 0.7, h - 0.3);
  place(env, box(5.4, 0.6, 0.06, weather(C.hazard, rng, 0.5)), 0, BAY.height + 0.7, h - 0.42);
}

// ----------------------------------------------------------------------------
// Roof: sagging trusses under a stained deck (with a hole letting light in)
// ----------------------------------------------------------------------------

function truss(span: number): Group {
  const g = new Group();
  const chord = grimy(C.steelDark, 0.35);
  g.add(box(span, 0.18, 0.18, chord));
  g.add(box(span, 0.18, 0.18, chord).translateY(1.1));
  const bays = Math.floor(span / 2);
  for (let i = 0; i <= bays; i++) {
    const x = -span / 2 + (i / bays) * span;
    g.add(box(0.1, 1.1, 0.1, chord).translateX(x).translateY(0.55));
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
  // Roof deck panels, leaving a torn-open hole near one corner.
  const tiles = 6;
  const t = (ROOM.half * 2) / tiles;
  for (let ix = 0; ix < tiles; ix++) {
    for (let iz = 0; iz < tiles; iz++) {
      // hole: skip a couple of panels in the back-east area.
      if (ix >= 4 && iz <= 1) continue;
      const x = -ROOM.half + t / 2 + ix * t;
      const z = -ROOM.half + t / 2 + iz * t;
      place(env, box(t * 0.99, 0.3, t * 0.99, grimy(C.steelDark, 0.3)), x, ROOM.height, z);
    }
  }
  for (let i = -3; i <= 3; i++) {
    const tr = truss(ROOM.half * 2);
    tr.rotation.z = rand(-0.015, 0.015); // slight sag
    place(env, tr, 0, ROOM.height - 1.5 + rand(-0.2, 0), i * 4.5);
  }
}

// ----------------------------------------------------------------------------
// Steel I-beam columns ringing the work floor (rusted)
// ----------------------------------------------------------------------------

function iBeam(height: number): Group {
  const g = new Group();
  const mat = grimy(C.steel, 0.4);
  g.add(box(0.07, height, 0.3, mat));
  g.add(box(0.36, height, 0.07, mat).translateZ(0.15));
  g.add(box(0.36, height, 0.07, mat).translateZ(-0.15));
  g.add(box(0.5, 0.08, 0.5, grimy(C.steelDark, 0.4)).translateY(-height / 2 + 0.04));
  g.add(box(0.5, 0.08, 0.5, grimy(C.steelDark, 0.4)).translateY(height / 2 - 0.04));
  // rust at the base where it meets the damp floor
  g.add(box(0.4, rand(0.6, 1.2), 0.4, weather(C.rust, rng, 0.25)).translateY(-height / 2 + 0.6));
  return g;
}

function buildColumns(env: Group): void {
  const inner = ROOM.half - ROOM.catwalkDepth;
  const h = ROOM.height;
  const positions: Array<[number, number]> = [];
  for (let i = -3; i <= 3; i++) positions.push([i * 4.5, -inner]);
  for (let i = -2; i <= 3; i++) {
    positions.push([-inner, i * 4.5]);
    positions.push([inner, i * 4.5]);
  }
  for (const [x, z] of positions) {
    place(env, iBeam(h), x, h / 2, z);
  }
}

// ----------------------------------------------------------------------------
// Catwalk / mezzanine — three runs that MEET at the corners (no overlap)
// ----------------------------------------------------------------------------

function handrail(length: number, decayed = true): Group {
  const g = new Group();
  const mat = grimy(C.rail, 0.35);
  g.add(box(length, 0.08, 0.08, mat).translateY(1.1));
  g.add(box(length, 0.08, 0.08, mat).translateY(0.55));
  g.add(box(length, 0.18, 0.04, grimy(C.trim, 0.3)).translateY(0.09));
  const count = Math.floor(length / 1.4);
  for (let i = 0; i <= count; i++) {
    if (decayed && rng() < 0.12) continue; // missing/bent post
    const x = -length / 2 + (i / count) * length;
    g.add(box(0.07, 1.15, 0.07, mat).translateX(x).translateY(0.57));
  }
  return g;
}

function buildCatwalk(env: Group): void {
  const h = ROOM.half;
  const y = ROOM.catwalkY;
  const d = ROOM.catwalkDepth;

  // North run spans the full width; the side runs start where it ends, so the
  // three decks butt together at the corners with no overlap.
  const sideLen = h * 2 - d;
  const sideCenterZ = d / 2; // midpoint of [-h+d, h]

  place(env, box(h * 2, 0.18, d, grimy(C.grating, 0.3)), 0, y, -h + d / 2);
  place(env, box(d, 0.18, sideLen, grimy(C.grating, 0.3)), h - d / 2, y, sideCenterZ);
  place(env, box(d, 0.18, sideLen, grimy(C.grating, 0.3)), -h + d / 2, y, sideCenterZ);

  // Inner handrails. North rail stops short of each corner so you can step onto
  // the side runs; the side rails cover their full inner edge.
  const rN = handrail(h * 2 - 2 * d);
  place(env, rN, 0, y + 0.09, -h + d);
  const rE = handrail(sideLen);
  rE.rotation.y = Math.PI / 2;
  place(env, rE, h - d, y + 0.09, sideCenterZ);
  const rW = handrail(sideLen);
  rW.rotation.y = Math.PI / 2;
  place(env, rW, -h + d, y + 0.09, sideCenterZ);

  // Under-deck support brackets at the wall.
  for (let i = -3; i <= 3; i++) {
    place(env, box(d, 0.16, 0.16, grimy(C.steelDark, 0.4)), i * 4.5, y - 0.2, -h + d / 2);
  }

  buildStair(env, -h + 1.6, y, 6);
}

function buildStair(env: Group, x: number, topY: number, run: number): void {
  const steps = 14;
  const stepMat = grimy(C.steelDark, 0.4);
  const railMat = grimy(C.rail, 0.35);
  for (let i = 0; i < steps; i++) {
    const sy = (i + 1) * (topY / steps) - topY / (2 * steps);
    const sz = run - (i / steps) * (run * 1.3);
    place(env, box(1.8, 0.08, 0.7, stepMat), x, sy, sz);
  }
  for (let i = 0; i <= steps; i += 2) {
    const sy = i * (topY / steps);
    const sz = run + 0.35 - (i / steps) * (run * 1.3);
    place(env, box(0.06, 1.0, 0.06, railMat), x + 0.95, sy + 0.5, sz);
    place(env, box(0.06, 1.0, 0.06, railMat), x - 0.95, sy + 0.5, sz);
  }
}

// ----------------------------------------------------------------------------
// Dead conveyor belts (some legs collapsed)
// ----------------------------------------------------------------------------

function conveyor(length: number, broken = false): Group {
  const g = new Group();
  g.add(box(length, 0.12, 0.9, grimy(C.steel, 0.4)).translateY(0.9));
  g.add(box(length - 0.2, 0.06, 0.78, grimy(C.trim, 0.3)).translateY(0.99));
  const roller = grimy(C.steelLight, 0.4);
  for (let i = 0; i <= length; i += 0.6) {
    if (rng() < 0.15) continue; // missing roller
    g.add(post(0.06, 0.06, 0.84, roller, 8).translateX(-length / 2 + i).translateY(1.0).rotateX(Math.PI / 2));
  }
  for (const lx of [-length / 2 + 0.5, 0, length / 2 - 0.5]) {
    g.add(box(0.12, 0.9, 0.12, grimy(C.steelDark, 0.4)).translateX(lx).translateY(0.45).translateZ(0.35));
    g.add(box(0.12, 0.9, 0.12, grimy(C.steelDark, 0.4)).translateX(lx).translateY(0.45).translateZ(-0.35));
  }
  // a lone forgotten crate
  if (!broken) g.add(box(0.5, 0.5, 0.5, grimy(C.crate, 0.4)).translateX(-length / 3).translateY(1.27));
  if (broken) {
    g.rotation.z = 0.12; // sagging end
    g.position.y = -0.1;
  }
  return g;
}

function buildConveyors(env: Group): void {
  place(env, conveyor(8), 11, 0, -6);
  const c2 = conveyor(8, true);
  c2.rotation.y = Math.PI / 2;
  place(env, c2, -12, 0, 5);
}

// ----------------------------------------------------------------------------
// Broken machines (dark screens, dead stack lights, leaning)
// ----------------------------------------------------------------------------

function machine(dead = true): Group {
  const g = new Group();
  g.add(box(1.8, 1.6, 1.2, grimy(C.machineBody, 0.4)).translateY(0.8));
  g.add(box(1.9, 0.2, 1.3, grimy(C.steelDark, 0.4)).translateY(1.7));
  g.add(box(0.9, 1.0, 0.1, grimy(C.panel, 0.3)).translateX(1.0).translateY(1.0));
  g.add(box(0.7, 0.4, 0.06, C.screen).translateX(1.04).translateY(1.25)); // dark screen
  g.add(post(0.06, 0.06, 0.06, weather(C.led, rng, dead ? 0.7 : 0), 8).translateX(1.05).translateY(0.95).rotateX(Math.PI / 2));
  g.add(post(0.06, 0.06, 0.06, weather(C.ledRed, rng, dead ? 0.7 : 0), 8).translateX(1.05).translateY(0.78).rotateX(Math.PI / 2));
  g.add(post(0.08, 0.08, 0.5, grimy(C.steelDark, 0.4), 8).translateX(-0.7).translateY(2.0));
  g.add(post(0.1, 0.1, 0.14, weather(C.ledRed, rng, 0.7), 8).translateX(-0.7).translateY(2.15)); // dead lamp
  return g;
}

function buildMachines(env: Group): void {
  const placements: Array<[number, number, number, number]> = [
    [13, 6, -Math.PI / 2, 0],
    [13, 11, -Math.PI / 2, 0.04], // tilted
    [-13, -7, Math.PI / 2, 0],
  ];
  for (const [x, z, r, tilt] of placements) {
    const m = machine();
    m.rotation.y = r;
    m.rotation.x = tilt;
    place(env, m, x, 0, z);
  }
}

// ----------------------------------------------------------------------------
// Pallet racking — leaning, half-collapsed, missing crates
// ----------------------------------------------------------------------------

function palletRack(bays: number, lean = 0): Group {
  const g = new Group();
  const upright = grimy(C.machine, 0.4);
  const beam = grimy(C.pipeHot, 0.3);
  const bayW = 2.4;
  const totalW = bays * bayW;
  const height = 4.2;
  for (let i = 0; i <= bays; i++) {
    const x = -totalW / 2 + i * bayW;
    g.add(box(0.14, height, 1.1, upright).translateX(x).translateY(height / 2));
  }
  for (const sy of [1.4, 2.8]) {
    g.add(box(totalW, 0.12, 0.1, beam).translateY(sy).translateZ(0.45));
    g.add(box(totalW, 0.12, 0.1, beam).translateY(sy).translateZ(-0.45));
    for (let b = 0; b < bays; b++) {
      if (rng() < 0.4) continue; // looted / fallen
      const cx = -totalW / 2 + bayW / 2 + b * bayW;
      g.add(box(1.8, 1.0, 0.9, grimy(b % 2 ? C.crate : C.crateAlt, 0.4)).translateX(cx).translateY(sy + 0.55));
    }
  }
  g.rotation.z = lean;
  return g;
}

function buildRacking(env: Group): void {
  place(env, palletRack(5, 0.03), 0, 0, -ROOM.half + 1.4);
  const rack2 = palletRack(4, 0.05);
  rack2.rotation.y = Math.PI / 2;
  place(env, rack2, ROOM.half - 1.4, 0, -12);
}

// ----------------------------------------------------------------------------
// Loose clutter: toppled crates, broken pallets, spilled drums
// ----------------------------------------------------------------------------

function pallet(): Group {
  const g = new Group();
  const mat = grimy(C.crateAlt, 0.4);
  g.add(box(1.2, 0.06, 1.0, mat).translateY(0.14));
  for (const lx of [-0.5, 0, 0.5]) {
    g.add(box(0.16, 0.14, 1.0, mat).translateX(lx).translateY(0.07));
  }
  return g;
}

function drum(color: string): Group {
  const g = new Group();
  g.add(post(0.32, 0.32, 0.9, weather(color, rng, 0.35), 10).translateY(0.45));
  g.add(post(0.34, 0.34, 0.05, grimy(C.steelDark, 0.4), 10).translateY(0.25));
  g.add(post(0.34, 0.34, 0.05, grimy(C.steelDark, 0.4), 10).translateY(0.65));
  return g;
}

function buildClutter(env: Group): void {
  const stacks: Array<[number, number]> = [
    [15, 14],
    [-15, 13],
    [-15, -14],
  ];
  for (const [x, z] of stacks) {
    place(env, pallet(), x, 0, z);
    place(env, box(1.0, 1.0, 1.0, grimy(C.crate, 0.4)), x, 0.65, z);
    // a toppled crate that fell off the stack
    const fallen = box(0.8, 0.8, 0.8, grimy(C.crateAlt, 0.4));
    fallen.rotation.set(rand(-0.3, 0.3), rand(0, 1), 0.4);
    place(env, fallen, x + rand(1.0, 1.6), 0.4, z + rand(-0.5, 0.5));
  }

  // A cluster of drums, one tipped over and leaking.
  const drumColors = [C.drumRed, C.drumBlue, C.drumYellow];
  const spots: Array<[number, number]> = [
    [16, -13],
    [16.7, -13],
    [16.3, -13.7],
  ];
  spots.forEach(([x, z], i) => place(env, drum(drumColors[i % 3]), x, 0, z));
  const tipped = drum(C.drumRed);
  tipped.rotation.z = Math.PI / 2;
  place(env, tipped, 15.2, 0.32, -13.4);
  place(env, post(1.2, 1.6, 0.012, C.oil, 10), 14.0, 0.012, -13.4); // oil spill
}

// ----------------------------------------------------------------------------
// Overhead gantry crane (rusted, hook hanging crooked)
// ----------------------------------------------------------------------------

function buildGantryCrane(env: Group): void {
  const y = 7.2;
  const span = ROOM.half * 2 - 2;
  place(env, box(span, 0.5, 0.7, grimy(C.rail, 0.4)), 0, y, -2);
  place(env, box(span, 0.2, 0.9, grimy(C.steelDark, 0.4)), 0, y + 0.3, -2);
  place(env, box(1.2, 0.7, 1.4, grimy(C.steelDark, 0.4)), -span / 2, y, -2);
  place(env, box(1.2, 0.7, 1.4, grimy(C.steelDark, 0.4)), span / 2, y, -2);
  const trolley = new Group();
  trolley.add(box(1.0, 0.6, 1.0, grimy(C.machine, 0.4)));
  trolley.add(box(0.08, 2.4, 0.08, grimy(C.trim, 0.3)).translateY(-1.3));
  trolley.add(box(0.4, 0.4, 0.4, grimy(C.steelDark, 0.4)).translateY(-2.6));
  trolley.add(post(0.06, 0.12, 0.4, grimy(C.steelLight, 0.4), 6).translateY(-2.95));
  trolley.rotation.z = 0.08;
  place(env, trolley, 3, y - 0.3, -2);
  place(env, box(0.2, 0.2, ROOM.half * 2, grimy(C.steelDark, 0.4)), -ROOM.half + ROOM.catwalkDepth, y + 0.4, 0);
  place(env, box(0.2, 0.2, ROOM.half * 2, grimy(C.steelDark, 0.4)), ROOM.half - ROOM.catwalkDepth, y + 0.4, 0);
}

// ----------------------------------------------------------------------------
// Wall pipework (rusted; one length broken loose and hanging)
// ----------------------------------------------------------------------------

function buildPipes(env: Group): void {
  const z = -ROOM.half + 0.5;
  const runs: Array<[number, string]> = [
    [3.6, C.pipe],
    [3.9, C.pipeHot],
    [4.2, C.pipe],
  ];
  for (const [y, color] of runs) {
    place(env, post(0.1, 0.1, ROOM.half * 2 - 2, weather(color, rng, 0.3), 8).rotateZ(Math.PI / 2), 0, y, z);
  }
  for (const x of [-6, 7]) {
    place(env, post(0.1, 0.1, 3.5, grimy(C.pipe, 0.35), 8), x, 1.8, z);
  }
  // a broken pipe length swinging down from the ceiling
  const dangling = post(0.1, 0.1, 2.4, weather(C.pipeHot, rng, 0.25), 8);
  dangling.rotation.x = 0.5;
  place(env, dangling, 9, ROOM.height - 2.5, -ROOM.half + 3);
}

// ----------------------------------------------------------------------------
// Decay layer: grime, oil puddles, cracks, rubble, moss, fallen debris
// ----------------------------------------------------------------------------

function buildDecay(env: Group): void {
  // Oil/water puddles pooled around the floor.
  for (let i = 0; i < 14; i++) {
    const x = rand(-ROOM.half + 2, ROOM.half - 2);
    const z = rand(-ROOM.half + 2, ROOM.half - 2);
    place(env, post(rand(0.6, 1.8), rand(0.6, 1.8), 0.012, weather(C.oil, rng, 0.1), 10), x, 0.012, z);
  }

  // Hairline cracks fanning across the slab.
  for (let i = 0; i < 30; i++) {
    const x = rand(-ROOM.half + 1, ROOM.half - 1);
    const z = rand(-ROOM.half + 1, ROOM.half - 1);
    const crack = box(rand(0.4, 2.2), 0.012, 0.05, C.grime);
    crack.rotation.y = rand(0, Math.PI);
    place(env, crack, x, 0.015, z);
  }

  // Rubble piles (broken concrete / fallen debris) in the corners and edges.
  const rubbleSpots: Array<[number, number]> = [
    [ROOM.half - 3, -ROOM.half + 3],
    [-ROOM.half + 4, ROOM.half - 4],
    [ROOM.half - 5, ROOM.half - 6],
    [-ROOM.half + 3, -ROOM.half + 5],
  ];
  for (const [cx, cz] of rubbleSpots) {
    for (let i = 0; i < 9; i++) {
      const chunk = box(rand(0.2, 0.6), rand(0.15, 0.45), rand(0.2, 0.6), grimy(C.concrete, 0.5));
      chunk.rotation.set(rand(0, 1), rand(0, Math.PI), rand(0, 1));
      place(env, chunk, cx + rand(-1.2, 1.2), rand(0.1, 0.3), cz + rand(-1.2, 1.2));
    }
  }

  // Debris fallen from the roof hole (back-east area).
  for (let i = 0; i < 7; i++) {
    const plank = box(rand(0.8, 1.8), 0.08, rand(0.1, 0.25), grimy(C.steelDark, 0.4));
    plank.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI), rand(-0.2, 0.2));
    place(env, plank, rand(11, 16), rand(0.04, 0.3), rand(-16, -11));
  }

  // Moss/grime creeping up the wall bases under the windows.
  for (let i = 0; i < 18; i++) {
    const side = Math.floor(rng() * 3);
    const t = rand(-ROOM.half + 2, ROOM.half - 2);
    const m = box(rand(0.6, 1.6), rand(0.3, 0.9), 0.05, weather(C.moss, rng, 0.2));
    if (side === 0) place(env, m, t, rand(0.2, 0.7), -ROOM.half + 0.25);
    else if (side === 1) { m.rotation.y = Math.PI / 2; place(env, m, -ROOM.half + 0.25, rand(0.2, 0.7), t); }
    else { m.rotation.y = Math.PI / 2; place(env, m, ROOM.half - 0.25, rand(0.2, 0.7), t); }
  }
}

// ----------------------------------------------------------------------------
// High-bay light fixtures — mostly dead; only a few still flicker on
// ----------------------------------------------------------------------------

function buildHighBayLights(env: Group): void {
  // [x, z, working]
  const fixtures: Array<[number, number, boolean]> = [
    [-7, -7, true],
    [7, -7, false],
    [-7, 7, false],
    [7, 7, true],
    [0, 0, false],
  ];
  for (const [x, z, working] of fixtures) {
    const fx = new Group();
    fx.add(box(0.06, 1.4, 0.06, grimy(C.trim, 0.3)).translateY(0.7));
    fx.add(post(0.5, 0.32, 0.4, grimy(C.steelDark, 0.4), 8));
    // hangs crooked if dead
    fx.add(post(0.34, 0.34, 0.06, working ? C.window : weather(C.windowBroken, rng, 0.2), 8).translateY(-0.2));
    fx.rotation.z = working ? 0 : rand(-0.25, 0.25);
    fx.position.set(x, ROOM.height - 2.2, z);
    env.add(fx);

    if (working) {
      const light = new PointLight(0xdfe6ee, 16, 22, 2);
      light.position.set(x, ROOM.height - 2.6, z);
      env.add(light);
    }
  }
}

// ----------------------------------------------------------------------------
// Ambient / fill — dim, cold, with grey light through the broken roof & windows
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  env.add(new HemisphereLight(0x9aa6b0, 0x26241f, 0.35));
  env.add(new AmbientLight(0xaab0b6, 0.16));

  // Cold daylight shaft through the torn-open roof (back-east corner).
  const shaft = new DirectionalLight(0xcdd8e2, 0.5);
  shaft.position.set(13, 16, -13);
  env.add(shaft);

  // Faint grey glow leaking through the clerestory band on three sides.
  for (const [x, z] of [
    [0, -ROOM.half + 0.6],
    [-ROOM.half + 0.6, 0],
    [ROOM.half - 0.6, 0],
  ] as Array<[number, number]>) {
    const l = new PointLight(0x9fb4c0, 3, 11, 2);
    l.position.set(x, ROOM.height - 1.6, z);
    env.add(l);
  }
}

// ----------------------------------------------------------------------------
// Sliding bay doors (animated by BayDoorSystem in ./doors.ts) — dented & rusty
// ----------------------------------------------------------------------------

function bayLeaf(): Group {
  const g = new Group();
  const mat = grimy('#7a7f82', 0.4);
  g.add(box(BAY.halfWidth, BAY.height, 0.12, mat).translateY(BAY.height / 2));
  const ribMat = grimy('#6a6f72', 0.4);
  for (let i = 0; i < 9; i++) {
    g.add(box(BAY.halfWidth - 0.1, 0.12, 0.06, ribMat).translateY(0.4 + i * 0.55).translateZ(0.07));
  }
  // rust streaks
  for (let i = 0; i < 3; i++) {
    g.add(box(rand(0.15, 0.4), rand(1, 2.5), 0.04, weather(C.rust, rng, 0.2)).translateX(rand(-1.2, 1.2)).translateY(rand(1.5, 3.5)).translateZ(0.1));
  }
  g.add(box(BAY.halfWidth - 1.2, 0.5, 0.06, weather(C.window, rng, 0.4)).translateY(BAY.height - 1.0).translateZ(0.07));
  return g;
}

function buildDoors(world: World): void {
  const z = ROOM.half - 0.05;
  const closed = BAY.halfWidth / 2;
  const travel = BAY.halfWidth;

  const left = new Group();
  left.add(bayLeaf());
  left.position.set(-closed, 0, z);
  left.userData = { closedX: -closed, openX: -closed - travel, doorwayZ: z, openRadius: 6 };
  world.createTransformEntity(left).addComponent(BayDoor);

  const right = new Group();
  const rp = bayLeaf();
  rp.scale.x = -1;
  right.add(rp);
  right.position.set(closed, 0, z);
  right.userData = { closedX: closed, openX: closed + travel, doorwayZ: z, openRadius: 6 };
  world.createTransformEntity(right).addComponent(BayDoor);
}

// ----------------------------------------------------------------------------
// Grabbable props scattered around the floor (rusty, worn)
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  const wrench = new Group();
  wrench.add(box(0.5, 0.07, 0.12, grimy(C.steelLight, 0.4)));
  wrench.add(post(0.1, 0.1, 0.1, grimy(C.steelLight, 0.4), 6).translateX(0.28).rotateX(Math.PI / 2));
  grabbable(world, wrench, 1.5, 1.0, 4);

  const gear = new Group();
  gear.add(post(0.2, 0.2, 0.1, grimy(C.steel, 0.4), 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = box(0.08, 0.11, 0.1, grimy(C.steelDark, 0.4));
    t.position.set(Math.sin(a) * 0.22, 0, Math.cos(a) * 0.22);
    gear.add(t);
  }
  grabbable(world, gear, -1.5, 1.0, 4);

  const hat = new Group();
  hat.add(post(0.16, 0.18, 0.16, weather(C.hazard, rng, 0.4), 8));
  hat.add(post(0.26, 0.26, 0.04, weather(C.hazard, rng, 0.4), 8).translateY(-0.06));
  grabbable(world, hat, 0, 1.0, 5);

  grabbable(world, box(0.45, 0.45, 0.45, grimy(C.crate, 0.4)), 6, 0.3, 8);
  grabbable(world, drum(C.drumBlue), -6, 0.0, 8);
}
