/**
 * Papercraft Saloon Arena — IWSDK entry point.
 *
 * Boots an immersive-VR world, builds the procedural papercraft saloon arena,
 * drops in a welcome panel, and registers the batwing-door system. Use this as
 * a ready-made arena environment to build IWSDK games on top of: the central
 * ~10m circle is left clear for gameplay.
 */

import {
  Interactable,
  PanelUI,
  ScreenSpace,
  SessionMode,
  World,
} from '@iwsdk/core';

import { BatwingSystem } from './doors.js';
import { PanelSystem } from './panel.js';
import { buildSaloon } from './saloon.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true },
  },
  features: { grabbing: true, locomotion: true },
}).then((world) => {
  const { camera } = world;

  // Start standing just inside the batwing doors, facing into the arena (-Z).
  camera.position.set(0, 1.6, 7.5);

  // Build the whole set: walls, bar, balcony, stage, furniture, lights,
  // swinging doors, and grabbable props.
  buildSaloon(world);

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
  panel.object3D!.position.set(0, 2.0, 5.5);

  world.registerSystem(BatwingSystem).registerSystem(PanelSystem);
});
