/**
 * Jetsons traffic: a few rows of flying cars streaking past above the alley,
 * coming from different directions. Some lanes run the length of the alley
 * (both ways, at different heights); a couple cross overhead, so when you look up
 * through the gap between the rooftops you catch them sliding by.
 *
 * Everything is instanced — body, glowing canopy, head- and tail-lights are four
 * InstancedMeshes parented under one Group, and the TrafficSystem flies every car
 * by rewriting their instance matrices each frame. So the whole sky of traffic is
 * four draw calls.
 */

import {
  type World,
  Group,
  InstancedMesh,
  BoxGeometry,
  Object3D,
  Vector3,
  Quaternion,
  Euler,
  Matrix4,
  Color,
  createComponent,
  createSystem,
  Types,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeNeon, makeRng } from './paper.js';

export const Traffic = createComponent('Traffic', {
  count: { type: Types.Float32, default: 0 },
});

/** Where each lane lives and which way it flows. */
type Lane = { y: number; axis: 'z' | 'x'; dir: 1 | -1; lateral: number; speed: number };
const LANES: Lane[] = [
  { y: 12, axis: 'z', dir: 1, lateral: -2.2, speed: 9 },
  { y: 15, axis: 'z', dir: -1, lateral: 2.2, speed: 11 },
  { y: 19, axis: 'z', dir: 1, lateral: 0, speed: 14 },
  { y: 17, axis: 'x', dir: 1, lateral: -8, speed: 10 }, // crosses overhead
  { y: 22, axis: 'x', dir: -1, lateral: 12, speed: 13 }, // crosses overhead
];

const Z_MIN = -150;
const Z_MAX = 55;
const X_MIN = -80;
const X_MAX = 80;

export function buildTraffic(world: World): void {
  const n = CONFIG.traffic.cars;
  const group = new Group();

  const body = new InstancedMesh(new BoxGeometry(1.2, 0.6, 2.6), makePaper('#ffffff', 0.9), n);
  const canopy = new InstancedMesh(new BoxGeometry(0.9, 0.4, 1.3), makeNeon(CONFIG.palette.neon.cyan, 1.3), n);
  const head = new InstancedMesh(new BoxGeometry(0.95, 0.12, 0.12), makeNeon('#fff6e0', 2.0), n);
  const tail = new InstancedMesh(new BoxGeometry(1.0, 0.16, 0.12), makeNeon(CONFIG.palette.neon.red, 2.2), n);
  body.name = 'body';
  canopy.name = 'canopy';
  head.name = 'head';
  tail.name = 'tail';
  for (const m of [body, canopy, head, tail]) {
    m.frustumCulled = false;
    m.castShadow = false;
    m.receiveShadow = false;
    group.add(m);
  }
  world.createTransformEntity(group).addComponent(Traffic, { count: n });
}

