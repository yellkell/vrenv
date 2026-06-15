/**
 * The neon: signs bolted to the walls, hanging banners, big holographic ads, the
 * hero sign capping the dead end, the coloured light spilled on the wet street,
 * and — crucially — the life in it. Some signs buzz and flicker (broken tubes);
 * others switch fully on and off over time, in different places, so the alley is
 * never lit the same way twice.
 *
 * Each sign is a small Group built around one self-lit (emissive) material, so
 * the NeonSystem can just walk the group and pulse every emissive surface.
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
import { makePaper, makeNeon, makeReflection, makeHolo, makeRng } from './paper.js';
import { FLOOR_Y, ALLEY } from './street.js';

const P = CONFIG.palette;
const NEON = Object.values(CONFIG.palette.neon);

/** Marks a sign that buzzes/flickers (a broken tube). */
export const NeonFlicker = createComponent('NeonFlicker', {
  base: { type: Types.Float32, default: 2.0 },
  speed: { type: Types.Float32, default: 8 },
  phase: { type: Types.Float32, default: 0 },
});

/** Marks a sign/light that switches fully on and off over time. */
export const NeonToggle = createComponent('NeonToggle', {
  base: { type: Types.Float32, default: 2.0 },
  period: { type: Types.Float32, default: 6 },
  onFrac: { type: Types.Float32, default: 0.6 }, // fraction of the cycle spent lit
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

/** A hanging cloth banner with a glowing vertical strip down it. */
function banner(color: string, base: number, h: number): Group {
  const g = new Group();
  const cloth = new Mesh(new BoxGeometry(0.7, h, 0.05), makePaper('#1a1620', 0.97));
  const strip = new Mesh(new PlaneGeometry(0.34, h - 0.3), makeNeon(color, base, true));
  strip.position.z = 0.04;
  cloth.castShadow = true;
  g.add(cloth, strip);
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

/** A big translucent holographic advertisement that floats on the wall. */
function holoBillboard(color: string, base: number, w: number, h: number): Group {
  const g = new Group();
  const frame = new Mesh(new BoxGeometry(w + 0.2, h + 0.2, 0.1), makePaper(P.metalDark, 0.95));
  const pane = new Mesh(new PlaneGeometry(w, h), makeHolo(color, base, 0.34));
  pane.position.z = 0.09;
  frame.castShadow = true;
  g.add(frame, pane);
  return g;
}

/** Lay a stretched, faint reflection of a sign onto the wet road below it. */
function dropReflection(world: World, x: number, z: number, color: string, w: number): void {
  const refl = new Mesh(new PlaneGeometry(w, 5.5), makeReflection(color, 0.8, 0.4));
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(x * 0.5, FLOOR_Y + 0.02, z);
  world.createTransformEntity(refl);
}

/** Tag a freshly-placed sign so it either flickers, toggles, or stays steady. */
function animate(entity: ReturnType<World['createTransformEntity']>, base: number, rng: () => number): void {
  if (rng() < CONFIG.neon.flickerChance) {
    entity.addComponent(NeonFlicker, { base, speed: 5 + rng() * 8, phase: rng() * Math.PI * 2 });
  } else if (rng() < CONFIG.neon.toggleChance) {
    entity.addComponent(NeonToggle, {
      base,
      period: 3 + rng() * 7,
      onFrac: 0.45 + rng() * 0.4,
      phase: rng(),
    });
  }
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
        if (r < 0.4) sign = panel(color, base, 1.4 + rng() * 1.4, 0.8 + rng() * 0.8);
        else if (r < 0.64) sign = tube(color, base, 1.0 + rng() * 1.2, 0.8 + rng() * 1.0);
        else if (r < 0.84) sign = verticalBar(color, base, 2.0 + rng() * 2.2);
        else sign = banner(color, base, 1.8 + rng() * 1.6);
        sign.position.set(innerX - side * 0.1, FLOOR_Y + 3 + rng() * 4.5, z);
        sign.rotation.y = -side * (Math.PI / 2); // lie flush, face the alley
      }

      const entity = world.createTransformEntity(sign);
      animate(entity, base, rng);

      // The brightest steady signs reflect in the road.
      if (base > 2.4 && !isBlade) dropReflection(world, innerX, z, color, 1.6);
    }

    // A few big holographic billboards high on each wall.
    for (let b = 0; b < CONFIG.neon.holoBillboards; b++) {
      const color = nextColor();
      const base = 1.2 + rng() * 0.8;
      const w = 2.6 + rng() * 1.6;
      const h = 3.0 + rng() * 2.0;
      const z = ALLEY.front + 5 + ((b + 0.5) / CONFIG.neon.holoBillboards) * (ALLEY.length - 10);
      const bill = holoBillboard(color, base, w, h);
      bill.position.set(side * ALLEY.halfWidth - side * 0.06, FLOOR_Y + 9 + rng() * 4, z);
      bill.rotation.y = -side * (Math.PI / 2);
      const entity = world.createTransformEntity(bill);
      // Billboards mostly cycle slowly on and off, like changing ads.
      entity.addComponent(NeonToggle, {
        base,
        period: 6 + rng() * 8,
        onFrac: 0.55 + rng() * 0.3,
        phase: rng(),
      });
    }
  }

  // --- The hero sign capping the dead end, facing the player down the alley. ---
  const heroColor = P.neon.magenta;
  const hero = panel(heroColor, 2.6, 5.2, 2.6);
  hero.position.set(0, FLOOR_Y + 6.5, ALLEY.back - 1.2);
  hero.rotation.y = Math.PI; // face -Z, toward the spawn
  world.createTransformEntity(hero);
  dropReflection(world, 0, ALLEY.back - 5, heroColor, 4.0);

  // --- Non-shadow point lights to wash neon onto the walls + wet floor. ---
  const lights: Array<[string, number, number, number]> = [
    [P.neon.magenta, -ALLEY.halfWidth + 0.6, 4.0, ALLEY.front + ALLEY.length * 0.25],
    [P.neon.cyan, ALLEY.halfWidth - 0.6, 4.0, ALLEY.front + ALLEY.length * 0.45],
    [P.neon.amber, 0, 6.5, ALLEY.back - 3],
    [P.neon.blue, ALLEY.halfWidth - 0.6, 3.5, ALLEY.front + ALLEY.length * 0.7],
    [P.neon.green, -ALLEY.halfWidth + 0.6, 3.5, ALLEY.front + ALLEY.length * 0.85],
  ];
  for (const [hex, x, y, z] of lights) {
    const light = new PointLight(new Color(hex), 9, 18, 2);
    light.position.set(x, y, z);
    world.createTransformEntity(light);
  }
}

