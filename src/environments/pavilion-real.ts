/**
 * pavilion-real.ts — "Lakeside Sports Pavilion" (realistic)
 *
 * The same glass sports hall as the stylized version — arched glazing on a
 * steel frame over a sunken acrylic court in a wooden deck — rebuilt with
 * realistic materials: procedurally textured oak decking, a painted acrylic
 * court, powder-coated steel tube arches, reflective low-iron glazing lit by
 * a PMREM environment map, filmic tone mapping, and one static baked shadow
 * pass. Everything still ships as code; every texture is painted into a
 * canvas at load.
 *
 * Layout constants intentionally match src/environments/pavilion.ts so the
 * exported nav mesh from that file drives locomotion here too.
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
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Drifter } from '../drift.js';
import { leafClump, leafyTree, mountainRange } from '../nature.js';
import { applyRealismRenderer, bakeEnvironment, skyDome, type SkySpec } from '../realism.js';
import {
  bannerArt,
  barkTexture,
  cloudCard,
  concreteTexture,
  courtTexture,
  grassTexture,
  leafage,
  muralWall,
  netWeave,
  paintedMetal,
  screenArt,
  srand,
  woodPlanks,
} from '../textures.js';
import { buildNav } from './pavilion.js';

// ----------------------------------------------------------------------------
// Layout (must mirror pavilion.ts) & palette
// ----------------------------------------------------------------------------

const HALL = { hx: 13, hz: 17, low: 0.92, eaves: 4.2, peak: 8.6 };
const PIT = { hx: 5.75, hz: 8, depth: 0.28 };
const STEP = 0.42;
const RIB_ZS = [-17, -12.75, -8.5, -4.25, 0, 4.25, 8.5, 12.75, 17];

const TEAL = '#2b8a99';
const WHITE_STEEL = '#e8eae6';

let seed = 77;
const rand = (min: number, max: number) => {
  seed = (seed * 16807) % 2147483647;
  return min + ((seed & 0xffff) / 0x10000) * (max - min);
};

function archY(x: number): number {
  const t = Math.min(Math.abs(x) / HALL.hx, 1);
  return HALL.eaves + (HALL.peak - HALL.eaves) * Math.cos((t * Math.PI) / 2);
}

/** Scales a geometry's UVs (used to keep texel density uniform pre-merge). */
function scaleUV(geom: BufferGeometry, sx: number, sy: number): BufferGeometry {
  const uv = geom.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  return geom;
}

/** Bakes each mesh's transform and merges them into one indexed mesh. */
function mergeInto(material: MeshStandardMaterial, meshes: Mesh[], shadows = true): Mesh {
  const geoms = meshes.map((m) => {
    m.updateMatrix();
    return m.geometry.applyMatrix4(m.matrix);
  });
  const merged = new Mesh(mergeGeometries(geoms, false)!, material);
  merged.castShadow = shadows;
  merged.receiveShadow = true;
  return merged;
}

const SKY: SkySpec = {
  top: '#2e6fb2',
  mid: '#7db8e0',
  horizon: '#dceef5',
  sunDirection: new Vector3(0.45, 0.72, 0.4),
  sunColor: '#fff2d8',
  haloPower: 120,
  haloStrength: 0.4,
};

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

export function buildPavilionReal(world: World): void {
  srand(0x51ab);
  applyRealismRenderer(world, 1.05);
  bakeEnvironment(world, SKY, 0.9);
  world.scene.fog = new Fog('#d8e9f0', 120, 400);

  const env = new Group();
  env.name = 'SportsPavilionReal';

  buildFloor(env);
  buildCourtAndNet(env);
  buildStructure(env);
  buildGlazing(env);
  buildKicker(env);
  buildFurnishings(env);
  buildBackdrop(env);
  env.add(skyDome(SKY));
  buildLights(env);

  world.createTransformEntity(env);

  const nav = buildNav();
  nav.visible = false;
  world
    .createTransformEntity(nav)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  buildClouds(world);
  buildProps(world);
}

