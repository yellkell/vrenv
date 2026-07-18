# IWSDK Environments

A small collection of ready-made environments for [IWSDK — the Immersive Web
SDK](https://iwsdk.dev), in two art styles: **realistic** (procedural PBR
textures, physical skies, baked shadows) and **papercraft** (flat-shaded toon
primitives). Everything is generated in code at load time, so the project
ships as plain TypeScript with **no external 3D assets** — clone, install,
run.

Pick an environment with the `?env=` query parameter:

| `?env=`          | Environment                            | Style      |
| ---------------- | -------------------------------------- | ---------- |
| `pavilion`       | **Lakeside Sports Pavilion** (default) | Realistic  |
| `cove`           | **Lantern Cove**                       | Realistic  |
| `pavilion-paper` | Lakeside Sports Pavilion               | Papercraft |
| `cove-paper`     | Lantern Cove                           | Papercraft |
| `factory`        | **Papercraft Factory Floor**           | Papercraft |

Every environment keeps its center wide open as a gameplay arena, registers
its walkable surfaces with IWSDK locomotion (teleport + smooth), and includes
a few distance-grabbable props.

## Lakeside Sports Pavilion (`?env=pavilion`)

A sun-drenched glass sports hall: steel tube arches carrying a curved,
genuinely reflective glass vault, oak plank decking around a sunken acrylic
court (painted — lines, service boxes, wear and all — into a single baked
texture), a sagging woven net, wood-and-steel benches, printed fabric
banners, concrete planters with leafy shrubs, and an LED scoreboard. Outside
the glazing: a lawn, volumetric leaf-clump trees, one continuous hazy
mountain range on the horizon, and drifting cloud billboards. Grab a paddle and ball down on the court.

## Lantern Cove (`?env=cove`)

Golden hour on a lake island. A noise-displaced terrain mesh with a baked
meadow-to-shore splat and 3D grass tufts; still water whose scrolling ripple
normals reflect a physical sunset sky (the glitter path comes out of the
environment map, not paint); a dock running straight at the sun;
volumetric pines; a live scrolling waterfall; striped-fabric balloons; and
lantern pools plus a flickering fire pit as the light fades. Grabbable carry
lantern, oar, and skipping stone.

## Papercraft Factory Floor (`?env=factory`)

A big dilapidated industrial hall: two-tone concrete bays, steel catwalks on
three walls, dead conveyors, broken machines, pallet racking, a gantry crane,
and sliding bay doors that open as you approach (`BayDoorSystem`). Grabbable
wrench, gear, hard hat, crate, and drum.

## How the realistic style works (with zero assets)

- **Procedural textures** (`src/textures.ts`): every material — oak planks,
  sport acrylic, terrain splat, bark, tiling leafage and needles, cloud
  billboards, banner art, the scoreboard — is painted into an offscreen
  canvas at load, with normal maps derived from painted height via a Sobel
  pass and roughness maps for PBR response.
- **Physical sky + IBL** (`src/realism.ts`): an analytic gradient-plus-sun
  shader dome is run through `PMREMGenerator` and set as
  `scene.environment`, so glass, steel, and water actually reflect the
  world. ACES filmic tone mapping ties it together.
- **One static shadow pass**: the sun renders a single 2048px PCF shadow map
  which is then frozen (`renderer.shadowMap.autoUpdate = false`) — real
  contact shadows at near-zero per-frame cost.
- **Live touches** (`TickSystem`): scrolling water normals, a falling-water
  texture on the waterfall, ember flicker; balloons and clouds drift on the
  same `Drifter` system as the papercraft scenes.

## Quest 3 performance

Both styles budget the same way: merged static geometry (papercraft via
`mergeStatic`, realistic via per-material `mergeGeometries` batches — whole
forests collapse to two draw calls, the entire mountain range to one mesh
from `src/nature.ts`), a few dozen draw calls per scene, one directional
light plus hemisphere fill, at most three point lights, opaque displaced
geometry for tree canopies (stereo-correct, no alpha sorting), fog for
depth, and no per-frame shadow rendering. Locomotion gets its own invisible low-poly
nav group (indexed geometry only, which the IWSDK locomotor requires) instead
of colliding against the full visual set; the realistic environments reuse
the exact nav meshes exported by their papercraft twins.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` launches the IWSDK dev server. On desktop you get keyboard/mouse
XR emulation (no headset required); on a Quest browser, hit **Enter XR**. Add
`?env=cove` (or `factory`) to the URL to switch environments.

Requires Node.js ≥ 20.19.

## Deploy (GitHub Pages)

A workflow at `.github/workflows/deploy.yml` builds the project and publishes
`dist/` to GitHub Pages on every push to `main`. Vite's `base: './'` keeps asset
paths relative so it works under the `https://<owner>.github.io/vrenv/` subpath.
WebXR/immersive mode needs HTTPS, which GitHub Pages provides.

## Project layout

```
index.html                  # mounts #scene-container and loads src/index.ts
vite.config.ts              # IWSDK dev plugin + UIKitML compiler + mkcert
src/
  index.ts                  # World.create(), spawns the chosen environment
  environments/
    registry.ts             # environment catalog + ?env= selection
    pavilion-real.ts        # Lakeside Sports Pavilion (realistic, default)
    cove-real.ts            # Lantern Cove (realistic, default)
    pavilion.ts             # Lakeside Sports Pavilion (papercraft) + nav mesh
    cove.ts                 # Lantern Cove (papercraft) + nav mesh
  factory.ts                # Papercraft Factory Floor
  textures.ts               # procedural canvas textures (realistic style)
  nature.ts                 # mountain-range ring + volumetric tree builders
  realism.ts                # sky shader, PMREM env baking, shadows, TickSystem
  papercraft.ts             # flat-shaded primitives, gradients, RNG helpers
  merge.ts                  # static-geometry merge pass (draw-call collapse)
  drift.ts                  # Drifter component + ambient-motion system
  doors.ts                  # BayDoor component + proximity slide (factory)
  panel.ts                  # welcome panel title/blurb + Enter/Exit XR button
ui/welcome.uikitml          # spatial UI template (compiled to public/ui/)
```

## Building your game on top

Each environment's `build(world)` is self-contained. In `src/index.ts`, after
`env.build(world)` runs, add your own entities/systems. Keep gameplay actors
in the open center: the pavilion's sunken court (~11 m × 16 m), the cove's
meadow (~13 m radius), or the factory's marked work zone (~18 m square).

## Tweaking the look

Each environment file starts with its dimension constants and palette. In the
realistic scenes, most of the look lives in `src/textures.ts` (per-material
canvas painting) and each scene's `SKY` spec (gradient stops, sun direction,
halo) — change those and the PMREM reflections, water, and lighting follow.
The papercraft feel comes from `flatShading` plus low segment counts (see
`src/papercraft.ts`); its gradients are vertex colors painted by
`gradientPaint` / `radialPaint`, and they survive the merge pass untouched.
