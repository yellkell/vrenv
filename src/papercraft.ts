/**
 * papercraft.ts
 *
 * Tiny helpers for building a low-poly, flat-shaded "folded paper" look out of
 * plain Three.js primitives. Everything here is pure Three.js so the saloon can
 * be dropped into any IWSDK world without external GLTF/GLXF assets.
 *
 * The papercraft aesthetic comes from three tricks:
 *   1. `flatShading: true` so every facet reads as a crisp paper fold.
 *   2. Low radial segment counts on cylinders/cones (6-8) for chunky facets.
 *   3. Matte, slightly desaturated colors (high roughness, zero metalness).
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';

export type Paint = number | string | Color;

export interface PaperOptions {
  roughness?: number;
  metalness?: number;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
}

/** A matte, flat-shaded "construction paper" material. */
export function paper(color: Paint, opts: PaperOptions = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: opts.roughness ?? 0.94,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flat ?? true,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

function dressMesh(mesh: Mesh): Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A faceted folded-paper box (or shares a material if one is passed in). */
export function box(
  w: number,
  h: number,
  d: number,
  color: Paint | MeshStandardMaterial,
): Mesh {
  const material = color instanceof MeshStandardMaterial ? color : paper(color);
  return dressMesh(new Mesh(new BoxGeometry(w, h, d), material));
}

/** A chunky faceted post/cylinder. Use `segments` 6-8 for the papercraft look. */
export function post(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: Paint | MeshStandardMaterial,
  segments = 8,
): Mesh {
  const material = color instanceof MeshStandardMaterial ? color : paper(color);
  return dressMesh(
    new Mesh(new CylinderGeometry(radiusTop, radiusBottom, height, segments), material),
  );
}

/** A faceted "crumpled paper" ball — good for foliage, rocks, clouds, balloons. */
export function ball(
  radius: number,
  color: Paint | MeshStandardMaterial,
  detail = 1,
): Mesh {
  const material = color instanceof MeshStandardMaterial ? color : paper(color);
  return dressMesh(new Mesh(new IcosahedronGeometry(radius, detail), material));
}

/** A chunky faceted cone (pine trees, mountains, funnels). */
export function cone(
  radius: number,
  height: number,
  color: Paint | MeshStandardMaterial,
  segments = 7,
): Mesh {
  const material = color instanceof MeshStandardMaterial ? color : paper(color);
  return dressMesh(
    new Mesh(new CylinderGeometry(0.001, radius, height, segments), material),
  );
}

/**
 * Paints a vertical color gradient into a geometry's vertex colors (bottom →
 * top in the geometry's local space). The mesh's material is switched to white
 * + `vertexColors` so the gradient is what you see; `mergeStatic` keeps
 * authored vertex colors intact, so gradients survive the merge pass.
 */
export function gradientPaint(mesh: Mesh, bottom: Paint, top: Paint): Mesh {
  const geom = mesh.geometry as BufferGeometry;
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const span = Math.max(bb.max.y - bb.min.y, 1e-5);
  const pos = geom.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const cBottom = new Color(bottom);
  const cTop = new Color(top);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / span;
    c.copy(cBottom).lerp(cTop, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new BufferAttribute(colors, 3));
  const mat = mesh.material as MeshStandardMaterial;
  mat.color.set('#ffffff');
  mat.vertexColors = true;
  return mesh;
}

/**
 * Paints a radial color gradient (center → rim in the local XZ plane) into a
 * geometry's vertex colors. Great for ground discs and water. Same material
 * handling as `gradientPaint`.
 */
export function radialPaint(mesh: Mesh, center: Paint, rim: Paint): Mesh {
  const geom = mesh.geometry as BufferGeometry;
  geom.computeBoundingBox();
  const bb = geom.boundingBox!;
  const maxR = Math.max(
    Math.hypot(bb.max.x, bb.max.z),
    Math.hypot(bb.min.x, bb.min.z),
    1e-5,
  );
  const pos = geom.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const cCenter = new Color(center);
  const cRim = new Color(rim);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(Math.hypot(pos.getX(i), pos.getZ(i)) / maxR, 1);
    c.copy(cCenter).lerp(cRim, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new BufferAttribute(colors, 3));
  const mat = mesh.material as MeshStandardMaterial;
  mat.color.set('#ffffff');
  mat.vertexColors = true;
  return mesh;
}

/** Position helper that also returns the object, so calls can be chained inline. */
export function at<T extends Object3D>(obj: T, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  return obj;
}

/** Adds `child` to `parent` at the given position and returns the child. */
export function place<T extends Object3D>(
  parent: Object3D,
  child: T,
  x: number,
  y: number,
  z: number,
): T {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

/** Convenience for grouping a set of children under one transform. */
export function group(...children: Object3D[]): Group {
  const g = new Group();
  children.forEach((c) => g.add(c));
  return g;
}

// ----------------------------------------------------------------------------
// Weathering helpers — for a grimy, dilapidated look
// ----------------------------------------------------------------------------

/** Deterministic seeded PRNG (mulberry32) so the decay is stable build-to-build. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a grimier version of a color: darker, desaturated, and nudged toward
 * rust. `amount` (0..1) controls how aggressive the decay is; `rng` adds
 * per-call variation so neighbouring surfaces don't look uniform.
 */
export function weather(base: Paint, rng: () => number, amount = 0.3): Color {
  const c = new Color(base);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const t = rng();
  hsl.l *= 1 - amount * (0.25 + 0.6 * t);
  hsl.s *= 1 - amount * 0.55;
  const rustHue = 0.06; // orange-brown
  hsl.h += (rustHue - hsl.h) * amount * t * 0.5;
  c.setHSL(hsl.h, Math.max(0, hsl.s), Math.max(0, hsl.l));
  return c;
}
