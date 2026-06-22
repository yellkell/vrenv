# Papercraft Factory Floor

A big indoor **industrial factory floor** built for [IWSDK — the Immersive Web SDK](https://iwsdk.dev).
The entire set is folded out of flat-shaded, low-poly **papercraft** geometry, so
it ships as plain TypeScript with **no external 3D assets** — clone, install, run.

The middle of the room is a wide-open **work floor** (a 36 m × 36 m hall with a
clear central zone marked by yellow safety lanes), deliberately left empty so you
can build a game on top of a finished, atmospheric environment. A steel
**catwalk / mezzanine** wraps three walls.

## What's in the scene

- **Work floor** – two-tone concrete bays, painted safety lanes, hazard chevrons by the doors, and a steel gear emblem at center.
- **Factory shell** – ribbed metal cladding, a clerestory window band, roof trusses under a deck, and steel I-beam columns.
- **Catwalk / mezzanine** – grating decks on three walls with yellow handrails, toe boards, support brackets, and a switchback stair (the "balcony", industrial-style).
- **Conveyors** – belt frames with rollers, legs, and crates riding along.
- **Machines** – bodies with control panels, screens, indicator buttons, and stack lights.
- **Pallet racking** – multi-bay uprights and beams loaded with crates.
- **Clutter** – crate/pallet stacks and clusters of oil drums.
- **Gantry crane** – a bridge girder on end trucks with a trolley and hook block, riding rails over the floor.
- **Pipework & high-bay lights** – wall pipe runs plus hanging high-bay fixtures carrying the cool key lighting.
- **Sliding bay doors** – two leaves that slide open as you approach and glide shut behind you (`BayDoorSystem`).
- **Grabbable props** – a wrench, a gear, a hard hat, a crate, and an oil drum (distance-grabbable).
- **Welcome panel** – spatial UI with an Enter/Exit XR button.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` launches the IWSDK dev server. On desktop you get keyboard/mouse XR
emulation (no headset required); on a Quest browser, hit **Enter XR**.

Requires Node.js ≥ 20.19.

## Deploy (GitHub Pages)

A workflow at `.github/workflows/deploy.yml` builds the project and publishes
`dist/` to GitHub Pages on every push to `main`. Vite's `base: './'` keeps asset
paths relative so it works under the `https://<owner>.github.io/vrenv/` subpath.
WebXR/immersive mode needs HTTPS, which GitHub Pages provides.

## Project layout

```
index.html            # mounts #scene-container and loads src/index.ts
vite.config.ts        # IWSDK dev plugin + UIKitML compiler + mkcert
src/
  index.ts            # World.create(), camera, registers systems
  factory.ts          # buildFactory(world): all geometry, lights, doors, props
  papercraft.ts       # flat-shaded "folded paper" material/primitive helpers
  doors.ts            # BayDoor component + BayDoorSystem (proximity slide)
  panel.ts            # wires the welcome panel's Enter/Exit XR button
ui/welcome.uikitml    # spatial UI template (compiled to public/ui/welcome.json)
```

## Building your game on top

`buildFactory(world)` is self-contained. In `src/index.ts`, after it runs, add
your own entities/systems. Keep gameplay actors inside the central work zone
(roughly a 18 m square centered on the origin); equipment and props already
avoid it.

## Tweaking the look

Geometry sizes live in the `ROOM` / `BAY` / `WORK_HALF` constants and the `C`
color palette at the top of `src/factory.ts`. The papercraft feel comes from
`flatShading` plus low cylinder segment counts — see `src/papercraft.ts`.
