/**
 * doors.ts
 *
 * A tiny ECS feature that makes the saloon's batwing doors swing open as the
 * player approaches the entrance and gently settle closed when they leave.
 *
 * `Batwing` is a plain tag component; per-door state (which way it hinges and
 * its current angle) lives in the pivot's `object3D.userData`, so we don't need
 * to depend on a specific component field-type API.
 */

import { createComponent, createSystem } from '@iwsdk/core';
import { Vector3 } from 'three';

/** Tag marking an entity whose object3D is a batwing-door hinge pivot. */
export const Batwing = createComponent('Batwing', {});

// Doorway is centered on the +Z (front) wall of the saloon.
const DOORWAY = new Vector3(0, 0, 9);
const OPEN_RADIUS = 2.8; // how close the player must be for the doors to open
const OPEN_ANGLE = 0.75; // ~43 degrees
const LERP = 0.12; // per-frame easing toward the target angle

export class BatwingSystem extends createSystem({
  doors: { required: [Batwing] },
}) {
  private headPos!: Vector3;
  private doorPos!: Vector3;

  init() {
    this.headPos = new Vector3();
    this.doorPos = new Vector3();
  }

  update() {
    this.player.head.getWorldPosition(this.headPos);

    this.queries.doors.entities.forEach((entity) => {
      const pivot = entity.object3D;
      if (!pivot) {
        return;
      }

      // Open based on how close the player is to the doorway as a whole.
      pivot.getWorldPosition(this.doorPos);
      const horizontalDist = Math.hypot(
        this.headPos.x - DOORWAY.x,
        this.headPos.z - DOORWAY.z,
      );

      const sign = (pivot.userData.sign as number) ?? 1;
      const target = horizontalDist < OPEN_RADIUS ? sign * OPEN_ANGLE : 0;

      const current = (pivot.userData.cur as number) ?? 0;
      const next = current + (target - current) * LERP;
      pivot.userData.cur = next;
      pivot.rotation.y = next;
    });
  }
}
