/**
 * pavilion.ts — "Lakeside Sports Pavilion"
 *
 * A bright, saturated, toon-styled indoor sports hall inspired by modern
 * social-sports games: an arched glass shell on a teal steel frame, a warm
 * wood deck wrapping a sunken blue-and-orange court, planters, benches,
 * hanging banners, a big screen — and a stylized summer valley (rounded
 * trees, painterly mountains, drifting clouds) visible through every pane.
 *
 * Authored as flat-shaded papercraft primitives, then collapsed to a handful
 * of draw calls by `mergeStatic`, so it runs comfortably on Quest 3. The
 * sunken court at the center doubles as an open gameplay arena.
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
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
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
  weather,
} from '../papercraft.js';

// ----------------------------------------------------------------------------
// Dimensions & palette
// ----------------------------------------------------------------------------

const HALL = {
  hx: 13, // half-width (X)
  hz: 17, // half-length (Z)
  low: 0.92, // white kicker wall height
  eaves: 4.2, // where the arch springs from
  peak: 8.6, // arch apex
};

// Sunken court pit at the center of the hall.
const PIT = { hx: 5.75, hz: 8, depth: 0.28 };
const STEP = 0.42; // tread depth of the two steps ringing the pit

const C = {
  teal: '#2fb3c4',
  tealDark: '#1e93a6',
  tealDeep: '#12727f',
  white: '#f4f6f5',
  whiteWarm: '#efe9dd',
  glass: '#cdeef7',
  wood: '#c8955c',
  woodAlt: '#b8824a',
  woodDark: '#7c5530',
  courtOrange: '#e8862c',
  courtBlue: '#2f8fd4',
  courtBlueLight: '#4da3e0',
  line: '#f2f5f4',
  orange: '#f08a1d',
  magenta: '#d84fa0',
  yellow: '#f4c927',
  benchTeal: '#2fa9ba',
  leafBright: '#7ecb3f',
  leafDeep: '#4f9e3c',
  leafLime: '#b9e05a',
  trunk: '#8a6238',
  grass: '#84cb52',
  grassFar: '#a8dd6a',
  hill: '#5ec7a8',
  hillLight: '#8fdcc2',
  mountain: '#4fb2a0',
  mountainPale: '#a5ded2',
  snow: '#f2fbf7',
  skyTop: '#5fc0ea',
  skyMid: '#9fe0f0',
  skyHorizon: '#e2f8f0',
  cloud: '#ffffff',
  apron: '#d8d5c9',
  steelGrey: '#b9bfc2',
};

const rng = makeRng(0x9a7e);
const rand = (min: number, max: number) => min + (max - min) * rng();

// Shared materials so the merge pass buckets cleanly.
const glassMat = paper(C.glass, {
  roughness: 0.4,
  transparent: true,
  opacity: 0.22,
});
const netMat = paper('#ffffff', {
  roughness: 0.8,
  transparent: true,
  opacity: 0.4,
});

/** Arch height above the floor at lateral position x (cosine barrel vault). */
function archY(x: number): number {
  const t = Math.min(Math.abs(x) / HALL.hx, 1);
  return HALL.eaves + (HALL.peak - HALL.eaves) * Math.cos((t * Math.PI) / 2);
}

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

export function buildPavilion(world: World): void {
  const env = new Group();
  env.name = 'SportsPavilion';

  buildFloor(env);
  buildCourt(env);
  buildShellFrame(env);
  buildGlassWalls(env);
  buildRoof(env);
  buildMural(env);
  buildFurnishings(env);
  buildBackdrop(env);
  buildSky(env);
  buildLights(env);

  // Visuals: merged to a handful of draw calls, no locomotion component.
  world.createTransformEntity(mergeStatic(env));

  // Locomotion runs on a separate invisible nav group of simple indexed
  // boxes (the locomotor merges + indexes whatever it's given, so it must
  // stay all-indexed and attribute-uniform).
  const nav = buildNav();
  nav.visible = false;
  world
    .createTransformEntity(nav)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  world.scene.fog = new Fog('#d5f1ee', 80, 220);

  buildClouds(world);
  buildProps(world);
}

