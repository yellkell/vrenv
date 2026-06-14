# Paper Frontier

A papercraft western desert in VR, built with **IWSDK** (Meta's [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk)) — Three.js + WebXR, runs right in the Meta Quest browser, no install.

Folded-paper dunes at golden hour, layered red-rock mesas on the horizon, saguaro cacti, a sun-bleached cattle skull, and **tumbleweeds rolling past on the wind**. Walk around and pick up the little paper rocks.

The whole look is "folded construction paper": low-poly flat-shaded geometry with completely matte materials. It's generated procedurally, so you don't place anything by hand — to restyle it you mostly just change numbers.

> This branch (`claude/papercraft-desert`) is a second environment in the repo. The Mirror's Edge rooftop scene lives on `claude/vr-glassmorphic-environments-r7rCA`.

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

- `mood.sunElevation` — sun height (low = long dramatic shadows)
- `mood.exposure` / `mood.haze` — brightness and dusty distance
- `sky.*` / `ibl.*` — golden-hour colours and lighting
- `palette.*` — every construction-paper colour (sand, rock strata, cactus, tumbleweed…)
- `terrain.*` — dune size, height, and facet chunkiness
- `rocks.*` — boulder count and the horizon mesa ring
- `cacti.*` — how many saguaros / barrels / prickly pears
- `tumbleweeds.*` — how many roll, and how fast the wind blows

## How it's organised

| File | What it builds |
| --- | --- |
| `src/index.ts` | Entry point — world, sky, sun, wiring |
| `src/config.ts` | **All the knobs** for art direction |
| `src/paper.ts` | Papercraft material toolkit + seeded RNG / noise |
| `src/terrain.ts` | The folded-paper dunes (+ shared `desertHeight`) |
| `src/rocks.ts` | Boulders, horizon mesas, grab-able paper rocks |
| `src/cactus.ts` | Saguaro / barrel / prickly-pear cacti |
| `src/tumbleweed.ts` | The rolling plants + the wind system |
| `src/props.ts` | Signpost, cattle skull, broken fence |
