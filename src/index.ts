/**
 * Paper Frontier — a papercraft western desert at golden hour.
 *
 * Folded-paper dunes, layered red-rock mesas on the horizon, saguaro cacti, and
 * tumbleweeds rolling past on the wind. Walk around; pick up the little paper
 * rocks. To restyle the whole place, edit numbers in config.ts.
 */

import {
  World,
  SessionMode,
  Vector3,
  Color,
  Mesh,
  CircleGeometry,
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
import { hexToVec4, makePaperDouble } from './paper.js';
import { buildTerrain } from './terrain.js';
import { buildBoulders, buildMesas, buildGrabRocks } from './rocks.js';
import { buildCacti } from './cactus.js';
import { buildTumbleweeds, TumbleweedSystem } from './tumbleweed.js';
import { buildProps } from './props.js';
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
    defaultLighting: false, // we supply our own sky + IBL below
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: true,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  // --- Warm golden-hour rendering with long, soft-edged shadows. ---
  const renderer = world.renderer;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.mood.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // --- Camera: stand on the sand looking out across the desert. ---
  const { camera } = world;
  camera.position.set(0, 1.6, 0);
  camera.lookAt(new Vector3(0, 1.5, -12));

  // --- Sky + image-based lighting (warm dusty daylight). On the level root. ---
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

  // --- The low golden sun: drives long shadows + a flat paper sun disc. ---
  const e = CONFIG.mood.sunElevation * (Math.PI / 2);
  const sunDir = new Vector3(0.35 * Math.cos(e), Math.sin(e), -0.94 * Math.cos(e)).normalize();

  const sun = new DirectionalLight(new Color('#ffdca0'), 2.4);
  sun.position.copy(sunDir).multiplyScalar(55);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  const cam = sun.shadow.camera;
  cam.near = 8;
  cam.far = 140;
  cam.left = cam.bottom = -42;
  cam.right = cam.top = 42;
  cam.updateProjectionMatrix();
  world.createTransformEntity(sun);

  world.createTransformEntity(new AmbientLight(new Color('#d8b38a'), 0.5));

  // Stylised paper sun low on the horizon (with a fainter halo behind it).
  const halo = new Mesh(new CircleGeometry(44, 36), makePaperDouble('#ffe7ad', 0.5));
  halo.position.copy(sunDir).multiplyScalar(602);
  halo.lookAt(0, halo.position.y, 0);
  world.createTransformEntity(halo);
  const disc = new Mesh(new CircleGeometry(26, 32), makePaperDouble(CONFIG.palette.sun, 1.1));
  disc.position.copy(sunDir).multiplyScalar(600);
  disc.lookAt(0, disc.position.y, 0);
  world.createTransformEntity(disc);

  // --- The world itself. ---
  buildTerrain(world);
  buildMesas(world);
  buildBoulders(world);
  buildCacti(world);
  buildProps(world);
  buildTumbleweeds(world);
  buildGrabRocks(world);

  // --- Welcome panel with the Enter/Exit XR button. ---
  const panel = world
    .createTransformEntity()
    .addComponent(PanelUI, { config: './ui/welcome.json', maxHeight: 0.7, maxWidth: 1.4 })
    .addComponent(Interactable)
    .addComponent(ScreenSpace, { top: '20px', left: '20px', height: '38%' });
  panel.object3D!.position.set(1.2, 1.3, -2.4);
  panel.object3D!.lookAt(0, 1.6, 0);

  world.registerSystem(PanelSystem).registerSystem(TumbleweedSystem);
});
