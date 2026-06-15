/**
 * Steam curling up from the street gratings — the one bit of slow weather left
 * now that the rain is gone. Each vent emits a few translucent puffs that rise,
 * swell, and fade out in a seamless loop.
 */

import {
  type World,
  Mesh,
  BoxGeometry,
  IcosahedronGeometry,
  Color,
  MeshStandardMaterial,
  createComponent,
  createSystem,
  Types,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

export const Steam = createComponent('Steam', {
  base: { type: Types.Vec3, default: [0, 0, 0] },
  rise: { type: Types.Float32, default: 4 },
  period: { type: Types.Float32, default: 6 },
  phase: { type: Types.Float32, default: 0 },
  scale0: { type: Types.Float32, default: 0.5 },
});

export function buildWeather(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 29 + 3);
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
  steam: { required: [Steam] },
}) {
  update(_delta: number, time: number) {
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