// ----------------------------------------------------------------------------
// Floor: oak deck ring, wooden steps, acrylic court in one baked texture
// ----------------------------------------------------------------------------

function buildFloor(env: Group): void {
  const oak = woodPlanks('#8a6138');
  const deckMat = new MeshStandardMaterial({
    map: oak.map,
    normalMap: oak.normalMap,
    roughnessMap: oak.roughnessMap,
    roughness: 1,
  });
  const outerHx = PIT.hx + 2 * STEP;
  const outerHz = PIT.hz + 2 * STEP;
  const plankAcross = 1.35; // metres of texture across the 8 planks
  const plankAlong = 4.2;

  const decks: Mesh[] = [];
  const region = (w: number, d: number, x: number, z: number, alongX: boolean) => {
    // Planks run along the canvas V axis (world Z by default); for X-run
    // boards, build the plane pre-swapped so the yaw restores the footprint.
    const g = new PlaneGeometry(alongX ? d : w, alongX ? w : d);
    g.rotateX(-Math.PI / 2);
    if (alongX) g.rotateY(Math.PI / 2);
    scaleUV(
      g,
      (alongX ? d : w) / plankAcross,
      (alongX ? w : d) / plankAlong,
    );
    const m = new Mesh(g, deckMat);
    m.position.set(x, 0.001, z);
    return m;
  };
  const nsDepth = HALL.hz - outerHz;
  decks.push(region(HALL.hx * 2, nsDepth, 0, -(outerHz + nsDepth / 2), true));
  decks.push(region(HALL.hx * 2, nsDepth, 0, outerHz + nsDepth / 2, true));
  const ewWidth = HALL.hx - outerHx;
  decks.push(region(ewWidth, outerHz * 2, -(outerHx + ewWidth / 2), 0, false));
  decks.push(region(ewWidth, outerHz * 2, outerHx + ewWidth / 2, 0, false));
  const deck = mergeInto(deckMat, decks, false);
  deck.receiveShadow = true;
  env.add(deck);

  // Steps + pit side walls in darker oak.
  const darkOak = woodPlanks('#6e4a28', 6, 512);
  const stepMat = new MeshStandardMaterial({
    map: darkOak.map,
    normalMap: darkOak.normalMap,
    roughnessMap: darkOak.roughnessMap,
  });
  const steps: Mesh[] = [];
  const stepTops = [-0.093, -0.187];
  for (let s = 0; s < 2; s++) {
    const y = stepTops[s] - 0.06;
    const inHx = PIT.hx + (1 - s) * STEP;
    const inHz = PIT.hz + (1 - s) * STEP;
    for (const [w, d, x, z] of [
      [(inHx + STEP) * 2, STEP, 0, -(inHz + STEP / 2)],
      [(inHx + STEP) * 2, STEP, 0, inHz + STEP / 2],
      [STEP, inHz * 2, -(inHx + STEP / 2), 0],
      [STEP, inHz * 2, inHx + STEP / 2, 0],
    ] as Array<[number, number, number, number]>) {
      const m = new Mesh(scaleUV(new BoxGeometry(w, 0.13, d), 2, 2), stepMat);
      m.position.set(x, y, z);
      steps.push(m);
    }
  }
  env.add(mergeInto(stepMat, steps));
}

