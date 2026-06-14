/**
 * One place to steer the whole vibe — a papercraft western desert at golden
 * hour: folded-paper dunes, layered red-rock mesas, saguaro cacti, and
 * tumbleweeds rolling on the wind.
 *
 * You don't have to touch the geometry code. Almost every "feeling" of the
 * scene is a number in here. Change a value, save, the dev server hot-reloads.
 */

export const CONFIG = {
  /** Overall art direction. Tweak these first. */
  mood: {
    /** Sun height: 0 = on the horizon (long dramatic shadows), 1 = overhead. */
    sunElevation: 0.22,
    /** Brightness of the whole scene. */
    exposure: 1.0,
    /** Dusty warm haze that fades the far mesas into the horizon. */
    haze: 0.5,
    /** Render distance (meters). */
    viewDistance: 1500,
  },

  /** Warm golden-hour sky gradient (a big inward-facing dome). */
  sky: {
    top: '#5f93cf', // warm daytime blue overhead
    horizon: '#f6cf94', // golden dust band at the horizon
    bottom: '#caa676', // sandy glow below
    intensity: 1.0,
  },

  /** Image-based lighting — warm, so paper surfaces glow at golden hour. */
  ibl: {
    sky: '#ffe9c6',
    ground: '#a98353',
    intensity: 1.05,
  },

  /** The construction-paper palette. */
  palette: {
    sandLight: '#e8c992', // dune tops
    sandDark: '#cda86e', // dune hollows
    sun: '#ffdf8a',
    /** Layered mesa / rock colours, from base to cap (cardstock strata). */
    rockStrata: ['#a85638', '#c06b41', '#cf8350', '#b85a3a', '#9d4a30'],
    boulder: ['#bd7048', '#a9603c', '#caa06a'],
    cactus: '#6f9a5b',
    cactusDark: '#5b8049',
    flower: '#ec6a86',
    tumbleweed: ['#b59257', '#9a7842', '#caa978'],
    wood: '#875432',
    bone: '#ece2cb',
  },

  /** The folded-paper ground. */
  terrain: {
    seed: 23,
    size: 240, // width of the desert (meters)
    segments: 56, // facet density (lower = chunkier paper folds)
    duneHeight: 3.2, // dune amplitude
    flatRadius: 14, // level clearing around where you start
  },

  /** Scattered boulders + the big horizon mesas. */
  rocks: {
    boulders: 64,
    mesas: 7,
    mesaRingMin: 70, // mesas live out toward the horizon
    mesaRingMax: 112,
  },

  /** Cacti. */
  cacti: {
    saguaro: 11, // the tall armed ones
    barrel: 8, // short round ones
    pricklyPear: 7, // stacked pads
    clearRadius: 9, // keep them away from your feet
  },

  /** The rolling plants. Wind blows them mostly along +X. */
  tumbleweeds: {
    count: 9,
    windSpeed: 2.6,
    radius: 0.55,
  },

  /** Grab-able paper rocks you can pick up and toss. */
  decor: {
    grabRocks: 5,
  },
} as const;
