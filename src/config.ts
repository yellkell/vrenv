/**
 * One place to steer the whole vibe — now tuned to a Mirror's Edge aesthetic:
 * blinding clean white architecture, crisp midday sun, a huge bright sky, and
 * bold sparing hits of the signature red (with the odd blue / yellow).
 *
 * You don't have to touch the geometry code. Almost every "feeling" of the
 * scene is a number in here. Change a value, save, the dev server hot-reloads.
 */

export const CONFIG = {
  /** Overall art direction. Tweak these first. */
  mood: {
    /** How high above the city the rooftop floats, in meters (storeys ≈ this / 3). */
    altitude: 200,
    /** Window glass translucency. Low = clean, clear, barely-there glazing. */
    glassOpacity: 0.12,
    /** Frostiness of the glass. Mirror's Edge glass is clear, so keep this low. */
    frost: 0.04,
    /** Atmospheric haze. ME air is crisp and clear, so keep this small. */
    haze: 0.16,
    /** Render distance (meters). Must comfortably exceed altitude + city extent. */
    viewDistance: 3000,
  },

  /** Sky gradient (a big inward-facing dome). Bright clean daylight blue. */
  sky: {
    top: '#2f6fbf', // clean blue overhead
    horizon: '#e4f0fb', // bright, near-white haze band at the horizon
    bottom: '#cdd9e4', // pale below
    intensity: 1.05,
  },

  /** Image-based lighting — bright, so white surfaces read crisp and clean. */
  ibl: {
    sky: '#eef5ff',
    ground: '#cfd6dc',
    intensity: 1.5,
  },

  /** The Mirror's Edge palette. */
  palette: {
    white: '#eef1f4', // clean architectural white
    structure: '#ffffff', // mullions, frames, trim (brightest white)
    roof: '#d6dce2', // light grey roof slabs / parapets that catch the light
    concrete: '#aeb6bd', // ground plane far below
    red: '#e0352b', // THE Mirror's Edge red
    blue: '#2f9bd6',
    yellow: '#f4c026',
    /** Colours a small minority of buildings get painted. Mostly white city. */
    accents: ['#e0352b', '#2f9bd6', '#f4c026'],
  },

  /** The rooftop room you start inside. */
  room: {
    radius: 7.5, // interior radius (meters)
    wallHeight: 3.6,
    ringWidth: 1.6, // width of the see-through glass floor band at the windows
    columns: 16, // evenly spaced white mullions around the glass wall
  },

  /** The stylised white cityscape far below. */
  city: {
    seed: 11,
    extent: 360, // half-width of the city grid (meters)
    spacing: 18, // distance between building lots
    clearing: 80, // empty radius directly under you (so you see straight down)
    maxHeight: 155, // tallest downtown towers
    minHeight: 18,
    jitter: 4, // random lot offset so the grid doesn't look perfect
    accentChance: 0.12, // fraction of buildings painted a bold accent colour
    waterTowerChance: 0.06, // fraction of roofs that get an iconic water tower
  },

  /** Floating grab-able objects scattered around the room (ME-red cubes). */
  decor: {
    cubes: 8,
    bobAmplitude: 0.06, // how far they bob up/down (meters)
    bobSpeed: 0.8,
  },
} as const;
