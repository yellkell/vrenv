/**
 * cove.ts — "Lantern Cove"
 *
 * An outdoor golden-hour environment: a grassy island meadow in the middle of
 * a still alpine lake, ringed by pine islands and dusk-blue mountains. A low
 * sun hangs over the water at the end of a long glitter path; hot-air
 * balloons drift overhead, clouds catch the last warm light, and lantern
 * posts around the meadow pick up the scene as it dims.
 *
 * The meadow dome is wide open at the center — a ready-made gameplay arena —
 * with a wooden dock reaching out over the water. Everything is flat-shaded
 * papercraft primitives collapsed by `mergeStatic` into a handful of draw
 * calls; only the balloons, clouds, and grabbable props stay live.
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
  BufferAttribute,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SphereGeometry,
} from 'three';
import { Drifter } from '../drift.js';
import { mergeStatic } from '../merge.js';
import {
  ball,
  box,
  cone,
  gradientPaint,
  makeRng,
  paper,
  place,
  post,
  radialPaint,
} from '../papercraft.js';

// ----------------------------------------------------------------------------
// Layout & palette
// ----------------------------------------------------------------------------

const WATER_Y = -0.6;
// Meadow dome: a gently squashed sphere, top at y = 0, shoreline at r ≈ 13.2.
const ISLAND = { r: 20, squash: 0.06 };

const C = {
  meadow: '#96a84e',
  meadowWarm: '#aaaf55',
  meadowEdge: '#67853f',
  path: '#c2a06b',
  water: '#2e6a78',
  waterDeep: '#1e4a58',
  glint: '#ffcf8a',
  dockWood: '#8a6238',
  dockWoodDark: '#6e4c2a',
  pine: '#24483a',
  pineLit: '#7fae62',
  pineTrunk: '#5c4126',
  aspen: '#e8c95c',
  aspenLit: '#f7e08a',
  rock: '#7d7468',
  rockWarm: '#a8927a',
  mountain: '#525f80',
  mountainLit: '#8a7a92',
  snow: '#f6e3d0',
  skyTop: '#27336a',
  skyMid: '#8f5f7a',
  skyHorizon: '#ffbe76',
  sun: '#ffd98a',
  sunGlow: '#ffb066',
  cloud: '#e8a06b',
  cloudLit: '#ffd2a0',
  lanternGlow: '#ffdf9f',
  lanternWood: '#4a3a26',
  balloonA: '#d95f3b',
  balloonB: '#e8b23a',
  balloonC: '#8a5f9e',
  cream: '#f2e3c8',
  fog: '#d98a5f',
};

const rng = makeRng(0xc0fe);
const rand = (min: number, max: number) => min + (max - min) * rng();

/** Meadow dome surface height at radius r from the island center. */
function meadowY(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const t = Math.min(r / ISLAND.r, 1);
  const domeH = ISLAND.r * ISLAND.squash * 2;
  return domeH * Math.sqrt(Math.max(1 - t * t, 0)) - domeH;
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

export function buildCove(world: World): void {
  const env = new Group();
  env.name = 'LanternCove';

  buildWater(env);
  buildIsland(env);
  buildDock(env);
  buildFlora(env);
  buildRocks(env);
  buildLanterns(env);
  buildOuterIslands(env);
  buildMountains(env);
  buildWaterfall(env);
  buildSky(env);
  buildLights(env);

  // Visuals: merged to a handful of draw calls, no locomotion component.
  world.createTransformEntity(mergeStatic(env));

  // Locomotion runs on a separate invisible nav group (all-indexed geometry
  // only — the locomotor merges + indexes whatever it's given).
  const nav = buildNav();
  nav.visible = false;
  world
    .createTransformEntity(nav)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  world.scene.fog = new Fog(C.fog, 55, 165);

  buildBalloons(world);
  buildClouds(world);
  buildProps(world);
}

/** Invisible walkable/collision proxy: island dome, dock deck, barriers. */
function buildNav(): Group {
  const g = new Group();
  const mat = new MeshStandardMaterial();
  const domeH = ISLAND.r * ISLAND.squash * 2;

  // Smooth indexed sphere standing in for the icosahedral meadow dome.
  const dome = new Mesh(new SphereGeometry(ISLAND.r, 24, 16), mat);
  dome.scale.y = ISLAND.squash * 2;
  dome.position.y = -domeH;
  g.add(dome);

  // Dock deck + steps, plus low side/end barriers so nobody strolls into
  // the lake.
  const deck = new Mesh(new BoxGeometry(2.1, 0.1, 9.6), mat);
  deck.position.set(0, -0.13, -15.4);
  g.add(deck);
  const step1 = new Mesh(new BoxGeometry(2.1, 0.1, 0.5), mat);
  step1.position.set(0, -0.3, -10.55);
  g.add(step1);
  const step2 = new Mesh(new BoxGeometry(2.1, 0.1, 0.5), mat);
  step2.position.set(0, -0.18, -10.95);
  g.add(step2);
  for (const sx of [-1.1, 1.1]) {
    const rail = new Mesh(new BoxGeometry(0.08, 0.9, 9.6), mat);
    rail.position.set(sx, 0.3, -15.4);
    g.add(rail);
  }
  const endRail = new Mesh(new BoxGeometry(2.3, 0.9, 0.08), mat);
  endRail.position.set(0, 0.3, -20.2);
  g.add(endRail);

  // Open-ended barrier ring at the shoreline, with a gap for the dock lane
  // (theta 0 faces +Z, so the gap is centered on -Z).
  const ring = new Mesh(
    new CylinderGeometry(13.4, 13.4, 5, 24, 1, true, Math.PI + 0.16, Math.PI * 2 - 0.32),
    mat,
  );
  ring.position.y = 1.6;
  g.add(ring);
  return g;
}

// ----------------------------------------------------------------------------
// Water: still lake with a sun-glitter path running toward the dock
// ----------------------------------------------------------------------------

function buildWater(env: Group): void {
  const water = post(150, 150, 0.25, paper('#ffffff', { roughness: 0.35 }), 32);
  radialPaint(water, C.water, C.waterDeep);
  place(env, water, 0, WATER_Y - 0.125, 0);

  // Glitter path: warm unlit flecks scattered in a lane from the sun (far -Z)
  // toward the island, widening as it approaches.
  const fleck = new MeshBasicMaterial({ color: C.glint });
  for (let i = 0; i < 60; i++) {
    const t = rng();
    const z = -22 - t * 95;
    const lane = 1.5 + t * 10;
    const m = new Mesh(new BoxGeometry(rand(0.25, 0.9), 0.02, rand(0.08, 0.2)), fleck);
    m.position.set(rand(-lane, lane), WATER_Y + 0.02 + t * 0.001, z);
    m.rotation.y = rand(-0.3, 0.3);
    env.add(m);
  }

  // Soft foam rings where the island meets the water.
  const foam = paper(C.cream, { roughness: 0.9, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2);
    const r = 12.4 + rand(0, 1.6);
    place(env, box(rand(1.2, 2.8), 0.03, rand(0.25, 0.5), foam), Math.sin(a) * r, WATER_Y + 0.04, Math.cos(a) * r).rotation.y = -a;
  }
}

// ----------------------------------------------------------------------------
// The meadow island: a gentle grass dome with a stone path to the dock
// ----------------------------------------------------------------------------

function buildIsland(env: Group): void {
  const domeH = ISLAND.r * ISLAND.squash * 2;
  const dome = ball(ISLAND.r, paper('#ffffff'), 3);
  gradientPaint(dome, C.meadowEdge, C.meadowWarm);
  dome.scale.y = ISLAND.squash * 2;
  place(env, dome, 0, -domeH, 0);

  // Warm dry-grass tufts dotted around (out of the central arena).
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(6.5, 11.5);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const tuft = cone(rand(0.1, 0.2), rand(0.3, 0.55), paper(i % 2 ? C.meadowWarm : C.aspen), 5);
    place(env, tuft, x, meadowY(x, z) + 0.12, z);
  }

  // Stepping-stone path from the center toward the dock (north, -Z).
  for (let i = 0; i < 7; i++) {
    const z = -(3.2 + i * 1.35);
    const x = Math.sin(i * 0.9) * 0.5;
    const stone = post(rand(0.42, 0.6), rand(0.5, 0.68), 0.1, paper(C.path), 7);
    stone.rotation.y = rand(0, Math.PI);
    place(env, stone, x, meadowY(x, z) + 0.03, z);
  }

  // A stone circle fire pit off to one side, still glowing faintly.
  const fx = -6.5;
  const fz = 4.5;
  const fy = meadowY(fx, fz);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = ball(rand(0.16, 0.24), paper(C.rock), 1);
    place(env, s, fx + Math.sin(a) * 0.8, fy + 0.1, fz + Math.cos(a) * 0.8);
  }
  const embers = new Mesh(new SphereGeometry(0.3, 8, 6), new MeshBasicMaterial({ color: '#ff9040' }));
  embers.scale.y = 0.4;
  embers.position.set(fx, fy + 0.12, fz);
  env.add(embers);
  for (const [lx, lz, ry] of [
    [0.5, 0.2, 0.4],
    [-0.4, 0.4, 2.2],
    [0.1, -0.5, 1.2],
  ] as Array<[number, number, number]>) {
    const log = post(0.07, 0.09, 0.9, paper(C.lanternWood), 6);
    log.rotation.set(Math.PI / 2, 0, ry);
    place(env, log, fx + lx, fy + 0.14, fz + lz);
  }
}

