# Neon Alley

A papercraft cyberpunk backstreet in VR, built with **IWSDK** (Meta's [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk)) — Three.js + WebXR, runs right in the Meta Quest browser, no install.

A narrow rain-slicked alley at night, walled in by towering window-speckled buildings and plastered with buzzing neon. Steam curls up from the street gratings, cables sag overhead with strung paper lanterns, and a warm little ramen stall glows against all the cold neon. Look one way for the hero sign capping the dead end; turn around for the fogged megacity skyline. Walk around and pick up the little glowing things.

The whole look is "folded construction paper": low-poly flat-shaded geometry with completely matte materials, lit almost entirely by self-glowing neon. It's generated procedurally, so you don't place anything by hand — to restyle it you mostly just change numbers.

> This branch (`claude/cyberpunk-backstreet`) is one environment in the repo. The golden-hour papercraft desert lives on `claude/papercraft-desert`, and the Mirror's Edge rooftop scene on `claude/vr-glassmorphic-environments-r7rCA`.

## Run it

```bash
npm install
npm run dev      # opens a dev server with a desktop XR emulator
```

On a **Meta Quest**: open the dev server's `https://<your-computer-ip>:8081` URL in the Quest browser and tap **Enter XR**. (HTTPS via mkcert, which WebXR requires.)

```bash
npm run build    # production bundle into dist/
```

## Tune the vibe — `src/config.ts`

Almost every feeling of the scene is a single number in [`src/config.ts`](src/config.ts):

- `mood.exposure` / `mood.fogDensity` — overall brightness and how fast the alley fades into haze
- `mood.moonElevation` — the cold moon's height (it grounds the shadows; neon does the colour)
- `sky.*` / `ibl.*` — the night sky gradient and cool ambient lighting
- `palette.*` — every paper colour: concrete, metal, and the whole neon ink set
- `palette.neon.*` — the glowing colours signs and accents are drawn from
- `alley.*` — how wide and how long the alley is
- `buildings.*` / `windows.*` — facade size/height and the lit-window grids
- `skyline.*` — the fogged megacity beyond the open end
- `neon.*` — how many signs per wall, how many jut out, how many flicker
- `props.*` — crates, barrels, lanterns, cables, grabbables…
- `rain.*` / `steam.*` — the falling rain and the vent steam

## How it's organised

| File | What it builds |
| --- | --- |
| `src/index.ts` | Entry point — world, night sky, fog, moon, wiring |
| `src/config.ts` | **All the knobs** for art direction |
| `src/paper.ts` | Papercraft material toolkit (+ neon/reflection) and seeded RNG / noise |
| `src/street.ts` | The wet asphalt floor, puddles, curbs (+ the walkable surface) |
| `src/buildings.ts` | Alley facades, instanced windows, rooftops, and the skyline |
| `src/neon.ts` | Neon signs, the hero sign, light spill, and the flicker system |
| `src/props.ts` | Dumpsters, crates, barrels, AC, pipes, fire escapes, cables, ramen stall, grabbables |
| `src/weather.ts` | The falling rain and the rising vent steam |