/** Invisible walkable/collision proxy: floors, pit steps, and wall barriers. */
function buildNav(): Group {
  const g = new Group();
  const mat = paper(C.white);
  const outerHx = PIT.hx + 2 * STEP;
  const outerHz = PIT.hz + 2 * STEP;

  // Deck ring.
  const nsDepth = HALL.hz - outerHz;
  place(g, box(HALL.hx * 2, 0.35, nsDepth, mat), 0, -0.175, -(outerHz + nsDepth / 2));
  place(g, box(HALL.hx * 2, 0.35, nsDepth, mat), 0, -0.175, outerHz + nsDepth / 2);
  const ewWidth = HALL.hx - outerHx;
  place(g, box(ewWidth, 0.35, outerHz * 2, mat), -(outerHx + ewWidth / 2), -0.175, 0);
  place(g, box(ewWidth, 0.35, outerHz * 2, mat), outerHx + ewWidth / 2, -0.175, 0);

  // Pit floor + steps.
  place(g, box(PIT.hx * 2, 0.35, PIT.hz * 2, mat), 0, -PIT.depth - 0.175, 0);
  const stepTops = [-0.093, -0.187];
  for (let s = 0; s < 2; s++) {
    const y = stepTops[s] - 0.06;
    const inHx = PIT.hx + (1 - s) * STEP;
    const inHz = PIT.hz + (1 - s) * STEP;
    place(g, box((inHx + STEP) * 2, 0.12, STEP, mat), 0, y, -(inHz + STEP / 2));
    place(g, box((inHx + STEP) * 2, 0.12, STEP, mat), 0, y, inHz + STEP / 2);
    place(g, box(STEP, 0.12, inHz * 2, mat), -(inHx + STEP / 2), y, 0);
    place(g, box(STEP, 0.12, inHz * 2, mat), inHx + STEP / 2, y, 0);
  }

  // Wall barriers so players stay inside the glass.
  place(g, box(0.3, 7, HALL.hz * 2, mat), -HALL.hx, 3.5, 0);
  place(g, box(0.3, 7, HALL.hz * 2, mat), HALL.hx, 3.5, 0);
  place(g, box(HALL.hx * 2, 7, 0.3, mat), 0, 3.5, -HALL.hz);
  place(g, box(HALL.hx * 2, 7, 0.3, mat), 0, 3.5, HALL.hz);
  return g;
}

// ----------------------------------------------------------------------------
// Floor: wood deck ring, two steps down into the sunken court pit
// ----------------------------------------------------------------------------

function buildFloor(env: Group): void {
  const outerHx = PIT.hx + 2 * STEP;
  const outerHz = PIT.hz + 2 * STEP;

  // Structural slab pieces around the pit (tops at y = 0).
  const slab = paper(C.woodDark);
  const nsDepth = HALL.hz - outerHz;
  place(env, box(HALL.hx * 2, 0.35, nsDepth, slab), 0, -0.175, -(outerHz + nsDepth / 2));
  place(env, box(HALL.hx * 2, 0.35, nsDepth, slab), 0, -0.175, outerHz + nsDepth / 2);
  const ewWidth = HALL.hx - outerHx;
  place(env, box(ewWidth, 0.35, outerHz * 2, slab), -(outerHx + ewWidth / 2), -0.175, 0);
  place(env, box(ewWidth, 0.35, outerHz * 2, slab), outerHx + ewWidth / 2, -0.175, 0);

  // Pit floor (orange court surround) and its two wooden steps.
  place(env, box(PIT.hx * 2, 0.35, PIT.hz * 2, paper(C.courtOrange)), 0, -PIT.depth - 0.175, 0);

  const stepTops = [-0.093, -0.187];
  for (let s = 0; s < 2; s++) {
    const y = stepTops[s] - 0.06;
    const inHx = PIT.hx + (1 - s) * STEP;
    const inHz = PIT.hz + (1 - s) * STEP;
    const stepMat = paper(s ? C.woodAlt : C.wood);
    // North/south treads span the full step width; east/west fill between.
    place(env, box((inHx + STEP) * 2, 0.12, STEP, stepMat), 0, y, -(inHz + STEP / 2));
    place(env, box((inHx + STEP) * 2, 0.12, STEP, stepMat), 0, y, inHz + STEP / 2);
    place(env, box(STEP, 0.12, inHz * 2, stepMat), -(inHx + STEP / 2), y, 0);
    place(env, box(STEP, 0.12, inHz * 2, stepMat), inHx + STEP / 2, y, 0);
  }

  // Deck planks: warm two-tone boards laid over the slab.
  const plank = 0.46;
  const gap = 0.08;
  const pitch = plank + gap;
  // North & south decks — boards run across the hall (along X).
  for (const sign of [-1, 1]) {
    const z0 = outerHz + 0.1;
    const rows = Math.floor((HALL.hz - z0 - 0.15) / pitch);
    for (let i = 0; i < rows; i++) {
      const z = sign * (z0 + pitch / 2 + i * pitch);
      place(
        env,
        box(HALL.hx * 2 - 0.35, 0.03, plank, paper(weather(i % 2 ? C.wood : C.woodAlt, rng, 0.08))),
        0,
        0.015,
        z,
      );
    }
  }
  // East & west decks — boards run along the court (along Z).
  for (const sign of [-1, 1]) {
    const x0 = outerHx + 0.1;
    const cols = Math.floor((HALL.hx - x0 - 0.15) / pitch);
    for (let i = 0; i < cols; i++) {
      const x = sign * (x0 + pitch / 2 + i * pitch);
      place(
        env,
        box(plank, 0.03, outerHz * 2, paper(weather(i % 2 ? C.wood : C.woodAlt, rng, 0.08))),
        x,
        0.015,
        0,
      );
    }
  }
}