// ----------------------------------------------------------------------------
// Wooden dock reaching out over the water toward the sun
// ----------------------------------------------------------------------------

function buildDock(env: Group): void {
  const deckY = -0.08;
  // The dock runs north (-Z), straight toward the setting sun.
  // Two wooden steps up from the meadow onto the dock deck.
  place(env, box(2.1, 0.1, 0.5, paper(C.dockWoodDark)), 0, -0.3, -10.55);
  place(env, box(2.1, 0.1, 0.5, paper(C.dockWood)), 0, -0.18, -10.95);
  // Planks from the shore (z ≈ -11) out over the lake.
  for (let i = 0; i < 14; i++) {
    const z = -(11.2 + i * 0.62);
    place(
      env,
      box(2.1, 0.07, 0.54, paper(i % 2 ? C.dockWood : C.dockWoodDark)),
      0,
      deckY,
      z,
    );
  }
  // Stringers + piles.
  place(env, box(0.16, 0.12, 9.0, paper(C.dockWoodDark)), -0.85, deckY - 0.09, -15.5);
  place(env, box(0.16, 0.12, 9.0, paper(C.dockWoodDark)), 0.85, deckY - 0.09, -15.5);
  for (const z of [-11.8, -14.2, -16.6, -19.0]) {
    for (const sx of [-0.95, 0.95]) {
      place(env, post(0.09, 0.11, 1.35, paper(C.dockWoodDark), 6), sx, deckY - 0.55, z);
    }
  }
  // End posts, one wearing a glowing lantern.
  place(env, post(0.09, 0.1, 1.0, paper(C.dockWoodDark), 6), -0.95, deckY + 0.42, -19.6);
  place(env, post(0.09, 0.1, 1.0, paper(C.dockWoodDark), 6), 0.95, deckY + 0.42, -19.6);
  lanternHead(env, 0.95, deckY + 1.02, -19.6, true);

  // A little rowboat tied up alongside.
  const boat = new Group();
  const hull = ball(1.1, paper('#a24e30'), 1);
  hull.scale.set(0.55, 0.32, 1.1);
  boat.add(hull);
  const inner = ball(0.95, paper(C.cream), 1);
  inner.scale.set(0.45, 0.24, 0.98);
  inner.position.y = 0.1;
  boat.add(inner);
  boat.add(box(0.7, 0.05, 0.16, paper(C.dockWood)).translateY(0.18));
  boat.rotation.y = 0.35;
  place(env, boat, 2.6, WATER_Y + 0.18, -17.8);
}

