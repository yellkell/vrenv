/**
 * Slow, hypnotic rotation for centerpieces — the kind of motion that makes a
 * static glass sculpture feel alive without ever distracting.
 */

import { createComponent, createSystem, Types } from '@iwsdk/core';

export const SlowSpin = createComponent('SlowSpin', {
  speed: { type: Types.Float32, default: 0.15 },
  tilt: { type: Types.Float32, default: 0 },
});

export class SpinSystem extends createSystem({
  spinners: { required: [SlowSpin] },
}) {
  update(delta: number) {
    this.queries.spinners.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const speed = entity.getValue(SlowSpin, 'speed') ?? 0.15;
      obj.rotation.y += delta * speed;
    });
  }
}