function buildCourtAndNet(env: Group): void {
  // Whole pit floor — surround, court, service boxes, lines — in one texture.
  const court = courtTexture();
  const courtMat = new MeshStandardMaterial({
    map: court.map,
    roughnessMap: court.roughnessMap,
    roughness: 1,
  });
  court.map.anisotropy = 16;
  const plane = new Mesh(new PlaneGeometry(PIT.hx * 2, PIT.hz * 2), courtMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -PIT.depth;
  plane.receiveShadow = true;
  env.add(plane);

  // Net: steel posts, white head tape, alpha-tested weave.
  const floorY = -PIT.depth;
  const netTopY = floorY + 0.92;
  const postMat = new MeshStandardMaterial({ color: '#20242a', roughness: 0.4, metalness: 0.7 });
  const posts: Mesh[] = [];
  for (const sx of [-5.5, 5.5]) {
    const p = new Mesh(new CylinderGeometry(0.045, 0.05, 1.06, 12), postMat);
    p.position.set(sx, floorY + 0.53, 0);
    posts.push(p);
    const foot = new Mesh(new CylinderGeometry(0.14, 0.16, 0.05, 12), postMat);
    foot.position.set(sx, floorY + 0.025, 0);
    posts.push(foot);
  }
  env.add(mergeInto(postMat, posts));

  const weave = netWeave();
  weave.repeat.set(9, 3.2); // ~4.5 cm mesh cells across the 11 m net
  const netMat = new MeshStandardMaterial({
    map: weave,
    transparent: false,
    alphaTest: 0.12,
    side: DoubleSide,
    roughness: 0.9,
  });
  const net = new Mesh(new PlaneGeometry(10.95, 0.72, 24, 1), netMat);
  // Gentle catenary sag.
  const pos = net.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setY(i, pos.getY(i) - 0.035 * (1 - (x / 5.5) ** 2));
  }
  net.position.set(0, netTopY - 0.36, 0);
  net.castShadow = true;
  env.add(net);

  const tapeMat = new MeshStandardMaterial({ color: '#f2f4f2', roughness: 0.8 });
  const tape = new Mesh(new BoxGeometry(10.95, 0.06, 0.03), tapeMat);
  tape.position.set(0, netTopY, 0);
  tape.castShadow = true;
  env.add(tape);
}

// ----------------------------------------------------------------------------
// Structure: white tube arches, teal purlins/columns, mullions
// ----------------------------------------------------------------------------

function archCurvePoints(offset = 0): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = -HALL.hx + (i / 24) * HALL.hx * 2;
    pts.push(new Vector3(x, archY(x) + offset, 0));
  }
  return pts;
}