// ----------------------------------------------------------------------------
// Pines, golden aspens, rocks — ringing the meadow, leaving the center open
// ----------------------------------------------------------------------------

function pine(size: number): Group {
  const g = new Group();
  g.add(post(0.08 * size, 0.12 * size, 0.7 * size, paper(C.pineTrunk), 6).translateY(0.35 * size));
  const tiers: Array<[number, number, number]> = [
    [0.85, 1.15, 0.62],
    [0.65, 1.05, 1.28],
    [0.42, 0.95, 1.92],
  ];
  for (const [r, h, y] of tiers) {
    const tier = cone(r * size, h * size, paper('#ffffff'), 7);
    gradientPaint(tier, C.pine, C.pineLit);
    tier.position.y = y * size;
    tier.rotation.y = rand(0, Math.PI);
    g.add(tier);
  }
  return g;
}

function aspen(size: number): Group {
  const g = new Group();
  g.add(post(0.05 * size, 0.07 * size, 1.0 * size, paper(C.cream), 6).translateY(0.5 * size));
  const crown = ball(0.55 * size, paper('#ffffff'), 1);
  gradientPaint(crown, C.aspen, C.aspenLit);
  crown.position.y = 1.35 * size;
  crown.scale.y = 1.25;
  g.add(crown);
  return g;
}