/** Set the emissive intensity of every glowing surface in a group. */
function setGlow(obj: { traverse: (cb: (o: unknown) => void) => void }, lit: number): void {
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
}

/** Drives the flickering and the on/off toggling signs. */
export class NeonSystem extends createSystem({
  flicker: { required: [NeonFlicker] },
  toggle: { required: [NeonToggle] },
}) {
  update(_delta: number, time: number) {
    this.queries.flicker.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const base = entity.getValue(NeonFlicker, 'base') ?? 2;
      const speed = entity.getValue(NeonFlicker, 'speed') ?? 8;
      const phase = entity.getValue(NeonFlicker, 'phase') ?? 0;
      const t = time * speed + phase;
      let f = 0.82 + 0.18 * Math.sin(t * 9);
      // Occasional hard dropout — the broken-tube buzz.
      if (Math.sin(t * 2.1) * Math.sin(t * 5.7) > 0.9) f *= 0.18;
      setGlow(obj, base * f);
    });

    this.queries.toggle.entities.forEach((entity) => {
      const obj = entity.object3D;
      if (!obj) return;
      const base = entity.getValue(NeonToggle, 'base') ?? 2;
      const period = entity.getValue(NeonToggle, 'period') ?? 6;
      const onFrac = entity.getValue(NeonToggle, 'onFrac') ?? 0.6;
      const phase = entity.getValue(NeonToggle, 'phase') ?? 0;
      let prog = (time / period + phase) % 1;
      if (prog < 0) prog += 1;
      // Lit for the first `onFrac` of the cycle, with a soft edge on/off.
      const edge = 0.05;
      let f = 0;
      if (prog < onFrac) f = Math.min(1, Math.min(prog, onFrac - prog) / edge);
      setGlow(obj, base * f);
    });
  }
}