// ----------------------------------------------------------------------------
// Court paint, lines, and the across-the-court net
// ----------------------------------------------------------------------------

function buildCourt(env: Group): void {
  const floorY = -PIT.depth;

  // Blue court on the orange surround.
  place(env, box(8.4, 0.02, 13.2, paper(C.courtBlue)), 0, floorY + 0.012, 0);
  // Lighter service panels, two per side of the net.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      place(env, box(3.8, 0.016, 5.6, paper(C.courtBlueLight)), sx * 2.05, floorY + 0.022, sz * 3.35);
    }
  }
  // White boundary + service lines.
  const line = paper(C.line);
  place(env, box(8.4, 0.014, 0.09, line), 0, floorY + 0.03, -6.56);
  place(env, box(8.4, 0.014, 0.09, line), 0, floorY + 0.03, 6.56);
  place(env, box(0.09, 0.014, 13.2, line), -4.16, floorY + 0.03, 0);
  place(env, box(0.09, 0.014, 13.2, line), 4.16, floorY + 0.03, 0);
  place(env, box(8.4, 0.014, 0.09, line), 0, floorY + 0.03, -3.3);
  place(env, box(8.4, 0.014, 0.09, line), 0, floorY + 0.03, 3.3);
  place(env, box(0.09, 0.014, 3.26, line), 0, floorY + 0.03, -4.93);
  place(env, box(0.09, 0.014, 3.26, line), 0, floorY + 0.03, 4.93);

  // Net across the court at z = 0: translucent backing + a visible white
  // grid of merged thin slats, like the chunky toon net in the reference.
  const netTopY = floorY + 0.92;
  place(env, box(10.9, 0.68, 0.02, netMat), 0, netTopY - 0.36, 0);
  const slat = paper(C.white, { roughness: 0.8 });
  for (let i = 0; i <= 26; i++) {
    place(env, box(0.022, 0.68, 0.026, slat), -5.28 + i * 0.406, netTopY - 0.36, 0);
  }
  for (let j = 1; j <= 3; j++) {
    place(env, box(10.6, 0.022, 0.026, slat), 0, netTopY - j * 0.17, 0);
  }
  place(env, box(10.95, 0.07, 0.05, paper(C.white)), 0, netTopY, 0);
  for (const sx of [-1, 1]) {
    const px = sx * 5.5;
    place(env, box(0.09, 1.05, 0.09, paper(C.tealDeep)), px, floorY + 0.52, 0);
    // Chunky toon net-post covers with a candy accent, like the reference.
    const cover = ball(0.3, paper(C.teal), 1);
    cover.scale.set(0.75, 1.35, 0.5);
    place(env, cover, px, floorY + 0.62, 0);
    place(env, ball(0.14, paper(C.magenta), 1), px, netTopY + 0.1, 0);
  }
}

// ----------------------------------------------------------------------------
// Teal steel frame: columns, eaves beams, arched ribs at the gable ends
// ----------------------------------------------------------------------------

function archSegments(): Array<{ x: number; y: number; len: number; ang: number }> {
  const N = 14;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = -HALL.hx + (i / N) * HALL.hx * 2;
    pts.push([x, archY(x)]);
  }
  const segs = [];
  for (let i = 0; i < N; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    segs.push({
      x: (x0 + x1) / 2,
      y: (y0 + y1) / 2,
      len: Math.hypot(x1 - x0, y1 - y0) + 0.06,
      ang: Math.atan2(y1 - y0, x1 - x0),
    });
  }
  return segs;
}

const RIB_ZS = [-17, -12.75, -8.5, -4.25, 0, 4.25, 8.5, 12.75, 17];

function buildShellFrame(env: Group): void {
  const white = paper(C.white, { roughness: 0.7 });
  const teal = paper(C.teal, { roughness: 0.7 });

  // White arch ribs across the hall at every bay line.
  const segs = archSegments();
  for (const z of RIB_ZS) {
    for (const s of segs) {
      const rib = box(s.len, 0.3, 0.26, white);
      rib.position.set(s.x, s.y, z);
      rib.rotation.z = s.ang;
      env.add(rib);
    }
  }

  // Teal purlins running the length of the hall along each arch joint.
  for (let i = 1; i < 14; i++) {
    const x = -HALL.hx + (i / 14) * HALL.hx * 2;
    place(env, box(0.09, 0.09, HALL.hz * 2, teal), x, archY(x) - 0.12, 0);
  }

  // Round teal columns under the eaves on both long sides.
  for (const sx of [-1, 1]) {
    place(env, box(0.22, 0.26, HALL.hz * 2, teal), sx * (HALL.hx - 0.05), HALL.eaves - 0.1, 0);
    for (const z of RIB_ZS) {
      const zc = Math.max(-HALL.hz + 0.35, Math.min(HALL.hz - 0.35, z));
      place(env, post(0.13, 0.15, HALL.eaves, teal, 8), sx * (HALL.hx - 0.28), HALL.eaves / 2, zc);
    }
  }
}

