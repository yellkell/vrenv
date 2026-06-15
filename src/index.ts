/**
 * Neon Alley — a papercraft cyberpunk backstreet at night.
 *
 * A narrow rain-slicked alley walled in by towering, window-speckled buildings,
 * plastered with buzzing neon, steam curling from the gratings and cables sagging
 * overhead. Look one way for the hero sign capping the dead end; turn around for
 * the fogged megacity skyline. Walk around; pick up the little glowing things.
 * To restyle the whole place, edit numbers in config.ts.
 */

import {
  World,
  SessionMode,
  Vector3,
  Color,
  FogExp2,
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
import { hexToVec4 } from './paper.js';
import { buildStreet, ALLEY } from './street.js';
import { buildBuildings } from './buildings.js';
import { buildNeon, NeonSystem } from './neon.js';
import { buildProps } from './props.js';
import { buildWeather, WeatherSystem } from './weather.js';
import { PanelSystem } from './panel.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true, layers: true },
  },
  render: {
    far: CONFIG.mood.viewDistance,
    near: 0.1,
    defaultLighting: false, // we supply our own night sky + IBL below
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  // --- Moody night rendering: low key, with the neon doing the talking. ---
  const renderer = world.renderer;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.mood.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // Night haze: the alley's far end and the skyline dissolve into a glow.
  world.scene.fog = new FogExp2('#1a1430', CONFIG.mood.fogDensity);

  // --- Camera: stand in the alley looking toward the hero sign at the dead end. ---
  const { camera } = world;
  const spawnZ = ALLEY.front + ALLEY.length * 0.33;
  camera.position.set(0, 1.6, spawnZ);
  camera.lookAt(new Vector3(0, 2.5, ALLEY.back));

  // --- Night sky dome + cool image-based lighting (on the level root). ---
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

  // --- A cold, dim moon for grounding shadows; the neon supplies the colour. ---
  const e = CONFIG.mood.moonElevation * (Math.PI / 2);
  const moonDir = new Vector3(-0.5 * Math.cos(e), Math.sin(e), 0.3 * Math.cos(e)).normalize();
  const moon = new DirectionalLight(new Color('#8aa0d6'), 0.55);
  moon.position.copy(moonDir).multiplyScalar(60);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.03;
  const cam = moon.shadow.camera;
  cam.near = 1;
  cam.far = 160;
  cam.left = cam.bottom = -38;
  cam.right = cam.top = 38;
  cam.updateProjectionMatrix();
  world.createTransformEntity(moon);

  world.createTransformEntity(new AmbientLight(new Color('#2a3358'), 0.45));

  // --- The world itself. ---
  buildStreet(world);
  buildBuildings(world);
  buildNeon(world);
  buildProps(world);
  buildWeather(world);

  // --- Welcome panel with the Enter/Exit XR button. ---
  const panel = world
    .createTransformEntity()
    .addComponent(PanelUI, { config: './ui/welcome.json', maxHeight: 0.7, maxWidth: 1.4 })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, { top: '20px', left: '20px', height: '38%' });
  panel.object3D!.position.set(1.3, 1.35, spawnZ + 2.5);
  panel.object3D!.lookAt(0, 1.6, spawnZ);

  world.registerSystem(PanelSystem).registerSystem(NeonSystem).registerSystem(WeatherSystem);
});
