/**
 * The things that move: rain falling through the neon glow, and steam curling up
 * from the street gratings.
 *
 * Rain is one InstancedMesh of thin streaks confined to the alley volume; the
 * WeatherSystem rains them down and recycles each streak to the top when it hits
 * the road. Steam is a small set of translucent puffs that rise, swell, and fade
 * over the vents in a seamless loop.
 */

import {
  type World,
  Mesh,
  InstancedMesh,
  BoxGeometry,
  IcosahedronGeometry,
  Object3D,
  Color,
  MeshStandardMaterial,
  createComponent,
  createSystem,
  Types,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

const RAIN_TOP = 15;

export const Rain = createComponent('Rain', {
  top: { type: Types.Float32, default: RAIN_TOP },
});

export const Steam = createComponent('Steam', {
  base: { type: Types.Vec3, default: [0, 0, 0] },
  rise: { type: Types.Float32, default: 4 },
  period: { type: Types.Float32, default: 6 },
  phase: { type: Types.Float32, default: 0 },
  scale0: { type: Types.Float32, default: 0.5 },
});

export function buildWeather(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 29 + 3);

  // --- Rain: faint self-lit streaks so they read against the dark walls. ---
  const rainMat = new MeshStandardMaterial({
    color: new Color('#000000'),
    emissive: new Color(CONFIG.rain.color),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const rain = new InstancedMesh(
    new BoxGeometry(0.012, 0.55, 0.012),
    rainMat,
    CONFIG.rain.count,
  );
  rain.frustumCulled = false;
  // Seed initial matrices so nothing pops on the first frame.
  const tmp = new Object3D();
  tmp.rotation.z = CONFIG.rain.slant;
  for (let i = 0; i < CONFIG.rain.count; i++) {
    tmp.position.set(
      (rng() * 2 - 1) * ALLEY.halfWidth,
      FLOOR_Y + rng() * RAIN_TOP,
      ALLEY.front + rng() * ALLEY.length,
    );
    tmp.updateMatrix();
    rain.setMatrixAt(i, tmp.matrix);
  }
  rain.instanceMatrix.needsUpdate = true;
  world.createTransformEntity(rain).addComponent(Rain, { top: RAIN_TOP });

  // --- Vent gratings + their rising steam puffs. ---
  const grateMat = makePaper(CONFIG.palette.metalDark, 0.9);
  for (let v = 0; v < CONFIG.steam.vents; v++) {
    const x = (rng() * 2 - 1) * (ALLEY.halfWidth - 1.0);
    const z = ALLEY.front + 3 + rng() * (ALLEY.length - 6);
    const grate = new Mesh(new BoxGeometry(1.2, 0.05, 1.2), grateMat);
    grate.position.set(x, FLOOR_Y + 0.03, z);
    grate.receiveShadow = true;
    world.createTransformEntity(grate);

    for (let p = 0; p < CONFIG.steam.puffsPerVent; p++) {
      const puffMat = new MeshStandardMaterial({
        color: new Color('#aab6c8'),
        emissive: new Color('#3a4a66'),
        emissiveIntensity: 0.3,
        roughness: 1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        flatShading: true,
      });
      const puff = new Mesh(new IcosahedronGeometry(0.5, 0), puffMat);
      puff.position.set(x, FLOOR_Y + 0.2, z);
      world.createTransformEntity(puff).addComponent(Steam, {
        base: [x, FLOOR_Y + 0.2, z],
        rise: 3.5 + rng() * 2.5,
        period: 5 + rng() * 4,
        phase: rng(),
        scale0: 0.5 + rng() * 0.4,
      });
    }
  }
}

export class WeatherSystem extends createSystem({
  rain: { required: [Rain] },
  steam: { required: [Steam] },
}) {
  private rx!: Float32Array;
  private ry!: Float32Array;
  private rz!: Float32Array;
  private rs!: Float32Array;
  private dummy!: Object3D;
  private ready = false;

  init() {
    this.dummy = new Object3D();
    this.dummy.rotation.z = CONFIG.rain.slant;
    // Allocate per-drop state once the rain instance exists.
    this.queries.rain.subscribe('qualify', (entity) => {
      const mesh = entity.object3D as InstancedMesh | null;
      if (!mesh) return;
      const n = mesh.count;
      this.rx = new Float32Array(n);
      this.ry = new Float32Array(n);
      this.rz = new Float32Array(n);
      this.rs = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        this.rx[i] = (Math.random() * 2 - 1) * ALLEY.halfWidth;
        this.ry[i] = FLOOR_Y + Math.random() * RAIN_TOP;
        this.rz[i] = ALLEY.front + Math.random() * ALLEY.length;
        this.rs[i] = CONFIG.rain.speed * (0.8 + Math.random() * 0.5);
      }
      this.ready = true;
    });
  }

  update(delta: number, time: number) {
    // Rain.
    if (this.ready) {
      this.queries.rain.entities.forEach((rainEntity) => {
        const mesh = rainEntity.object3D as InstancedMesh | null;
        if (!mesh) return;
        const n = mesh.count;
        for (let i = 0; i < n; i++) {
          this.ry[i] -= this.rs[i] * delta;
          if (this.ry[i] < FLOOR_Y) {
            this.ry[i] = RAIN_TOP + Math.random() * 2;
            this.rx[i] = (Math.random() * 2 - 1) * ALLEY.halfWidth;
            this.rz[i] = ALLEY.front + Math.random() * ALLEY.length;
          }
          this.dummy.position.set(this.rx[i], this.ry[i], this.rz[i]);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(i, this.dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });
    }

    // Steam.
    this.queries.steam.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const base = entity.getVectorView(Steam, 'base') as Float32Array;
      const rise = entity.getValue(Steam, 'rise') ?? 4;
      const period = entity.getValue(Steam, 'period') ?? 6;
      const phase = entity.getValue(Steam, 'phase') ?? 0;
      const scale0 = entity.getValue(Steam, 'scale0') ?? 0.5;
      let prog = (time / period + phase) % 1;
      if (prog < 0) prog += 1;
      const y = base[1] + prog * rise;
      const drift = Math.sin(time * 0.5 + phase * 6.28) * 0.4 * prog;
      obj.position.set(base[0] + drift, y, base[2]);
      const s = scale0 * (0.6 + prog * 1.9);
      obj.scale.setScalar(s);
      // Fade in quickly, then out toward the top.
      const fadeIn = prog < 0.15 ? prog / 0.15 : 1;
      const opacity = fadeIn * (1 - prog) * 0.22;
      const mat = (obj as Mesh).material as MeshStandardMaterial;
      if (mat) mat.opacity = opacity;
    });
  }
}
