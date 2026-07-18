/**
 * merge.ts
 *
 * Static-geometry merge pass for Quest-class performance. The papercraft
 * environments are authored as hundreds of tiny primitive meshes (easy to
 * write and tweak), which would each cost a draw call. `mergeStatic` walks a
 * finished environment group, bakes every mesh's world transform and material
 * color into vertex-colored geometry, and merges everything that shares the
 * same material *settings* (shading, opacity, side…) into one big mesh.
 *
 * A whole environment typically collapses to a handful of draw calls — the
 * difference between comfortably hitting frame rate on Quest 3 and not.
 *
 * Opt-outs: set `userData.noMerge = true` on a mesh (or any ancestor group)
 * to keep it live — used for sky domes, animated pieces, and anything whose
 * transform changes at runtime.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Bucket {
  geometries: BufferGeometry[];
  template: MeshStandardMaterial | MeshBasicMaterial;
}

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv', 'color'];

function materialKey(mat: MeshStandardMaterial | MeshBasicMaterial): string {
  const std = mat as MeshStandardMaterial;
  return [
    mat.type,
    std.flatShading ? 'flat' : 'smooth',
    std.roughness ?? '-',
    std.metalness ?? '-',
    mat.transparent ? `t${mat.opacity}` : 'o',
    mat.side,
    (mat as MeshBasicMaterial).fog === false ? 'nofog' : 'fog',
  ].join('|');
}

/**
 * Returns a new Group containing the merged static geometry plus any subtrees
 * that opted out via `userData.noMerge` (re-parented whole, with their world
 * transforms preserved, so animated groups stay animatable). Lights survive
 * too. The input group should NOT be added to the scene — add the result.
 */
export function mergeStatic(root: Object3D): Group {
  root.updateMatrixWorld(true);

  const buckets = new Map<string, Bucket>();
  const survivors: Object3D[] = [];

  const collect = (mesh: Mesh): void => {
    const mat = mesh.material as MeshStandardMaterial | MeshBasicMaterial;
    const key = materialKey(mat);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { geometries: [], template: mat };
      buckets.set(key, bucket);
    }

    // Bake world transform, then bake the material color into vertex colors
    // (unless the geometry was gradient-painted already, in which case the
    // authored colors stand).
    const geom = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    for (const name of Object.keys(geom.attributes)) {
      if (!KEEP_ATTRIBUTES.includes(name)) geom.deleteAttribute(name);
    }
    if (!geom.getAttribute('color')) {
      const count = geom.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      const c = new Color(mat.color);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geom.setAttribute('color', new BufferAttribute(colors, 3));
    }
    bucket.geometries.push(geom.toNonIndexed());
  };

  const walk = (obj: Object3D): void => {
    if (obj !== root && obj.userData.noMerge) {
      survivors.push(obj);
      return; // keep the whole subtree live; don't descend
    }
    const anyObj = obj as Mesh & { isLight?: boolean };
    if (anyObj.isLight) {
      survivors.push(obj);
      return;
    }
    if (anyObj.isMesh) collect(anyObj);
    for (const child of obj.children) walk(child);
  };
  walk(root);

  const out = new Group();
  out.name = `${root.name || 'environment'}-merged`;

  for (const { geometries, template } of buckets.values()) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    const mat = template.clone();
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    const mesh = new Mesh(merged, mat);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    out.add(mesh);
  }

  // Re-parent survivors preserving their world transforms. (Their subtrees
  // keep local transforms relative to them, so animation still works.)
  for (const obj of survivors) {
    obj.getWorldPosition(obj.position);
    obj.getWorldQuaternion(obj.quaternion);
    obj.getWorldScale(obj.scale);
    out.add(obj);
  }

  return out;
}
