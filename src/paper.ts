/**
 * Papercraft material toolkit + tiny deterministic helpers.
 *
 * The whole look is "folded construction paper": flat-shaded low-poly geometry
 * (hard facet edges, no smoothing) wearing completely matte materials (no
 * gloss, barely any reflection). That's cheap and holds 72-90 FPS on Quest.
 */

import { Color, MeshStandardMaterial } from '@iwsdk/core';

/** A sheet of matte paper. `flat` gives the folded-facet look (default on). */
export function makePaper(hex: string, roughness = 0.97, flat = true): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(hex),
    roughness,
    metalness: 0.0,
    flatShading: flat,
    envMapIntensity: 0.35, // a touch of sky bounce, but stays papery
  });
}

/** Paper that's visible from both sides (cutout signs, blades, reflections). */
export function makePaperDouble(hex: string, emissive = 0): MeshStandardMaterial {
  const c = new Color(hex);
  const mat = makePaper(hex);
  mat.side = 2; // THREE.DoubleSide
  if (emissive > 0) {
    mat.emissive = c.clone().multiplyScalar(emissive);
  }
  return mat;
}

/**
 * A glowing neon sheet: a near-black body that emits its own colour, so it
 * reads as a lit sign / tube / window against the dark alley. `intensity`
 * pushes it past 1 to bloom toward white at the core under ACES tone-mapping.
 */
export function makeNeon(hex: string, intensity = 2.4, doubleSide = false): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: new Color('#08080b'),
    emissive: new Color(hex),
    emissiveIntensity: intensity,
    roughness: 0.5,
    metalness: 0.0,
  });
  if (doubleSide) mat.side = 2;
  return mat;
}

/**
 * A faint, additive "wet reflection" sheet for laying on the road under a sign.
 * Self-lit, transparent, and doesn't write depth so it layers without z-fights.
 */
export function makeReflection(hex: string, intensity = 1.0, opacity = 0.5): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: new Color('#000000'),
    emissive: new Color(hex),
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    side: 2,
  });
  return mat;
}

/**
 * A holographic advertising panel: a bright, see-through coloured pane that
 * floats on a wall. Transparent and self-lit, and doesn't write depth so it
 * layers like projected light rather than solid paper.
 */
export function makeHolo(hex: string, intensity = 1.4, opacity = 0.32): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color('#000000'),
    emissive: new Color(hex),
    emissiveIntensity: intensity,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
    side: 2,
  });
}

/**
 * Deterministic pseudo-random generator (mulberry32). Same seed → same alley
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

/** Smooth value noise on a 2D grid — gives the dunes their rolling shape. */
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