function buildStructure(env: Group): void {
  const whitePaint = paintedMetal(WHITE_STEEL);
  const whiteMat = new MeshStandardMaterial({
    map: whitePaint.map,
    roughnessMap: whitePaint.roughnessMap,
    roughness: 1,
    metalness: 0.25,
  });
  const tealPaint = paintedMetal(TEAL);
  const tealMat = new MeshStandardMaterial({
    map: tealPaint.map,
    roughnessMap: tealPaint.roughnessMap,
    roughness: 1,
    metalness: 0.35,
  });

  // Arched ribs: proper steel tubes following the vault.
  const curve = new CatmullRomCurve3(archCurvePoints());
  const ribs: Mesh[] = [];
  for (const z of RIB_ZS) {
    const rib = new Mesh(new TubeGeometry(curve, 40, 0.11, 10), whiteMat);
    rib.position.z = z;
    ribs.push(rib);
  }
  env.add(mergeInto(whiteMat, ribs));

  // Purlins along the vault + eaves beams + columns in teal.
  const tealParts: Mesh[] = [];
  for (let i = 1; i < 12; i++) {
    const x = -HALL.hx + (i / 12) * HALL.hx * 2;
    const p = new Mesh(new CylinderGeometry(0.045, 0.045, HALL.hz * 2, 8), tealMat);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, archY(x) - 0.02, 0);
    tealParts.push(p);
  }
  for (const sx of [-1, 1]) {
    const beam = new Mesh(new BoxGeometry(0.2, 0.24, HALL.hz * 2), tealMat);
    beam.position.set(sx * (HALL.hx - 0.06), HALL.eaves - 0.08, 0);
    tealParts.push(beam);
    for (const z of RIB_ZS) {
      const zc = Math.max(-HALL.hz + 0.4, Math.min(HALL.hz - 0.4, z));
      const col = new Mesh(new CylinderGeometry(0.09, 0.11, HALL.eaves, 12), tealMat);
      col.position.set(sx * (HALL.hx - 0.26), HALL.eaves / 2, zc);
      tealParts.push(col);
    }
  }
  // Window mullions: sides + gables.
  for (const sx of [-1, 1]) {
    const x = sx * (HALL.hx - 0.1);
    for (let i = 0; i <= 16; i++) {
      const z = Math.max(-HALL.hz + 0.05, Math.min(HALL.hz - 0.05, -HALL.hz + (i * HALL.hz * 2) / 16));
      const m = new Mesh(new BoxGeometry(0.06, HALL.eaves - HALL.low, 0.06), tealMat);
      m.position.set(x, (HALL.eaves + HALL.low) / 2, z);
      tealParts.push(m);
    }
    const transom = new Mesh(new BoxGeometry(0.07, 0.06, HALL.hz * 2), tealMat);
    transom.position.set(x, 2.55, 0);
    tealParts.push(transom);
  }
  for (const sz of [-1, 1]) {
    const z = sz * (HALL.hz - 0.1);
    for (let i = 0; i <= 12; i++) {
      const x = Math.max(-HALL.hx + 0.05, Math.min(HALL.hx - 0.05, -HALL.hx + (i * HALL.hx * 2) / 12));
      const h = archY(x) - 0.25;
      const m = new Mesh(new BoxGeometry(0.06, h - HALL.low, 0.06), tealMat);
      m.position.set(x, (h + HALL.low) / 2, z);
      tealParts.push(m);
    }
    const transom = new Mesh(new BoxGeometry(HALL.hx * 2, 0.06, 0.07), tealMat);
    transom.position.set(0, 2.55, z);
    tealParts.push(transom);
  }
  env.add(mergeInto(tealMat, tealParts));
}

// ----------------------------------------------------------------------------
// Glazing: one curved vault sheet + wall/gable panes, all reflective
// ----------------------------------------------------------------------------

function glassMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#cfe6ec',
    transparent: true,
    opacity: 0.18,
    roughness: 0.06,
    metalness: 0,
    side: DoubleSide,
    envMapIntensity: 1.5,
  });
}

