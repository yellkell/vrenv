/**
 * Papercraft Factory Floor — IWSDK entry point.
 *
 * Boots an immersive-VR world, builds the procedural papercraft factory, drops
 * in a welcome panel, and registers the sliding bay-door system. Use this as a
 * ready-made industrial environment to build IWSDK games on top of: the large
 * central work floor is left wide open for gameplay.
 */

import {
  Interactable,
  PanelUI,
  ScreenSpace,
  SessionMode,
  World,
} from '@iwsdk/core';

import { BayDoorSystem } from './doors.js';
import { buildFactory } from './factory.js';
import { PanelSystem } from './panel.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true },
  },
  features: { grabbing: true, locomotion: true },
}).then((world) => {
  const { camera } = world;

  // Start standing just inside the bay doors, facing into the work floor (-Z).
  camera.position.set(0, 1.6, 15);

  // Build the whole set: walls, catwalk, conveyors, machines, racking, crane,
  // lighting, sliding doors, and grabbable props.
  buildFactory(world);

  // Welcome panel floating over the entrance (also shown as a 2D overlay on
  // desktop via ScreenSpace).
  const panel = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: './ui/welcome.json',
      maxHeight: 0.8,
      maxWidth: 1.4,
    })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, {
      top: '20px',
      left: '20px',
      height: '40%',
    });
  panel.object3D!.position.set(0, 2.2, 11);

  world.registerSystem(BayDoorSystem).registerSystem(PanelSystem);
});
