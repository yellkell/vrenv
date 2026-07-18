/**
 * IWSDK Environments — entry point.
 *
 * Boots an immersive-VR world and builds one of the project's ready-made
 * papercraft environments (see ./environments/registry.ts):
 *
 *   ?env=pavilion  — Lakeside Sports Pavilion (default): bright glass sports
 *                    hall with a sunken court in a toon summer valley.
 *   ?env=cove      — Lantern Cove: golden-hour lake island with balloons,
 *                    a dock, and a waterfall.
 *   ?env=factory   — Papercraft Factory Floor: dilapidated industrial hall.
 *
 * Every environment keeps its center open as a gameplay arena — build your
 * game on top by adding entities/systems after `env.build(world)` runs.
 */

import {
  Interactable,
  PanelUI,
  ScreenSpace,
  SessionMode,
  World,
} from '@iwsdk/core';

import { BayDoorSystem } from './doors.js';
import { DriftSystem } from './drift.js';
import { currentEnvironment } from './environments/registry.js';
import { PanelSystem } from './panel.js';
import { TickSystem } from './realism.js';

const env = currentEnvironment();
document.title = `${env.title} — IWSDK Environments`;

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true },
  },
  features: { grabbing: true, locomotion: true },
  ...(env.render ? { render: env.render } : {}),
}).then((world) => {
  const { camera } = world;
  camera.position.set(...env.spawn);

  env.build(world);

  // Welcome panel floating near the spawn point (also shown as a 2D overlay
  // on desktop via ScreenSpace).
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
  panel.object3D!.position.set(...env.panelPosition);

  world
    .registerSystem(BayDoorSystem)
    .registerSystem(DriftSystem)
    .registerSystem(TickSystem)
    .registerSystem(PanelSystem);
});
