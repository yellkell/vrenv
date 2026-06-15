/**
 * The neon: signs stapled and bolted to the walls, the hero sign capping the
 * dead end, the coloured light they spill onto the wet street, and the broken
 * ones that buzz and flicker.
 *
 * Each sign is a small Group built around one self-lit (emissive) material, so
 * the FlickerSystem can just walk the group and pulse every emissive surface it
 * finds. Flush signs (panels, tubes, bars) sit on the wall facing the alley;
 * blade signs jut out perpendicular so you read them coming down the street.
 */

import {
  type World,
  Group,
  Mesh,
  BoxGeometry,
  PlaneGeometry,
  PointLight,
  Color,
  MeshStandardMaterial,
  createComponent,
  createSystem,
  Types,
} from '@iwsdk/core';
import { CONFIG } from './config.js';
import { makePaper, makeNeon, makeReflection, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

const P = CONFIG.palette;
const NEON = Object.values(CONFIG.palette.neon);

/** Marks a sign that buzzes/flickers. */
export const NeonFlicker = createComponent('NeonFlicker', {
  base: { type: Types.Float32, default: 2.0 },
  speed: { type: Types.Float32, default: 8 },
  phase: { type: Types.Float32, default: 0 },
});

// --- Sign builders. Each returns a Group facing +Z, lit by one neon colour. ---

/** A framed glowing panel (the most common shop sign). */
function panel(color: string, base: number, w: number, h: number): Group {
  const g = new Group();
  const frame = new Mesh(new BoxGeometry(w + 0.18, h + 0.18, 0.12), makePaper(P.metalDark, 0.95));
  const face = new Mesh(new PlaneGeometry(w, h), makeNeon(color, base, true));
  face.position.z = 0.08;
  frame.castShadow = true;
  g.add(frame, face);
  return g;
}

/** A rectangle outlined in glowing tube (4 thin bars). */
function tube(color: string, base: number, w: number, h: number): Group {
  const g = new Group();
  const mat = makeNeon(color, base);
  const t = 0.09;
  const top = new Mesh(new BoxGeometry(w, t, t), mat);
  top.position.y = h / 2;
  const bot = new Mesh(new BoxGeometry(w, t, t), mat);
  bot.position.y = -h / 2;
  const left = new Mesh(new BoxGeometry(t, h, t), mat);
  left.position.x = -w / 2;
  const right = new Mesh(new BoxGeometry(t, h, t), mat);
  right.position.x = w / 2;
  g.add(top, bot, left, right);
  return g;
}

/** A tall vertical bar broken into stacked glyph-like segments. */
function verticalBar(color: string, base: number, h: number): Group {
  const g = new Group();
  const bar = new Mesh(new BoxGeometry(0.5, h, 0.12), makeNeon(color, base));
  g.add(bar);
  const gaps = 2 + ((h / 1.2) | 0);
  for (let i = 1; i < gaps; i++) {
    const cross = new Mesh(new BoxGeometry(0.62, 0.07, 0.16), makePaper(P.metalDark, 0.95));
    cross.position.y = -h / 2 + (i * h) / gaps;
    g.add(cross);
  }
  return g;
}

/** A blade sign: a tall plate jutting out from the wall, read end-on. */
function blade(color: string, base: number, h: number): Group {
  const g = new Group();
  const plate = new Mesh(new BoxGeometry(1.0, h, 0.1), makeNeon(color, base));
  const bracket = new Mesh(new BoxGeometry(0.5, 0.12, 0.1), makePaper(P.metalDark, 0.95));
  bracket.position.set(-0.6, h * 0.3, 0);
  bracket.castShadow = true;
  g.add(plate, bracket);
  return g;
}

/** Lay a stretched, faint reflection of a sign onto the wet road below it. */
function dropReflection(world: World, x: number, z: number, color: string, w: number): void {
  const refl = new Mesh(new PlaneGeometry(w, 5.5), makeReflection(color, 0.8, 0.4));
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(x * 0.5, FLOOR_Y + 0.02, z);
  world.createTransformEntity(refl);
}

export function buildNeon(world: World): void {
  const rng = makeRng(CONFIG.alley.seed * 17 + 9);
  let colorIdx = (rng() * NEON.length) | 0;
  const nextColor = () => NEON[(colorIdx = (colorIdx + 1) % NEON.length)];

  for (const side of [-1, 1]) {
    const innerX = side * ALLEY.halfWidth;
    for (let i = 0; i < CONFIG.neon.signsPerSide; i++) {
      const z = ALLEY.front + 3 + ((i + rng() * 0.6) / CONFIG.neon.signsPerSide) * (ALLEY.length - 6);
      const color = nextColor();
      const base = 1.8 + rng() * 1.0;
      const isBlade = rng() < CONFIG.neon.bladeChance;

      let sign: Group;
      if (isBlade) {
        sign = blade(color, base, 1.8 + rng() * 1.8);
        // Jut inward from the wall, faces read down the alley (±Z), up high.
        sign.position.set(innerX - side * 0.6, FLOOR_Y + 4.2 + rng() * 2.5, z);
      } else {
        const r = rng();
        if (r < 0.5) sign = panel(color, base, 1.4 + rng() * 1.4, 0.8 + rng() * 0.8);
        else if (r < 0.78) sign = tube(color, base, 1.0 + rng() * 1.2, 0.8 + rng() * 1.0);
        else sign = verticalBar(color, base, 2.0 + rng() * 2.2);
        sign.position.set(innerX - side * 0.1, FLOOR_Y + 3 + rng() * 4.5, z);
        sign.rotation.y = -side * (Math.PI / 2); // lie flush, face the alley
      }

      const entity = world.createTransformEntity(sign);
      if (rng() < CONFIG.neon.flickerChance) {
        entity.addComponent(NeonFlicker, {
          base,
          speed: 5 + rng() * 8,
          phase: rng() * Math.PI * 2,
        });
      }

      // The brightest signs reflect in the road and spill coloured light.
      if (base > 2.4 && !isBlade) dropReflection(world, innerX, z, color, 1.6);
    }
  }

  // --- The hero sign capping the dead end, facing the player down the alley. ---
  const heroColor = P.neon.magenta;
  const hero = panel(heroColor, 2.6, 5.2, 2.6);
  hero.position.set(0, FLOOR_Y + 6.5, ALLEY.back - 1.2);
  hero.rotation.y = Math.PI; // face -Z, toward the spawn
  world.createTransformEntity(hero);
  dropReflection(world, 0, ALLEY.back - 5, heroColor, 4.0);

  // --- A few non-shadow point lights to wash neon onto walls + wet floor. ---
  const lights: Array<[string, number, number, number]> = [
    [P.neon.magenta, -ALLEY.halfWidth + 0.6, 4.0, ALLEY.front + ALLEY.length * 0.3],
    [P.neon.cyan, ALLEY.halfWidth - 0.6, 4.0, ALLEY.front + ALLEY.length * 0.55],
    [P.neon.amber, 0, 6.5, ALLEY.back - 3],
    [P.neon.blue, ALLEY.halfWidth - 0.6, 3.5, ALLEY.front + ALLEY.length * 0.78],
  ];
  for (const [hex, x, y, z] of lights) {
    const light = new PointLight(new Color(hex), 9, 18, 2);
    light.position.set(x, y, z);
    world.createTransformEntity(light);
  }
}

/** Pulses the emissive intensity of broken signs so they buzz and flicker. */
export class NeonSystem extends createSystem({
  signs: { required: [NeonFlicker] },
}) {
  update(_delta: number, time: number) {
    this.queries.signs.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const base = entity.getValue(NeonFlicker, 'base') ?? 2;
      const speed = entity.getValue(NeonFlicker, 'speed') ?? 8;
      const phase = entity.getValue(NeonFlicker, 'phase') ?? 0;
      const t = time * speed + phase;
      let f = 0.82 + 0.18 * Math.sin(t * 9);
      // Occasional hard dropout — the broken-tube buzz.
      if (Math.sin(t * 2.1) * Math.sin(t * 5.7) > 0.9) f *= 0.18;
      const lit = base * f;
      obj.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | undefined;
        if (
          m &&
          (m as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial &&
          m.emissive &&
          m.emissive.r + m.emissive.g + m.emissive.b > 0
        ) {
          m.emissiveIntensity = lit;
        }
      });
    });
  }
}
