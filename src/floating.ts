/**
 * Floating glass crystals — the grab-able toys of the playground.
 *
 * They gently bob and turn while idle. The query excludes `Grabbed`, so the
 * instant you pick one up the bobbing stops and the grab system takes over;
 * when you let go it resumes bobbing from wherever you dropped it.
 */

import { createComponent, createSystem, Types, Grabbed } from '@iwsdk/core';
import { CONFIG } from './config.js';

export const Floating = createComponent('Floating', {
  baseY: { type: Types.Float32, default: 0 },
  phase: { type: Types.Float32, default: 0 },
  spin: { type: Types.Float32, default: 0.3 },
});

export class FloatSystem extends createSystem({
  idle: { required: [Floating], excluded: [Grabbed] },
}) {
  init() {
    // When a crystal (re)enters the idle set — on spawn or on release — anchor
    // its bob to wherever it currently sits.
    this.queries.idle.subscribe('qualify', (entity) => {
      const obj = entity.object3D;
      if (obj) entity.setValue(Floating, 'baseY', obj.position.y);
    });
  }

  update(delta: number, time: number) {
    const amp = CONFIG.decor.bobAmplitude;
    const speed = CONFIG.decor.bobSpeed;
    this.queries.idle.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const baseY = entity.getValue(Floating, 'baseY') ?? obj.position.y;
      const phase = entity.getValue(Floating, 'phase') ?? 0;
      const spin = entity.getValue(Floating, 'spin') ?? 0.3;
      obj.position.y = baseY + Math.sin(time * speed + phase) * amp;
      obj.rotation.y += delta * spin;
    });
  }
}
