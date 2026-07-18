/**
 * realism.ts
 *
 * Scene-level plumbing for the realistic environments:
 *
 *  - `applyRealismRenderer`: ACES tone mapping + a single *static* shadow
 *    map (rendered once, then frozen — near-zero per-frame cost on Quest 3).
 *  - `skyDome`: an analytic gradient-plus-sun shader sky, cheap enough for
 *    mobile and convincing under tone mapping.
 *  - `bakeEnvironment`: runs the sky through PMREMGenerator and assigns the
 *    result as `scene.environment`, which is what makes PBR materials (glass,
 *    steel, water) actually *reflect* the world instead of looking flat.
 *  - `onTick` + `TickSystem`: tiny per-frame callback registry for scrolling
 *    water normals, waterfall foam, ember flicker, etc.
 */

import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  createSystem,
  Mesh,
  PCFSoftShadowMap,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type World,
} from '@iwsdk/core';

// ----------------------------------------------------------------------------
// Renderer: filmic tone mapping + one-shot static shadows
// ----------------------------------------------------------------------------

export function applyRealismRenderer(world: World, exposure = 1.0): void {
  const renderer = world.renderer;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  // The environments are static: render the shadow map once and freeze it.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
}

// ----------------------------------------------------------------------------
// Sky
// ----------------------------------------------------------------------------

export interface SkySpec {
  top: string;
  mid: string;
  horizon: string;
  /** World-space direction pointing *at* the sun. */
  sunDirection: Vector3;
  sunColor: string;
  /** Solid disc size (cosine threshold) and halo breadth. */
  sunSize?: number;
  haloPower?: number;
  haloStrength?: number;
}

/**
 * Analytic sky: vertical three-stop gradient + sun disc with halo. One
 * draw call, no textures, tone-mapping friendly (emits HDR-ish values).
 */
export function skyDome(spec: SkySpec, radius = 380): Mesh {
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new Color(spec.top) },
      mid: { value: new Color(spec.mid) },
      horizon: { value: new Color(spec.horizon) },
      sunDir: { value: spec.sunDirection.clone().normalize() },
      sunColor: { value: new Color(spec.sunColor) },
      sunSize: { value: spec.sunSize ?? 0.9994 },
      haloPower: { value: spec.haloPower ?? 80 },
      haloStrength: { value: spec.haloStrength ?? 0.7 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunSize;
      uniform float haloPower;
      uniform float haloStrength;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.12, 1.0);
        vec3 col;
        if (h < 0.22) {
          col = mix(horizon, mid, smoothstep(-0.12, 0.22, h));
        } else {
          col = mix(mid, top, smoothstep(0.22, 0.85, h));
        }
        float cosang = dot(d, sunDir);
        // Halo scattering.
        col += sunColor * haloStrength * pow(max(cosang, 0.0), haloPower);
        // Solid disc, slightly overbright so tone mapping blooms it.
        col = mix(col, sunColor * 2.6, smoothstep(sunSize, sunSize + 0.0006, cosang));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new Mesh(new SphereGeometry(radius, 32, 20), mat);
  dome.userData.noMerge = true;
  dome.frustumCulled = false;
  return dome;
}

/**
 * Renders the given sky into a PMREM and assigns it as the scene's
 * environment map, so every MeshStandardMaterial picks up image-based
 * lighting + reflections. Returns after cleanup; call once per environment.
 */
export function bakeEnvironment(world: World, spec: SkySpec, intensity = 1): void {
  const pmrem = new PMREMGenerator(world.renderer);
  const skyScene = new Scene();
  skyScene.add(skyDome(spec, 100));
  const envMap = pmrem.fromScene(skyScene, 0.04).texture;
  world.scene.environment = envMap;
  if ('environmentIntensity' in world.scene) {
    (world.scene as { environmentIntensity: number }).environmentIntensity = intensity;
  }
  pmrem.dispose();
}

// ----------------------------------------------------------------------------
// Tick callbacks (water scroll, flicker, foam)
// ----------------------------------------------------------------------------

type TickFn = (delta: number, time: number) => void;
const tickFns: TickFn[] = [];

/** Register a per-frame callback (cleared when the page reloads). */
export function onTick(fn: TickFn): void {
  tickFns.push(fn);
}

export class TickSystem extends createSystem({}) {
  update(delta: number, time: number) {
    for (const fn of tickFns) fn(delta, time);
  }
}
