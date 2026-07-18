/**
 * cove-real.ts — "Lantern Cove" (realistic)
 *
 * The golden-hour lake island, rebuilt for realism: a noise-displaced
 * terrain mesh with a baked splat texture and 3D grass tufts, PBR water with
 * scrolling ripple normals reflecting a physical sunset sky (the glitter
 * path emerges from the environment map, not painted flecks), bough-card
 * pines, a live scrolling waterfall, striped-fabric hot-air balloons, and
 * warm lantern pools with a flickering fire pit. One static shadow pass;
 * everything procedural.
 *
 * Layout matches src/environments/cove.ts, whose exported nav mesh drives
 * locomotion here too.
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
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Drifter } from '../drift.js';
import {
  applyRealismRenderer,
  bakeEnvironment,
  onTick,
  skyDome,
  type SkySpec,
} from '../realism.js';
import {
  balloonFabric,
  barkTexture,
  cloudCard,
  fallStreaks,
  foliageCard,
  glowSprite,
  grassTuftCard,
  islandSplat,
  pineCard,
  rockTexture,
  srand,
  waterNormal,
  woodPlanks,
} from '../textures.js';
import { buildNav } from './cove.js';

// ----------------------------------------------------------------------------
// Layout (must mirror cove.ts) & light rig
// ----------------------------------------------------------------------------

const WATER_Y = -0.6;
const ISLAND = { r: 20, squash: 0.06 };

let seed = 913;
const rand = (min: number, max: number) => {
  seed = (seed * 16807) % 2147483647;
  return min + ((seed & 0xffff) / 0x10000) * (max - min);
};

/** Analytic meadow dome height (identical to the stylized cove). */
function domeY(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const t = Math.min(r / ISLAND.r, 1);
  const domeH = ISLAND.r * ISLAND.squash * 2;
  return domeH * Math.sqrt(Math.max(1 - t * t, 0)) - domeH;
}

/** Deterministic value noise for terrain detail. */
function hash2(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000;
}
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function terrainDetail(x: number, z: number): number {
  const n = vnoise(x * 0.35, z * 0.35) * 0.65 + vnoise(x * 1.1, z * 1.1) * 0.35;
  const r = Math.hypot(x, z);
  // Flat in the central arena, fades out underwater.
  const fade = Math.min(1, Math.max(0, (r - 4) / 6)) * Math.min(1, Math.max(0, (16 - r) / 4));
  return (n - 0.5) * 0.26 * fade;
}
function groundY(x: number, z: number): number {
  return domeY(x, z) + terrainDetail(x, z);
}

const SKY: SkySpec = {
  top: '#1d2c56',
  mid: '#8a5a72',
  horizon: '#ff9e4a',
  sunDirection: new Vector3(0, 0.16, -1),
  sunColor: '#ffd9a0',
  sunSize: 0.99955,
  haloPower: 22,
  haloStrength: 0.85,
};

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

export function buildCoveReal(world: World): void {
  srand(0xc0de);
  applyRealismRenderer(world, 1.0);
  bakeEnvironment(world, SKY, 1.0);
  world.scene.fog = new Fog('#b06a48', 70, 260);

  const env = new Group();
  env.name = 'LanternCoveReal';

  buildTerrain(env);
  buildWater(env);
  buildDock(env);
  buildFlora(env);
  buildRocks(env);
  buildLanternsAndFire(env);
  buildWaterfall(env);
  buildMountains(env);
  env.add(skyDome(SKY));
  buildLights(env);

  world.createTransformEntity(env);

  const nav = buildNav();
  nav.visible = false;
  world
    .createTransformEntity(nav)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  buildBalloons(world);
  buildClouds(world);
  buildProps(world);
}

// ----------------------------------------------------------------------------
// Terrain + near-field grass
// ----------------------------------------------------------------------------