function buildFlora(env: Group): void {
  // Meadow rim trees (kept off the central arena and the dock lane).
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.15, 0.15);
    if (Math.abs(Math.sin(a)) < 0.28 && Math.cos(a) < 0) continue; // dock lane
    const r = rand(9.5, 12);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const t = rng() < 0.3 ? aspen(rand(1.1, 1.6)) : pine(rand(1.2, 2.1));
    t.rotation.y = rand(0, Math.PI * 2);
    place(env, t, x, meadowY(x, z) - 0.05, z);
  }
}

function buildRocks(env: Group): void {
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(8, 12);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const rock = ball(rand(0.25, 0.7), paper('#ffffff'), 1);
    gradientPaint(rock, C.rock, C.rockWarm);
    rock.rotation.set(rand(0, 1), rand(0, Math.PI), rand(0, 1));
    rock.scale.y = rand(0.6, 0.9);
    place(env, rock, x, meadowY(x, z) + 0.1, z);
  }
}

// ----------------------------------------------------------------------------
// Lantern posts: warm unlit "paper" boxes; two carry real point lights
// ----------------------------------------------------------------------------

function lanternHead(env: Group, x: number, y: number, z: number, lit: boolean): void {
  place(env, box(0.16, 0.03, 0.16, paper(C.lanternWood)), x, y - 0.12, z);
  const glow = new Mesh(
    new BoxGeometry(0.13, 0.18, 0.13),
    new MeshBasicMaterial({ color: C.lanternGlow }),
  );
  glow.position.set(x, y, z);
  env.add(glow);
  // A soft halo sells the glow at dusk for the cost of one translucent shell.
  const halo = new Mesh(
    new SphereGeometry(0.34, 10, 8),
    new MeshBasicMaterial({ color: C.sunGlow, transparent: true, opacity: 0.16 }),
  );
  halo.position.set(x, y, z);
  env.add(halo);
  place(env, box(0.17, 0.03, 0.17, paper(C.lanternWood)), x, y + 0.11, z);
  if (lit) {
    const light = new PointLight('#ffc06a', 3.5, 9, 1.8);
    light.position.set(x, y + 0.05, z);
    env.add(light);
  }
}

function buildLanterns(env: Group): void {
  // [x, z, carries a real light]
  const posts: Array<[number, number, boolean]> = [
    [5.5, -4.5, true],
    [-5, -6, false],
    [7, 2.5, false],
    [-6.8, -0.5, true],
    [2.5, 7.5, false],
  ];
  for (const [x, z, lit] of posts) {
    const y = meadowY(x, z);
    place(env, post(0.06, 0.08, 1.9, paper(C.lanternWood), 6), x, y + 0.95, z);
    place(env, box(0.5, 0.05, 0.05, paper(C.lanternWood)), x + 0.12, y + 1.85, z);
    lanternHead(env, x + 0.32, y + 1.7, z, lit);
  }
}

// ----------------------------------------------------------------------------
// Outer pine islands + dusk mountain ring + far waterfall cliff
// ----------------------------------------------------------------------------

function buildOuterIslands(env: Group): void {
  const islands: Array<[number, number, number, number]> = [
    [-30, -18, 9, 5],
    [26, -26, 7, 4],
    [38, 8, 11, 6],
    [-38, 14, 8, 4],
    [12, 34, 6, 3],
    [-16, 38, 7, 3],
  ];
  for (const [x, z, r, trees] of islands) {
    const isle = ball(r, paper('#ffffff'), 2);
    gradientPaint(isle, C.meadowEdge, C.meadow);
    isle.scale.y = 0.32;
    place(env, isle, x, WATER_Y - r * 0.13, z);
    const topY = WATER_Y - r * 0.13 + r * 0.32;
    for (let t = 0; t < trees; t++) {
      const a = rand(0, Math.PI * 2);
      const rr = rand(0, r * 0.45);
      const p = pine(rand(1.0, 1.9));
      p.rotation.y = rand(0, Math.PI * 2);
      place(env, p, x + Math.sin(a) * rr, topY - (rr / r) * 1.2 - 0.4, z + Math.cos(a) * rr);
    }
  }
}