// ----------------------------------------------------------------------------
// Glass: side walls, gable ends, kicker wall, entrance doors
// ----------------------------------------------------------------------------

function buildGlassWalls(env: Group): void {
  const teal = paper(C.teal, { roughness: 0.7 });
  const white = paper(C.white, { roughness: 0.7 });

  // White kicker wall around the whole hall (with a door gap on the south).
  const kick = (w: number, x: number, z: number, rotY: number) => {
    const g = new Group();
    g.add(box(w, HALL.low, 0.16, white).translateY(HALL.low / 2));
    g.add(box(w, 0.09, 0.24, teal).translateY(HALL.low - 0.045));
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    env.add(g);
  };
  kick(HALL.hx * 2, 0, -HALL.hz + 0.1, 0);
  kick(HALL.hz * 2, -HALL.hx + 0.1, 0, Math.PI / 2);
  kick(HALL.hz * 2, HALL.hx - 0.1, 0, Math.PI / 2);
  const doorHalf = 1.35;
  const southW = HALL.hx - doorHalf;
  kick(southW, -(doorHalf + southW / 2), HALL.hz - 0.1, 0);
  kick(southW, doorHalf + southW / 2, HALL.hz - 0.1, 0);

  // Long side walls: glass from kicker to eaves with teal mullions + transom.
  for (const sx of [-1, 1]) {
    const x = sx * (HALL.hx - 0.1);
    const bays = 16;
    const bw = (HALL.hz * 2) / bays;
    for (let i = 0; i <= bays; i++) {
      const z = -HALL.hz + i * bw;
      place(env, box(0.09, HALL.eaves - HALL.low, 0.09, teal), x, (HALL.eaves + HALL.low) / 2, Math.max(-HALL.hz + 0.05, Math.min(HALL.hz - 0.05, z)));
    }
    for (let i = 0; i < bays; i++) {
      const z = -HALL.hz + bw / 2 + i * bw;
      place(env, box(0.05, HALL.eaves - HALL.low - 0.1, bw - 0.12, glassMat), x, (HALL.eaves + HALL.low) / 2, z);
    }
    place(env, box(0.11, 0.09, HALL.hz * 2, teal), x, 2.55, 0);
  }

  // Gable ends: stepped glass following the arch, teal mullions, white fascia.
  for (const sz of [-1, 1]) {
    const z = sz * (HALL.hz - 0.1);
    const bays = 12;
    const bw = (HALL.hx * 2) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = -HALL.hx + i * bw;
      const h = archY(Math.min(Math.abs(x), HALL.hx - 0.01)) - 0.25;
      place(env, box(0.09, h - HALL.low, 0.09, teal), Math.max(-HALL.hx + 0.05, Math.min(HALL.hx - 0.05, x)), (h + HALL.low) / 2, z);
    }
    for (let i = 0; i < bays; i++) {
      const x = -HALL.hx + bw / 2 + i * bw;
      const isDoor = sz > 0 && Math.abs(x) < doorHalf + bw / 2;
      const h = archY(x) - 0.3;
      const bottom = isDoor ? 0.05 : HALL.low;
      place(env, box(bw - 0.12, h - bottom, 0.05, glassMat), x, (h + bottom) / 2, z);
    }
    place(env, box(HALL.hx * 2, 0.09, 0.11, teal), 0, 2.55, z);
  }

  // South entrance: teal door frames + white header + welcome sign.
  place(env, box(0.14, 2.4, 0.2, paper(C.tealDark)), -doorHalf, 1.2, HALL.hz - 0.1);
  place(env, box(0.14, 2.4, 0.2, paper(C.tealDark)), doorHalf, 1.2, HALL.hz - 0.1);
  place(env, box(0.1, 2.4, 0.12, paper(C.tealDark)), 0, 1.2, HALL.hz - 0.1);
  place(env, box(doorHalf * 2 + 0.3, 0.22, 0.24, white), 0, 2.5, HALL.hz - 0.1);
  for (const sx of [-1, 1]) {
    place(env, box(0.5, 0.06, 0.05, paper(C.steelGrey)), sx * doorHalf * 0.5, 1.05, HALL.hz - 0.2);
  }
}

// ----------------------------------------------------------------------------
// Roof: glass barrel vault; the two south bays are white skylight grids
// ----------------------------------------------------------------------------

