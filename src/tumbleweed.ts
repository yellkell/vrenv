/**
 * The rolling plants. Each tumbleweed is a tangled ball of paper twigs (a few
 * thin tori at random angles) that the wind blows across the desert. The system
 * moves them, rolls them about the correct axis, bounces them over the dunes,
 * and respawns them on the far edge when they blow out of bounds.
 */

import {
  type World,
  Group,
  Mesh,
  TorusGeometry,
  Vector3,
  createComponent,
  createSystem,
  Types,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeRng } from './paper.js';
import { desertHeight } from './terrain.js';

export const Tumbleweed = createComponent('Tumbleweed', {
  dx: { type: Types.Float32, default: 1 },
  dz: { type: Types.Float32, default: 0 },
  speed: { type: Types.Float32, default: 2.5 },
  radius: { type: Types.Float32, default: 0.55 },
  phase: { type: Types.Float32, default: 0 },
});

/** A tangled ball of paper twigs. */
function makeBall(rng: () => number): Group {
  const g = new Group();
  const cols = CONFIG.palette.tumbleweed;
  const r = CONFIG.tumbleweeds.radius;
  for (let i = 0; i < 7; i++) {
    const ring = new Mesh(
      new TorusGeometry(r * (0.7 + rng() * 0.3), 0.03, 4, 7),
      makePaper(cols[(rng() * cols.length) | 0], 0.98),
    );
    ring.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    g.add(ring);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

export function buildTumbleweeds(world: World): void {
  const rng = makeRng(CONFIG.terrain.seed * 19 + 4);
  const half = CONFIG.terrain.size / 2 - 4;
  for (let i = 0; i < CONFIG.tumbleweeds.count; i++) {
    const ball = makeBall(rng);
    const x = (rng() * 2 - 1) * half;
    const z = (rng() * 2 - 1) * half;
    ball.position.set(x, desertHeight(x, z) + CONFIG.tumbleweeds.radius, z);
    const theta = (rng() - 0.5) * 0.6; // wind mostly along +X
    world.createTransformEntity(ball).addComponent(Tumbleweed, {
      dx: Math.cos(theta),
      dz: Math.sin(theta),
      speed: CONFIG.tumbleweeds.windSpeed * (0.7 + rng() * 0.6),
      radius: CONFIG.tumbleweeds.radius,
      phase: rng() * Math.PI * 2,
    });
  }
}

export class TumbleweedSystem extends createSystem({
  weeds: { required: [Tumbleweed] },
}) {
  private axis!: Vector3;

  init() {
    this.axis = new Vector3();
  }

  update(delta: number, time: number) {
    const half = CONFIG.terrain.size / 2 - 4;
    this.queries.weeds.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const dx = entity.getValue(Tumbleweed, 'dx') ?? 1;
      const dz = entity.getValue(Tumbleweed, 'dz') ?? 0;
      const speed = entity.getValue(Tumbleweed, 'speed') ?? 2.5;
      const radius = entity.getValue(Tumbleweed, 'radius') ?? 0.55;
      const phase = entity.getValue(Tumbleweed, 'phase') ?? 0;

      let x = obj.position.x + dx * speed * delta;
      let z = obj.position.z + dz * speed * delta;
      // A little sideways wander so they don't travel in dead-straight lines.
      x += -dz * Math.sin(time * 0.8 + phase) * delta * 0.6;
      z += dx * Math.sin(time * 0.8 + phase) * delta * 0.6;

      // Wrap to the opposite edge when blown out of the desert.
      if (x > half) x = -half;
      else if (x < -half) x = half;
      if (z > half) z = -half;
      else if (z < -half) z = half;

      // Bounce over the dunes.
      const ground = desertHeight(x, z) + radius;
      const bounce = Math.abs(Math.sin(time * 3 + phase)) * 0.15;
      obj.position.set(x, ground + bounce, z);

      // Roll about the axis perpendicular to travel.
      this.axis.set(-dz, 0, dx).normalize();
      obj.rotateOnWorldAxis(this.axis, (speed * delta) / radius);
    });
  }
}