function buildTerrain(env: Group): void {
  const segs = 88;
  const span = 44;
  const geom = new PlaneGeometry(span, span, segs, segs);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, groundY(x, z));
  }
  geom.computeVertexNormals();
  const mat = new MeshStandardMaterial({
    map: islandSplat(),
    roughness: 1,
  });
  const terrain = new Mesh(geom, mat);
  terrain.receiveShadow = true;
  env.add(terrain);

  // 3D grass tufts: crossed alpha cards, merged into one draw call.
  const tuft = grassTuftCard();
  const tuftMat = new MeshStandardMaterial({
    map: tuft,
    alphaTest: 0.22,
    side: DoubleSide,
    roughness: 1,
  });
  const cards: Mesh[] = [];
  for (let i = 0; i < 130; i++) {
    const a = rand(0, Math.PI * 2);
    const r = 1.5 + Math.sqrt(rand(0, 1)) * 10.5;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const s = rand(0.28, 0.6);
    const y = groundY(x, z);
    for (let k = 0; k < 2; k++) {
      const card = new Mesh(new PlaneGeometry(s, s * 0.6), tuftMat);
      card.position.set(x, y + s * 0.28, z);
      card.rotation.y = (k * Math.PI) / 2 + rand(-0.4, 0.4);
      cards.push(card);
    }
  }
  const grass = mergeMeshes(tuftMat, cards);
  grass.castShadow = false;
  env.add(grass);
}

/** Bakes transforms and merges (all-indexed geometry only). */
function mergeMeshes(material: MeshStandardMaterial, meshes: Mesh[]): Mesh {
  const geoms = meshes.map((m) => {
    m.updateMatrix();
    return m.geometry.applyMatrix4(m.matrix);
  });
  const merged = new Mesh(mergeGeometries(geoms, false)!, material);
  merged.castShadow = true;
  merged.receiveShadow = true;
  return merged;
}

// ----------------------------------------------------------------------------
// Water: PBR plane with scrolling ripple normals
// ----------------------------------------------------------------------------