function buildRoof(env: Group): void {
  const segs = archSegments();
  const white = paper(C.whiteWarm, { roughness: 0.8 });
  const frame = paper(C.white, { roughness: 0.7 });

  for (let b = 0; b < RIB_ZS.length - 1; b++) {
    const z0 = RIB_ZS[b];
    const z1 = RIB_ZS[b + 1];
    const zc = (z0 + z1) / 2;
    const bw = z1 - z0 - 0.3;
    const solid = zc > 8.4; // south bays read as the white panel roof up close
    for (const s of segs) {
      const panel = box(s.len, solid ? 0.1 : 0.05, bw, solid ? white : glassMat);
      panel.position.set(s.x, s.y + 0.12, zc);
      panel.rotation.z = s.ang;
      env.add(panel);
      if (solid) {
        const grid = box(s.len, 0.14, 0.1, frame);
        grid.position.set(s.x, s.y + 0.14, zc);
        grid.rotation.z = s.ang;
        env.add(grid);
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Teal wave mural along the kicker wall (the swirl graphics in the reference)
// ----------------------------------------------------------------------------

function buildMural(env: Group): void {
  const teal = paper(C.teal, { roughness: 0.85 });
  const pale = paper('#a8dfe6', { roughness: 0.85 });

  const wave = (len: number, cx: number, cz: number, rotY: number, seed: number) => {
    const g = new Group();
    const n = Math.floor(len / 0.55);
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + 0.3 + i * 0.55;
      const y1 = 0.45 + Math.sin(i * 0.55 + seed) * 0.16;
      const y2 = 0.38 + Math.sin(i * 0.47 + seed + 2.1) * 0.12;
      g.add(box(0.6, 0.2, 0.03, teal).translateX(x).translateY(y1));
      g.add(box(0.6, 0.12, 0.03, pale).translateX(x).translateY(y2));
    }
    g.position.set(cx, 0, cz);
    g.rotation.y = rotY;
    env.add(g);
  };

  wave(HALL.hx * 2 - 1, 0, -HALL.hz + 0.21, 0, 0.4);
  wave(HALL.hz * 2 - 1, -HALL.hx + 0.21, 0, Math.PI / 2, 1.7);
  wave(HALL.hz * 2 - 1, HALL.hx - 0.21, 0, -Math.PI / 2, 3.1);
  wave(HALL.hx - 2.9, -(1.35 + (HALL.hx - 1.35) / 2), HALL.hz - 0.21, Math.PI, 5.2);
  wave(HALL.hx - 2.9, 1.35 + (HALL.hx - 1.35) / 2, HALL.hz - 0.21, Math.PI, 6.0);
}

// ----------------------------------------------------------------------------
// Furnishings: benches, planters, banners, screen, umpire chair, clutter
// ----------------------------------------------------------------------------

function bench(): Group {
  const g = new Group();
  const frame = paper(C.tealDark);
  const seat = paper(C.benchTeal);
  g.add(box(1.9, 0.07, 0.24, seat).translateY(0.46).translateZ(0.13));
  g.add(box(1.9, 0.07, 0.24, seat).translateY(0.46).translateZ(-0.13));
  g.add(box(1.9, 0.2, 0.06, seat).translateY(0.82).translateZ(-0.24));
  for (const sx of [-0.82, 0.82]) {
    g.add(box(0.07, 0.46, 0.4, frame).translateX(sx).translateY(0.23));
    g.add(box(0.07, 0.5, 0.07, frame).translateX(sx).translateY(0.66).translateZ(-0.22));
  }
  return g;
}

function planter(width: number): Group {
  const g = new Group();
  g.add(box(width, 0.34, 0.38, paper(C.tealDark)).translateY(0.17));
  const greens = [C.leafDeep, C.leafBright, C.leafLime];
  const n = Math.floor(width / 0.3);
  for (let i = 0; i < n; i++) {
    const b = ball(rand(0.14, 0.22), paper(greens[i % 3]), 1);
    b.position.set(-width / 2 + 0.25 + i * 0.3, 0.42 + rand(0, 0.08), rand(-0.06, 0.06));
    g.add(b);
  }
  return g;
}

function banner(): Group {
  const g = new Group();
  g.add(box(0.85, 2.4, 0.03, paper(C.white, { roughness: 0.85 })));
  const swoosh = box(1.0, 0.34, 0.032, paper(C.orange));
  swoosh.rotation.z = 0.5;
  g.add(swoosh.translateY(0.35));
  const swoosh2 = box(0.9, 0.22, 0.032, paper(C.yellow));
  swoosh2.rotation.z = 0.55;
  g.add(swoosh2.translateY(-0.25));
  g.add(box(0.85, 0.22, 0.032, paper(C.teal)).translateY(-1.05));
  g.add(box(0.9, 0.07, 0.07, paper(C.tealDark)).translateY(1.24));
  return g;
}

function umpireChair(): Group {
  const g = new Group();
  const white = paper(C.white, { roughness: 0.7 });
  for (const sz of [-0.35, 0.35]) {
    const rail = box(0.07, 2.3, 0.07, white);
    rail.rotation.x = sz > 0 ? -0.22 : 0.22;
    g.add(rail.translateY(1.15).translateZ(sz));
  }
  for (let i = 0; i < 5; i++) {
    const ry = 0.4 + i * 0.42;
    g.add(box(0.5, 0.05, 0.07, white).translateY(ry).translateZ(0.35 - ry * 0.15));
  }
  g.add(box(0.62, 0.08, 0.62, white).translateY(2.28));
  g.add(box(0.55, 0.45, 0.08, paper(C.orange)).translateY(2.55).translateZ(-0.28));
  g.add(box(0.55, 0.1, 0.5, paper(C.orange)).translateY(2.34).translateZ(-0.03));
  // curved sun canopy
  for (let i = 0; i < 4; i++) {
    const seg = box(0.7, 0.05, 0.5, paper(C.yellow));
    seg.rotation.z = -0.5 + i * 0.33;
    seg.position.set(-0.35 + i * 0.24, 3.0 + Math.sin(i * 0.7) * 0.12, -0.05);
    g.add(seg);
  }
  return g;
}

function bigScreen(): Group {
  const g = new Group();
  const white = paper(C.white, { roughness: 0.7 });
  for (const sx of [-1.5, 1.5]) {
    g.add(box(0.12, 3.2, 0.12, white).translateX(sx).translateY(1.6));
    g.add(box(0.12, 0.12, 0.9, white).translateX(sx).translateY(0.06));
  }
  g.add(box(3.6, 2.1, 0.14, paper(C.tealDark)).translateY(2.6));
  const face = new Mesh(
    new BoxGeometry(3.3, 1.85, 0.05),
    new MeshBasicMaterial({ color: '#fbfcf8' }),
  );
  face.position.set(0, 2.6, 0.06);
  g.add(face);
  // Cheerful abstract "player" graphic, unlit so it pops like a real display.
  const shapes: Array<[number, number, number, number, string, number]> = [
    [0.55, 1.0, -0.55, 2.5, C.magenta, 0.45],
    [0.4, 0.8, 0.1, 2.4, C.orange, -0.35],
    [0.35, 0.35, 0.75, 2.9, C.yellow, 0],
    [1.1, 0.18, 0.45, 2.15, C.teal, 0.15],
  ];
  for (const [w, h, x, y, color, rot] of shapes) {
    const s = new Mesh(new BoxGeometry(w, h, 0.04), new MeshBasicMaterial({ color }));
    s.position.set(x, y, 0.1);
    s.rotation.z = rot;
    g.add(s);
  }
  return g;
}

function buildFurnishings(env: Group): void {
  // Benches on the east & west decks facing the court.
  for (const [x, z, ry] of [
    [-10.6, -3.5, Math.PI / 2],
    [-10.6, 3.5, Math.PI / 2],
    [10.6, -3.5, -Math.PI / 2],
    [10.6, 3.5, -Math.PI / 2],
    [-5.5, -14.8, 0],
    [5.5, -14.8, 0],
  ] as Array<[number, number, number]>) {
    const b = bench();
    b.rotation.y = ry;
    place(env, b, x, 0.03, z);
  }

  // Orange chair, kicked slightly askew (a nod to the reference).
  const chair = new Group();
  chair.add(box(0.46, 0.06, 0.44, paper(C.orange)).translateY(0.46));
  chair.add(box(0.46, 0.52, 0.06, paper(C.orange)).translateY(0.78).translateZ(-0.2));
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
    chair.add(box(0.05, 0.46, 0.05, paper(C.steelGrey)).translateX(lx).translateY(0.23).translateZ(lz));
  }
  chair.rotation.y = 0.7;
  place(env, chair, -11.2, 0.03, 9.2);

  // Umpire ladder chair on the west deck at the net line.
  const ump = umpireChair();
  ump.rotation.y = Math.PI / 2;
  place(env, ump, -11.3, 0.03, 0);

  // Big screen on the north deck, angled toward the court.
  const screen = bigScreen();
  screen.rotation.y = 0.35;
  place(env, screen, -8.6, 0.03, -14.2);

  // Wall planters along the kicker on three sides + two tubs by the door.
  for (const [w, x, z, ry] of [
    [1.6, -6, -16.4, 0],
    [1.6, 6, -16.4, 0],
    [1.6, -12.4, -8, Math.PI / 2],
    [1.6, -12.4, 8, Math.PI / 2],
    [1.6, 12.4, -8, Math.PI / 2],
    [1.6, 12.4, 8, Math.PI / 2],
  ] as Array<[number, number, number, number]>) {
    const p = planter(w);
    p.rotation.y = ry;
    place(env, p, x, HALL.low, z);
  }
  for (const sx of [-1, 1]) {
    const tub = new Group();
    tub.add(post(0.34, 0.42, 0.55, paper(C.tealDark), 8).translateY(0.28));
    tub.add(post(0.06, 0.08, 0.9, paper(C.trunk), 6).translateY(0.9));
    tub.add(ball(0.45, paper(C.leafBright), 1).translateY(1.65));
    tub.add(ball(0.3, paper(C.leafLime), 1).translateY(1.95).translateX(0.2));
    place(env, tub, sx * 2.6, 0.03, 15.9);
  }

  // Hanging banners along both long sides.
  for (const sx of [-1, 1]) {
    for (const z of [-12.75, -4.25, 4.25, 12.75]) {
      const b = banner();
      b.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      place(env, b, sx * (HALL.hx - 0.75), 4.6, z);
    }
  }

  // Cooler barrel + bin near the north-east corner.
  place(env, post(0.3, 0.3, 0.72, paper(C.orange), 10), 11.6, 0.39, -14.6);
  place(env, post(0.31, 0.31, 0.06, paper(C.white), 10), 11.6, 0.78, -14.6);
  place(env, post(0.26, 0.24, 0.8, paper(C.steelGrey), 10), 12.2, 0.43, -13.5);
  place(env, post(0.28, 0.28, 0.05, paper('#8d9497'), 10), 12.2, 0.86, -13.5);

  // Duffel bag by the benches.
  const duffel = ball(0.32, paper(C.magenta), 1);
  duffel.scale.set(1.5, 0.85, 0.9);
  place(env, duffel, 10.4, 0.2, 5.6);

  // White sign board with a toon logo hung from the north arch, facing court.
  place(env, box(3.4, 1.0, 0.12, paper(C.white)), 0, 6.2, -HALL.hz + 0.5);
  place(env, box(1.7, 0.28, 0.06, paper(C.teal)), -0.45, 6.3, -HALL.hz + 0.42);
  place(env, box(1.1, 0.2, 0.06, paper(C.orange)), -0.7, 5.95, -HALL.hz + 0.42);
  place(env, ball(0.26, paper(C.yellow), 1), 1.15, 6.15, -HALL.hz + 0.4);
  for (const sx of [-1.3, 1.3]) {
    place(env, box(0.06, 1.7, 0.06, paper(C.white)), sx, 7.5, -HALL.hz + 0.5);
  }
}

// ----------------------------------------------------------------------------
// Backdrop: grass, trees, hills, painterly mountains, tiny town
// ----------------------------------------------------------------------------

function tree(size: number): Group {
  const g = new Group();
  g.add(post(0.09 * size, 0.13 * size, 0.9 * size, paper(C.trunk), 6).translateY(0.45 * size));
  const crown = ball(0.85 * size, paper('#ffffff'), 1);
  gradientPaint(crown, C.leafDeep, C.leafLime);
  crown.position.y = 1.35 * size;
  g.add(crown);
  const tuft = ball(0.45 * size, paper(C.leafBright), 1);
  tuft.position.set(0.45 * size, 1.8 * size, 0.15 * size);
  g.add(tuft);
  return g;
}

function buildBackdrop(env: Group): void {
  // Grass carpet and a pale apron ring hugging the hall's footprint.
  const grass = post(118, 118, 0.3, paper('#ffffff'), 28);
  radialPaint(grass, C.grass, C.grassFar);
  place(env, grass, 0, -0.5, 0);
  const apron = paper(C.apron);
  place(env, box(HALL.hx * 2 + 5, 0.22, 2.5, apron), 0, -0.26, -(HALL.hz + 1.25));
  place(env, box(HALL.hx * 2 + 5, 0.22, 2.5, apron), 0, -0.26, HALL.hz + 1.25);
  place(env, box(2.5, 0.22, HALL.hz * 2, apron), -(HALL.hx + 1.25), -0.26, 0);
  place(env, box(2.5, 0.22, HALL.hz * 2, apron), HALL.hx + 1.25, -0.26, 0);
  // Path from the south door.
  for (let i = 0; i < 6; i++) {
    place(env, box(2.2 - i * 0.12, 0.06, 1.1, paper(C.whiteWarm)), 0, -0.3, HALL.hz + 1.6 + i * 1.35);
  }

  // Rounded trees scattered outside the glass…
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(23, 55);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (Math.abs(x) < HALL.hx + 4 && Math.abs(z) < HALL.hz + 4) continue;
    place(env, tree(rand(1.4, 3.2)), x, -0.35, z);
  }
  // …plus a lush grove framing the view through the north gable.
  for (let i = 0; i < 10; i++) {
    const x = rand(-26, 26);
    const z = -HALL.hz - rand(6, 24);
    place(env, tree(rand(1.8, 3.6)), x, -0.35, z);
  }

  // Soft rolling hills.
  for (const [x, z, r, sq, c1, c2] of [
    [-45, -55, 26, 0.22, C.hill, C.hillLight],
    [40, -60, 30, 0.2, C.hill, C.hillLight],
    [65, 10, 24, 0.24, C.hill, C.hillLight],
    [-65, 20, 27, 0.2, C.hill, C.hillLight],
    [10, 70, 30, 0.18, C.hill, C.hillLight],
  ] as Array<[number, number, number, number, string, string]>) {
    const h = ball(r, paper('#ffffff'), 1);
    gradientPaint(h, c1, c2);
    h.scale.y = sq;
    place(env, h, x, -0.6, z);
  }

  // Painterly mountain ring with pale tops.
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const r = rand(88, 112);
    const height = rand(26, 44);
    const base = rand(22, 34);
    const m = cone(base, height, paper('#ffffff'), 7);
    gradientPaint(m, C.mountain, C.mountainPale);
    m.rotation.y = rand(0, Math.PI);
    place(env, m, Math.sin(a) * r, height / 2 - 3, Math.cos(a) * r);
    const cap = cone(base * 0.3, height * 0.24, paper(C.snow), 7);
    cap.rotation.y = rand(0, Math.PI);
    place(env, cap, Math.sin(a) * r, height - 3 - height * 0.11, Math.cos(a) * r);
  }

  // A tiny toon town to the north-west.
  for (let i = 0; i < 7; i++) {
    const x = -30 - rand(0, 16);
    const z = -34 - rand(0, 14);
    const w = rand(2.4, 5);
    const h = rand(1.8, 4.2);
    place(env, box(w, h, rand(2.4, 4.5), paper(i % 2 ? C.white : C.whiteWarm)), x, h / 2 - 0.4, z);
    place(env, box(w * 0.95, 0.35, 3.4, paper(i % 3 ? C.teal : C.orange)), x, h - 0.2, z);
  }
  // Striped carousel pavilion — a splash of candy color in the distance.
  const car = new Group();
  car.add(post(2.8, 2.8, 2.2, paper(C.white), 10).translateY(1.1));
  car.add(cone(3.6, 2.4, paper(C.orange), 10).translateY(3.4));
  car.add(post(2.6, 2.6, 0.3, paper(C.yellow), 10).translateY(2.5));
  car.add(post(1.6, 1.6, 0.3, paper(C.magenta), 10).translateY(3.3));
  place(env, car, 34, -0.4, -38);
}

