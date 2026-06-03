# Glass Heights

A glassmorphic VR environment built with **IWSDK** (Meta's [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk)) — Three.js + WebXR, runs right in the Meta Quest browser, no install.

You start inside a circular glass penthouse. Turn around, walk to the floor‑to‑ceiling windows, step onto the **see‑through glass floor band**… and discover you're hundreds of metres up, ringed by a softly glowing glass skyline at sunset. Pick up the floating crystals and toss them around.

The intricate, detailed parts (the whole skyline, the building heights, the scattered décor) are **generated procedurally** so you don't have to place anything by hand. To restyle the entire place, you mostly just change numbers.

## Run it

```bash
npm install
npm run dev      # opens a dev server with a desktop XR emulator
```

On a **Meta Quest**: make sure the headset is on the same network, then open the dev server's `https://<your-computer-ip>:8081` URL in the Quest browser and tap **Enter XR**. (IWSDK serves over HTTPS via mkcert, which WebXR requires.)

```bash
npm run build    # production bundle into dist/
```

## Tune the vibe — `src/config.ts`

You don't need to be a "detail person." Almost every feeling of the scene is a single number in [`src/config.ts`](src/config.ts). Save and the dev server hot‑reloads.

- `mood.altitude` — how high above the city you float
- `mood.glassOpacity` / `mood.frost` — how translucent / frosted everything looks
- `mood.haze` — atmospheric depth (hides the far city)
- `sky.*` / `ibl.*` — time‑of‑day gradient and what the glass reflects
- `palette.glassTints` — the pastel colours buildings & crystals are tinted with
- `city.*` — skyline size, density, tower heights, the clearing under your feet
- `room.*` — the penthouse dimensions
- `decor.crystals` — how many grab‑able toys float around you

## How it's organised

| File | What it builds |
| --- | --- |
| `src/index.ts` | Entry point — world, lighting, sky/IBL, wiring |
| `src/config.ts` | **All the knobs** for art direction |
| `src/glass.ts` | Glassmorphic material toolkit + seeded RNG / noise |
| `src/penthouse.ts` | The interior room (floor, glass walls, railing, your tower shaft) |
| `src/city.ts` | The procedural instanced skyline + haze |
| `src/decor.ts` | Centerpiece sculpture + floating crystals |
| `src/floating.ts` | Crystals bob/spin while idle (pause when grabbed) |
| `src/spin.ts` | Slow rotation for centerpieces |

### A note on performance & glassmorphism

True frosted glass (real refraction/transmission) is genuinely expensive in VR, despite glassmorphism's reputation. So this project *fakes the look* cheaply: translucent reflective materials lit by image‑based lighting, plus a soft self‑glow — and the whole city is a single instanced draw call. That keeps it comfortable at Quest's 72–90 FPS target.