function buildMountains(env: Group): void {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.26;
    const r = rand(95, 130);
    const height = rand(30, 52);
    const base = rand(26, 40);
    const m = cone(base, height, paper('#ffffff'), 7);
    gradientPaint(m, C.mountain, C.mountainLit);
    m.rotation.y = rand(0, Math.PI);
    place(env, m, Math.sin(a) * r, height / 2 - 6, Math.cos(a) * r);
    const cap = cone(base * 0.32, height * 0.26, paper(C.snow), 7);
    cap.rotation.y = rand(0, Math.PI);
    place(env, cap, Math.sin(a) * r, height - 6 - height * 0.12, Math.cos(a) * r);
  }
}

function buildWaterfall(env: Group): void {
  // A cliff island in the north-west view with a silver fall feeding the lake.
  const x = -30;
  const z = -16;
  const cliff = ball(5, paper('#ffffff'), 2);
  gradientPaint(cliff, C.rock, C.rockWarm);
  cliff.scale.set(1.15, 1.3, 0.9);
  place(env, cliff, x, WATER_Y + 2.6, z);

  const fall = paper('#dff0ee', { roughness: 0.5, transparent: true, opacity: 0.75 });
  place(env, box(1.4, 8.4, 0.4, fall), x + 4.6, WATER_Y + 4.0, z + 1);
  place(env, box(1.8, 0.2, 1.8, fall), x + 4.7, WATER_Y + 0.12, z + 1);
  const rippleMat = paper(C.cream, { transparent: true, opacity: 0.3 });
  for (let i = 0; i < 4; i++) {
    place(env, post(1.2 + i * 0.9, 1.2 + i * 0.9, 0.03, rippleMat, 12), x + 4.7, WATER_Y + 0.05, z + 1);
  }
  // Pines crowning the cliff.
  for (const [px, pz] of [
    [-1.6, 0.5],
    [1.2, -1.2],
    [0.2, 1.6],
  ]) {
    const p = pine(rand(1.2, 1.7));
    place(env, p, x + px, WATER_Y + 2.6 + 5.6, z + pz);
  }
}

// ----------------------------------------------------------------------------
// Sky: three-stop dusk gradient, low sun with glow discs
// ----------------------------------------------------------------------------

function buildSky(env: Group): void {
  const sky = new Mesh(
    new SphereGeometry(160, 24, 14),
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false }),
  );
  // Two-band gradient: warm horizon washing up into a deep indigo zenith.
  const geom = sky.geometry;
  const pos = geom.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const horizon = hex(C.skyHorizon);
  const mid = hex(C.skyMid);
  const top = hex(C.skyTop);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(pos.getY(i) / 160, -0.15);
    let r: number, g: number, b: number;
    if (t < 0.28) {
      const k = Math.max(t, 0) / 0.28;
      r = horizon.r + (mid.r - horizon.r) * k;
      g = horizon.g + (mid.g - horizon.g) * k;
      b = horizon.b + (mid.b - horizon.b) * k;
    } else {
      const k = Math.min((t - 0.28) / 0.55, 1);
      r = mid.r + (top.r - mid.r) * k;
      g = mid.g + (top.g - mid.g) * k;
      b = mid.b + (top.b - mid.b) * k;
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geom.setAttribute('color', new BufferAttribute(colors, 3));
  sky.userData.noMerge = true;
  env.add(sky);

  // The sun, low over the water to the south... er, north (-Z), plus glow.
  const sunMat = new MeshBasicMaterial({ color: C.sun, fog: false });
  const sun = new Mesh(new SphereGeometry(9, 14, 10), sunMat);
  sun.position.set(0, 11, -142);
  env.add(sun);
  for (const [r, o] of [
    [14, 0.35],
    [22, 0.16],
  ]) {
    const glow = new Mesh(
      new SphereGeometry(r, 14, 10),
      new MeshBasicMaterial({ color: C.sunGlow, transparent: true, opacity: o, fog: false }),
    );
    glow.position.set(0, 11, -142.5);
    glow.scale.z = 0.05;
    env.add(glow);
  }
}