function buildGlazing(env: Group): void {
  const mat = glassMaterial();

  // Curved vault sheet.
  const N = 30;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -HALL.hx + (i / N) * HALL.hx * 2;
    const y = archY(x) + 0.1;
    positions.push(x, y, -HALL.hz, x, y, HALL.hz);
    uvs.push(i / N, 0, i / N, 1);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const vault = new BufferGeometry();
  vault.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  vault.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  vault.setIndex(indices);
  vault.computeVertexNormals();
  env.add(new Mesh(vault, mat));

  // Side wall glass.
  for (const sx of [-1, 1]) {
    const pane = new Mesh(new PlaneGeometry(HALL.hz * 2, HALL.eaves - HALL.low), mat);
    pane.rotation.y = sx * -Math.PI / 2;
    pane.position.set(sx * (HALL.hx - 0.1), (HALL.eaves + HALL.low) / 2, 0);
    env.add(pane);
  }
  // Gable glass: strip whose top edge follows the arch.
  for (const sz of [-1, 1]) {
    const M = 26;
    const gp: number[] = [];
    const guv: number[] = [];
    const gi: number[] = [];
    for (let i = 0; i <= M; i++) {
      const x = -HALL.hx + (i / M) * HALL.hx * 2;
      gp.push(x, HALL.low, 0, x, archY(x) - 0.22, 0);
      guv.push(i / M, 0, i / M, 1);
    }
    for (let i = 0; i < M; i++) {
      const a = i * 2;
      gi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const gable = new BufferGeometry();
    gable.setAttribute('position', new BufferAttribute(new Float32Array(gp), 3));
    gable.setAttribute('uv', new BufferAttribute(new Float32Array(guv), 2));
    gable.setIndex(gi);
    gable.computeVertexNormals();
    const mesh = new Mesh(gable, mat);
    mesh.position.z = sz * (HALL.hz - 0.1);
    env.add(mesh);
  }
}

// ----------------------------------------------------------------------------
// Kicker wall with painted wave mural
// ----------------------------------------------------------------------------

function buildKicker(env: Group): void {
  const mural = muralWall();
  const mat = new MeshStandardMaterial({
    map: mural.map,
    roughnessMap: mural.roughnessMap,
    roughness: 1,
  });
  const walls: Mesh[] = [];
  const mk = (w: number, x: number, z: number, ry: number) => {
    const g = scaleUV(new BoxGeometry(w, HALL.low, 0.16), w / 16, 1);
    const m = new Mesh(g, mat);
    m.position.set(x, HALL.low / 2, z);
    m.rotation.y = ry;
    walls.push(m);
  };
  mk(HALL.hx * 2, 0, -HALL.hz + 0.1, 0);
  mk(HALL.hz * 2, -HALL.hx + 0.1, 0, Math.PI / 2);
  mk(HALL.hz * 2, HALL.hx - 0.1, 0, -Math.PI / 2);
  const doorHalf = 1.35;
  const southW = HALL.hx - doorHalf;
  mk(southW, -(doorHalf + southW / 2), HALL.hz - 0.1, Math.PI);
  mk(southW, doorHalf + southW / 2, HALL.hz - 0.1, Math.PI);
  env.add(mergeInto(mat, walls));

  // Door frame in dark teal.
  const frameMat = new MeshStandardMaterial({ color: '#1d616e', roughness: 0.5, metalness: 0.4 });
  const frames: Mesh[] = [];
  for (const sx of [-doorHalf, doorHalf]) {
    const f = new Mesh(new BoxGeometry(0.12, 2.4, 0.18), frameMat);
    f.position.set(sx, 1.2, HALL.hz - 0.1);
    frames.push(f);
  }
  const header = new Mesh(new BoxGeometry(doorHalf * 2 + 0.24, 0.16, 0.2), frameMat);
  header.position.set(0, 2.46, HALL.hz - 0.1);
  frames.push(header);
  const mid = new Mesh(new BoxGeometry(0.08, 2.4, 0.1), frameMat);
  mid.position.set(0, 1.2, HALL.hz - 0.1);
  frames.push(mid);
  env.add(mergeInto(frameMat, frames));
}

// ----------------------------------------------------------------------------
// Furnishings
// ----------------------------------------------------------------------------

function buildFurnishings(env: Group): void {
  const oak = woodPlanks('#96703f', 4, 512);
  const slatMat = new MeshStandardMaterial({
    map: oak.map,
    normalMap: oak.normalMap,
    roughness: 0.8,
  });
  const frameMat = new MeshStandardMaterial({ color: '#26343a', roughness: 0.45, metalness: 0.7 });

  const woodParts: Mesh[] = [];
  const steelParts: Mesh[] = [];
  const benchAt = (x: number, z: number, ry: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.updateMatrixWorld(true);
    const local = (mesh: Mesh, lx: number, ly: number, lz: number, list: Mesh[]) => {
      mesh.position.set(lx, ly, lz).applyMatrix4(g.matrixWorld);
      mesh.rotation.y = ry;
      list.push(mesh);
    };
    for (const dz of [-0.14, 0.02, 0.18]) {
      local(new Mesh(scaleUV(new BoxGeometry(1.9, 0.045, 0.13), 2, 0.3), slatMat), 0, 0.46, dz, woodParts);
    }
    for (const dz of [0.1, 0.24]) {
      local(new Mesh(scaleUV(new BoxGeometry(1.9, 0.045, 0.12), 2, 0.3), slatMat), 0, 0.62 + dz, -0.3, woodParts);
    }
    for (const sx of [-0.82, 0.82]) {
      local(new Mesh(new BoxGeometry(0.05, 0.46, 0.42), frameMat), sx, 0.23, 0, steelParts);
      local(new Mesh(new BoxGeometry(0.05, 0.5, 0.05), frameMat), sx, 0.66, -0.3, steelParts);
    }
  };
  benchAt(-10.6, -3.5, Math.PI / 2);
  benchAt(-10.6, 3.5, Math.PI / 2);
  benchAt(10.6, -3.5, -Math.PI / 2);
  benchAt(10.6, 3.5, -Math.PI / 2);
  benchAt(-5.5, -14.8, 0);
  benchAt(5.5, -14.8, 0);
  env.add(mergeInto(slatMat, woodParts));
  env.add(mergeInto(frameMat, steelParts));

  // Concrete planters with clumpy geometric shrubs.
  const conc = concreteTexture();
  const planterMat = new MeshStandardMaterial({
    map: conc.map,
    normalMap: conc.normalMap,
    roughness: 0.95,
  });
  const bushLeaf = leafage('#26451d', '#7cb23e');
  const bushMat = new MeshStandardMaterial({
    map: bushLeaf.map,
    roughnessMap: bushLeaf.roughnessMap,
    roughness: 1,
    vertexColors: true,
  });
  const planters: Mesh[] = [];
  const bushes: Mesh[] = [];
  const planterAt = (x: number, z: number) => {
    const box = new Mesh(new BoxGeometry(1.5, 0.5, 0.5), planterMat);
    box.position.set(x, 0.25, z);
    planters.push(box);
    for (let i = 0; i < 3; i++) {
      const bx = x - 0.5 + i * 0.5;
      bushes.push(
        leafClump(bx + rand(-0.05, 0.05), 0.66, z + rand(-0.05, 0.05), rand(0.2, 0.3), rand),
      );
    }
  };
  planterAt(-6, -16.35);
  planterAt(6, -16.35);
  planterAt(-12.35, -8);
  planterAt(-12.35, 8);
  planterAt(12.35, -8);
  planterAt(12.35, 8);
  env.add(mergeInto(planterMat, planters));
  const bushMesh = mergeInto(bushMat, bushes);
  bushMesh.castShadow = true;
  env.add(bushMesh);

  // Hanging banners (printed fabric).
  const art1 = bannerArt('#e86a1d', '#f2c22e');
  const art2 = bannerArt('#2e97a8', '#e8556a');
  const bannerMat1 = new MeshStandardMaterial({ map: art1, side: DoubleSide, roughness: 0.9 });
  const bannerMat2 = new MeshStandardMaterial({ map: art2, side: DoubleSide, roughness: 0.9 });
  const b1: Mesh[] = [];
  const b2: Mesh[] = [];
  for (const sx of [-1, 1]) {
    RIB_ZS.filter((z) => Math.abs(z) > 2 && Math.abs(z) < 15).forEach((z, i) => {
      const m = new Mesh(new PlaneGeometry(0.85, 2.3), i % 2 ? bannerMat2 : bannerMat1);
      m.position.set(sx * (HALL.hx - 0.8), 4.55, z);
      m.rotation.y = (sx * -Math.PI) / 2;
      m.castShadow = true;
      (i % 2 ? b2 : b1).push(m);
    });
  }
  env.add(mergeInto(bannerMat1, b1));
  env.add(mergeInto(bannerMat2, b2));

  // Scoreboard screen on steel legs (LED-emissive).
  const art = screenArt();
  const screenMat = new MeshStandardMaterial({
    map: art,
    emissiveMap: art,
    emissive: new Color('#ffffff'),
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const screen = new Mesh(new PlaneGeometry(3.2, 1.6), screenMat);
  const sg = new Group();
  sg.position.set(-8.6, 0, -14.6);
  sg.rotation.y = 0.35;
  const frame = new Mesh(new BoxGeometry(3.44, 1.84, 0.12), frameMat);
  frame.position.set(0, 2.5, 0);
  frame.castShadow = true;
  sg.add(frame);
  screen.position.set(0, 2.5, 0.065);
  sg.add(screen);
  for (const sx of [-1.4, 1.4]) {
    const leg = new Mesh(new CylinderGeometry(0.05, 0.06, 3.3, 10), frameMat);
    leg.position.set(sx, 1.65, 0);
    sg.add(leg);
  }
  env.add(sg);
}

// ----------------------------------------------------------------------------
// Backdrop: lawn, concrete apron, textured trees, mountains
// ----------------------------------------------------------------------------

function buildBackdrop(env: Group): void {
  const grass = grassTexture();
  const lawnMat = new MeshStandardMaterial({
    map: grass.map,
    normalMap: grass.normalMap,
    roughness: 1,
  });
  grass.map.repeat.set(48, 48);
  grass.normalMap!.repeat.set(48, 48);
  const lawn = new Mesh(new PlaneGeometry(320, 320), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.35;
  lawn.receiveShadow = true;
  env.add(lawn);

  const conc = concreteTexture();
  conc.map.repeat.set(10, 1.6);
  const apronMat = new MeshStandardMaterial({
    map: conc.map,
    normalMap: conc.normalMap,
    roughness: 0.95,
  });
  const aprons: Mesh[] = [];
  for (const [w, d, x, z] of [
    [HALL.hx * 2 + 5, 2.5, 0, -(HALL.hz + 1.25)],
    [HALL.hx * 2 + 5, 2.5, 0, HALL.hz + 1.25],
    [2.5, HALL.hz * 2, -(HALL.hx + 1.25), 0],
    [2.5, HALL.hz * 2, HALL.hx + 1.25, 0],
  ] as Array<[number, number, number, number]>) {
    const m = new Mesh(new BoxGeometry(w, 0.22, d), apronMat);
    m.position.set(x, -0.26, z);
    aprons.push(m);
  }
  // Under-hall slab (kept below the pit floor) + a perimeter skirt closing
  // the gap between the deck edge and the ground.
  const slab = new Mesh(new BoxGeometry(HALL.hx * 2, 0.36, HALL.hz * 2), apronMat);
  slab.position.set(0, -0.48, 0);
  aprons.push(slab);
  for (const [w, d, x, z] of [
    [HALL.hx * 2, 0.16, 0, -HALL.hz + 0.08],
    [HALL.hx * 2, 0.16, 0, HALL.hz - 0.08],
    [0.16, HALL.hz * 2, -HALL.hx + 0.08, 0],
    [0.16, HALL.hz * 2, HALL.hx - 0.08, 0],
  ] as Array<[number, number, number, number]>) {
    const skirt = new Mesh(new BoxGeometry(w, 0.4, d), apronMat);
    skirt.position.set(x, -0.18, z);
    aprons.push(skirt);
  }
  env.add(mergeInto(apronMat, aprons, false));

  // Trees: bark trunks + volumetric displaced leaf-clump canopies.
  const bark = barkTexture();
  const trunkMat = new MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normalMap,
    roughness: 1,
  });
  const leaf = leafage('#274a1e', '#8cc24a');
  const leafMat = new MeshStandardMaterial({
    map: leaf.map,
    roughnessMap: leaf.roughnessMap,
    roughness: 1,
    vertexColors: true,
  });
  const trunks: Mesh[] = [];
  const canopies: Mesh[] = [];
  const treeAt = (x: number, z: number, s: number) => {
    const parts = leafyTree(x, -0.35, z, s, rand);
    trunks.push(...parts.trunk);
    canopies.push(...parts.canopy);
  };
  for (let i = 0; i < 22; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(24, 60);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (Math.abs(x) < HALL.hx + 5 && Math.abs(z) < HALL.hz + 5) continue;
    treeAt(x, z, rand(0.8, 1.7));
  }
  for (let i = 0; i < 9; i++) {
    treeAt(rand(-26, 26), -HALL.hz - rand(7, 26), rand(1.0, 1.9));
  }
  env.add(mergeInto(trunkMat, trunks));
  const canopyMesh = mergeInto(leafMat, canopies);
  canopyMesh.castShadow = true;
  env.add(canopyMesh);

  // One continuous mountain range ringing the horizon.
  env.add(
    mountainRange({
      crestRadius: 200,
      halfWidth: 55,
      maxHeight: 78,
      baseY: -0.6,
      seed: 3,
      forest: '#2c4a26',
      rock: '#6b645c',
      snow: '#eef3f5',
      snowLine: 0.7,
    }),
  );
}

function buildClouds(world: World): void {
  const tex = cloudCard('#ffffff');
  const mat = new MeshStandardMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    roughness: 1,
    emissive: new Color('#ffffff'),
    emissiveIntensity: 0.35,
  });
  for (let i = 0; i < 5; i++) {
    const m = new Mesh(new PlaneGeometry(rand(50, 90), rand(16, 26)), mat);
    const a = rand(0, Math.PI * 2);
    m.position.set(Math.sin(a) * rand(120, 220), rand(55, 95), Math.cos(a) * rand(120, 220));
    m.rotation.y = -a;
    m.userData = { bobAmp: 0.8, bobSpeed: 0.04, driftAmp: rand(6, 12), driftSpeed: 0.006, phase: rand(0, 6), billboard: true };
    world.createTransformEntity(m).addComponent(Drifter);
  }
}