function buildWater(env: Group): void {
  const normal = waterNormal();
  normal.repeat.set(26, 26);
  const mat = new MeshStandardMaterial({
    color: '#0e2f3c',
    roughness: 0.1,
    metalness: 0.55,
    normalMap: normal,
    envMapIntensity: 1.35,
  });
  mat.normalScale.set(0.42, 0.42);
  const water = new Mesh(new PlaneGeometry(420, 420), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  env.add(water);
  onTick((delta) => {
    normal.offset.x += delta * 0.0075;
    normal.offset.y += delta * 0.0042;
  });
}

// ----------------------------------------------------------------------------
// Dock (north, toward the sun) with an end lantern
// ----------------------------------------------------------------------------

function buildDock(env: Group): void {
  const deckY = -0.08;
  const wood = woodPlanks('#6e4c2c', 6, 512);
  const mat = new MeshStandardMaterial({
    map: wood.map,
    normalMap: wood.normalMap,
    roughnessMap: wood.roughnessMap,
  });
  const parts: Mesh[] = [];
  const part = (g: BoxGeometry | CylinderGeometry, x: number, y: number, z: number, rx = 0) => {
    const m = new Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parts.push(m);
  };
  part(new BoxGeometry(2.1, 0.1, 0.5), 0, -0.3, -10.55);
  part(new BoxGeometry(2.1, 0.1, 0.5), 0, -0.18, -10.95);
  for (let i = 0; i < 14; i++) {
    part(new BoxGeometry(2.1, 0.07, 0.54), 0, deckY, -(11.2 + i * 0.62));
  }
  part(new BoxGeometry(0.16, 0.12, 9.0), -0.85, deckY - 0.09, -15.5);
  part(new BoxGeometry(0.16, 0.12, 9.0), 0.85, deckY - 0.09, -15.5);
  for (const z of [-11.8, -14.2, -16.6, -19.0]) {
    for (const sx of [-0.95, 0.95]) {
      part(new CylinderGeometry(0.09, 0.11, 1.35, 10), sx, deckY - 0.55, z);
    }
  }
  part(new CylinderGeometry(0.07, 0.09, 1.0, 10), -0.95, deckY + 0.42, -19.6);
  part(new CylinderGeometry(0.07, 0.09, 1.0, 10), 0.95, deckY + 0.42, -19.6);
  env.add(mergeMeshes(mat, parts));

  lantern(env, 0.95, deckY + 1.05, -19.6, true);

  // Rowboat: displaced hull + bench, moored beside the dock.
  const hullMat = new MeshStandardMaterial({ color: '#7e3c22', roughness: 0.75 });
  const hull = new Mesh(new SphereGeometry(1.1, 18, 12), hullMat);
  hull.scale.set(0.55, 0.3, 1.15);
  hull.position.set(2.6, WATER_Y + 0.16, -17.8);
  hull.rotation.y = 0.35;
  hull.castShadow = true;
  env.add(hull);
  const bench = new Mesh(new BoxGeometry(0.85, 0.05, 0.18), hullMat);
  bench.position.set(2.6, WATER_Y + 0.3, -17.8);
  bench.rotation.y = 0.35;
  env.add(bench);
}

// ----------------------------------------------------------------------------
// Pines (bough cards), golden aspens, rocks
// ----------------------------------------------------------------------------

const pineTex = () => pineCard('#16301f', '#3e6a36');

function buildFlora(env: Group): void {
  const bark = barkTexture('#4a3826');
  const trunkMat = new MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normalMap,
    roughness: 1,
  });
  const boughTex = pineTex();
  const boughMat = new MeshStandardMaterial({
    map: boughTex,
    alphaTest: 0.3,
    side: DoubleSide,
    roughness: 0.95,
  });
  const goldTex = foliageCard('#7a5c1e', '#e0b84e');
  const goldMat = new MeshStandardMaterial({
    map: goldTex,
    alphaTest: 0.28,
    side: DoubleSide,
    roughness: 0.95,
  });

  const trunks: Mesh[] = [];
  const boughs: Mesh[] = [];
  const golds: Mesh[] = [];

  const pineAt = (x: number, z: number, s: number, baseY?: number) => {
    const y = baseY ?? groundY(x, z);
    const trunk = new Mesh(new CylinderGeometry(0.07 * s, 0.14 * s, 1.5 * s, 8), trunkMat);
    trunk.position.set(x, y + 0.75 * s, z);
    trunks.push(trunk);
    // Radial bough cards, wider and drooping near the base.
    const tiers = 5;
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const size = (2.4 - frac * 1.55) * s;
      const cy = y + (0.5 + frac * 1.5) * s;
      const n = t >= tiers - 2 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const card = new Mesh(new PlaneGeometry(size, size), boughMat);
        card.position.set(x, cy + size * 0.28, z);
        card.rotation.y = (k / n) * Math.PI + rand(-0.3, 0.3) + t;
        boughs.push(card);
      }
    }
  };
  const aspenAt = (x: number, z: number, s: number) => {
    const y = groundY(x, z);
    const trunk = new Mesh(new CylinderGeometry(0.05 * s, 0.08 * s, 1.6 * s, 8), trunkMat);
    trunk.position.set(x, y + 0.8 * s, z);
    trunks.push(trunk);
    for (let k = 0; k < 3; k++) {
      const card = new Mesh(new PlaneGeometry(1.5 * s, 1.7 * s), goldMat);
      card.position.set(x, y + 1.85 * s, z);
      card.rotation.y = (k / 3) * Math.PI + rand(-0.25, 0.25);
      golds.push(card);
    }
  };

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.15, 0.15);
    if (Math.abs(Math.sin(a)) < 0.28 && Math.cos(a) < 0) continue; // dock lane
    const r = rand(9.5, 12);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (rand(0, 1) < 0.3) aspenAt(x, z, rand(1.0, 1.5));
    else pineAt(x, z, rand(1.0, 1.8));
  }

  // Outer pine islands: dark mounds with tree clusters.
  const moundMat = new MeshStandardMaterial({ color: '#243824', roughness: 1 });
  const mounds: Mesh[] = [];
  const islands: Array<[number, number, number, number]> = [
    [-30, -18, 9, 5],
    [26, -26, 7, 4],
    [38, 8, 11, 6],
    [-38, 14, 8, 4],
    [12, 34, 6, 3],
    [-16, 38, 7, 3],
  ];
  for (const [x, z, r, trees] of islands) {
    const mound = new Mesh(new SphereGeometry(r, 20, 12), moundMat);
    mound.scale.y = 0.3;
    mound.position.set(x, WATER_Y - r * 0.12, z);
    mounds.push(mound);
    const topY = WATER_Y - r * 0.12 + r * 0.3;
    for (let t = 0; t < trees; t++) {
      const a = rand(0, Math.PI * 2);
      const rr = rand(0, r * 0.45);
      pineAt(x + Math.sin(a) * rr, z + Math.cos(a) * rr, rand(0.9, 1.7), topY - (rr / r) * 1.1 - 0.5);
    }
  }
  env.add(mergeMeshes(moundMat, mounds));
  env.add(mergeMeshes(trunkMat, trunks));
  const boughMesh = mergeMeshes(boughMat, boughs);
  env.add(boughMesh);
  if (golds.length) env.add(mergeMeshes(goldMat, golds));
}