export class TrafficSystem extends createSystem({
  traffic: { required: [Traffic] },
}) {
  // Per-car state (a fixed particle system, so plain arrays are fine).
  private x!: Float32Array;
  private y!: Float32Array;
  private z!: Float32Array;
  private yaw!: Float32Array;
  private speed!: Float32Array;
  private dx!: Float32Array;
  private dz!: Float32Array;
  private ready = false;

  private pos!: Vector3;
  private quat!: Quaternion;
  private euler!: Euler;
  private one!: Vector3;
  private base!: Matrix4;
  private out!: Matrix4;
  private canopyOff!: Matrix4;
  private headOff!: Matrix4;
  private tailOff!: Matrix4;

  init() {
    this.pos = new Vector3();
    this.quat = new Quaternion();
    this.euler = new Euler();
    this.one = new Vector3(1, 1, 1);
    this.base = new Matrix4();
    this.out = new Matrix4();
    this.canopyOff = new Matrix4().makeTranslation(0, 0.42, 0.2);
    this.headOff = new Matrix4().makeTranslation(0, 0, 1.3);
    this.tailOff = new Matrix4().makeTranslation(0, 0.06, -1.3);

    this.queries.traffic.subscribe('qualify', (entity) => {
      const n = entity.getValue(Traffic, 'count') ?? CONFIG.traffic.cars;
      const rng = makeRng(CONFIG.alley.seed * 41 + 13);
      this.x = new Float32Array(n);
      this.y = new Float32Array(n);
      this.z = new Float32Array(n);
      this.yaw = new Float32Array(n);
      this.speed = new Float32Array(n);
      this.dx = new Float32Array(n);
      this.dz = new Float32Array(n);

      const group = entity.object3D as Group | null;
      const bodyMesh = group?.getObjectByName('body') as InstancedMesh | undefined;
      const dark = new Color();

      for (let i = 0; i < n; i++) {
        const lane = LANES[i % LANES.length];
        const sp = lane.speed * (0.8 + rng() * 0.5);
        this.speed[i] = sp;
        this.y[i] = lane.y + (rng() - 0.5) * 0.6;
        if (lane.axis === 'z') {
          this.dx[i] = 0;
          this.dz[i] = lane.dir;
          this.x[i] = lane.lateral + (rng() - 0.5) * 1.2;
          this.z[i] = Z_MIN + rng() * (Z_MAX - Z_MIN);
          this.yaw[i] = lane.dir === 1 ? 0 : Math.PI;
        } else {
          this.dx[i] = lane.dir;
          this.dz[i] = 0;
          this.z[i] = lane.lateral + (rng() - 0.5) * 1.2;
          this.x[i] = X_MIN + rng() * (X_MAX - X_MIN);
          this.yaw[i] = lane.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        }
        // A dim, slightly varied body colour.
        dark.setHSL(0.6 + rng() * 0.1, 0.4, 0.18 + rng() * 0.1);
        bodyMesh?.setColorAt(i, dark);
      }
      if (bodyMesh?.instanceColor) bodyMesh.instanceColor.needsUpdate = true;
      this.ready = true;
    });
  }

  update(delta: number) {
    if (!this.ready) return;
    this.queries.traffic.entities.forEach((entity) => {
      const group = entity.object3D as Group | null;
      if (!group) return;
      const body = group.getObjectByName('body') as InstancedMesh | undefined;
      const canopy = group.getObjectByName('canopy') as InstancedMesh | undefined;
      const head = group.getObjectByName('head') as InstancedMesh | undefined;
      const tail = group.getObjectByName('tail') as InstancedMesh | undefined;
      if (!body || !canopy || !head || !tail) return;

      const n = body.count;
      for (let i = 0; i < n; i++) {
        this.x[i] += this.dx[i] * this.speed[i] * delta;
        this.z[i] += this.dz[i] * this.speed[i] * delta;
        // Wrap around when a car flies off the end of its lane.
        if (this.dz[i] > 0 && this.z[i] > Z_MAX) this.z[i] = Z_MIN;
        else if (this.dz[i] < 0 && this.z[i] < Z_MIN) this.z[i] = Z_MAX;
        if (this.dx[i] > 0 && this.x[i] > X_MAX) this.x[i] = X_MIN;
        else if (this.dx[i] < 0 && this.x[i] < X_MIN) this.x[i] = X_MAX;

        this.pos.set(this.x[i], this.y[i], this.z[i]);
        this.euler.set(0, this.yaw[i], 0);
        this.quat.setFromEuler(this.euler);
        this.base.compose(this.pos, this.quat, this.one);
        body.setMatrixAt(i, this.base);
        this.out.multiplyMatrices(this.base, this.canopyOff);
        canopy.setMatrixAt(i, this.out);
        this.out.multiplyMatrices(this.base, this.headOff);
        head.setMatrixAt(i, this.out);
        this.out.multiplyMatrices(this.base, this.tailOff);
        tail.setMatrixAt(i, this.out);
      }
      body.instanceMatrix.needsUpdate = true;
      canopy.instanceMatrix.needsUpdate = true;
      head.instanceMatrix.needsUpdate = true;
      tail.instanceMatrix.needsUpdate = true;
    });
  }
}
