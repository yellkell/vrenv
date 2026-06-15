/**
 * One place to steer the whole vibe — a papercraft cyberpunk backstreet at
 * night: a narrow rain-slicked alley between towering buildings, walls plastered
 * with buzzing neon, steam curling up from the gratings, cables sagging
 * overhead. The far end opens onto a fogged megacity skyline.
 *
 * You don't have to touch the geometry code. Almost every "feeling" of the
 * scene is a number in here. Change a value, save, the dev server hot-reloads.
 */

export const CONFIG = {
  /** Overall art direction. Tweak these first. */
  mood: {
    /** Brightness of the whole scene (kept low so the neon pops). */
    exposure: 1.05,
    /** Render distance (meters). */
    viewDistance: 600,
    /** Night haze — fades the alley's far end + skyline into a neon glow. */
    fogDensity: 0.011,
    /** Cold moon height: 0 = on the horizon, 1 = overhead. */
    moonElevation: 0.62,
  },

  /** Night sky gradient (a big inward-facing dome). */
  sky: {
    top: '#05060f', // deep space-blue overhead
    horizon: '#241a3a', // the city's light pollution smeared on the clouds
    bottom: '#0a0b16', // dark ground haze
    intensity: 0.6,
  },

  /** Image-based lighting — cool and dim, so paper holds its shape in the dark. */
  ibl: {
    sky: '#2a3358',
    ground: '#140a1e',
    intensity: 0.5,
  },

  /** The construction-paper palette. */
  palette: {
    asphalt: '#15151d', // the wet road
    puddle: '#0c0d16', // darker, glassier water
    curb: '#23232d',
    /** Concrete facade variants (matte cardstock). */
    concrete: ['#23232c', '#2b2733', '#1d1f2a', '#2c2733', '#262430'],
    trim: '#34343f',
    metal: '#2b2d35',
    metalDark: '#191a20',
    rust: '#5a3a2c',
    /** Glowing neon inks. */
    neon: {
      magenta: '#ff2d95',
      cyan: '#1ee4ff',
      blue: '#3a6bff',
      pink: '#ff61c3',
      green: '#3dff8b',
      amber: '#ffb24a',
      red: '#ff3b4e',
      purple: '#b14bff',
    },
    /** Lit-window glows. */
    windowWarm: '#ffc879',
    windowCyan: '#86e8ff',
    windowMagenta: '#ff86d4',
    windowOff: '#101019',
  },

  /** The alley itself. It runs along Z; you start near the dead end (+Z). */
  alley: {
    halfWidth: 3.4, // half the gap between the two rows of buildings
    front: -30, // open end (z) — skyline lies beyond
    back: 30, // dead-end (z) with the hero sign
    seed: 71,
  },

  /** The buildings that wall in the alley. */
  buildings: {
    perSide: 7,
    minHeight: 16,
    maxHeight: 42,
    depthMin: 7, // footprint along Z
    depthMax: 12,
    outwardMin: 8, // footprint into X, away from the alley
    outwardMax: 16,
  },

  /** Lit-window grids on the facades. */
  windows: {
    spacing: 1.7,
    width: 0.7,
    height: 0.95,
    litChance: 0.6, // fraction that glow; the rest are dark
  },

  /** The fogged megacity beyond the open end. */
  skyline: {
    towers: 80,
    windowDots: 360,
    spreadX: 220, // how wide the skyline fans out
    nearZ: -44,
    farZ: -150,
  },

  /** Neon signage stapled to the walls. */
  neon: {
    signsPerSide: 9,
    bladeChance: 0.4, // signs that jut out perpendicular into the alley
    flickerChance: 0.32, // signs with a broken, buzzing flicker
  },

  /** Street clutter. */
  props: {
    crates: 16,
    barrels: 9,
    toxicBarrels: 3, // the ones glowing green
    trashBags: 14,
    lanterns: 18, // strung paper lanterns / bulbs
    cables: 7, // wires sagging across the alley
    grab: 5, // glowing things you can pick up
  },

  /** Falling rain confined to the alley volume. */
  rain: {
    count: 300,
    speed: 24,
    color: '#adbfe0',
    slant: 0.12,
  },

  /** Steam rising from the street gratings. */
  steam: {
    vents: 5,
    puffsPerVent: 4,
  },
} as const;
