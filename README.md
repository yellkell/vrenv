# IWSDK Papercraft Environments

A small collection of ready-made environments for [IWSDK — the Immersive Web
SDK](https://iwsdk.dev). Every set is folded out of flat-shaded, low-poly
**papercraft** geometry, so it ships as plain TypeScript with **no external 3D
assets** — clone, install, run.

Pick an environment with the `?env=` query parameter:

| `?env=`    | Environment                 | Mood                                  |
| ---------- | --------------------------- | ------------------------------------- |
| `pavilion` | **Lakeside Sports Pavilion** (default) | Bright toon sports hall in a summer valley |
| `cove`     | **Lantern Cove**            | Golden-hour lake island at sunset     |
| `factory`  | **Papercraft Factory Floor** | Dilapidated industrial hall           |

Every environment keeps its center wide open as a gameplay arena, registers
its walkable surfaces with IWSDK locomotion (teleport + smooth), and includes
a few distance-grabbable props.

## Lakeside Sports Pavilion (`?env=pavilion`)

A sun-drenched glass sports hall: an arched glass barrel vault on a teal steel
frame, a warm wood deck wrapping a sunken blue-and-orange court, a chunky toon
net, planters, benches, hanging banners, an umpire ladder chair, and a big
screen. Through every pane: rounded trees, painterly mountains, a tiny toon
town, and slowly drifting clouds. Grab a paddle and ball down on the court.

## Lantern Cove (`?env=cove`)

Golden hour on a grassy island in a still alpine lake. A wooden dock runs
straight toward the low sun and its glitter path on the water; hot-air
balloons drift overhead, a waterfall pours off a cliff island across the
lake, and lantern posts (two of them genuinely lit) wake up as the light
fades. Grabbable carry lantern, oar, and skipping stone.

## Papercraft Factory Floor (`?env=factory`)

A big dilapidated industrial hall: two-tone concrete bays, steel catwalks on
three walls, dead conveyors, broken machines, pallet racking, a gantry crane,
and sliding bay doors that open as you approach (`BayDoorSystem`). Grabbable
wrench, gear, hard hat, crate, and drum.

## Quest 3 performance

The environments are authored as hundreds of tiny primitives (easy to write
and tweak) and then collapsed at load time by `mergeStatic` (`src/merge.ts`),
which bakes world transforms and material colors into vertex-colored merged
meshes — one draw call per material *setting* rather than per object. A whole
environment typically renders in a handful of draw calls plus the live bits
(clouds, balloons, props, panel).

Other guardrails: no shadow maps, one directional light + hemisphere/ambient
fill, at most a couple of point lights, low-segment primitives, and fog for
depth instead of extra geometry. Locomotion gets its own invisible low-poly
nav group (indexed geometry only, which the IWSDK locomotor requires) instead
of colliding against the full visual set.

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
    pavilion.ts             # Lakeside Sports Pavilion
    cove.ts                 # Lantern Cove
  factory.ts                # Papercraft Factory Floor
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

Each environment file starts with its dimension constants and a `C` color
palette. The papercraft feel comes from `flatShading` plus low segment counts
(see `src/papercraft.ts`); the gradients on trees, mountains, and skies are
vertex colors painted by `gradientPaint` / `radialPaint`, and they survive the
merge pass untouched.
