# Papercraft Saloon Arena

A big indoor **Western saloon arena** built for [IWSDK — the Immersive Web SDK](https://iwsdk.dev).
The entire set is folded out of flat-shaded, low-poly **papercraft** geometry, so
it ships as plain TypeScript with **no external 3D assets** — clone, install, run.

The middle of the room is a clear ~10 m **arena circle**, deliberately left empty
so you can build a game (duels, brawls, sports, mini-games) on top of a finished,
atmospheric environment.

## What's in the scene

- **Arena floor** – plank flooring with an inlaid worn circle and a brass sunburst emblem at center.
- **Saloon shell** – cream-plaster + dark-wainscot walls, exposed ceiling beams, glowing dusk windows.
- **Bar** – counter with brass foot rail, back-bar mirror, and two shelves of faceted bottles.
- **Balcony / mezzanine** – wraps three walls with railings, support posts, and a staircase.
- **Stage** – raised platform with a papercraft upright piano and stool.
- **Furniture** – poker tables (green felt), stools, and barrels pushed to the edges.
- **Chandeliers** – hanging fixtures that carry the warm key lighting.
- **Batwing doors** – swing open as you approach the entrance and settle closed behind you (`BatwingSystem`).
- **Grabbable props** – a whiskey bottle, a glass, a stack of poker chips, and a sheriff's badge (distance-grabbable).
- **Welcome panel** – spatial UI with an Enter/Exit XR button.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` launches the IWSDK dev server. On desktop you get keyboard/mouse XR
emulation (no headset required); on a Quest browser, hit **Enter XR**.

Requires Node.js ≥ 20.19.

## Project layout

```
index.html            # mounts #scene-container and loads src/index.ts
vite.config.ts        # IWSDK dev plugin + UIKitML compiler + mkcert
src/
  index.ts            # World.create(), camera, registers systems
  saloon.ts           # buildSaloon(world): all geometry, lights, doors, props
  papercraft.ts       # flat-shaded "folded paper" material/primitive helpers
  doors.ts            # Batwing component + BatwingSystem (proximity swing)
  panel.ts            # wires the welcome panel's Enter/Exit XR button
ui/welcome.uikitml    # spatial UI template (compiled to public/ui/welcome.json)
```

## Building your game on top

`buildSaloon(world)` is self-contained. In `src/index.ts`, after it runs, add
your own entities/systems. Keep gameplay actors inside the central arena circle
(radius ≈ 5 m, centered at the origin); furniture and props already avoid it.

## Tweaking the look

Geometry sizes live in the `ROOM` / `DOOR` / `ARENA_RADIUS` constants and the
`C` color palette at the top of `src/saloon.ts`. The papercraft feel comes from
`flatShading` plus low cylinder segment counts — see `src/papercraft.ts`.