// ----------------------------------------------------------------------------
// Sky dome + merged static clouds
// ----------------------------------------------------------------------------

function buildSky(env: Group): void {
  const sky = new Mesh(
    new SphereGeometry(150, 24, 12),
    new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false }),
  );
  gradientPaint(sky, C.skyHorizon, C.skyTop);
  sky.userData.noMerge = true;
  env.add(sky);
}

function buildClouds(world: World): void {
  // A few puffy clouds drift very slowly — kept live (not merged) and cheap.
  for (let i = 0; i < 5; i++) {
    const g = new Group();
    const puffs = 3 + Math.floor(rng() * 2);
    for (let p = 0; p < puffs; p++) {
      const puff = new Mesh(
        new SphereGeometry(rand(4, 8), 10, 7),
        new MeshBasicMaterial({ color: C.cloud }),
      );
      puff.position.set(p * rand(4, 6) - puffs * 2.4, rand(-1, 1.4), rand(-2, 2));
      puff.scale.y = 0.55;
      g.add(puff);
    }
    const a = rand(0, Math.PI * 2);
    g.position.set(Math.sin(a) * rand(55, 105), rand(34, 55), Math.cos(a) * rand(55, 105));
    g.userData = { bobAmp: 0.6, bobSpeed: 0.05, driftAmp: rand(4, 9), driftSpeed: 0.008, phase: rand(0, 6) };
    world.createTransformEntity(g).addComponent(Drifter);
  }
}

