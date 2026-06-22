/**
 * doors.ts
 *
 * A tiny ECS feature that slides the factory's bay doors open as the player
 * approaches the entrance and lets them glide shut again when they leave.
 *
 * `BayDoor` is a plain tag component; per-leaf state (its closed/open X
 * positions and the doorway location) lives in the pivot's `object3D.userData`,
 * so we don't depend on a specific component field-type API.
 */

import { createComponent, createSystem } from '@iwsdk/core';
import { Vector3 } from 'three';

/** Tag marking an entity whose object3D is a sliding bay-door leaf. */
export const BayDoor = createComponent('BayDoor', {});

const LERP = 0.1; // per-frame easing toward the target position

export class BayDoorSystem extends createSystem({
  doors: { required: [BayDoor] },
}) {
  private headPos!: Vector3;

  init() {
    this.headPos = new Vector3();
  }

  update() {
    this.player.head.getWorldPosition(this.headPos);

    this.queries.doors.entities.forEach((entity) => {
      const leaf = entity.object3D;
      if (!leaf) {
        return;
      }

      const closedX = (leaf.userData.closedX as number) ?? 0;
      const openX = (leaf.userData.openX as number) ?? 0;
      const doorwayZ = (leaf.userData.doorwayZ as number) ?? 0;
      const openRadius = (leaf.userData.openRadius as number) ?? 6;

      // Open based on the player's horizontal distance to the doorway.
      const dist = Math.hypot(this.headPos.x - 0, this.headPos.z - doorwayZ);
      const target = dist < openRadius ? openX : closedX;

      leaf.position.x += (target - leaf.position.x) * LERP;
    });
  }
}