function buildRocks(env: Group): void {
  const rock = rockTexture();
  const mat = new MeshStandardMaterial({
    map: rock.map,
    normalMap: rock.normalMap,
    roughness: 1,
  });
  const rocks: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(8, 12.4);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const s = rand(0.22, 0.62);
    const geom = new IcosahedronGeometry(s, 2);
    const p = geom.getAttribute('position');
    const squash = rand(0.55, 0.8);
    for (let v = 0; v < p.count; v++) {
      const px = p.getX(v);
      const py = p.getY(v);
      const pz = p.getZ(v);
      const f = 1 + (vnoise(px * 2.4 + i * 9, (py + pz) * 2.4) - 0.5) * 0.55;
      p.setXYZ(v, px * f, py * f * squash, pz * f);
    }
    geom.computeVertexNormals();
    const m = new Mesh(geom, mat);
    m.position.set(x, groundY(x, z) + s * 0.25, z);
    m.rotation.y = rand(0, Math.PI * 2);
    rocks.push(m);
  }
  env.add(mergeMeshes(mat, rocks));
}

// ----------------------------------------------------------------------------
// Lanterns + fire pit (the cove's namesake glow)
// ----------------------------------------------------------------------------

function lantern(env: Group, x: number, y: number, z: number, lit: boolean): void {
  const dark = new MeshStandardMaterial({ color: '#241a10', roughness: 0.9 });
  const cap = new Mesh(new BoxGeometry(0.17, 0.03, 0.17), dark);
  cap.position.set(x, y + 0.11, z);
  env.add(cap);
  const base = new Mesh(new BoxGeometry(0.16, 0.03, 0.16), dark);
  base.position.set(x, y - 0.12, z);
  env.add(base);
  const glassMat = new MeshStandardMaterial({
    color: '#3a2a14',
    emissive: new Color('#ffb75e'),
    emissiveIntensity: lit ? 2.2 : 1.1,
    roughness: 0.4,
  });
  const glass = new Mesh(new BoxGeometry(0.12, 0.17, 0.12), glassMat);
  glass.position.set(x, y, z);
  env.add(glass);
  const halo = new Mesh(
    new PlaneGeometry(0.55, 0.55),
    new MeshBasicMaterial({
      map: glowSprite('#ffb75e'),
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.position.set(x, y, z);
  halo.userData.noMerge = true;
  // Cheap billboard: two crossed glow planes.
  const halo2 = halo.clone();
  halo2.rotation.y = Math.PI / 2;
  env.add(halo, halo2);
  if (lit) {
    const light = new PointLight('#ffb160', 4.5, 10, 1.9);
    light.position.set(x, y + 0.05, z);
    env.add(light);
  }
}

function buildLanternsAndFire(env: Group): void {
  const postMat = new MeshStandardMaterial({ color: '#2e2214', roughness: 0.95 });
  const posts: Array<[number, number, boolean]> = [
    [5.5, -4.5, true],
    [-5, -6, false],
    [7, 2.5, false],
    [-6.8, -0.5, true],
    [2.5, 7.5, false],
  ];
  const meshes: Mesh[] = [];
  for (const [x, z, lit] of posts) {
    const y = groundY(x, z);
    const post = new Mesh(new CylinderGeometry(0.05, 0.07, 1.9, 8), postMat);
    post.position.set(x, y + 0.95, z);
    meshes.push(post);
    const arm = new Mesh(new BoxGeometry(0.5, 0.05, 0.05), postMat);
    arm.position.set(x + 0.12, y + 1.85, z);
    meshes.push(arm);
    lantern(env, x + 0.32, y + 1.7, z, lit);
  }
  env.add(mergeMeshes(postMat, meshes));

  // Fire pit: rock ring, ember bed, flickering light.
  const fx = -6.5;
  const fz = 4.5;
  const fy = groundY(fx, fz);
  const rock = rockTexture();
  const rockMat = new MeshStandardMaterial({ map: rock.map, normalMap: rock.normalMap, roughness: 1 });
  const ring: Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = rand(0.14, 0.2);
    const m = new Mesh(new IcosahedronGeometry(s, 1), rockMat);
    m.position.set(fx + Math.sin(a) * 0.75, fy + 0.1, fz + Math.cos(a) * 0.75);
    ring.push(m);
  }
  env.add(mergeMeshes(rockMat, ring));
  const embers = new Mesh(
    new SphereGeometry(0.34, 12, 8),
    new MeshStandardMaterial({
      color: '#1c0f08',
      emissive: new Color('#ff7a28'),
      emissiveIntensity: 1.8,
      roughness: 1,
    }),
  );
  embers.scale.y = 0.35;
  embers.position.set(fx, fy + 0.1, fz);
  env.add(embers);
  const fireGlow = new Mesh(
    new PlaneGeometry(2.2, 2.2),
    new MeshBasicMaterial({
      map: glowSprite('#ff8a38'),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  fireGlow.rotation.x = -Math.PI / 2;
  fireGlow.position.set(fx, fy + 0.16, fz);
  env.add(fireGlow);
  const fireLight = new PointLight('#ff8a38', 5, 12, 1.9);
  fireLight.position.set(fx, fy + 0.6, fz);
  env.add(fireLight);
  onTick((_d, time) => {
    fireLight.intensity = 4.6 + Math.sin(time * 9.3) * 0.5 + Math.sin(time * 23.7) * 0.35;
  });
}

// ----------------------------------------------------------------------------
// Waterfall cliff with scrolling streaks
// ----------------------------------------------------------------------------

function buildWaterfall(env: Group): void {
  const x = -30;
  const z = -16;
  const rock = rockTexture();
  rock.map.repeat.set(3, 3);
  rock.normalMap!.repeat.set(3, 3);
  const cliffMat = new MeshStandardMaterial({ map: rock.map, normalMap: rock.normalMap, roughness: 1 });
  const cliff = new Mesh(new SphereGeometry(5, 20, 14), cliffMat);
  const p = cliff.geometry.getAttribute('position');
  for (let v = 0; v < p.count; v++) {
    const px = p.getX(v);
    const py = p.getY(v);
    const pz = p.getZ(v);
    const f = 1 + (vnoise(px * 0.7 + 31, (py + pz) * 0.7) - 0.5) * 0.4;
    p.setXYZ(v, px * f * 1.15, py * 1.3, pz * f * 0.9);
  }
  cliff.geometry.computeVertexNormals();
  cliff.position.set(x, WATER_Y + 2.6, z);
  cliff.castShadow = true;
  env.add(cliff);

  const streaks = fallStreaks();
  streaks.repeat.set(1.6, 1.1);
  const fallMat = new MeshBasicMaterial({
    map: streaks,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    opacity: 0.9,
  });
  const fall = new Mesh(new PlaneGeometry(1.7, 8.6), fallMat);
  fall.position.set(x + 4.4, WATER_Y + 3.9, z + 1);
  env.add(fall);
  onTick((delta) => {
    streaks.offset.y += delta * 0.55;
  });
  // Foam pool.
  const foam = new Mesh(
    new PlaneGeometry(4.2, 3),
    new MeshBasicMaterial({
      map: cloudCard('#e8f2f2'),
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(x + 4.5, WATER_Y + 0.05, z + 1.2);
  env.add(foam);
}

// ----------------------------------------------------------------------------
// Dusk mountains
// ----------------------------------------------------------------------------

function buildMountains(env: Group): void {
  const rock = rockTexture();
  rock.map.repeat.set(6, 3);
  rock.normalMap!.repeat.set(6, 3);
  const mat = new MeshStandardMaterial({
    map: rock.map,
    normalMap: rock.normalMap,
    roughness: 1,
    vertexColors: true,
  });
  const mountains: Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    if (i === 5) continue; // leave open water under the setting sun
    const a = (i / 11) * Math.PI * 2 + 0.26;
    const r = rand(160, 235);
    const height = rand(40, 75);
    const base = rand(45, 75);
    const geom = new CylinderGeometry(1.2, base, height, 22, 6);
    const p = geom.getAttribute('position');
    const colors = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v++) {
      const vx = p.getX(v);
      const vz = p.getZ(v);
      const vy = p.getY(v);
      const ang = Math.atan2(vx, vz);
      const ridge = Math.sin(ang * 5 + i) * 0.15 + Math.sin(ang * 12 + i * 2) * 0.07;
      p.setX(v, vx * (1 + ridge));
      p.setZ(v, vz * (1 + ridge));
      const hFrac = (vy + height / 2) / height;
      const snow = Math.max(0, (hFrac - 0.62) * 2.4 + ridge * 0.4);
      // Dusk shading: cool blue rock, warm-lit snow.
      const tone = 0.45 + ridge * 0.6;
      colors[v * 3] = Math.min(1, tone * 0.5 + snow * 1.05);
      colors[v * 3 + 1] = Math.min(1, tone * 0.48 + snow * 0.9);
      colors[v * 3 + 2] = Math.min(1, tone * 0.62 + snow * 0.85);
    }
    geom.setAttribute('color', new BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    const m = new Mesh(geom, mat);
    m.position.set(Math.sin(a) * r, height / 2 - 8, Math.cos(a) * r);
    mountains.push(m);
  }
  const merged = mergeMeshes(mat, mountains);
  merged.castShadow = false;
  env.add(merged);
}

// ----------------------------------------------------------------------------
// Lights
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  const sun = new DirectionalLight('#ff9a4e', 2.4);
  sun.position.set(0, 26, -140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 60;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  env.add(sun);
  env.add(sun.target);
  env.add(new HemisphereLight('#c8825e', '#2c3038', 0.65));
}

// ----------------------------------------------------------------------------
// Balloons + clouds (live drifters)
// ----------------------------------------------------------------------------

function buildBalloons(world: World): void {
  const specs: Array<[string, string, number, number, number, number]> = [
    ['#b8402a', '#e8ddc8', -18, 16, -52, 0],
    ['#c8862a', '#284468', 22, 21, -38, 2.2],
    ['#5c3a78', '#e8ddc8', -5, 26, -78, 4.1],
  ];
  const basketTex = woodPlanks('#5c3f22', 4, 256);
  for (const [a, b, x, y, z, phase] of specs) {
    const g = new Group();
    const envelope = new Mesh(
      new SphereGeometry(2.1, 20, 16),
      new MeshStandardMaterial({ map: balloonFabric(a, b), roughness: 0.75 }),
    );
    envelope.scale.y = 1.18;
    envelope.position.y = 3.2;
    g.add(envelope);
    const throat = new Mesh(
      new CylinderGeometry(1.0, 0.5, 1.1, 14, 1, true),
      new MeshStandardMaterial({ color: a, roughness: 0.8, side: DoubleSide }),
    );
    throat.position.y = 1.4;
    g.add(throat);
    const basket = new Mesh(
      new BoxGeometry(0.62, 0.5, 0.62),
      new MeshStandardMaterial({ map: basketTex.map, roughness: 0.95 }),
    );
    basket.position.y = 0.25;
    g.add(basket);
    const ropeMat = new MeshStandardMaterial({ color: '#3a2c1a', roughness: 0.9 });
    for (const [sx, sz] of [
      [-0.26, -0.26],
      [0.26, -0.26],
      [-0.26, 0.26],
      [0.26, 0.26],
    ]) {
      const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 0.95, 6), ropeMat);
      rope.position.set(sx, 0.92, sz);
      g.add(rope);
    }
    g.position.set(x, y, z);
    g.userData = {
      bobAmp: rand(0.5, 1.0),
      bobSpeed: rand(0.12, 0.2),
      driftAmp: rand(2.5, 5),
      driftSpeed: 0.015,
      swayAmp: 0.03,
      swaySpeed: 0.2,
      phase,
    };
    world.createTransformEntity(g).addComponent(Drifter);
  }
}

function buildClouds(world: World): void {
  const warmTex = cloudCard('#ffc9a0');
  const coolTex = cloudCard('#c8b8c2');
  for (let i = 0; i < 6; i++) {
    const warm = rand(0, 1) < 0.55;
    const mat = new MeshStandardMaterial({
      map: warm ? warmTex : coolTex,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      roughness: 1,
      emissive: new Color(warm ? '#ff9a58' : '#8a7a92'),
      emissiveIntensity: 0.4,
    });
    const m = new Mesh(new PlaneGeometry(rand(40, 75), rand(11, 20)), mat);
    const a = rand(0, Math.PI * 2);
    m.position.set(Math.sin(a) * rand(90, 190), rand(30, 60), Math.cos(a) * rand(90, 190) - 30);
    m.rotation.y = -a;
    m.userData = { bobAmp: 0.4, bobSpeed: 0.04, driftAmp: rand(5, 10), driftSpeed: 0.006, phase: rand(0, 6) };
    world.createTransformEntity(m).addComponent(Drifter);
  }
}

// ----------------------------------------------------------------------------
// Grabbable props
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function buildProps(world: World): void {
  // Carry lantern.
  const g = new Group();
  const dark = new MeshStandardMaterial({ color: '#241a10', roughness: 0.9 });
  const base = new Mesh(new BoxGeometry(0.15, 0.025, 0.15), dark);
  base.position.y = -0.1;
  g.add(base);
  const glass = new Mesh(
    new BoxGeometry(0.11, 0.15, 0.11),
    new MeshStandardMaterial({
      color: '#3a2a14',
      emissive: new Color('#ffb75e'),
      emissiveIntensity: 2,
      roughness: 0.4,
    }),
  );
  g.add(glass);
  const cap = new Mesh(new BoxGeometry(0.16, 0.025, 0.16), dark);
  cap.position.y = 0.1;
  g.add(cap);
  const handle = new Mesh(new CylinderGeometry(0.011, 0.011, 0.2, 8), dark);
  handle.rotation.z = Math.PI / 2;
  handle.position.y = 0.16;
  g.add(handle);
  grabbable(world, g, 0.8, groundY(0.8, 2) + 0.16, 2);

  // Oar.
  const oar = new Group();
  const wood = new MeshStandardMaterial({ color: '#7e5a32', roughness: 0.8 });
  const shaft = new Mesh(new CylinderGeometry(0.018, 0.022, 1.1, 10), wood);
  oar.add(shaft);
  const blade = new Mesh(new SphereGeometry(0.16, 12, 8), wood);
  blade.scale.set(0.5, 1.4, 0.16);
  blade.position.y = -0.66;
  oar.add(blade);
  oar.rotation.set(0.2, 0, 1.35);
  grabbable(world, oar, -0.9, 0.05, -14.5);

  // Skipping stone.
  const stone = new Mesh(
    new IcosahedronGeometry(0.055, 1),
    new MeshStandardMaterial({ color: '#6e6862', roughness: 0.7 }),
  );
  stone.scale.y = 0.45;
  grabbable(world, stone, 0.4, -0.02, -17.5);
}
