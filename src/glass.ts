/**
 * Surface toolkit + tiny deterministic helpers.
 *
 * The Mirror's Edge look is mostly clean matte/semi-gloss white with sparse
 * bold accents and clear glass — not frosted glassmorphism — so most surfaces
 * here are simple, bright MeshStandardMaterials that lean on the image-based
 * lighting for soft sky reflections. Cheap, and holds 72-90 FPS on Quest.
 */

import { Color, MeshStandardMaterial, DoubleSide, FrontSide } from '@iwsdk/core';
import { CONFIG } from './config.js';

/** Clean architectural matte surface — the workhorse white of the whole scene. */
export function makeMatte(tint: string, roughness = 0.72): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(tint),
    roughness,
    metalness: 0.0,
    envMapIntensity: 0.7, // pick up a little sky so white never goes dull
  });
}

/** Semi-gloss surface — floors and trim that catch a soft sheen of the sky. */
export function makeGloss(tint: string, roughness = 0.28): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(tint),
    roughness,
    metalness: 0.0,
    envMapIntensity: 1.2,
  });
}

/** Bold accent (the ME red, blue, yellow) with a touch of glow so it pops. */
export function makeAccent(tint: string, glow = 0.22): MeshStandardMaterial {
  const c = new Color(tint);
  return new MeshStandardMaterial({
    color: c,
    roughness: 0.5,
    metalness: 0.0,
    emissive: c.clone().multiplyScalar(glow),
    emissiveIntensity: 1,
    envMapIntensity: 0.6,
  });
}

export interface GlassOptions {
  tint?: string;
  opacity?: number;
  frost?: number;
  doubleSided?: boolean;
  envIntensity?: number;
}

/** Clean, clear window glass — slightly blue, reflective, barely frosted. */
export function makeGlass(opts: GlassOptions = {}): MeshStandardMaterial {
  const opacity = opts.opacity ?? CONFIG.mood.glassOpacity;
  const frost = opts.frost ?? CONFIG.mood.frost;
  return new MeshStandardMaterial({
    color: new Color(opts.tint ?? '#dcefff'),
    transparent: opacity < 0.98,
    opacity,
    roughness: 0.02 + frost * 0.5,
    metalness: 0.0,
    envMapIntensity: opts.envIntensity ?? 1.8,
    side: opts.doubleSided ? DoubleSide : FrontSide,
    depthWrite: opacity > 0.85,
  });
}

/**
 * Deterministic pseudo-random generator (mulberry32). Same seed → same city
 * every reload, so the world feels like a real place instead of reshuffling.
 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise on a 2D grid — gives the skyline rolling hills of height. */
export function valueNoise2D(rng: () => number, size: number): (x: number, y: number) => number {
  const grid: number[] = new Array((size + 1) * (size + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const at = (xi: number, yi: number) => {
    const cx = ((xi % size) + size) % size;
    const cy = ((yi % size) + size) % size;
    return grid[cy * (size + 1) + cx];
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
}

/** Convert a hex string to the Vec4 [r,g,b,a] the environment components expect. */
export function hexToVec4(hex: string, alpha = 1): [number, number, number, number] {
  const c = new Color(hex);
  return [c.r, c.g, c.b, alpha];
}
