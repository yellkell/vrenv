/**
 * Mirror's Edge Heights — a clean white rooftop room high above a bright,
 * crisp city, with the signature red accents and the signature vertigo.
 *
 * You start inside a white glass-walled room. Turn, follow the red stripe to
 * the windows, step onto the see-through floor band... and the drop to the
 * gleaming city far below hits you.
 *
 * The detailed, intricate stuff is generated procedurally (city.ts /
 * penthouse.ts). To restyle the whole place, edit numbers in config.ts.
 */

import {
  World,
  SessionMode,
  Vector3,
  Color,
  DirectionalLight,
  AmbientLight,
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
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
  render: {
    // The city is ~200m down and stretches hundreds of metres out — the
    // default 200m far plane was clipping almost all of it.
    far: CONFIG.mood.viewDistance,
    near: 0.1,
    // We supply our own sky + IBL below, so skip IWSDK's default gradient.
    defaultLighting: false,
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  // --- Bright, high-key rendering: ACES tone mapping + soft hard-edged shadows. ---
  const renderer = world.renderer;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // --- Camera: start facing the centerpiece; the city reveal is all around. ---
  const { camera } = world;
  camera.position.set(0, 1.6, 3.2);
  camera.lookAt(new Vector3(0, 1.3, 0));

  // --- Sky + image-based lighting: bright clean daylight. On the level root. ---
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

  // --- A strong midday sun (casts the crisp ME shadows over the room) + fill. ---
  const sun = new DirectionalLight(new Color('#fff7ea'), 2.2);
  sun.position.set(14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  const cam = sun.shadow.camera;
  cam.near = 1;
  cam.far = 80;
  cam.left = cam.bottom = -14;
  cam.right = cam.top = 14;
  cam.updateProjectionMatrix();
  world.createTransformEntity(sun);

  const fill = new AmbientLight(new Color('#b9cee0'), 0.55);
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