// ----------------------------------------------------------------------------
// Lights: one shadow-casting sun + hemisphere fill (env map does the rest)
// ----------------------------------------------------------------------------

function buildLights(env: Group): void {
  const sun = new DirectionalLight('#fff1d8', 2.6);
  sun.position.set(SKY.sunDirection.x * 90, SKY.sunDirection.y * 90, SKY.sunDirection.z * 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  env.add(sun);
  env.add(sun.target);
  env.add(new HemisphereLight('#cfe4f0', '#5f7a4e', 0.55));
}

// ----------------------------------------------------------------------------
// Grabbable props: paddles + ball
// ----------------------------------------------------------------------------

function grabbable(world: World, obj: Object3D, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  world
    .createTransformEntity(obj)
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, { movementMode: MovementMode.MoveFromTarget });
}

function paddle(rubber: string): Group {
  const g = new Group();
  const wood = new MeshStandardMaterial({ color: '#b08a55', roughness: 0.7 });
  const handle = new Mesh(new CylinderGeometry(0.017, 0.021, 0.11, 10), wood);
  handle.position.y = -0.115;
  g.add(handle);
  const blade = new Mesh(new CylinderGeometry(0.088, 0.088, 0.014, 24), wood);
  blade.rotation.x = Math.PI / 2;
  g.add(blade);
  const face = new Mesh(
    new CylinderGeometry(0.086, 0.086, 0.004, 24),
    new MeshStandardMaterial({ color: rubber, roughness: 0.55 }),
  );
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.009;
  g.add(face);
  g.traverse((o) => ((o as Mesh).castShadow = true));
  return g;
}

function buildProps(world: World): void {
  const p1 = paddle('#c62828');
  p1.rotation.set(0.4, 0.3, 1.4);
  grabbable(world, p1, -1.4, -PIT.depth + 0.1, 2.6);
  const p2 = paddle('#1a1a1e');
  p2.rotation.set(-0.2, 1.1, 1.5);
  grabbable(world, p2, 1.2, -PIT.depth + 0.1, -2.8);
  const ballMesh = new Mesh(
    new IcosahedronGeometry(0.036, 2),
    new MeshStandardMaterial({ color: '#f2f2e8', roughness: 0.5 }),
  );
  ballMesh.castShadow = true;
  grabbable(world, ballMesh, 0.6, -PIT.depth + 0.05, 1.8);
}
