/**
 * Glass Heights — a glassmorphic penthouse floating high above a stylised city.
 *
 * You start inside a circular glass room. Turn, walk to the windows, step onto
 * the see-through floor band... and discover you're hundreds of metres up,
 * ringed by a softly glowing glass skyline at sunset.
 *
 * The detailed, intricate stuff is generated procedurally (see city.ts /
 * penthouse.ts). To restyle the whole place, edit numbers in config.ts.
 */

import {
  World,
  SessionMode,
  Vector3,
  Color,
  DirectionalLight,
  AmbientLight,
  DomeGradient,
  IBLGradient,
  PanelUI,
  Interactable,
  ScreenSpace,
} from '@iwsdk/core';

import { CONFIG } from './config.js';
import { hexToVec4 } from './glass.js';
import { buildPenthouse } from './penthouse.js';
import { buildCity } from './city.js';
import { buildDecor } from './decor.js';
import { PanelSystem } from './panel.js';
import { FloatSystem } from './floating.js';
import { SpinSystem } from './spin.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  // --- Camera: start facing the centerpiece; the city reveal is all around. ---
  const { camera } = world;
  camera.position.set(0, 1.6, 3.2);
  camera.lookAt(new Vector3(0, 1.3, 0));

  // --- Sky + image-based lighting (twilight over a city). Goes on level root. ---
  const root = world.activeLevel.value;
  root.addComponent(DomeGradient, {
    sky: hexToVec4(CONFIG.sky.top),
    equator: hexToVec4(CONFIG.sky.horizon),
    ground: hexToVec4(CONFIG.sky.bottom),
    intensity: CONFIG.sky.intensity,
    _needsUpdate: true,
  });
  root.addComponent(IBLGradient, {
    sky: hexToVec4(CONFIG.ibl.sky),
    ground: hexToVec4(CONFIG.ibl.ground),
    intensity: CONFIG.ibl.intensity,
    _needsUpdate: true,
  });

  // --- A low, warm sun for glassy specular highlights + a cool ambient fill. ---
  const sun = new DirectionalLight(new Color('#ffd9b0'), 1.3);
  sun.position.set(-60, 26, -48);
  world.createTransformEntity(sun);
  const fill = new AmbientLight(new Color('#6a72a0'), 0.45);
  world.createTransformEntity(fill);

  // --- The world itself. ---
  buildPenthouse(world);
  buildCity(world);
  buildDecor(world);

  // --- Welcome panel with the Enter/Exit XR button. ---
  const panel = world
    .createTransformEntity()
    .addComponent(PanelUI, { config: './ui/welcome.json', maxHeight: 0.7, maxWidth: 1.4 })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, { top: '20px', left: '20px', height: '38%' });
  panel.object3D!.position.set(0, 1.05, 2.2);

  world.registerSystem(PanelSystem).registerSystem(FloatSystem).registerSystem(SpinSystem);
});