// ----------------------------------------------------------------------------
// Lighting: bright summer daylight
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  env.add(new HemisphereLight('#eafcff', '#79b874', 0.95));
  env.add(new AmbientLight('#d3f0f2', 0.5));
  const sun = new DirectionalLight('#fff3dc', 1.7);
  sun.position.set(35, 55, 22);
  env.add(sun);
}

// ----------------------------------------------------------------------------
// Grabbable props: two paddles and a ball, ready for a rally
// ----------------------------------------------------------------------------

function paddle(faceColor: string): Group {
  const g = new Group();
  g.add(post(0.021, 0.025, 0.11, paper(C.trunk), 7).translateY(-0.12));
  const face = post(0.09, 0.09, 0.024, paper(faceColor), 12);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const rim = post(0.093, 0.093, 0.012, paper(C.white), 12);
  rim.rotation.x = Math.PI / 2;
  g.add(rim.translateY(-0.006));
  return g;
}

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  const p1 = paddle(C.orange);
  p1.rotation.set(0.4, 0.3, 1.4);
  grabbable(world, p1, -1.4, -PIT.depth + 0.1, 2.6);
  const p2 = paddle(C.magenta);
  p2.rotation.set(-0.2, 1.1, 1.5);
  grabbable(world, p2, 1.2, -PIT.depth + 0.1, -2.8);
  grabbable(world, ball(0.036, paper(C.yellow, { roughness: 0.6 }), 1), 0.6, -PIT.depth + 0.05, 1.8);
}
