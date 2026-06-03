/**
 * One place to steer the whole vibe.
 *
 * You don't have to touch any of the detailed geometry code — almost every
 * "feeling" of the scene (time of day, how high up you are, how dense the
 * city is, how frosted the glass looks) is a number in here. Change a value,
 * save, and the dev server hot-reloads.
 *
 * Colors are written as hex strings for readability and converted where needed.
 */

export const CONFIG = {
  /** Overall art direction. Tweak these first. */
  mood: {
    /** How high above the city the penthouse floats, in meters (storeys ≈ this / 3). */
    altitude: 220,
    /** Master glass translucency. 0 = invisible, 1 = solid frosted. */
    glassOpacity: 0.32,
    /** Frostiness of the glass. 0 = mirror-clear, 1 = heavily sandblasted. */
    frost: 0.22,
    /** Thickness of the atmospheric haze. Higher = dreamier, hides the far city. */
    haze: 0.7,
  },

  /** Sky gradient (a big inward-facing dome). Twilight-over-a-city by default. */
  sky: {
    top: '#1a1640', // deep indigo overhead
    horizon: '#ff8f6b', // warm sunset band at eye level
    bottom: '#0b0a1e', // dim violet below
    intensity: 1.0,
  },

  /** Image-based lighting — what the glass reflects. Soft, so highlights stay gentle. */
  ibl: {
    sky: '#cdd2ff',
    ground: '#3a2f4d',
    intensity: 1.15,
  },

  /** The frosted-glass palette. Buildings + decor pick randomly from these tints. */
  palette: {
    glassTints: ['#bfe9ff', '#d8c6ff', '#ffc8e6', '#c6fff0', '#fff2c6'],
    structure: '#eaf2ff', // columns, mullions, railings
    accent: '#7fe3ff', // glowing edges / centerpiece
  },

  /** The penthouse room you start inside. */
  room: {
    radius: 7.5, // interior radius (meters)
    wallHeight: 3.6,
    ringWidth: 1.6, // width of the see-through glass floor band at the windows
    columns: 12, // evenly spaced glass mullions around the glass wall
  },

  /** The stylised cityscape far below. */
  city: {
    seed: 7,
    extent: 320, // half-width of the city grid (meters)
    spacing: 16, // distance between building lots
    clearing: 90, // empty radius directly under you (so you see straight down)
    maxHeight: 170, // tallest downtown towers
    minHeight: 14,
    jitter: 5, // random lot offset so the grid doesn't look perfect
  },

  /** Floating grab-able glass crystals scattered around the room. */
  decor: {
    crystals: 9,
    bobAmplitude: 0.06, // how far they bob up/down (meters)
    bobSpeed: 0.8,
  },
} as const;
