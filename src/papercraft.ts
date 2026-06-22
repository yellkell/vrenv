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
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';

export type Paint = number | string;

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