function hex(colorHex: string): { r: number; g: number; b: number } {
  const n = parseInt(colorHex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// ----------------------------------------------------------------------------
// Golden-hour lighting
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  env.add(new HemisphereLight('#ffd9a8', '#3f4436', 0.6));
  env.add(new AmbientLight('#7a6a8f', 0.32));
  const sun = new DirectionalLight('#ffb35c', 1.5);
  sun.position.set(0, 16, -80);
  env.add(sun);
  // Cool counter-light from the darkening east sky.
  const rim = new DirectionalLight('#5a6ea0', 0.35);
  rim.position.set(40, 30, 60);
  env.add(rim);
}

// ----------------------------------------------------------------------------
// Live set dressing: balloons and clouds on gentle drifts
// ----------------------------------------------------------------------------

function balloon(main: string): Group {
  const g = new Group();
  const envl = ball(2.1, paper('#ffffff', { roughness: 0.85 }), 2);
  gradientPaint(envl, main, C.cream);
  envl.scale.y = 1.18;
  envl.position.y = 3.2;
  g.add(envl);
  g.add(post(1.0, 0.45, 1.1, paper(main), 8).translateY(1.35));
  g.add(box(0.62, 0.5, 0.62, paper(C.dockWoodDark)).translateY(0.25));
  for (const [sx, sz] of [
    [-0.26, -0.26],
    [0.26, -0.26],
    [-0.26, 0.26],
    [0.26, 0.26],
  ]) {
    g.add(box(0.03, 0.85, 0.03, paper(C.lanternWood)).translateX(sx).translateY(0.9).translateZ(sz));
  }
  return g;
}

function buildBalloons(world: World): void {
  const specs: Array<[string, number, number, number, number]> = [
    [C.balloonA, -18, 16, -52, 0],
    [C.balloonB, 22, 21, -38, 2.2],
    [C.balloonC, -5, 26, -78, 4.1],
  ];
  for (const [color, x, y, z, phase] of specs) {
    const b = balloon(color);
    b.position.set(x, y, z);
    b.userData = {
      bobAmp: rand(0.5, 1.0),
      bobSpeed: rand(0.12, 0.2),
      driftAmp: rand(2.5, 5),
      driftSpeed: 0.015,
      swayAmp: 0.03,
      swaySpeed: 0.2,
      phase,
    };
    world.createTransformEntity(b).addComponent(Drifter);
  }
}

function buildClouds(world: World): void {
  for (let i = 0; i < 6; i++) {
    const g = new Group();
    const puffs = 3 + Math.floor(rng() * 3);
    const warm = rng() < 0.55;
    for (let p = 0; p < puffs; p++) {
      const puff = new Mesh(
        new SphereGeometry(rand(3.5, 7), 10, 7),
        new MeshBasicMaterial({ color: warm ? C.cloudLit : C.cloud }),
      );
      puff.position.set(p * rand(3.5, 5.5) - puffs * 2.2, rand(-0.8, 1.2), rand(-2, 2));
      puff.scale.y = 0.42;
      g.add(puff);
    }
    const a = rand(0, Math.PI * 2);
    g.position.set(Math.sin(a) * rand(50, 110), rand(26, 48), Math.cos(a) * rand(50, 110) - 20);
    g.userData = { bobAmp: 0.4, bobSpeed: 0.04, driftAmp: rand(5, 10), driftSpeed: 0.006, phase: rand(0, 6) };
    world.createTransformEntity(g).addComponent(Drifter);
  }
}

// ----------------------------------------------------------------------------
// Grabbable props: a carry lantern, an oar, a skipping stone
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  const lantern = new Group();
  lantern.add(box(0.15, 0.025, 0.15, paper(C.lanternWood)).translateY(-0.1));
  const glow = new Mesh(
    new BoxGeometry(0.11, 0.15, 0.11),
    new MeshBasicMaterial({ color: C.lanternGlow }),
  );
  lantern.add(glow);
  lantern.add(box(0.16, 0.025, 0.16, paper(C.lanternWood)).translateY(0.1));
  const handle = post(0.012, 0.012, 0.22, paper(C.lanternWood), 6);
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.17;
  lantern.add(handle);
  grabbable(world, lantern, 0.8, meadowY(0.8, 2) + 0.16, 2);

  const oar = new Group();
  oar.add(post(0.02, 0.025, 1.1, paper(C.dockWood), 7));
  const blade = ball(0.16, paper(C.dockWoodDark), 1);
  blade.scale.set(0.5, 1.4, 0.18);
  blade.position.y = -0.66;
  oar.add(blade);
  oar.rotation.set(0.2, 0, 1.35);
  grabbable(world, oar, -0.9, 0.05, -14.5);

  const stone = ball(0.055, paper(C.rock, { roughness: 0.7 }), 1);
  stone.scale.y = 0.5;
  grabbable(world, stone, 0.4, -0.02, -17.5);
}
