/**
 * Glassmorphic material toolkit + tiny deterministic helpers.
 *
 * Performance note (important for Quest): real frosted glass uses
 * `transmission`/refraction, which is genuinely expensive in VR. So instead of
 * faking physics, we *fake the look*: a translucent MeshStandardMaterial that
 * leans on the image-based-lighting reflection + a soft emissive tint. This
 * reads as "glassmorphism" (frosted, glowing, layered) but stays cheap enough
 * to hold 72-90 FPS.
 */

import { Color, MeshStandardMaterial, DoubleSide, FrontSide } from '@iwsdk/core';
import { CONFIG } from './config.js';

export interface GlassOptions {
  tint?: string;
  /** 0 (clear) .. 1 (solid frosted). Defaults to the master config value. */
  opacity?: number;
  /** 0 (mirror) .. 1 (sandblasted). Defaults to the master config value. */
  frost?: number;
  /** Soft inner glow. Good for centerpieces and edges. */
  glow?: number;
  /** Both-sides rendering — needed for thin panels you can walk around. */
  doubleSided?: boolean;
  /** Reflectivity of the IBL environment. */
  envIntensity?: number;
}

/**
 * The one material everything glassy is built from. Translucent, lightly
 * reflective, softly glowing — the signature glassmorphic surface.
 */
export function makeGlass(opts: GlassOptions = {}): MeshStandardMaterial {
  const tint = new Color(opts.tint ?? CONFIG.palette.glassTints[0]);
  const opacity = opts.opacity ?? CONFIG.mood.glassOpacity;
  const frost = opts.frost ?? CONFIG.mood.frost;
  const glow = opts.glow ?? 0.04;

  const mat = new MeshStandardMaterial({
    color: tint,
    transparent: opacity < 0.98,
    opacity,
    // Frost maps to roughness; clear glass is smooth and mirror-like.
    roughness: 0.05 + frost * 0.6,
    metalness: 0.0,
    // A faint self-lit tint keeps shadowed glass from reading as dead black
    // at twilight, which is most of the glassmorphic charm.
    emissive: tint.clone().multiplyScalar(glow),
    emissiveIntensity: 1,
    envMapIntensity: opts.envIntensity ?? 1.4,
    side: opts.doubleSided ? DoubleSide : FrontSide,
    // Transparent surfaces shouldn't write depth, or stacked panes punch holes
    // in each other. We accept a little back-to-front imperfection for speed.
    depthWrite: opacity > 0.85,
  });
  return mat;
}

/** Opaque-but-glassy surface for the city towers (cheap, no sorting headaches). */
export function makeSolidGlass(tint: string, glow = 0.16): MeshStandardMaterial {
  const c = new Color(tint);
  return new MeshStandardMaterial({
    color: c,
    roughness: 0.18,
    metalness: 0.0,
    emissive: c.clone().multiplyScalar(glow),
    emissiveIntensity: 1,
    envMapIntensity: 1.2,
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
