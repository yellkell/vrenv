/**
 * drift.ts
 *
 * A tiny ECS feature that gives entities a gentle, endless ambient drift —
 * hot-air balloons bobbing, clouds sliding, lanterns swaying. Cheap enough
 * for Quest: a couple of sin/cos per entity per frame.
 *
 * `Drifter` is a plain tag component (same pattern as `BayDoor`); per-entity
 * motion parameters live in `object3D.userData`:
 *   baseX/baseY/baseZ  — anchor position (defaults to the spawn position)
 *   bobAmp / bobSpeed  — vertical sine bob (m / rad·s)
 *   driftAmp / driftSpeed — slow horizontal orbit (m / rad·s)
 *   swayAmp / swaySpeed — z-axis rock (rad / rad·s)
 *   billboard          — yaw toward the player (cloud planes, glow sprites)
 *   phase              — de-syncs neighbours
 */

import { createComponent, createSystem } from '@iwsdk/core';
import { Vector3 } from 'three';

export const Drifter = createComponent('Drifter', {});

export class DriftSystem extends createSystem({
  drifters: { required: [Drifter] },
}) {
  private headPos!: Vector3;

  init() {
    this.headPos = new Vector3();
  }

  update(_delta: number, time: number) {
    this.player.head.getWorldPosition(this.headPos);
    this.queries.drifters.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) {
        return;
      }
      const d = obj.userData;
      if (d.baseX === undefined) {
        d.baseX = obj.position.x;
        d.baseY = obj.position.y;
        d.baseZ = obj.position.z;
      }
      const phase = (d.phase as number) ?? 0;
      const bobAmp = (d.bobAmp as number) ?? 0.4;
      const bobSpeed = (d.bobSpeed as number) ?? 0.25;
      const driftAmp = (d.driftAmp as number) ?? 0;
      const driftSpeed = (d.driftSpeed as number) ?? 0.04;

      obj.position.y = d.baseY + Math.sin(time * bobSpeed + phase) * bobAmp;
      if (driftAmp > 0) {
        obj.position.x = d.baseX + Math.sin(time * driftSpeed + phase) * driftAmp;
        obj.position.z =
          d.baseZ + Math.cos(time * driftSpeed * 0.7 + phase) * driftAmp;
      }
      if (d.swayAmp) {
        obj.rotation.z =
          Math.sin(time * ((d.swaySpeed as number) ?? 0.4) + phase) *
          (d.swayAmp as number);
      }
      if (d.billboard) {
        // Yaw-only billboard so cloud planes never get caught edge-on.
        obj.rotation.y = Math.atan2(
          this.headPos.x - obj.position.x,
          this.headPos.z - obj.position.z,
        );
      }
    });
  }
}
